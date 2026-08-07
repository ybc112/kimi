const { ethers } = require("ethers");
async function main() {
  const p = new ethers.JsonRpcProvider("https://bsc.publicnode.com", 56);
  const addr = process.argv[2] || "0x518afd31a57ffb9b06691d55288395105c3c7777";
  const token = new ethers.Contract(addr, [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function receiver() view returns (address)",
    "function platformFeeReceiver() view returns (address)",
    "function fundFeeBps() view returns (uint16)",
    "function dividendFeeBps() view returns (uint16)",
    "function lpFeeBps() view returns (uint16)",
    "function burnFeeBps() view returns (uint16)",
    "function buyTaxBps() view returns (uint16)",
    "function sellTaxBps() view returns (uint16)",
    "function totalMarketingRouted() view returns (uint256)",
    "function totalPlatformRouted() view returns (uint256)",
    "function totalDividendsDeposited() view returns (uint256)",
    "function totalLiquidityAdded() view returns (uint256)",
    "function totalTaxBurned() view returns (uint256)",
  ], p);

  const n = await token.name();
  const s = await token.symbol();
  const receiver = await token.receiver();
  const platform = await token.platformFeeReceiver();
  const fundFee = await token.fundFeeBps();
  const divFee = await token.dividendFeeBps();
  const lpFee = await token.lpFeeBps();
  const burnFee = await token.burnFeeBps();
  const buy = await token.buyTaxBps();
  const sell = await token.sellTaxBps();
  const mktRouted = await token.totalMarketingRouted();
  const platRouted = await token.totalPlatformRouted();
  const divDep = await token.totalDividendsDeposited();
  const liqAdded = await token.totalLiquidityAdded();
  const burned = await token.totalTaxBurned();

  console.log("=== " + n + " (" + s + ") ===");
  console.log("交易税: Buy " + Number(buy)/100 + "% / Sell " + Number(sell)/100 + "%");
  console.log("");
  console.log("--- 税费分配 ---");
  console.log("营销(fundFee):  " + Number(fundFee)/100 + "% → receiver");
  console.log("分红(divFee):   " + Number(divFee)/100 + "% → dividendDistributor");
  console.log("LP(lpFee):      " + Number(lpFee)/100 + "% → PancakeSwap LP");
  console.log("燃烧(burnFee):  " + Number(burnFee)/100 + "% → 0xdead");
  console.log("平台(硬编码):   10% → platformFeeReceiver");
  console.log("");
  console.log("--- 收款地址 ---");
  console.log("接收receiver:               " + receiver + " ← 营销费到这");
  console.log("平台platformFeeReceiver:     " + platform + " ← 10%平台税到这");
  console.log("");
  console.log("--- 已分配金额 ---");
  console.log("营销费到账:  " + ethers.formatEther(mktRouted) + " BNB → " + receiver);
  console.log("平台费到账:  " + ethers.formatEther(platRouted) + " BNB → " + platform);
  console.log("分红存入:    " + ethers.formatEther(divDep) + " (reward token)");
  console.log("LP添加:      " + ethers.formatEther(liqAdded) + " (liquidity)");
  console.log("已燃烧:      " + ethers.formatEther(burned) + " (burned tokens)");

  // Check if receiver matches fee recipient
  const isPlatform = receiver.toLowerCase() === platform.toLowerCase();
  if (isPlatform) console.log("\n⚠️ receiver 和 platformFeeReceiver 是同一个地址!");
}
main().catch(e => console.error(e.message || e));
