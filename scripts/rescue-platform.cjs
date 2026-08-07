// Rescue stranded platform tokens: call _swapBackNative directly
require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
  const pk = "0x" + (process.env.PRIVATE_KEY || "").replace("0x", "");
  const p = new ethers.JsonRpcProvider("https://bsc.publicnode.com", 56);
  const signer = new ethers.Wallet(pk, p);
  const addr = "0x518afd31a57ffb9b06691d55288395105c3c7777";

  const token = new ethers.Contract(addr, [
    "function _swapBackNative(uint256,uint256,uint256,uint256) external returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function platformFeeReceiver() view returns (address)",
    "function receiver() view returns (address)",
  ], signer);

  const balance = await token.balanceOf(addr);
  const platform = await token.platformFeeReceiver();
  const receiver = await token.receiver();

  console.log("合约余额:", ethers.formatUnits(balance, 18), "Cs");
  console.log("平台收款(platformFeeReceiver):", platform);
  console.log("创建者(receiver):", receiver);
  console.log("");

  if (balance === 0n) {
    console.log("合约没有余额，无需处理");
    return;
  }

  // Call _swapBackNative with ALL tokens going to platform
  // platformTokens = balance, marketingTokens = 0, liquidityHalf = 0, nativeSwapTokens = balance
  console.log("执行 _swapBackNative(balance, 0, 0, balance)");
  console.log("→ 全部兑换 BNB 打给 platformFeeReceiver:", platform);
  console.log("");

  try {
    const tx = await token._swapBackNative(balance, 0, 0, balance);
    console.log("TX:", tx.hash);
    console.log("等待确认...");
    await tx.wait();
    console.log("✅ 完成！");

    // Check result
    const newBalance = await token.balanceOf(addr);
    console.log("剩余余额:", ethers.formatUnits(newBalance, 18), "Cs");
  } catch(e) {
    console.error("失败:", e.shortMessage || e.message);
  }
}
main().catch(e => console.error(e.message || e));
