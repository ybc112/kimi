const { ethers } = require("ethers");
async function main() {
  const addr = process.argv[2] || "0xa58ba2b16c5a854045547993bec722ca9e4a7777";
  const p = new ethers.JsonRpcProvider("https://bsc.publicnode.com", 56);

  const token = new ethers.Contract(addr, [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function tradingEnabled() view returns (bool)",
    "function swapThreshold() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function buyTaxBps() view returns (uint16)",
    "function sellTaxBps() view returns (uint16)",
    "function transferTaxBps() view returns (uint16)",
    "function dividendFeeBps() view returns (uint16)",
    "function fundFeeBps() view returns (uint16)",
    "function lpFeeBps() view returns (uint16)",
    "function burnFeeBps() view returns (uint16)",
    "function totalDividendsDeposited() view returns (uint256)",
    "function rewardToken() view returns (address)",
    "function rewardThreshold() view returns (uint256)",
    "function dividendDistributor() view returns (address)",
    "function distributorGas() view returns (uint256)",
  ], p);

  const n = await token.name();
  const s = await token.symbol();
  const trading = await token.tradingEnabled();
  const supply = await token.totalSupply();
  const threshold = await token.swapThreshold();
  const balance = await token.balanceOf(addr);
  const buy = await token.buyTaxBps();
  const sell = await token.sellTaxBps();
  const transfer = await token.transferTaxBps();
  const divFee = await token.dividendFeeBps();
  const fundFee = await token.fundFeeBps();
  const lpFee = await token.lpFeeBps();
  const burnFee = await token.burnFeeBps();
  const totalDiv = await token.totalDividendsDeposited();
  const rewardTok = await token.rewardToken();
  const threshold_reward = await token.rewardThreshold();
  const distAddr = await token.dividendDistributor();
  const gas = await token.distributorGas();

  console.log("=== " + n + " (" + s + ") ===");
  console.log("Trading:", trading);
  console.log("Supply:", ethers.formatUnits(supply, 18));
  console.log("");
  console.log("--- 税率 ---");
  console.log("Buy:", Number(buy)/100, "%  Sell:", Number(sell)/100, "%  Transfer:", Number(transfer)/100, "%");
  console.log("");
  console.log("--- 税费分配 ---");
  console.log("分红 fee:", Number(divFee)/100, "%");
  console.log("营销 fee:", Number(fundFee)/100, "%");
  console.log("LP fee:", Number(lpFee)/100, "%");
  console.log("燃烧 fee:", Number(burnFee)/100, "%");
  console.log("");
  console.log("--- 积累 ---");
  console.log("合约余额:", ethers.formatUnits(balance, 18), s);
  console.log("兑换阈值:", ethers.formatUnits(threshold, 18), s);
  console.log("已达成分红:", ethers.formatEther(totalDiv), "(reward token)");
  console.log("");
  console.log("--- 分红配置 ---");
  console.log("奖励代币:", rewardTok);
  console.log("持币门槛:", ethers.formatUnits(threshold_reward, 18), s);
  console.log("分配器地址:", distAddr);
  console.log("Gas预算:", gas.toString());
  console.log("");

  if (!trading) { console.log("❌ 交易未开启"); return; }
  if (balance < threshold) {
    console.log("❌ 余额(" + ethers.formatUnits(balance, 18) + ") < 阈值(" + ethers.formatUnits(threshold, 18) + ")，不会swap");
    console.log("   还需要 " + ethers.formatUnits(threshold - balance, 18) + " 个代币积累");
  }
  if (Number(divFee) === 0) {
    console.log("❌ 分红费率=0%，没有分红分配");
  }
  if (gas.toString() === "0") {
    console.log("❌ distributorGas=0，分红处理被禁用");
  }
}

main().catch(e => console.error(e.shortMessage || e.message));
