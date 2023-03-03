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

sendDint.post("/send-dint", async (req, res) => {
  if (req.headers.apikey !== process.env.SECURITY_KEY) {
    console.log("req.headers", req.headers.apikey === process.env.SECURITY_KEY);
    return res.send({ success: false, message: "invalid api key" });
  }
  if (!process.env.OWNER_PRIVATE_KEY) {
    return res.send({ success: false, message: "private key not found" });
  }
  
  const { sender_id, reciever_id, amount } = req.body;
  const price_usd = "1000000";

  try {
    getData(sender_id, reciever_id, amount, price_usd)
      .then((data) => {
        generate(data, amount)
          .then((data) => {
            return res.send({
              success: true,
              Hash: data.res.hash,
              sender: data.data.userAddress,
              reciever: data.data.recieverAddress,
              amount: amount,
            });
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
          success: false,
          message: "Something went wrong while getting user data.",
        });
      });
  } catch (error) {
    res.status(500).json({
      sucess: false,
      message: "Something went wrong. Please try again!",
    });
  }
});




module.exports = sendDint;
