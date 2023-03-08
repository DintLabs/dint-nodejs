const ethers = require("ethers");
const axios = require("axios");
require("dotenv").config();

const getProviderAndSigner = () => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_PROVIDER);
  const wallet = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
  return { provider, signer: wallet };
};

const getGasPrices = async () => {
  try {
    const { data } = await axios.get("https://gasstation-mainnet.matic.network/v2");
    const fastGasPrice = parseFloat(data?.fast?.gasPrice) || 40;
    const maxGasPrice = Math.max(fastGasPrice, 100);
    return {
      maxFeePerGas: ethers.utils.parseUnits(Math.ceil(maxGasPrice) + "", "wei"),
      maxPriorityFeePerGas: ethers.utils.parseUnits(Math.ceil(maxGasPrice) + "", "wei"),
    };
  } catch (error) {
    console.error("Error fetching gas prices:", error);
    return {
      maxFeePerGas: ethers.BigNumber.from(150000000000),
      maxPriorityFeePerGas: ethers.BigNumber.from(1500000000000),
    };
  }
};

const transferDint = async ({ amount, destAddr }) => {
  const { provider, signer } = getProviderAndSigner();
  const gasPrices = await getGasPrices();
  const contractAddr = process.env.DINT_TOKEN_ADDRESS;
  const erc20dint = new ethers.Contract(
    contractAddr,
    [
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
    ],
    signer
  );
  try {
    const tx = await erc20dint.transfer(destAddr, amount, {
      maxFeePerGas: gasPrices.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
      gasLimit: ethers.utils.parseUnits("8000000", "wei"),
    });
    const receipt = await tx.wait();
    console.log("Transaction Hash", receipt.transactionHash);
    return receipt;
  } catch (error) {
    console.error("Error sending transaction:", error);
  }
};

module.exports = { transferDint };
