require("dotenv").config();
const { initRedisConnection, disconnectRedisConnection, getNextNonce, getNonce, clearRedisCache } = require("../utils/nonceManager");
const myAddress = "0xcB4461A0CE317DD7e4D9A552E7e121260131526A";

beforeEach(async () => {
   await initRedisConnection()
});

afterEach(async () => {
   await disconnectRedisConnection();
});

describe("Check Nonce function", () => {
    it("get current nonce for address", async () => {
        const nonce = await getNonce(myAddress)
        console.log("current nonce ", nonce)
        expect(nonce).not.toBeLessThan(0);
    });
    it("get next nonce for address ", async () => {
          const nonce = await getNextNonce(myAddress)
          console.log("new nonce ", nonce)
          expect(nonce).toBeGreaterThan(0);
    });
});