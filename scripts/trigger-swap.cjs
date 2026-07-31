require("dotenv").config();
const { ethers } = require("ethers");
async function main() {
  const pk = "0x" + (process.env.PRIVATE_KEY || "").replace("0x", "");
  const p = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL || "https://bsc.publicnode.com", 56);
  const signer = new ethers.Wallet(pk, p);
  const addr = process.argv[2] || "0xa58ba2b16c5a854045547993bec722ca9e4a7777";
  const token = new ethers.Contract(addr, ["function processTaxTokens() external"], signer);
  console.log("Triggering processTaxTokens for", addr);
  try {
    const tx = await token.processTaxTokens();
    console.log("TX:", tx.hash);
    await tx.wait();
    console.log("Done!");
  } catch(e) {
    console.log("Reverted:", e.shortMessage || e.message);
    console.log("Reason: KIMI-WBNB swap likely failing due to low liquidity");
  }
}
main();
