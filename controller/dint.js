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


const generate = async (data, amount) => {
    const signer = new ethers.Wallet(data.userPrivateKey, provider); // create a signer instance using the user's private key
    const contract = new ethers.Contract(
      DintTokenAddress.toLowerCase(), // the address of the token contract
      DintTokenAbBI, // the ABI (Application Binary Interface) of the token contract
      ownerSigner // the owner's signer instance used for non-constant functions
    );
    const domainName = "Dint"; // token name
    const domainVersion = "MMT_0.1"; // token version
    const chainId = 137; // this is for the chain's ID.
    const contractAddress = DintTokenAddress.toLowerCase(); // the address of the token contract
    const spender = DintDistributerAddress.toLowerCase(); // the address of the contract that will spend the user's tokens
    const deadline = 2673329804; // deadline timestamp in seconds since Unix epoch (Monday, January 1, 1970)
    
    var account = data.userAddress.toLowerCase();  // the address of the user
    const domain = {
      name: domainName,
      version: domainVersion,
      verifyingContract: contractAddress.toLowerCase(),
      chainId,
    };

    const domainType = [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ];
    const Permit = [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ];
    const currentApproval = await contract.allowance(
      data.userAddress,
      DintDistributerAddress
    );

      console.log(`Current approval (${currentApproval}) `);

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
      

 // Get the current gas price
 let gasPrice = await getGasPrice();
 console.log("Gas Price for permit:", gasPrice.toString());

 // Set the gas limit to 600,000 units
 const gasLimit = ethers.utils.parseUnits('75000', 'wei');

  // Get the nonce for the transaction
  const nonce = await signer.getTransactionCount("latest");
  console.log("Nonce for permit:", nonce); 


if (Number(currentApproval) >= 0) {
      const value = BigInt(
        Number(ethers.utils.parseUnits(amount.toString(), "ether")) // convert the amount to Wei (smallest unit of Ether)
      );

      const currentnonce = await contract.nonces(account);
      const newNonce = currentnonce.toNumber();
      const permit = {
        owner: account,
        spender,
        value,
        nonce: newNonce,
        deadline,
      };
      const generatedSig = await signer._signTypedData(
        domain,
        { Permit: Permit },
        permit
      );
     let sig = await ethers.utils.splitSignature(generatedSig);

    
 // Get the nonce for the transaction
 const nonce = await signer.getTransactionCount("latest");
 console.log("Nonce:", nonce);


      return new Promise(async (resolve, reject) => {
        contract
          .permit(account, spender, value, deadline, sig.v, sig.r, sig.s, {
            gasLimit: gasLimit,
            gasPrice: gasPrice,
          })
          .then((res) => {
            console.log("Approval Hash", res.hash);
            send(data, value)
              .then((data) => {
                resolve(data);
              })
              .catch((err) => {
                reject(err);
              });
          })
          .catch((err) => {
            console.log("err permit", err);
            reject(err);
          });
      });
    } else {
      const currentnonce = await contract.nonces(account);
      const newNonce = currentnonce.toNumber();
      const permit = {
        owner: account,
        spender,
        value,
        nonce: newNonce,
        deadline,
      };
      const generatedSig = await signer._signTypedData(
        domain,
        { Permit: Permit },
        permit
      );
      let sig = await ethers.utils.splitSignature(generatedSig);

      try {
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
      console.log("Approval Hash", res.hash);
      send(data, value)
        .then((data) => {
          resolve(data);
        })
        .catch((err) => {
          reject(err);
        });
    } catch (err) {
      console.log("err permit", err);
  
  // check if the error is a 'transaction underpriced' error
  if (err.code === ethers.utils.Logger.errors.REPLACEMENT_UNDERPRICED) {
    // Get the new gas price
    gasPrice = await getGasPrice();
    console.log("New Gas Price for permit:", gasPrice.toString());

    // Get the new nonce
    const newNonce = await signer.getTransactionCount("latest");
    console.log("New Nonce for permit:", newNonce);

    // Resubmit the transaction with the new gas fee and nonce
    const resubmit = await contract.permit(
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
        nonce: newNonce
      }
    );
if (err.errorType === "REPLACEMENT_UNDERPRICED") {
  console.log("we need to retry with higher fees");
}


    console.log("Resubmitted Approval Hash", resubmit.hash);
    send(data, value)
      .then((data) => {
        resolve(data);
      })
      .catch((err) => {
        reject(err);
      });
  } else {
    reject(err);
  }

      const value = BigInt(
        Number(ethers.utils.parseUnits(amount.toString(), "ether"))
      );
      const permitNew = {
        owner: account,
        spender,
        value,
        nonce: newNonce + 1,
        deadline,
      };
      const generatedNewSig = await signer._signTypedData(
        domain,
        { Permit: Permit },
        permitNew
      );

      let sigNew = ethers.utils.splitSignature(generatedNewSig);
      return new Promise(async (resolve, reject) => {
       
       
        try {
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
          console.log("Approval Hash", res.hash);
          send(data, value)
            .then((data) => {
              resolve(data);
            })
            .catch((err) => {
              reject(err);
            });
        } catch (err) {
          console.log("err permit", err);
          
          // retry the permit function for all other errors
          permit(data, amount)
            .then((data) => {
              resolve(data);
            })
            .catch((err) => {
              reject(err);
            });
          }}
      
      );
    }}
  };




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