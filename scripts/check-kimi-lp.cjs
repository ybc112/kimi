const { ethers } = require("ethers");
async function main() {
  const p = new ethers.JsonRpcProvider("https://bsc.publicnode.com", 56);
  const kimi = "0x9Aa9CADEc931C58c2a22Bbc5381b266d12887777";
  const wbnb = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
  const factory = new ethers.Contract("0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73", [
    "function getPair(address,address) view returns (address)"
  ], p);

  const pair = await factory.getPair(kimi, wbnb);
  console.log("KIMI-WBNB pair:", pair);

  if (pair !== ethers.ZeroAddress) {
    const pc = new ethers.Contract(pair, [
      "function getReserves() view returns (uint112,uint112,uint32)",
      "function token0() view returns (address)",
      "function token1() view returns (address)"
    ], p);
    const [r0, r1] = await pc.getReserves();
    const t0 = await pc.token0();
    const t1 = await pc.token1();
    console.log("Token0:", t0, "Registve:", ethers.formatEther(r0));
    console.log("Token1:", t1, "Reserve:", ethers.formatEther(r1));
    if (t0.toLowerCase() === kimi.toLowerCase()) {
      console.log("KIMI:", ethers.formatEther(r0), "  WBNB:", ethers.formatEther(r1));
    } else {
      console.log("KIMI:", ethers.formatEther(r1), "  WBNB:", ethers.formatEther(r0));
    }
  } else {
    console.log("NO KIMI-WBNB PAIR EXISTS!");

    // Also check token's own pair
    const csAddr = "0xa58ba2b16c5a854045547993bec722ca9e4a7777";
    const csPair = await factory.getPair(csAddr, wbnb);
    console.log("\nCs-WBNB pair:", csPair);
    if (csPair !== ethers.ZeroAddress) {
      const pc2 = new ethers.Contract(csPair, [
        "function getReserves() view returns (uint112,uint112,uint32)"
      ], p);
      const [r0, r1] = await pc2.getReserves();
      console.log("Reserve0:", ethers.formatEther(r0));
      console.log("Reserve1:", ethers.formatEther(r1));
    }
  }
}
main().catch(e => console.error(e.shortMessage || e.message));
