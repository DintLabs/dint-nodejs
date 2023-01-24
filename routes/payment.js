const express = require("express");
const stripe = require("stripe");
const ethers = require("ethers");
const { transferDint } = require("../controller/stripe");
const stripeApp = express.Router();
stripeApp.use(express.raw({ type: "*/*" }));
// require("dotenv").config({ path: `../env.local`, override: true });
require("dotenv").config();


const pvt =
  "0xd9fe157bdbc4e88a0eeb00510200746f853b9184928cee5dd893bc73b4f3d5e0";

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

stripeApp.post("/stripe", async (req, res) => {
  // This is your Stripe CLI webhook secret for testing your endpoint locally.

  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    if (event.type === "payment_intent.succeeded") {
      const amount = ethers.utils.parseEther(
        String(event.data.object.amount / 100)
      );
      const destAddr = event.data.object.metadata.walletAddr;
      console.log({ amount, destAddr });
      const tx = await transferDint({ amount, destAddr });
      console.log("tx hash", tx.hash);
    } else {
      res.status(200).json({ received: false });
    }
  } catch (err) {
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
