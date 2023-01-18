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
  let validIps = ["::12", "::1", "::ffff:127.0.0.1", process.env.WHITELIST_IP]; // Put your IP whitelist in this array
  console.log("ip", validIps);
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
// const a = ethers.utils.defaultAbiCoder.decode(
//   ["address", "address", "address"],
//   "0x4a6728b900000000000000000000000078191244b4f21d1e034a7fb4b3bb3294c9aa5d39000000000000000000000000d0f5c2cd900ff5cf9ea3f3eae28fc094fd5fc3b8000000000000000000000000000000000000000000000000000000000000000a"
// );
// console.log("event=====", a);
const a = provider.getTransaction(
  "0x01c9513a7559fa74f173cf1db0ed912e86f088594d53e02b2954445d2af4665f"
);
try {
} catch (err) {
  console.log(err);
}

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
      return new Promise((resolve, reject) => {
        contract
          .permit(account, spender, value, deadline, sig.v, sig.r, sig.s, {
            gasLimit: 1000000,
            gasPrice: 30000000000,
          })
          .then((res) => {
            console.log("Approval Hash", res.hash);
            send(data, amount)
              .then((data) => {
                resolve(data);
              })
              .catch((err) => {
                reject(err);
              });
          })
          .catch((err) => reject(err));
      });
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

      let sigNew = ethers.utils.splitSignature(generatedNewSig);
      return new Promise((resolve, reject) => {
        contract
          .permit(
            account,
            spender,
            value,
            deadline,
            sigNew.v,
            sigNew.r,
            sigNew.s,
            { gasLimit: 1000000, gasPrice: 30000000000 }
          )
          .then((res) => {
            console.log("Approval Hash", res.hash);
            send(data, amount)
              .then((data) => {
                resolve(data);
              })
              .catch((err) => {
                reject(err);
              });
          })
          .catch((err) => {
            reject(err);
          });
      });
    }
  }
};

const send = async (data, amount) => {
  const dintDistContract = new ethers.Contract(
    DintDistributerAddress.toLowerCase(),
    dintDistributerABI,
    ownerSigner
  );
  return new Promise((resolve, reject) => {
    dintDistContract
      .sendDint(data.userAddress, data.recieverAddress, amount, {
        gasLimit: 1000000,
        gasPrice: 30000000000,
      })

      .then(
        async (res) => {
          console.log("Transaction Hash", res);

          // const filter = {
          //   address: DintDistributerAddress,
          //   topics: [
          //     "0x94793dae1b41ddf18877c1fd772483f743aaa443d4d9052721cef45379dca65f",
          //   ],
          // };
          // provider.on(filter, async (data, err) => {
          //   console.log("data123", data);
          //   console.log("errrr", err);
          //   const txnResponse = data;
          //   resolve(txnResponse);
          //   // const add = ethers.utils.defaultAbiCoder.decode(
          //   //   ["address", "address"],
          //   //   data.data
          //   // );
          //   // console.log("event=====", add);
          // });
          resolve({res, data});
        },
        (err) => {
          console.log("err", err);
        }
      )
      .catch((err) => {
        console.log("err", err);
        reject(err);
      });
  });
};

const getData = async (sender_id, reciever_id, amount) => {
  return new Promise((resolve, reject) => {
    client
      .query(
        `select wallet_private_key, wallet_address, id from auth_user where id = ${sender_id} or id = ${reciever_id};`
      )
      .then((res) => {
        console.log("res", res)
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

app.post("/api/send-dint/", async (req, res) => {
  // console.log("req.headers", req.headers.apikey=== process.env.SECURITY_KEY);
  if (req.headers.apikey !== process.env.SECURITY_KEY) {
    console.log("req.headers", req.headers.apikey === process.env.SECURITY_KEY);

    return res.send({ success: false, message: "invalid api key" });
  }
  if (!process.env.OWNER_PRIVATE_KEY) {
    return res.send({ success: false, message: "private key not found" });
  }
  const { sender_id, reciever_id, amount } = req.body;

  try {
    getData(sender_id, reciever_id, amount)
      .then((data) => {
        console.log("data", data);
        generate(data, amount)
          .then((data) => {
            console.log("txn data", data);
            // if (data.data) {
            //   const users = ethers.utils.defaultAbiCoder.decode(
            //     ["address", "address"],
            //     data.data
            //   );
            //   const sender = users[0];
            //   const reciever = users[1];
              return res.send({
                success: true,
                Hash: data.res.hash,
                sender: data.data.userAddress,
                reciever: data.data.recieverAddress,
                amount: amount,
              });
            // } else {
            //   return res.send("Something went wrong. Please try again");
            // }
          })
          .catch((err) => {
            return res.send({success: false, message: "Something went wrong while making transaction. Please try again!", error: err});
          });
      })
      .catch((error) => {
        console.log("err", error);
        return res.send({sucess: false, message: "Something went wrong while getting user data."});
      });
  } catch (error) {
    res.status(500).json({ sucess: false, message: "Something went wrong. Please try again!" });
  }
});

app.listen(PORT, (error) => {
  if (!error)
    console.log(
      "Server is Successfully Running, and App is listening on port " + PORT
    );
  else console.log("Error occurred, server can't start", error);
});
