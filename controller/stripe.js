const ethers = require("ethers");
const fetch = require("node-fetch");

require("dotenv").config();

const DINT_TOKEN_ABI = [
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

const GAS_LIMIT = ethers.utils.parseUnits("25000000", "wei");

const transferDint = async ({ amount, destAddr }) => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_PROVIDER);

  const signer = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);

  const contractAddr = process.env.DINT_TOKEN_ADDRESS;
  const erc20dint = new ethers.Contract(contractAddr, DINT_TOKEN_ABI, signer);

  const gasPrice = await getGasPrice();

  try {
    const tx = await erc20dint.transfer(destAddr, amount, {
      gasPrice,
      gasLimit: GAS_LIMIT,
    });
    console.log("Transaction hash:", tx.hash);
  } catch (error) {
    console.log("Error transferring DINT:", error);
  }
};

const getGasPrice = async () => {
  try {
    const response = await fetch(process.env.POLYGON_GAS_API);
    const { data } = await response.json();
    return data.standard;
  } catch (error) {
    console.log("Error fetching gas price:", error);
    return ethers.utils.parseUnits("20", "gwei"); // fallback gas price
  }
};

module.exports = { transferDint };

