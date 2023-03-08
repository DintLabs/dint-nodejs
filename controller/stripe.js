const ethers = require("ethers");
const axios = require("axios");
require("dotenv").config();

const transferDint = async ({ amount, destAddr }) => {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.RPC_PROVIDER
  );

  const signer = new ethers.Wallet(
    process.env.OWNER_PRIVATE_KEY,
    provider
  );

  const abi = require("../DintTokenABI.json");

  const contractAddr = process.env.DINT_TOKEN_ADDRESS;
  const erc20dint = new ethers.Contract(contractAddr, abi, signer);

  try {
    // Set the gas price to 81555193021 wei
    let gasPrice = ethers.utils.parseUnits("gwei");
    console.log("Gas Price:", gasPrice.toString());

    const tx = await erc20dint.transfer(destAddr, amount, {
      gasPrice: gasPrice,
 
    });


    console.log("Transaction:", tx);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("Transaction Hash:", receipt.transactionHash);
    console.log("Receipt:", receipt);

    return receipt;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
};

module.exports = { transferDint };