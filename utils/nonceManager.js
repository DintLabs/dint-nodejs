
const redis = require('redis')
const ethers = require('ethers')
const client = redis.createClient();
client.on('error', err => console.log('Redis Client Error', err));

/**
 * This the function which used to connect redis server
 */
async function initRedisConnection() {
    await client.connect();
}

/**
 * This the function which used to disconnect redis server
 */
async function disconnectRedisConnection() {
    await client.disconnect();
}

async function clearRedisCache() {
    await client.flushAll();
}

/**
 * This is the function which used to get nonce from redis for particular address
 */
async function getNonce(address) {
    try {
        const value =  await client.get(address);
        return value !==null ? parseInt(value) : 0
    } catch (error) {
        return 0;
    }
}

/**
 * This is the function which used to increment nonce from redis for particular address
 */
async function incrementNonce(address, nonce) {
    await client.set(address, nonce);
}

/**
 * This is the function which used to check whether nonce available for particular address
 */
async function checkStorageExistForAddress(address) {
   const result = await client.get(address) 
   return result !== null
}

/**
 * This is the function public function which provide next nonce for user address
 */
async function getNextNonce(address) {
    const hasValue = await checkStorageExistForAddress(address)
    const nextNonce = (hasValue ? await getNonce(address) : await getTransactionCount(address)) + 1;
    await incrementNonce(address, nextNonce )
    return nextNonce;
}

/**
 * This is the function which used to get transaction count from blockchain if redis not have the data for paritcular address
 */
async function getTransactionCount(address) {
    try {
        const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_PROVIDER);
        const result = await provider.getTransactionCount(address);
        return parseInt(result)
    } catch (error) {
        return 0
    }

}



module.exports = {
    initRedisConnection,
    disconnectRedisConnection,
    clearRedisCache,
    getNonce,
    incrementNonce,
    checkStorageExistForAddress,
    getNextNonce
}

