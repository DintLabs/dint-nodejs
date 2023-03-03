const express = require("express");
const sendDint = express.Router();
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
    return res.send({ success: false, message: "invalid api key" });
  }
  if (!process.env.OWNER_PRIVATE_KEY) {
    return res.send({ success: false, message: "private key not found" });
  }

  const { sender_id, reciever_id, amount, priceInUSD } = req.body;

  try {
    getData(sender_id, reciever_id, amount)
      .then((data) => {
        generate(data, amount, priceInUSD)
          .then((data) => {
            return res.send({
              success: true,
              Hash: data.res.hash,
              sender: data.data.userAddress,
              reciever: data.data.recieverAddress,
              amount: amount,
              priceInUSD: priceInUSD,
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
          sucess: false,
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

sendDint.post("/checkout", checkout);

sendDint.post("/withdraw-dint", async (req, res) => {
  if (req.headers.apikey !== process.env.SECURITY_KEY) {
    return res.send({ success: false, message: "invalid api key" });
  }
  if (!process.env.OWNER_PRIVATE_KEY) {
    return res.send({ success: false, message: "private key not found" });
  }
  const { user_id, amount, priceInUSD } = req.body;

  try {
    getUserData(user_id, amount)
      .then((data) => {
        approval(data, amount)
          .then((data) => {
            return res.send({
              success: true,
              hash: data.res.hash,
              userAddress: data.data.userAddress,
              amount: amount,
              priceInUSD: priceInUSD,
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
