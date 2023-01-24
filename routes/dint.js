const express = require("express");
const ethers = require("ethers");
const sendDint = express.Router();
const Web3 = require("web3");
const DintTokenAbBI = require("../DintTokenABI.json");
require("dotenv").config({ path: `.env.local`, override: true });
const bodyParser = require("body-parser");
const cors = require("cors");
const { Client } = require("pg");
const dintDistributerABI = require("../DintDistributerABI.json");
const fernet = require("fernet");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
// sendDint.use(bodyParser());
const checkout = require("../controller/dint");
const { getData, generate } = require("../controller/dint");
// const generate = require("../controller/dint");

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

  try {
    getData(sender_id, reciever_id, amount)
      .then((data) => {
        generate(data, amount)
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

sendDint.post("/checkout", async (req, res) => {
  const { walletAddr, amount, email } = req.body;
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    customer_email: email,
    // pass customer wallet addr as metadata, so we know where to transfer funds
    payment_intent_data: {
      metadata: {
        walletAddr: walletAddr,
      },
    },
    metadata: {
      walletAddr: walletAddr,
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Membership credits", // name of the product (shown at checkout)
          },
          unit_amount: Number(amount) * 100, // Stripe accepts prices in cents
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `https://fedev.dint.com/buy-dint-token`, // where redirect user after success/fail
    cancel_url: `https://fedev.dint.com/buy-dint-token`,
  });
  res.status(200).json({ session });
});

module.exports = sendDint;
