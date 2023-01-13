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
// let UserAddress;
// let userPrivateKey;
const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
const web3 = new Web3(
  "https://polygon-mumbai.g.alchemy.com/v2/ZAh-n81Q9OudAr1YvmaA0QG5gmbQmEna"
);

const provider = new ethers.providers.JsonRpcProvider(
  "https://polygon-mumbai.g.alchemy.com/v2/ZAh-n81Q9OudAr1YvmaA0QG5gmbQmEna"
);

const ownerSigner = new ethers.Wallet(ownerPrivateKey, provider);
// const contract = new ethers.Contract(
//   DintTokenAddress.toLowerCase(),
//   DintTokenAbBI,
//   signer
// );

const getUserDetails = async (transactionData) => {
  console.log("userdetails", transactionData);

  client.query(
    `select wallet_private_key from auth_user where id = ${transactionData.id};`,
    (err, res) => {
      if (err) console.log(err.stack);
      else {
        console.log(res.rows);
      }
    }
  );
};
const gnerate = async (
  userPrivateKey,
  UserAddress,
  recieverAddress,
  amount
) => {
  const nonce = 0;
  if (amount >= 0) {
    const contract = new ethers.Contract(
      DintTokenAddress.toLowerCase(),
      DintTokenAbBI,
      ownerSigner
    );

    const domainName = "dint"; // put your token name
    const domainVersion = "MMT_0.1"; // leave this to "1"
    const chainId = 80001; // this is for the chain's ID. value is 1 for remix
    const contractAddress = DintTokenAddress.toLowerCase();
    const spender = DintDistributerAddress.toLowerCase();
    const deadline = 2673329804;
    var account = UserAddress.toLowerCase();
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

    const currentApproval = await contract.allowance(
      UserAddress,
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
      const Permit = [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ];

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
      send(value, reciever);
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
      const Permit = [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ];

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

      const updatednonce = await contract.nonces(account);
      const newUpdatedNonce = updatednonce.toNumber();

      const value = amount;
      const permitNew = {
        owner: account,
        spender,
        value: amount,
        nonce: newNonce + 1,
        deadline,
      };

      console.log("currentnonce", currentnonce.toNumber());
      const generatedNewSig = await signer._signTypedData(
        domain,
        { Permit: Permit },
        permitNew
      );

      let sigNew = await ethers.utils.splitSignature(generatedNewSig);
      console.log("sign", sigNew);

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

      send(value, reciever);
    }
  }
};

const send = async (userPrivateKey, UserAddress, recieverAddress, amount) => {
  console.log("sending Dint", value);
  // const recieverAddress = reciever;
  const dintDistContract = new ethers.Contract(
    DintDistributerAddress.toLowerCase(),
    dintDistributerABI,
    ownerSigner
  );

  const sendToken = await dintDistContract.sendDint(
    UserAddress,
    recieverAddress,
    value,
    { gasLimit: 1000000, gasPrice: 30000000000 }
  );
  console.log("Send Dint Transaction Hash", sendToken.hash);
};

const test = async (sender_id, reciever_id, amount) => {
  let userPrivateKey;
  let UserAddress;
  let recieverAddress;

  client.query(
    `select wallet_private_key from auth_user where id = ${sender_id};`,
    async (err, res) => {
      if (err) console.log(err.stack);
      else {
        var buf = Buffer.from(res.rows[0].wallet_private_key);
        var secret = new fernet.Secret(process.env.ENCRYPTION_KEY);
        var token = new fernet.Token({
          secret: secret,
          token: buf.toString(),
          ttl: 0,
        });
        userPrivateKey = token.decode();

        // console.log(token.decode());

        // console.log("userPrivateKey 1", userPrivateKey);
      }
    }
  );

  client.query(
    `select wallet_address from auth_user where id = ${sender_id};`,
    (err, res) => {
      if (err) console.log(err.stack);
      else {
        var buf = Buffer.from(res.rows[0].wallet_address);
        var secret = new fernet.Secret(process.env.ENCRYPTION_KEY);
        var token = new fernet.Token({
          secret: secret,
          token: buf.toString(),
          ttl: 0,
        });
        token.decode();

        console.log(token.decode());

        UserAddress = token.decode();
      }
    }
  );
  client.query(
    `select wallet_address from auth_user where id = ${reciever_id};`,
    (err, res) => {
      if (err) console.log(err.stack);
      else {
        var buf = Buffer.from(res.rows[0].wallet_address);
        var secret = new fernet.Secret(process.env.ENCRYPTION_KEY);
        var token = new fernet.Token({
          secret: secret,
          token: buf.toString(),
          ttl: 0,
        });
        token.decode();

        console.log(token.decode());
        recieverAddress = token.decode();
      }
    }
  );
};

app.post("/api/signature/:apiKey", async (req, res) => {
  if (req.params.apiKey !== process.env.SECURITY_KEY) {
    return res.send({ success: false, message: "invalid api key" });
  }
  if (!process.env.USER_PRIVATE_KEY) {
    return res.send({ success: false, message: "private key not found" });
  }
  const { sender_id, reciever_id, amount } = req.body;

  try {
    test(sender_id, reciever_id, amount);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong." });
  }
  // const { reciever } = req.body;
  // const { sender } = req.body
  // const { id } = req.body

  // gnerate(amount, reciever);
});

app.listen(PORT, (error) => {
  if (!error)
    console.log(
      "Server is Successfully Running, and App is listening on port " + PORT
    );
  else console.log("Error occurred, server can't start", error);
});
