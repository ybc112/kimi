const { ethers } = require("ethers");
async function main() {
  const addr = "0x0166eEc08FeB66Fbad1B9df279A90D5C4CDc7777";
  const p = new ethers.JsonRpcProvider("https://bsc.publicnode.com", 56);
  const code = await p.getCode(addr);
  console.log("Code bytes:", code.length/2-1);

  if (code.length <= 2) {
    console.log("NOT A CONTRACT");
    return;
  }

  const token = new ethers.Contract(addr, [
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
    "function buyTaxBps() view returns (uint16)",
    "function sellTaxBps() view returns (uint16)",
    "function tradingEnabled() view returns (bool)",
    "function totalSupply() view returns (uint256)",
    "function swapThreshold() view returns (uint256)",
    "function totalPlatformRouted() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
  ], p);

  const name = await token.name();
  const symbol = await token.symbol();
  const buy = await token.buyTaxBps();
  const sell = await token.sellTaxBps();
  const trading = await token.tradingEnabled();
  const supply = await token.totalSupply();
  const threshold = await token.swapThreshold();
  const routed = await token.totalPlatformRouted();
  const balance = await token.balanceOf(addr);

  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Trading:", trading);
  console.log("Supply:", ethers.formatUnits(supply, 18));
  console.log("Buy tax:", Number(buy)/100, "%");
  console.log("Sell tax:", Number(sell)/100, "%");
  console.log("Balance:", ethers.formatUnits(balance, 18));
  console.log("Threshold:", ethers.formatUnits(threshold, 18));
  console.log("Platform routed:", ethers.formatEther(routed), "BNB");

  if (!trading) console.log("\n⚠️ 交易未开启");
  if (Number(buy)===0 && Number(sell)===0) console.log("\n⚠️ 税率0%，没税可收");
  if (balance < threshold) console.log("\n⚠️ 余额不够阈值，需要更多交易");
}
main().catch(e => console.error(e.shortMessage || e.message));
