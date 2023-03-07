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

  const contractAddr = process.env.DINT_TOKEN_ADDRESS;
  const erc20dint = new ethers.Contract(contractAddr, abi, signer);

  // Get the current gas prices
  let gasPrice;
  let maxFeePerGas = ethers.BigNumber.from(100000000000) // fallback to 100 gwei
  let maxPriorityFeePerGas = ethers.BigNumber.from(100000000000) // fallback to 100 gwei
  try {
    const { data } = await axios({
      method: 'get',
      url: process.env.IS_PROD === 'true'
      ? 'https://gasstation-mainnet.matic.network/v2'
      : 'https://gasstation-mumbai.matic.today/v2',
    });

    console.log('Gas prices:', data); // log the entire response object
    const gasPrices = data;
    if (gasPrices && gasPrices.fast && typeof gasPrices.fast.maxFeePerGas === 'number') {
      maxFeePerGas = ethers.BigNumber.from(gasPrices.fast.maxFeePerGas.toString()).mul(ethers.BigNumber.from("1000000000"));
      maxPriorityFeePerGas = ethers.BigNumber.from(gasPrices.fast.maxPriorityFeePerGas.toString()).mul(ethers.BigNumber.from("1000000000"));
      gasPrice = maxFeePerGas.add(maxPriorityFeePerGas);
    } else {
      // handle the error or fallback to a default gas price
      gasPrice = maxFeePerGas.add(maxPriorityFeePerGas);
    }
  } catch (error) {
    console.error("Error fetching gas prices:", error);
    gasPrice = maxFeePerGas.add(maxPriorityFeePerGas);
  }

  // Estimate gas limit
  let gasLimit = await erc20dint.estimateGas.transfer(destAddr, amount);
  const GAS_MULTIPLIER = 4;
  gasLimit = parseInt(gasLimit * GAS_MULTIPLIER);

  // Send the transaction
  const tx = await erc20dint.transfer(destAddr, amount, {
    gasLimit,
    gasPrice,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });

  console.log("Transaction Hash", tx.hash);
  return tx;
};

module.exports = { transferDint };
