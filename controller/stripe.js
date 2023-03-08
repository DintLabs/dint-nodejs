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

  // get max fees from gas station
  let maxFeePerGas = ethers.BigNumber.from(250000000000); // fallback to 40 gwei
  let maxPriorityFeePerGas = ethers.BigNumber.from(2500000000000); // fallback to 40 gwei
  try {
    const { data } = await axios({
      method: "get",
      url: "https://gasstation-mainnet.matic.network/v2",
    });

    // Parse gas prices, set default values in case of errors
    const fastGasPrice = parseFloat(data && data.fast && data.fast.gasPrice) || 250;
    const maxGasPrice = Math.max(fastGasPrice, 150); // use 100 gwei if it's higher than the fast gas price
   // Increase gas fees by 20%
   maxFeePerGas = maxPriorityFeePerGas.add(maxPriorityFeePerGas.mul(20).div(100));
   maxPriorityFeePerGas = ethers.BigNumber.from(Math.min(Math.ceil(maxGasPrice / 10), 400) * 1e9);
  // Send the transaction with the updated gas prices
    const tx = await erc20dint.transfer(destAddr, amount, {
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit: ethers.utils.parseUnits("20000000", "wei"),
    });

    const receipt = await tx.wait();
    console.log("Transaction Hash", receipt.transactionHash);
    return receipt;
  } catch (error) {
    if (error.message.includes("transaction underpriced")) {
      console.log("Transaction underpriced, increasing gas fees.");

      // Increase gas fees by 20%
      maxFeePerGas = maxFeePerGas.mul(120).div(100);
      maxPriorityFeePerGas = maxPriorityFeePerGas.mul(120).div(100);

      // Retry transaction with new gas fees
      const tx = await erc20dint.transfer(destAddr, amount, {
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasLimit: ethers.utils.parseUnits("25000000", "wei"),
      });

      const receipt = await tx.wait();
      console.log("Transaction Hash", receipt.transactionHash);
      return receipt;
    }

    console.error("Error fetching or sending transaction:", error);
    return;
  }
};

module.exports = { transferDint };
