const winston = require("winston");
const express = require("express");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const ethers = require("ethers");
const { transferDint } = require("../controller/stripe");
const stripeApp = express.Router();
stripeApp.use(express.raw({ type: "application/json" }));

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "user-service" },
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});
logger.log({
  level: "info",
  message: "What time is the testing at?",
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

stripeApp.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    // res.setHeader("Access-Control-Allow-Origin", "*");
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      const amount = ethers.utils.parseEther(
        String(event.data.object.amount / 100)
      );
      const destAddr = event.data.object.metadata.walletAddr;

      if (event.type == "payment_intent.succeeded") {
        console.log({ amount, destAddr });
        transferDint({ amount, destAddr })
          .then((tx) => {
            console.log("tx hash", tx);
            res.json({ received: true });
          })
          .catch((error) => {
            // logger.log({
            //   level: "error",
            //   message: error,
            // });
            res.send(`Webhook: ${error.message}`);
          });
      } else {
        res.json({ received: true });
      }
    } catch (err) {
      console.log("err", err);
      res.send(`Webhook: ${err.message}`);
    }

    //   try {
    //     // event = stripe.webhooks.constructEvent(
    //     //   req.body,
    //     //   sig,
    //     //   endpointSecret,
    //     //   (err, constructedEvent) => {
    //     //     if (err) {
    //     //       logger.log({
    //     //         level: "error",
    //     //         message: err,
    //     //       });
    //     //       res.status(400).send(`Webhook Error: ${err.message}`);
    //     //       return;
    //     //     }
    //     //     logger.log({
    //     //       level: "info",
    //     //       message: "Event Created",
    //     //       event: constructedEvent,
    //     //     });
    //     //     const amount = ethers.utils.parseEther(
    //     //       String(constructedEvent.data.object.amount / 100)
    //     //     );
    //     //     const destAddr = constructedEvent.data.object.metadata.walletAddr;
    //     //     switch (constructedEvent.type) {
    //     //       case "payment_intent.succeeded":
    //     //         console.log({ amount, destAddr });
    //     //         transferDint({ amount, destAddr })
    //     //           .then((tx) => {
    //     //             console.log("tx hash", tx);
    //     //             res.status(200).json({ received: true });
    //     //           })
    //     //           .catch((error) => {
    //     //             logger.log({
    //     //               level: "error",
    //     //               message: error,
    //     //             });
    //     //             res.status(400).send(`Webhook Error: ${error.message}`);
    //     //           });
    //     //         break;
    //     //       default:
    //     //         console.log(`Unhandled event type ${constructedEvent.type}`);
    //     //     }
    //     //   }
    //     // );
    //     res.status(200).json({ received: true });
    //   } catch (err) {
    //     logger.log({
    //       level: "error",
    //       message: err,
    //     });
    //     res.status(400).send(`Webhook Error: ${err.message}`);
    //   }
  }
);

module.exports = stripeApp;
