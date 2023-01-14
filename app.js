const express = require("express");
const ethers = require("ethers");
const Web3 = require("web3");
const DintTokenAbBI = require("./DintTokenABI.json");
require("dotenv").config({ path: `.env.local`, override: true });
const bodyParser = require("body-parser");
const cors = require("cors");
const { Client } = require("pg");
const dintDistributerABI = require("./DintDistributerABI.json");
const fernet = require("fernet");

const app = express();
const PORT = 5000;
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(bodyParser.json());

app.use(cors());
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

// Custom Middleware
app.use((req, res, next) => {
  let validIps = ["::12", "::1", "::ffff:127.0.0.1"]; // Put your IP whitelist in this array
  console.log("process", typeof process.env.whitelistIp);
  console.log("req.socket.remoteAddress", req.socket.remoteAddress);
  if (process.env.whitelistIp === "inactive") {
    console.log("IP ok");
    next();
  } else if (validIps.includes(req.socket.remoteAddress)) {
    next();
  } else {
    // Invalid ip
    console.log("Bad IP: " + req.socket.remoteAddress);
    const err = new Error("Bad IP: " + req.socket.remoteAddress);
    next(err);
  }
});
// Error handler
app.use((err, req, res, next) => {
  console.log("Error handler", err);
  res.status(err.status || 500);
  res.send("get your ip whitelisted for accessing this");
});

const DintTokenAddress = process.env.DINT_TOKEN_ADDRESS;
const DintDistributerAddress = process.env.DINT_DIST_ADDRESS;
const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
const web3 = new Web3(process.env.RPC_PROVIDER);

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_PROVIDER);

const ownerSigner = new ethers.Wallet(ownerPrivateKey, provider);

const generate = async (data, amount) => {
  const nonce = 0;
  if (amount >= 0) {
    const signer = new ethers.Wallet(data.userPrivateKey, provider);
    const contract = new ethers.Contract(
      DintTokenAddress.toLowerCase(),
      DintTokenAbBI,
      ownerSigner
    );
    const domainName = "dint"; // token name
    const domainVersion = "MMT_0.1";
    const chainId = 80001; // this is for the chain's ID.
    const contractAddress = DintTokenAddress.toLowerCase();
    const spender = DintDistributerAddress.toLowerCase();
    const deadline = 2673329804;
    var account = data.userAddress.toLowerCase();
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

    if (currentApproval.toNumber() === 0) {
      const value = amount;
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
      const res = await contract.permit(
        account,
        spender,
        value,
        deadline,
        sig.v,
        sig.r,
        sig.s,
        { gasLimit: 1000000, gasPrice: 30000000000 }
      );
      console.log("Approval Hash", res.hash);
      send(data, amount);
    } else {
      const currentnonce = await contract.nonces(account);
      const newNonce = currentnonce.toNumber();
      const permit = {
        owner: account,
        spender,
        value: 0,
        nonce: newNonce,
        deadline,
      };
      const generatedSig = await signer._signTypedData(
        domain,
        { Permit: Permit },
        permit
      );
      let sig = await ethers.utils.splitSignature(generatedSig);
      const res = await contract.permit(
        account,
        spender,
        0,
        deadline,
        sig.v,
        sig.r,
        sig.s,
        { gasLimit: 1000000, gasPrice: 30000000000 }
      );
      const value = amount;
      const permitNew = {
        owner: account,
        spender,
        value: amount,
        nonce: newNonce + 1,
        deadline,
      };
      const generatedNewSig = await signer._signTypedData(
        domain,
        { Permit: Permit },
        permitNew
      );
      let sigNew = await ethers.utils.splitSignature(generatedNewSig);
      const resPermit = await contract.permit(
        account,
        spender,
        value,
        deadline,
        sigNew.v,
        sigNew.r,
        sigNew.s,
        { gasLimit: 1000000, gasPrice: 30000000000 }
      );
      console.log("Approval Hash", resPermit.hash);
    }
  }
};

const send = async (data, amount) => {
  const dintDistContract = new ethers.Contract(
    DintDistributerAddress.toLowerCase(),
    dintDistributerABI,
    ownerSigner
  );
  await dintDistContract
    .sendDint(data.userAddress, data.recieverAddress, amount, {
      gasLimit: 1000000,
      gasPrice: 30000000000,
    })
    .then((res) => {
      console.log("Transaction Hash", res.hash);

      // const filter = {
      //   address: DintDistributerAddress,
      //   topics: [
      //     "0x94793dae1b41ddf18877c1fd772483f743aaa443d4d9052721cef45379dca65f",
      //   ],
      // };
      // provider.on(filter, async (data) => {
      //   console.log("data123", data);
      // });
    });
};

const getData = async (sender_id, reciever_id, amount) => {
  return new Promise((resolve, reject) => {
    client.query(
      `select wallet_private_key, wallet_address, id from auth_user where id = ${sender_id} or id = ${reciever_id};`,
      async (err, res) => {
        if (err) console.log(err.stack);
        else {
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
        }
      }
    );
  });
};

app.post("/api/send-dint/:apiKey", async (req, res) => {
  if (req.params.apiKey !== process.env.SECURITY_KEY) {
    return res.send({ success: false, message: "invalid api key" });
  }
  if (!process.env.OWNER_PRIVATE_KEY) {
    return res.send({ success: false, message: "private key not found" });
  }
  const { sender_id, reciever_id, amount } = req.body;

  try {
    getData(sender_id, reciever_id, amount).then((data) => {
      generate(data, amount);
    });

    res.send(req.body);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

app.listen(PORT, (error) => {
  if (!error)
    console.log(
      "Server is Successfully Running, and App is listening on port " + PORT
    );
  else console.log("Error occurred, server can't start", error);
});
