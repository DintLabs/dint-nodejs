const winston = require("winston");
const expressWinston = require("express-winston");
const express = require("express");
const stripe = require("stripe");
const ethers = require("ethers");
const { buffer } = require ("micro");
// require("dotenv").config({ path: `../env.local`, override: true });
require("dotenv").config();
const bodyParser = require("body-parser");
const { transferDint } = require("../controller/stripe");
const stripeApp = express.Router();
stripeApp.use(express.raw({ type: "*/*" }));
stripeApp.use((req, res, next) => {
  if (req.originalUrl === "/api/webhooks/stripe/") {
    next();
  } else {
    express.json()(req, res, next);
  }
});
require("dotenv").config({ path: `../env.local`, override: true });
require("dotenv").config();
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "user-service" },
  transports: [
    //
    // - Write all logs with importance level of `error` or less to `error.log`
    // - Write all logs with importance level of `info` or less to `combined.log`
    //
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});
logger.log({
  level: "info",
  message: "What time is the testing at?",
});

// stripeApp.use(
//   expressWinston.logger({
//     transports: [
//       new winston.transports.Console(),
//     //   new winston.transports.File({ filename: "combined.log" }),
//     ],
//     format: winston.format.combine(
//       winston.format.colorize(),
//       winston.format.json()
//     ),
//     meta: false,
//     msg: "HTTP  ",
//     expressFormat: true,
//     colorize: false,
//     ignoreRoute: function (req, res) {
//       return false;
//     },
//   })
// );

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

stripeApp.post("/stripe/", async (req, res) => {
  // This is your Stripe CLI webhook secret for testing your endpoint locally.
  logger.log({
    level: "info",
    message: "End Point Hit",
  });

  const sig = req.headers["stripe-signature"];
  console.log("error", "error");
  winston.log("error", "127.0.0.1 - there's no place like home");

  let event;
console.log("sig", sig)
  try {
    // const buf = await buffer(req.rawBody);
    // console.log("buf", buf);
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    logger.log({
      level: "info",
      message: "Event Created",
      event,
    });
    logger.log("info", event);
    // logger.info(event);

    console.log("event", event);
    if (event.type === "payment_intent.succeeded") {
      logger.log({
        level: "error",
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
      // myLibLog.info("Payment not succeeded");
    }
  } catch (err) {
    logger.log({
      level: "error",
      message: err,
    });
    res.status(400).send(`Webhook Error: ${err.message}`);

    return;
  }

  // Handle the event
  //   switch (event.type) {
  //     case "payment_intent.succeeded":
  //       const paymentIntent = event.data.object;
  //       console.log("paymentIntent", paymentIntent);
  //       const amount = ethers.utils.parseEther(
  //         String(event.data.object.amount / 100)
  //       );
  //       const destAddr = event.data.object.metadata.walletAddr;
  //       console.log({ amount, destAddr });
  //       const tx = await transferDint({ amount, destAddr });
  //       console.log("tx hash", tx);
  //       break;
  //     //   ... handle other event types
  //     default:
  //       console.log(`Unhandled event type ${event.type}`);
  //   }

  // Return a 200 res to acknowledge receipt of the event
  res.send();
});

module.exports = stripeApp;
