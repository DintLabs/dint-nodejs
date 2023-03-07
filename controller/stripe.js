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
  let maxFeePerGas = ethers.BigNumber.from(40000000000); // fallback to 40 gwei
  let maxPriorityFeePerGas = ethers.BigNumber.from(40000000000); // fallback to 40 gwei
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
      data.fast &&
      typeof data.fast === "object" &&
      typeof data.fast.maxFee === "string" &&
      typeof data.fast.maxPriorityFee === "string"
    ) {
      maxFeePerGas = ethers.utils.parseUnits(data.fast.maxFee, "wei");
      maxPriorityFeePerGas = ethers.utils.parseUnits(
        data.fast.maxPriorityFee,
        "wei"
      );
    } else {
      throw new Error("Invalid gas price data");
    }
  } catch (error) {
    console.error("Error fetching gas prices:", error);
  }

  // Send the transaction
  const tx = await erc20dint.transfer(destAddr, amount, {
    maxFeePerGas,
    maxPriorityFeePerGas,
  });

  console.log("Transaction Hash", tx.hash);
  return tx;
};

module.exports = { transferDint };
