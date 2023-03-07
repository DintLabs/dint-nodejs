const ethers = require("ethers");
const axios = require("axios");
require("dotenv").config();

const transferDint = async ({ amount, destAddr }) => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_PROVIDER);

  const signer = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);

  const abi = [
    {
      constant: false,
      inputs: [
        { name: "_to", type: "address" },
        { name: "_amount", type: "uint256" },
      ],
      name: "transfer",
      outputs: [{ name: "success", type: "bool" }],
      payable: false,
      stateMutability: "nonpayable",
      type: "function",
    },
  ];

  const contractAddr = process.env.DINT_TOKEN_ADDRESS;
  const erc20dint = new ethers.Contract(contractAddr, abi, signer);

  // Get the current gas prices
  let gasPrice;
  try {
    const { data } = await axios.get("https://gasstation-mainnet.matic.network/v2");
    console.log("Gas prices:", data); // log the entire response object
    const { fast: fastGasPrice } = data;
    gasPrice = ethers.utils.parseUnits(fastGasPrice.toString(), "gwei");
  } catch (error) {
    console.error("Error fetching gas prices:", error);
    gasPrice = ethers.utils.parseUnits("200", "gwei"); // Set default gas price
  }

  // Calculate the gas limit and fees
  const gasLimit = await erc20dint.estimateGas.transfer(destAddr, amount);
  const maxFeePerGas = gasPrice;
  const maxPriorityFeePerGas = ethers.utils.parseUnits((gasPrice - 5).toString(), "gwei");

  // Send the transaction
  const tx = await erc20dint.transfer(destAddr, amount, {
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });
  console.log("Transaction Hash", tx.hash);
  return tx;
};

module.exports = { transferDint };
