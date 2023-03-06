const ethers = require("ethers");
// require("dotenv").config({ path: `../env.local`, override: true });
require("dotenv").config();

const transferDint = async ({ amount, destAddr }) => {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.JSON_RPC_URL // mumbai, polygon, eth mainnet
  );
  // private key of account that holds DINT.
  // Caution: this account must have MATIC/ETH to cover gas fees!
  const signer =  new ethers.Wallet(
    process.env.DINT_OPERATOR_PRIVATE_KEY,
    provider
  )
  const abi = [
    {
      "constant": false,
      "inputs": [
        { "name": "_to", "type": "address" },
        { "name": "_amount", "type": "uint256" }
      ],
      "name": "transfer",
      "outputs": [{ "name": "success", "type": "bool" }],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

  const contractAddr = process.env.DINT_CONTRACT_ADDR;
  const erc20dint = new ethers.Contract(contractAddr, abi, signer);
  const gasPrice = await provider.getGasPrice();
  const tx = await erc20dint.transfer(
    destAddr,
    amount,
    {
      gasPrice
    }
  ); // TRANSFER DINT to the customer

  return tx;
}

export const config = {
  api: {
    bodyParser: false,
  },
};


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const buf = await buffer(req);
    const sig = req.headers["stripe-signature"];
    // make sure that webhook is called by Stripe (not hackers or other ppl)
    // make sure that Stripe is configured to emit events to your webhook!
    const event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    if(event.type === "payment_intent.succeeded") {
      const amount = ethers.utils.parseEther(String(event.data.object.amount / 100))
      const destAddr = event.data.object.metadata.walletAddr;
      console.log({ amount, destAddr });
      const tx = await transferDint({ amount, destAddr })
      console.log("tx hash", tx.hash);
    }
    res.status(200).json({ received: true });
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}