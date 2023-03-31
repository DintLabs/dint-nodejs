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

  async function getGasPrice() {
    try {
      const response = await axios.get('https://gasstation-mainnet.matic.network');
      if (response.data && response.data.fast) {
        return ethers.utils.parseUnits(response.data.fast.toString(), 'gwei');
      }
    } catch (error) {
      console.log('Error getting gas price:', error);
    }
    // Return a default gas price if unable to get one from the API
    return ethers.utils.parseUnits('200', 'gwei');
  }

  const signer = new ethers.Wallet(data.userPrivateKey, provider);
  const contract = new ethers.Contract(
    DintTokenAddress.toLowerCase(),
    DintTokenAbBI,
    ownerSigner
  );

  // Constants
  const domainName = "Dint"; // token name
  const domainVersion = "MMT_0.1";
  const chainId = 137; // this is for the chain's ID.
  const contractAddress = DintTokenAddress.toLowerCase();
  const spender = DintDistributerAddress.toLowerCase();
  const deadline = 2673329804;
  const account = data.userAddress.toLowerCase();
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

  const domain = {
    name: domainName,
    version: domainVersion,
    verifyingContract: contractAddress.toLowerCase(),
    chainId,
  };

  const currentApproval = await contract.allowance(data.userAddress, DintDistributerAddress);
  console.log(`Current approval (${currentApproval}) `);

  const value = ethers.utils.parseEther(amount.toString());

  const currentNonce = await contract.nonces(account);
  const newNonce = currentNonce.toNumber();

  const permit = {
    owner: account,
    spender,
    value,
    nonce: newNonce,
    deadline,
  };

  const signature = await signer._signTypedData(domain, { Permit: Permit }, permit);
  const { v, r, s } = ethers.utils.splitSignature(signature);

  const gasPrice = await getGasPrice();
  console.log("Gas Price:", gasPrice.toString());

  let gasLimit;
  let tx;
  let attempt = 1;
  while (attempt <= 3) {
    try {
      console.log("Calling permit function... Attempt", attempt);
      tx = await contract.permit(account, spender, value, deadline, v, r, s, {
        gasLimit: gasLimit,
        gasPrice: gasPrice,
      });
      console.log("Approval Hash", tx.hash);
      const receipt = await tx.wait();
      console.log("Permit transaction receipt:", receipt);
      const result = await send(data, value);
      return result;
    } catch (error) {
      console.log("err permit", error.message);
      if (error.code === 'REPLACEMENT_UNDERPRICED') {
        console.log("Insufficient gas fees, retrying with higher gas fees...");
        gasPrice = await getGasPrice(); // Get a new gas price
        gasLimit = await tx.gasLimit.mul(2); // Increase gas limit by 2x
        attempt++;
      } else {
        console.log("err permit", error);
        throw error;
      }
    }
  }

  console.log("Maximum number of attempts reached.");
  throw new Error("Failed to generate permit.");
}


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