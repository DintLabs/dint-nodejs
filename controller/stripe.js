const ethers = require("ethers");
const axios = require("axios");
require("dotenv").config();


const transferDint = async ({ destAddr }) => {
  console.log('transferDint function called with destAddr:', destAddr);
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

  // get max fees from gas station
  try {
    const { data } = await axios({
      method: "get",
      url: "https://gasstation-mainnet.matic.network/v2",
    });
    
    console.log('Gas station data:', data);

    // Parse gas prices, set default values in case of errors
   
    const maxPriorityFeePerGas = ethers.utils.parseUnits("99", "gwei");
    const maxFeePerGas = ethers.utils.parseUnits("99", "gwei");
 
   

    const tx = await erc20dint.transfer(destAddr, 1, {
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit: ethers.utils.parseUnits("30000000", "wei"),
    });
    
    const receipt = await tx.wait();
    console.log("Transaction Hash", receipt.transactionHash);
    return receipt;
  } catch (error) {
    if (error.message.includes("transaction underpriced")) {
      console.log("Transaction underpriced, increasing gas fees.");

      maxFeePerGas = maxFeePerGas.mul(120).div(100);
      maxPriorityFeePerGas = maxPriorityFeePerGas.mul(120).div(100);

      const tx = await erc20dint.transfer(destAddr, 1, {
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasLimit: ethers.utils.parseUnits("25000000", "wei"),
      });

      const receipt = await tx.wait();
      console.log("Transaction Hash", receipt.transactionHash);
      console.log("Receipt:", receipt);
      return receipt;
    }

    console.error("Error fetching or sending transaction:", error);
    return;
  }
};

module.exports = { transferDint };
