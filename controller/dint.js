const ethers = require("ethers");
const Web3 = require("web3");
const DintTokenAbBI = require("../DintTokenABI.json");
// require("dotenv").config({ path: `../env.local`, override: true });
require("dotenv").config();
const { Client } = require("pg");
const dintDistributerABI = require("../DintDistributerABI.json");
const fernet = require("fernet");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const axios = require('axios');
const express = require("express");
const app = express();
const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
client.connect(function (err) {
  if (err) throw err;
  console.log("Connected!");
});

const DintTokenAddress = process.env.DINT_TOKEN_ADDRESS;
const DintDistributerAddress = process.env.DINT_DIST_ADDRESS;
const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
const web3 = new Web3(process.env.RPC_PROVIDER);
// const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_PROVIDER);

const ownerSigner = new ethers.Wallet(ownerPrivateKey, provider);

async function sendPermitWithRetry(account, spender, amount, deadline, chainId, gasLimit, gasPrice) {
  const domain = getDomain(chainId);
  const Permit = getPermitType(domain);
  const signer = getSigner();
  const contract = getContract();
  const value = BigInt(Number(ethers.utils.parseUnits(amount.toString(), "ether")));

  let newNonce = await contract.nonces(account);

  const permit = {
    owner: account,
    spender,
    value,
    nonce: newNonce,
    deadline,
  };

  const generatedSig = await signer._signTypedData(domain, { Permit: Permit }, permit);
  let sig = ethers.utils.splitSignature(generatedSig);

  const res = await contract.permit(
    account,
    spender,
    value,
    deadline,
    sig.v,
    sig.r,
    sig.s,
    {
      gasLimit: gasLimit,
      gasPrice: gasPrice,
    }
  );

  const txHash = res.hash;
  console.log("Approval Hash", txHash);
  console.log("Value", value);

  let retryCount = 0;
  while (true) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt && receipt.status === 1) {
        console.log("Permit transaction successful");
        return send(data, value);
      } else {
        console.log("Permit transaction failed, retrying...");
        // Increase the gas price by 10% and resend the transaction
        gasPrice = gasPrice.mul(110).div(100);
        const permitNew = {
          owner: account,
          spender,
          value,
          nonce: newNonce + 1,
          deadline,
        };
        const generatedNewSig = await signer._signTypedData(domain, { Permit: Permit }, permitNew);
        let sigNew = ethers.utils.splitSignature(generatedNewSig);

        const resNew = await contract.permit(
          account,
          spender,
          value,
          deadline,
          sigNew.v,
          sigNew.r,
          sigNew.s,
          {
            gasLimit: gasLimit,
            gasPrice: gasPrice,
          }
        );
        txHash = resNew.hash;
        console.log("New Approval Hash", txHash);
        console.log("New Gas Price", gasPrice.toString());
        retryCount++;
        if (retryCount >= 10) {
          throw new Error("Transaction failed after 10 retries");
        }
      }
    } catch (error) {
      console.log("Error occurred while resending transaction:", error);
      throw error;
    }
    // Wait for 10 seconds before resending the transaction
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}


const getGasPrice = async () => {
  try {
    const { standard, fast } = await axios
      .get("https://gasstation-mainnet.matic.network/")
      .then((res) => res.data);

    const fee = fast;
    return ethers.utils.parseUnits(fee.toFixed(2).toString(), "gwei");
  } catch (error) {
    console.log("gas error");
    console.error(error);
    return ethers.utils.parseUnits("220", "gwei");
  }
};

   
const send = async (data, value) => {
  try {
    const priceInUSD = 1000000;
    const gasLimit = ethers.utils.parseUnits('2500000', 'wei');
    let nonce = await ownerSigner.getTransactionCount('pending');
    let gasPrice = await getGasPrice();
    let attempt = 1;
    let txHash = null;

    while (!txHash) {
      try {
        const dintDistContract = new ethers.Contract(
          DintDistributerAddress.toLowerCase(),
          dintDistributerABI,
          ownerSigner
        );

        const tx = await dintDistContract.sendDint(
          data.userAddress,
          data.recieverAddress,
          value,
          priceInUSD,
          {
            nonce: nonce,
            gasLimit: gasLimit,
            gasPrice: gasPrice,
          }
        );

        console.log("Transaction Sent Successfully");
        console.log("Transaction Hash:", tx.hash);
        console.log("Dint Price:", priceInUSD);
        txHash = tx.hash;

        const receipt = await tx.wait();
        gasPrice = receipt.effectiveGasPrice;

        console.log("Transaction Receipt:", receipt);
        console.log("Transaction completed successfully!");
      } catch (error) {
        console.log(`Attempt ${attempt}: ${error.message}`);
        attempt++;

        if (error.reason === 'replacement' || error.code === 'TRANSACTION_REPLACED') {
          console.log("There was an issue with your transaction. Transaction was replaced");
          return { error };
        } else if (error.message.includes("replacement transaction underpriced")) {
          gasPrice = await getGasPrice();
          console.log("New Gas Price:", gasPrice.toString());
        } else if (error.message.includes("nonce too low")) {
          nonce = await ownerSigner.getTransactionCount('pending');
          console.log("New Nonce:", nonce);
        } else if (error.message.includes("insufficient funds")) {
          console.log(`Error: ${error.message}`);
          return { error };
        } else if (error.message.includes("transfer amount exceeds allowance")) {
          console.log(`Error: ${error.message}`);
          return { error };
        } else {
          throw error;
        }
      }
    }

    return { txHash };
  } catch (error) {
    console.log("There was an issue processing your transaction.");
    console.log("Error:", error);
    return { error };
  }
};



const getData = async (sender_id, reciever_id, amount) => {
  return new Promise((resolve, reject) => {
    client
      .query(
        `select wallet_private_key, wallet_address, id from auth_user where id = ${sender_id} or id = ${reciever_id};`
      )
      .then((res) => {
        const data = res.rows;
        let sender = data.find((el) => {
          return el.id === sender_id;
        });
        let reciever = data.find((el) => {
          return el.id === reciever_id;
        });
        const secret = new fernet.Secret(process.env.ENCRYPTION_KEY);
        const bufUserPvt = Buffer.from(sender.wallet_private_key);
        const tokenUserPvt = new fernet.Token({
          secret: secret,
          token: bufUserPvt.toString(),
          ttl: 0,
        });
        const userPrivateKey = tokenUserPvt.decode();
        const bufUserAdd = Buffer.from(sender.wallet_address);
        const tokenUserAdd = new fernet.Token({
          secret: secret,
          token: bufUserAdd.toString(),
          ttl: 0,
        });
        const userAddress = tokenUserAdd.decode();
        const bufRecieverAdd = Buffer.from(reciever.wallet_address);
        const tokenRecieverAdd = new fernet.Token({
          secret: secret,
          token: bufRecieverAdd.toString(),
          ttl: 0,
        });
        const recieverAddress = tokenRecieverAdd.decode();
        resolve({ userPrivateKey, userAddress, recieverAddress });
      })
      .catch((error) => {
        console.log(error.stack);
        reject(error.stack);
      });
  });
};

const checkout = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const charge = await stripe.charges.create({
    receipt_email: req.body.email,
    amount: parseInt(req.body.amount) * 100, //USD*100
    currency: "usd",
    card: req.body.cardDetails.card_id,
    customer: req.body.cardDetails.customer_id,
    metadata: { walletAddr: req.body.walletAddr },
  });
  res.send(charge);
};

module.exports = { getData, generate, checkout };