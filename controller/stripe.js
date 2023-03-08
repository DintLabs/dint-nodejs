const ethers = require("ethers");
const axios = require("axios");
require("dotenv").config();

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_PROVIDER);
const signer = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
const contractAddr = process.env.DINT_TOKEN_ADDRESS;
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

const erc20dint = new ethers.Contract(contractAddr, abi, signer);

const getGasPrices = async () => {
  try {
    const url = process.env.IS_PROD
      ? "https://gasstation-mainnet.matic.network/v2"
      : "https://gasstation-mumbai.matic.today/v2";
    const { data } = await axios.get(url);
    const maxFeePerGas = ethers.utils.parseUnits(
      Math.ceil(data.fast.maxFee) + "",
      "gwei"
    );
    const maxPriorityFeePerGas = ethers.utils.parseUnits(
      Math.ceil(data.fast.maxPriorityFee) + "",
      "gwei"
    );
    return { maxFeePerGas, maxPriorityFeePerGas };
  } catch (error) {
    console.error("Error fetching gas prices:", error);
    throw error;
  }
};

const transferDint = async ({ amount, destAddr }) => {
  const { maxFeePerGas, maxPriorityFeePerGas } = await getGasPrices();

  try {
    const tx = await erc20dint.transfer(destAddr, amount, {
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit: ethers.utils.parseUnits("8000000", "wei"),
    });
    const receipt = await tx.wait();
    console.log("Transaction Hash:", receipt.transactionHash);
    return receipt;
  } catch (error) {
    console.error("Error sending transaction:", error);
    throw error;
  }
};

module.exports = { transferDint };
