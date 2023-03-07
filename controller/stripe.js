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
  let maxFeePerGas;
  let maxPriorityFeePerGas;
  try {
    const { data } = await axios({
      method: "get",
      url:
        process.env.IS_PROD === "true"
          ? "https://gasstation-mainnet.matic.network/v2"
          : "https://gasstation-mumbai.matic.today/v2",
    });

    console.log("Gas prices:", data);
    if (
      data &&
      data.standard &&
      typeof data.standard === "number" &&
      data.standard > 0
    ) {
      const gasPriceGwei = Math.ceil(data.standard / 10) * 10;
      maxFeePerGas = ethers.utils.parseUnits(gasPriceGwei.toString(), "gwei");
      maxPriorityFeePerGas = ethers.utils.parseUnits(
        Math.ceil(gasPriceGwei * 1.1).toString(),
        "gwei"
      );
      gasPrice = maxFeePerGas.add(maxPriorityFeePerGas);
    } else {
      throw new Error("Invalid gas price data");
    }
  } catch (error) {
    console.error("Error fetching gas prices:", error);
    gasPrice = ethers.utils.parseUnits("100", "gwei");
    maxFeePerGas = gasPrice;
    maxPriorityFeePerGas = gasPrice;
  }

  // Send the transaction
  const tx = await erc20dint.transfer(destAddr, amount, {
    gasPrice,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });

  console.log("Transaction Hash", tx.hash);
  return tx;
};

module.exports = { transferDint };
