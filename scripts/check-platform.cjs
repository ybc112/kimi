const { ethers } = require("ethers");
async function main() {
  const p = new ethers.JsonRpcProvider("https://bsc.publicnode.com", 56);
  const addr = "0x518afd31a57ffb9b06691d55288395105c3c7777";
  const token = new ethers.Contract(addr, [
    "function tokensForPlatform() view returns (uint256)",
    "function tokensForMarketing() view returns (uint256)",
    "function tokensForLiquidity() view returns (uint256)",
    "function tokensForDividends() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function swapThreshold() view returns (uint256)",
    "function totalPlatformRouted() view returns (uint256)",
    "function totalMarketingRouted() view returns (uint256)",
    "function swapEnabled() view returns (bool)",
    "function fundFeeBps() view returns (uint16)",
    "function symbol() view returns (string)",
  ], p);

  const plat = await token.tokensForPlatform();
  const mkt = await token.tokensForMarketing();
  const liq = await token.tokensForLiquidity();
  const div = await token.tokensForDividends();
  const bal = await token.balanceOf(addr);
  const thresh = await token.swapThreshold();
  const platRouted = await token.totalPlatformRouted();
  const mktRouted = await token.totalMarketingRouted();
  const swapOn = await token.swapEnabled();
  const fundFee = await token.fundFeeBps();
  const sym = await token.symbol();

  const total = plat + mkt + liq + div;
  const nativeSwapSize = plat + mkt + (liq > 0n ? liq/2n : 0n);

  console.log("=== " + sym + " 累积分池 ===");
  console.log("Platform:", ethers.formatUnits(plat, 18));
  console.log("Marketing:", ethers.formatUnits(mkt, 18));
  console.log("Liquidity:", ethers.formatUnits(liq, 18));
  console.log("Dividends:", ethers.formatUnits(div, 18));
  console.log("合计:", ethers.formatUnits(total, 18));
  console.log("");
  console.log("合约余额:", ethers.formatUnits(bal, 18), sym);
  console.log("swap阈值:", ethers.formatUnits(thresh, 18), sym);
  console.log("swapEnabled:", swapOn);
  console.log("");
  console.log("nativeSwapTokens:", ethers.formatUnits(nativeSwapSize, 18), sym);
  console.log("");
  console.log("已分平台费:", ethers.formatEther(platRouted), "BNB");
  console.log("已分营销费:", ethers.formatEther(mktRouted), "BNB");
  console.log("");
  console.log("fundFeeBps:", Number(fundFee), "= 0% → 营销费永远为 0");
  console.log("");
  if (nativeSwapSize < thresh) {
    console.log("❌ nativeSwapTokens < 阈值，原生币兑换不会触发");
  } else if (nativeSwapSize > 0n && thresh > 0n) {
    console.log("✅ nativeSwapTokens >= 阈值，应该能触发");
  }
  if (Number(fundFee) === 0) {
    console.log("⚠️ fundFee=0%，营销费不会产生");
    console.log("⚠️ nativeSwapTokens 仅由平台费组成（无营销/流动性）");
  }
}
main().catch(e => console.error(e.message || e));
