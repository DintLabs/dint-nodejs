const ethers = require("ethers");
const axios = require("axios");

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

  const contractAddr = process.env.DINT_TOKEN_ADDRESS;
  const erc20dint = new ethers.Contract(contractAddr, abi, signer);

  // Get max fees from gas station
  let maxFeePerGas, maxPriorityFeePerGas;
  try {
    const { data } = await axios({
      method: "get",
      url: process.env.IS_PROD
        ? "https://gasstation-mainnet.matic.network/v2"
        : "https://gasstation-mumbai.matic.today/v2",
    });

    maxFeePerGas = ethers.BigNumber.from(data.fast.maxFee);
    maxPriorityFeePerGas = ethers.BigNumber.from(data.fast.maxPriorityFee);
  } catch (err) {
    console.error("Failed to get gas prices:", err);
    maxFeePerGas = ethers.utils.parseUnits("100", "gwei"); // Set default gas price
    maxPriorityFeePerGas = ethers.utils.parseUnits("10", "gwei"); // Set default priority gas price
  }

  // Send the transaction
  const tx = await erc20dint.transfer(destAddr, amount, {
    gasLimit: ethers.utils.parseUnits("100000", "wei"), // Set a fixed gas limit
    maxFeePerGas,
    maxPriorityFeePerGas,
  });

  return tx;
};

module.exports = { transferDint };
