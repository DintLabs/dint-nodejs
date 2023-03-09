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
    // Set the gas price to the recommended gas price from the network
    const gasPrice = await getGasPrice();
    console.log("Gas Price:", gasPrice.toString());
    console.log("Amount:", amount.toString());

    // Get the nonce for the transaction
    const nonce = await signer.getTransactionCount();

    // Create the transaction object
    const tx = {
      nonce: nonce,
      to: contractAddr,
      gasLimit: ethers.utils.hexlify(70000),
      gasPrice: gasPrice,
      value: ethers.utils.hexlify(0),
      data: erc20dint.interface.encodeFunctionData("transfer", [destAddr, amount]),
    };

    // Sign the transaction
    const signedTx = await signer.signTransaction(tx);

    // Send the transaction
    console.log("Sending transaction...");
    let txHash = await provider.sendTransaction(signedTx);
    console.log("Transaction Sent: ", txHash.hash);

    // Wait for the transaction to be mined
    console.log("Waiting for confirmation...");
    let receipt = await provider.waitForTransaction(txHash.hash);

    console.log("Transaction confirmed:", receipt.transactionHash);
    console.log("Receipt:", receipt);

    return receipt;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
};

module.exports = { transferDint };
