const { ethers } = require("ethers");
async function main() {
  const p = new ethers.JsonRpcProvider("https://bsc.publicnode.com", 56);
  const cs = "0xa58ba2b16c5a854045547993bec722ca9e4a7777";
  const wbnb = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
  const router = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
  const kimi = "0x9Aa9CADEc931C58c2a22Bbc5381b266d12887777";

  const pancakeFactory = new ethers.Contract("0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73", [
    "function getPair(address,address) view returns (address)"
  ], p);

  // Cs-WBNB pair
  const csPair = await pancakeFactory.getPair(cs, wbnb);
  console.log("Cs-WBNB pair:", csPair);

  if (csPair !== ethers.ZeroAddress) {
    const pc = new ethers.Contract(csPair, [
      "function getReserves() view returns (uint112,uint112,uint32)",
      "function token0() view returns (address)",
    ], p);
    const [r0, r1] = await pc.getReserves();
    const t0 = await pc.token0();
    if (t0.toLowerCase() === cs.toLowerCase()) {
      console.log("Cs:", ethers.formatUnits(r0, 18), "  WBNB:", ethers.formatEther(r1));
    } else {
      console.log("Cs:", ethers.formatUnits(r1, 18), "  WBNB:", ethers.formatEther(r0));
    }
    console.log("");
  }

  // Check swap path Cs→WBNB (2-hop)
  console.log("--- Testing Cs→WBNB swap (1 Cs) ---");
  const routerContract = new ethers.Contract(router, [
    "function getAmountsOut(uint256,address[]) view returns (uint256[])",
  ], p);
  try {
    const out = await routerContract.getAmountsOut(ethers.parseUnits("1", 18), [cs, wbnb]);
    console.log("1 Cs →", ethers.formatEther(out[1]), "WBNB");
  } catch(e) {
    console.log("Cs→WBNB FAILED:", e.shortMessage || e.message);
  }

  // Check swap path Cs→WBNB→KIMI (3-hop)
  console.log("--- Testing Cs→WBNB→KIMI swap (1 Cs) ---");
  try {
    const out = await routerContract.getAmountsOut(ethers.parseUnits("1", 18), [cs, wbnb, kimi]);
    console.log("1 Cs →", ethers.formatUnits(out[2], 18), "KIMI");
  } catch(e) {
    console.log("Cs→WBNB→KIMI FAILED:", e.shortMessage || e.message);
  }

  // Test with accumulated amount
  console.log("--- Testing Cs→WBNB→KIMI swap (6386 Cs) ---");
  try {
    const out = await routerContract.getAmountsOut(ethers.parseUnits("6386", 18), [cs, wbnb, kimi]);
    console.log("6386 Cs →", ethers.formatUnits(out[2], 18), "KIMI");
  } catch(e) {
    console.log("6386 Cs→WBNB→KIMI FAILED:", e.shortMessage || e.message);
  }
}
main().catch(e => console.error(e.shortMessage || e.message));
