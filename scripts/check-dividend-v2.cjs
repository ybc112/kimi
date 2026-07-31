const { ethers } = require("ethers");
async function main() {
  const addr = process.argv[2] || "0xa58ba2b16c5a854045547993bec722ca9e4a7777";
  const p = new ethers.JsonRpcProvider("https://bsc.publicnode.com", 56);

  const token = new ethers.Contract(addr, [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function tokensForPlatform() view returns (uint256)",
    "function tokensForMarketing() view returns (uint256)",
    "function tokensForLiquidity() view returns (uint256)",
    "function tokensForDividends() view returns (uint256)",
    "function totalDividendsDeposited() view returns (uint256)",
    "function swapEnabled() view returns (bool)",
    "function liquidityPair() view returns (address)",
    "function liquidityRouter() view returns (address)",
    "function dividendDistributor() view returns (address)",
    "function rewardToken() view returns (address)",
    "function balanceOf(address) view returns (uint256)",
    "function swapThreshold() view returns (uint256)",
    "function dividendFeeBps() view returns (uint16)",
  ], p);

  const n = await token.name();
  const s = await token.symbol();
  const plat = await token.tokensForPlatform();
  const mkt = await token.tokensForMarketing();
  const liq = await token.tokensForLiquidity();
  const div = await token.tokensForDividends();
  const totalDivDep = await token.totalDividendsDeposited();
  const swapOn = await token.swapEnabled();
  const pair = await token.liquidityPair();
  const router = await token.liquidityRouter();
  const distAddr = await token.dividendDistributor();
  const reward = await token.rewardToken();
  const balance = await token.balanceOf(addr);
  const threshold = await token.swapThreshold();
  const divFee = await token.dividendFeeBps();

  console.log("=== " + n + " (" + s + ") ===");
  console.log("合约余额:", ethers.formatUnits(balance, 18));
  console.log("阈值:", ethers.formatUnits(threshold, 18));
  console.log("分红费率:", Number(divFee)/100, "%");
  console.log("");

  const total = plat + mkt + liq + div;
  console.log("--- 未兑换累积 ---");
  console.log("Platform:", ethers.formatUnits(plat, 18));
  console.log("Marketing:", ethers.formatUnits(mkt, 18));
  console.log("Liquidity:", ethers.formatUnits(liq, 18));
  console.log("Dividends:", ethers.formatUnits(div, 18));
  console.log("合计:", ethers.formatUnits(total, 18));
  console.log("");

  console.log("--- swap 状态 ---");
  console.log("swapEnabled:", swapOn);
  console.log("Router:", router);
  console.log("Pair:", pair);
  console.log("");

  console.log("--- 分红 ---");
  console.log("奖励代币:", reward);
  console.log("已存分红:", ethers.formatEther(totalDivDep));

  if (distAddr && distAddr !== ethers.ZeroAddress) {
    const dist = new ethers.Contract(distAddr, [
      "function totalDividends() view returns (uint256)",
      "function totalShares() view returns (uint256)",
      "function totalDistributed() view returns (uint256)",
      "function pendingDividends() view returns (uint256)",
    ], p);
    const totD = await dist.totalDividends();
    const totS = await dist.totalShares();
    const totDist = await dist.totalDistributed();
    const pend = await dist.pendingDividends().catch(() => 0n);
    console.log("分配器 totalDividends:", ethers.formatEther(totD));
    console.log("分配器 totalShares:", ethers.formatEther(totS));
    console.log("分配器 totalDistributed:", ethers.formatEther(totDist));
    console.log("分配器 pending:", ethers.formatEther(pend));
  }

  console.log("");
  if (total < threshold) console.log("❌ 累积量 < 阈值，swap 不会触发");
  else console.log("✅ 累积量已达阈值，swap 应该触发");

  if (!swapOn) console.log("❌ swapEnabled=false");
  if (pair === ethers.ZeroAddress) console.log("❌ 无流动性池！pair 未设置");
  if (router === ethers.ZeroAddress) console.log("❌ Router 未设置");
  if (Number(divFee) === 0) console.log("❌ 分红费率为 0");
}
main().catch(e => console.error(e.shortMessage || e.message));
