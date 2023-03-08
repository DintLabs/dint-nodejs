const ethers = require("ethers");
const axios = require("axios");
require("dotenv").config();

const abi = require("./DintTokenABI.json");

const transferDint = async ({ destAddr, amount }) => {
  console.log('transferDint function called with destAddr:', destAddr, 'and amount:', amount);
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_PROVIDER);

  const signer = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);

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
    let gasPrice = ethers.utils.parseUnits(data.fast.toString(), "gwei");
const amount = amount.toString();
    const tx = await erc20dint.transfer(destAddr, amount, {
      gasPrice,
    });

    const receipt = await tx.wait();
    console.log("Transaction Hash", receipt.transactionHash);
    return receipt;
  } catch (error) {
    if (error.message.includes("transaction underpriced")) {
      console.log("Transaction underpriced, increasing gas fees.");

      let gasPrice = ethers.utils.parseUnits(data.fast.toString(), "gwei");
      gasPrice = gasPrice.mul(120).div(100);
      const amount = amount.toString();
      const tx = await erc20dint.transfer(destAddr, amount, {
        gasPrice,
      });

      const receipt = await tx.wait();
      console.log("Transaction Hash", receipt.transactionHash);
      console.log("Receipt:", receipt);
      return receipt;
    } else {
      console.error("Error fetching or sending transaction:", error);
      const tx = await erc20dint.transfer(destAddr, 0);
      const receipt = await tx.wait();
      console.log("Transaction Hash", receipt.transactionHash);
      console.log("Receipt:", receipt);
      return receipt;
    }
  }
};

module.exports = { transferDint };
