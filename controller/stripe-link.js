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
  let maxFeePerGas = ethers.BigNumber.from(150000000000); // fallback to 40 gwei
  let maxPriorityFeePerGas = ethers.BigNumber.from(1500000000000); // fallback to 400 gwei
  try {
    const { data } = await axios({
      method: "get",
      url: "https://gasstation-mainnet.matic.network/v2",
    });

    // Parse gas prices, set default values in case of errors
    const fastGasPrice = parseFloat(data && data.fast && data.fast.gasPrice) || 150;
    const maxGasPrice = Math.max(fastGasPrice, 100); // use 100 gwei if it's higher than the fast gas price
    maxFeePerGas = ethers.utils.parseUnits(Math.ceil(maxGasPrice) + "", "wei");
    maxPriorityFeePerGas = ethers.utils.parseUnits(Math.min(Math.ceil(maxGasPrice / 10), 400) + "", "wei"); // max priority fee is 10% of max gas price, with a cap of 400 gwei

    // Send the transaction with the updated gas prices
    const tx = await erc20dint.transfer(destAddr, amount, {
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit: ethers.utils.parseUnits("8000000", "wei"),
    });

    const receipt = await tx.wait();
    console.log("Transaction Hash", receipt.transactionHash);
    return receipt;
  } catch (error) {
    if (error.message.includes("transaction underpriced")) {
      console.log("Transaction underpriced, increasing gas fees...");
      maxPriorityFeePerGas = ethers.BigNumber.from(40000000000); // set priority fee to 40 gwei
      maxFeePerGas = ethers.BigNumber.from(100000000000); // set fee to 100 gwei
      try {
        const tx = await erc20dint.transfer(destAddr, amount, {
          maxFeePerGas,
          maxPriorityFeePerGas,
          gasLimit: ethers.utils.parseUnits("8000000", "wei"),
        });
        const receipt = await tx.wait();
        console.log("Transaction Hash", receipt.transactionHash);
        return receipt;
      } catch (error) {
        console.error("Error sending transaction:", error);
        return;
      }
    } else {
      console.error("Error fetching or sending transaction:", error);
      return;
    }
  }
};

module.exports = { transferDint };
