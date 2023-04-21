const Web3 = require('web3');
const { Client } = require("pg");
const ethers = require("ethers");
const DintTokenAddress = process.env.DINT_TOKEN_ADDRESS;
const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_PROVIDER);
const ownerSigner = new ethers.Wallet(ownerPrivateKey, provider);
const DintTokenAbBI = require("../DintTokenABI.json");

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
// Create a web3 instance for Polygon mainnet
// const web3 = new Web3('https://rpc-mainnet.matic.network');
// Define a map to store the latest nonces for each address
const latestNonces = new Map();
// Define a function to retrieve the latest nonce for an address from the database
function getLatestNonce(address) {
  return new Promise((resolve, reject) => {
    const query = `SELECT nonce FROM nonces WHERE address = '${address}'`;
    client.query(query, (error, results) => {
      if (error) {
        reject(error);
        return;
      }
      if (results.length === 0) {
        resolve(null);
        return;
      }
      const nonce = results[0].nonce;
      resolve(nonce);
    });
  });
}
// Define a function to update the latest nonce for an address in the database
function updateLatestNonce(address, nonce) {
  const query = `UPDATE nonces SET nonce = ${nonce} WHERE address = '${address}'`;
  client.query(query, (error, results) => {
    if (error) {
      console.error(error);
      return;
    }
    console.log(`Nonce for address ${address} updated in database`);
  });
}
// Define a function to retrieve the nonce for an address
async function getNonce(address) {
  // Check if we already have the latest nonce for this address in memory
  const latestNonce = latestNonces.get(address);
  if (latestNonce !== undefined) {
    return latestNonce;
  }
  // Otherwise, retrieve the latest nonce from the database
  const storedNonce = await getLatestNonce(address);
  if (storedNonce !== null) {
    // If the nonce was found in the database, store it in memory and return it
    latestNonces.set(address, storedNonce);
    return storedNonce;
  }
  // If the nonce was not found in the database, retrieve it from the network
  // const nonce = await web3.eth.getTransactionCount(address);

  const contract = new ethers.Contract(
    DintTokenAddress.toLowerCase(),
    DintTokenAbBI,
    ownerSigner
  );
  const nonce = await contract.nonces(account);
  // Store the nonce in the database and in memory
  updateLatestNonce(address, nonce);
  latestNonces.set(address, nonce);
  return nonce;
}


module.exports = { getNonce };
