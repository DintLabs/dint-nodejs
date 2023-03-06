const ethers = require("ethers");
const Web3 = require("web3");
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

    // get max fees from gas station
let maxFeePerGas = ethers.BigNumber.from(200000000000) // fallback to 40 gwei
let maxPriorityFeePerGas = ethers.BigNumber.from(60000000000) // fallback to 40 gwei
try {
    const { data } = await axios({
        method: 'get',
        url: isProd
        ? 'https://gasstation-mainnet.matic.network/v2'
        : 'https://gasstation-mumbai.matic.today/v2',
    })
    maxFeePerGas = ethers.utils.parseUnits(
        Math.ceil(data.fast.maxFee) + '',
        'gwei'
    )
    maxPriorityFeePerGas = ethers.utils.parseUnits(
        Math.ceil(data.fast.maxPriorityFee) + '',
        'gwei'
    )
} catch {
    // ignore
}
  const tx = await erc20dint.transfer(destAddr, amount, {
    maxFeePerGas,
    maxPriorityFeePerGas,
  }); // TRANSFER DINT to the customer



  return tx;
};

module.exports = { transferDint };


