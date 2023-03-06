const ethers = require("ethers");
// require("dotenv").config({ path: `../env.local`, override: true });
require("dotenv").config();

const transferDint = async ({ amount, destAddr }) => {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.RPC_PROVIDER
  );

  const signer = new ethers.Wallet(
    (process.env.OWNER_PRIVATE_KEY),
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


n

  const contractAddr = process.env.DINT_TOKEN_ADDRESS;
  const erc20dint = new ethers.Contract(contractAddr, abi, signer);

  const gasLimit = 21000; // Standard gas limit for a simple transfer
  const targetBlocks = 3; // Target number of blocks for the transaction to be included in
  const gasPrice = await provider.estimateGasPrice({ targetBlockTime: targetBlocks * 15 }); // Target block time is 15 seconds on Polygo
  const tx = await erc20dint.transfer(destAddr, amount, {
    gasPrice,
    gasLimit,
  }); // TRANSFER DINT to the customer



  return tx;
};

module.exports = { transferDint };
