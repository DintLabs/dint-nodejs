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




  const contractAddr = process.env.DINT_TOKEN_ADDRESS;
  const erc20dint = new ethers.Contract(contractAddr, abi, signer);

    // Specify the desired priority fee (in Gwei)
    const priorityFeeGwei = 45;

    // Convert the priority fee to Wei
    const priorityFeeWei = ethers.utils.parseUnits(priorityFeeGwei.toString(), 'gwei');
  const targetBlocks = 3; // Target number of blocks for the transaction to be included in

  const tx = await erc20dint.transfer(destAddr, amount, {
    gasLimit: 20000000,
    gasPrice: ethers.BigNumber.from(await provider.getGasPrice()).add(priorityFeeWei)
  }); // TRANSFER DINT to the customer



  return tx;
};

module.exports = { transferDint };


