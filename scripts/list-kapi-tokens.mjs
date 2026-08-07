import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://bsc-rpc.publicnode.com");
const factory = "0x6c3f15a06ca01dE33A1F1C38017D021e7A55BcE8";
const factoryAbi = [
  "function allTokensLength() view returns (uint256)",
  "function allTokens(uint256) view returns (address)",
  "function projects(address) view returns (address creator,address token,address vault,address paymentToken,address receiver,address platformFeeReceiver,bytes32 templateId,uint256 totalSupply,uint256 mintCount,uint256 whitelistMintCount,uint256 publicMintCount,uint256 mintPrice,uint256 maxMintPerWallet,bool whitelistEnabled,string metadataUri,uint64 createdAt,address rewardToken,uint256 rewardThreshold,uint16 buyTaxBps,uint16 sellTaxBps,uint16 transferTaxBps,uint16 addLiquidityTaxBps,uint16 removeLiquidityTaxBps,uint16 launchProtectionTaxBps,uint16 launchProtectionBlocks,uint32 claimWait,uint16 fundFeeBps,uint16 lpFeeBps,uint16 dividendFeeBps,uint16 burnFeeBps)",
];
const tokenAbi = ["function name() view returns (string)", "function symbol() view returns (string)"];

async function main() {
  const f = new ethers.Contract(factory, factoryAbi, provider);
  const count = Number(await f.allTokensLength());
  console.log("total tokens:", count);
  const start = Math.max(0, count - 10);
  for (let i = count - 1; i >= start; i--) {
    const tokenAddr = await f.allTokens(i);
    const p = await f.projects(tokenAddr).catch(() => null);
    if (!p) continue;
    const t = new ethers.Contract(tokenAddr, tokenAbi, provider);
    const name = await t.name().catch(() => "?");
    const symbol = await t.symbol().catch(() => "?");
    console.log(i, tokenAddr, symbol, "max:", p.maxMintPerWallet.toString(), "price:", p.mintPrice.toString(), "mints:", p.mintCount.toString(), "wl:", p.whitelistMintCount.toString());
  }
}

main().catch(console.error);
