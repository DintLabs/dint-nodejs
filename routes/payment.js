const winston = require("winston");
const express = require("express");
const stripe = require("stripe");
const ethers = require("ethers");
require("dotenv").config();
const { transferDint } = require("../controller/stripe");
const stripeApp = express.Router();
stripeApp.use(express.raw({ type: "*/*" }));

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "user-service" },
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

stripeApp.post("/buy-dint-token/", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    logger.log({
      level: "info",
      message: "Event Created",
      event,
    });

    if (event.type === "payment_intent.succeeded") {
      logger.log({
        level: "info",
        message: "payment_intent.succeeded found",
      });

      const amount = ethers.utils.parseEther(
        String(event.data.object.amount / 100)
      );
      const destAddr = event.data.object.metadata.walletAddr;
      console.log(amount, destAddr);
      const tx = await transferDint({ amount, destAddr });

      console.log("tx hash", tx.hash);
    } else {
      res.status(200).json({ received: false });
      logger.log({
        level: "error",
        message: event.type,
      });
    }
  } catch (err) {
    logger.log({
      level: "error",
      message: err,
    });
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  res.send();
});

module.exports = stripeApp;