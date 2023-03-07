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

  // Get gas prices
  let maxFeePerGas = ethers.BigNumber.from(40000000000); // fallback to 40 gwei
  let maxPriorityFeePerGas = ethers.BigNumber.from(40000000000); // fallback to 40 gwei
  try {
    const { data } = await axios.get(
      process.env.IS_PROD
        ? "https://gasstation-mainnet.matic.network/v2"
        : "https://gasstation-mumbai.matic.today/v2"
    );
    const fastGas = data.fast;
    if (fastGas && fastGas.maxFee && fastGas.maxPriorityFee) {
      maxFeePerGas = ethers.utils.parseUnits(
        Math.ceil(fastGas.maxFee).toString(),
        "gwei"
      );
      maxPriorityFeePerGas = ethers.utils.parseUnits(
        Math.ceil(fastGas.maxPriorityFee).toString(),
        "gwei"
      );
    } else {
      throw new Error("Invalid gas price data");
    }
  } catch (error) {
    console.error("Error fetching gas prices:", error.message);
    throw error;
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
