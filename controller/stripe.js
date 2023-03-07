const ethers = require("ethers");
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

  const contractAddr = process.env.DINT_TOKEN_ADDRESS;
  const erc20dint = new ethers.Contract(contractAddr, abi, signer);

  // Fetch the current gas price from GasNow
  const gasPrice = await fetch('https://gasstation-mainnet.matic.network/')
    .then(response => response.json())
    .then(data => data.data.standard);

  try {
    const tx = await erc20dint.transfer(destAddr, amount, {
      gasPrice: gasPrice,
      gasLimit: ethers.utils.parseUnits("25000000", "wei"),
    });
    console.log("Transaction hash:", tx.hash);
  } catch (error) {
    console.log("Error transferring DINT:", error);
  }
  
};

module.exports = { transferDint };
