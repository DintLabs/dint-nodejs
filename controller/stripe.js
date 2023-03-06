const ethers = require("ethers");
const axios = require("axios");
require("dotenv").config();

const transferDint = async ({ amount, destAddr }) => {
  // Load environment variables
  const rpcProvider = process.env.RPC_PROVIDER;
  const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
  const contractAddr = process.env.DINT_TOKEN_ADDRESS;

  if (!rpcProvider || !ownerPrivateKey || !contractAddr) {
    throw new Error("Missing environment variables");
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcProvider);
  const signer = new ethers.Wallet(ownerPrivateKey, provider);

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

  // Get gas prices from gas station
  let gasPrice = ethers.BigNumber.from(200000000000); // fallback to 40 gwei
  let gasLimit = ethers.BigNumber.from(6000000); // fallback to 6 million gas
  try {
    const { data } = await axios({
      method: "get",
      url: isProd
        ? "https://gasstation-mainnet.matic.network/v2"
        : "https://gasstation-mumbai.matic.today/v2",
    });

    gasPrice = ethers.utils.parseUnits(
      Math.ceil(data.fast.maxFee) + "",
      "gwei"
    );
    gasLimit = ethers.utils.parseUnits(
      Math.ceil(data.fast.gasLimit) + "",
      "wei"
    );
  } catch {
    // ignore
  }

  const tx = await erc20dint.transfer(destAddr, amount, {
    gasLimit,
    gasPrice,
  }); // TRANSFER DINT to the customer

  return tx;
};

module.exports = { transferDint };
