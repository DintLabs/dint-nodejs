const express = require("express");
const sendDint = express.Router();
// require("dotenv").config({ path: `../env.local`, override: true });
require("dotenv").config();
const bodyParser = require("body-parser");
const { getData, generate, checkout } = require("../controller/dint");
const { approval, getUserData } = require("../controller/payout");

sendDint.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
sendDint.use(bodyParser.json());



sendDint.post("/send-dint", async (req, res, next) => {
  res.setTimeout(180000); // Set timeout to 180 seconds
  if (req.headers.apikey !== process.env.SECURITY_KEY) {
    console.log("req.headers", req.headers.apikey === process.env.SECURITY_KEY);
    return res.status(401).send({ success: false, message: "invalid api key" });
  }
  if (!process.env.OWNER_PRIVATE_KEY) {
    return res.status(500).send({ success: false, message: "private key not found" });
  }

  const { sender_id, reciever_id, amount, priceInUSD } = req.body;

  try {
    const data = await getData(sender_id, reciever_id, amount, priceInUSD);
    generate(data, amount)
      .then((payload) => {
        console.log("Generated payload:", payload);
        console.log("Data variable:", data);
        res.status(201).send({
          success: true,
          Hash: payload.txHash,
          sender: payload.senderAddress,
          receiver: payload.recieverAddress,
          amount: amount,
          status: 201,
        });
        // Set a timeout for the response
        setTimeout(() => {
          if (!res.headersSent) {
            res.status(500).send({
              success: false,
              message: "Request timed out. Please try again later.",
            });
          }
        }, 180000);
      })
      .catch((err) => {
        console.log("Error in generating transaction:", err);
        next(err);
      });
  } catch (error) {
    console.log("Error in getting data:", error);
    next(error);
  }
});

// Error handler middleware
sendDint.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send({
    success: false,
    message: "Something went wrong. Please try again!",
  });
});





sendDint.post("/checkout", checkout);

sendDint.post("/withdraw-dint", async (req, res) => {
   if (req.headers.apikey !== process.env.SECURITY_KEY) {
     console.log(
       "req.headers",
       req.headers.apikey === process.env.SECURITY_KEY
     );

     return res.send({ success: false, message: "invalid api key" });
   }
   if (!process.env.OWNER_PRIVATE_KEY) {
     return res.send({ success: false, message: "private key not found" });
   }
  const { user_id, amount } = req.body;
  console.log(" req.body", req.body);

  try {
    getUserData(user_id, amount)
      .then((data) => {
        approval(data, amount)
          .then((data) => {
            // if (data.data) {
            //   const users = ethers.utils.defaultAbiCoder.decode(
            //     ["address", "address"],
            //     data.data
            //   );
            //   const sender = users[0];
            //   const reciever = users[1];
            return res.send({
              success: true,
              hash: data.res.hash,
              userAddress: data.data.userAddress,
              amount: amount,
            });
            // } else {
            //   return res.send("Something went wrong. Please try again");
            // }
          })
          .catch((err) => {
            return res.send({
              success: false,
              message:
                "Something went wrong while making transaction. Please try again!",
              error: err,
            });
          });
      })
      .catch((error) => {
        console.log("err", error);
        return res.send({
          sucess: false,
          message: "Something went wrong while getting user data.",
          error: error,
        });
      });
  } catch (error) {
    res.status(500).json({
      sucess: false,
      message: "Something went wrong. Please try again!",
      error: err,
    });
  }
});



module.exports = sendDint;