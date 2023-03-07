const ethers = require("ethers");
const axios = require("axios");
require("dotenv").config();

const transferDint = async ({ amount, destAddr }) => {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.RPC_PROVIDER
  );

  const signer = new ethers.Wallet(
    process.env.OWNER_PRIVATE_KEY,
    provider
  );

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

  // Get the current gas prices
  let gasPrice;
  let maxFeePerGas;
  let maxPriorityFeePerGas;
  try {
    const { data } = await axios.get(
      "https://ethgasstation.info/json/ethgasAPI.json"
    );
    gasPrice = data.fast;
    maxFeePerGas = ethers.utils.parseUnits(gasPrice.toString(), "gwei");
    maxPriorityFeePerGas = ethers.utils.parseUnits(
      (gasPrice - 5).toString(),
      "gwei"
    );
  } catch (error) {
    console.error("Error fetching gas prices:", error);
    maxFeePerGas = ethers.utils.parseUnits("200", "gwei"); // Set default gas price
    maxPriorityFeePerGas = ethers.utils.parseUnits("35", "gwei"); // Set default priority gas price
  }

  // Send the transaction
  const contractAddr = process.env.DINT_TOKEN_ADDRESS;
  const erc20dint = new ethers.Contract(contractAddr, abi, signer);
  const gasLimit = await erc20dint.estimateGas.transfer(destAddr, amount);
  const tx = await erc20dint.transfer(destAddr, amount, {
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
  }); // TRANSFER DINT to the customer
  
  return tx;
};

module.exports = { transferDint };
