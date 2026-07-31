const { ethers } = require("ethers");
async function main() {
  const p = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL || "https://bsc.publicnode.com", 56);
  const token = new ethers.Contract("0x0166eEc08FeB66Fbad1B9df279A90D5C4CDc7777", [
    "function buyTaxBps() view returns (uint16)",
    "function sellTaxBps() view returns (uint16)",
    "function transferTaxBps() view returns (uint16)",
    "function swapThreshold() view returns (uint256)",
    "function totalPlatformRouted() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function tradingEnabled() view returns (bool)",
    "function totalSupply() view returns (uint256)",
    "function platformFeeReceiver() view returns (address)",
  ], p);
  const [buy, sell, transfer, threshold, routed, balance, trading, supply, receiver] =
    await Promise.all([
      token.buyTaxBps(), token.sellTaxBps(), token.transferTaxBps(),
      token.swapThreshold(), token.totalPlatformRouted(),
      token.balanceOf("0x0166eEc08FeB66Fbad1B9df279A90D5C4CDc7777"),
      token.tradingEnabled(), token.totalSupply(),
      token.platformFeeReceiver(),
    ]);
  const name = await token.name().catch(() => "?");
  const symbol = await token.symbol().catch(() => "?");
  console.log("=== " + name + " (" + symbol + ") ===");
  console.log("交易状态:", trading ? "开启" : "关闭");
  console.log("总供应:", ethers.formatUnits(supply, 18));
  console.log("买入税:", Number(buy)/100, "%");
  console.log("卖出税:", Number(sell)/100, "%");
  console.log("转账税:", Number(transfer)/100, "%");
  console.log("合约代币余额:", ethers.formatUnits(balance, 18));
  console.log("兑换阈值:", ethers.formatUnits(threshold, 18));
  console.log("已分平台费:", ethers.formatEther(routed), "BNB");
  console.log("收款地址:", receiver);
  console.log("匹配0xc5c8:", receiver.toLowerCase() === "0xc5c848Dc65d004Adc1c9DC54BBb3b3bB7084C1E9".toLowerCase());
  console.log("");
  if (!trading) console.log("交易没开启，收不到税");
  if (Number(buy)===0 && Number(sell)===0) console.log("税率=0%，没税可收");
  if (balance < threshold) console.log("代币不够阈值(" + ethers.formatUnits(threshold,18) + ")，不会swap。需要更多交易");
}
main().catch(e => console.error(e.message || e));
