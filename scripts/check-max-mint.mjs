import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://bsc-rpc.publicnode.com");
const factoryAbi = [
  "function projects(address) view returns (address creator,address token,address vault,address paymentToken,address receiver,address platformFeeReceiver,bytes32 templateId,uint256 totalSupply,uint256 mintCount,uint256 whitelistMintCount,uint256 publicMintCount,uint256 mintPrice,uint256 maxMintPerWallet,bool whitelistEnabled,string metadataUri,uint64 createdAt,address rewardToken,uint256 rewardThreshold,uint16 buyTaxBps,uint16 sellTaxBps,uint16 transferTaxBps,uint16 addLiquidityTaxBps,uint16 removeLiquidityTaxBps,uint16 launchProtectionTaxBps,uint16 launchProtectionBlocks,uint32 claimWait,uint16 fundFeeBps,uint16 lpFeeBps,uint16 dividendFeeBps,uint16 burnFeeBps)",
  "function getProject(address token) view returns ((address creator,address token,address vault,address paymentToken,address receiver,address platformFeeReceiver,bytes32 templateId,uint256 totalSupply,uint256 mintCount,uint256 whitelistMintCount,uint256 publicMintCount,uint256 mintPrice,uint256 maxMintPerWallet,bool whitelistEnabled,string metadataUri,uint64 createdAt,address rewardToken,uint256 rewardThreshold,uint16 buyTaxBps,uint16 sellTaxBps,uint16 transferTaxBps,uint16 addLiquidityTaxBps,uint16 removeLiquidityTaxBps,uint16 launchProtectionTaxBps,uint16 launchProtectionBlocks,uint32 claimWait,uint16 fundFeeBps,uint16 lpFeeBps,uint16 dividendFeeBps,uint16 burnFeeBps))",
];

const tokens = [
  { factory: "0xE1CD783bcE52E8945B0FB539AA106aa35b08879e", token: "0x7685ac3047ee9C95798E4DA688c890CD25Ff7777" },
];

async function main() {
  for (const { factory: f, token } of tokens) {
    console.log("\n===", token, "factory", f, "===");
    const factory = new ethers.Contract(f, factoryAbi, provider);
    try {
      const p = await factory.projects(token);
      console.log("maxMintPerWallet (named):", p.maxMintPerWallet.toString());
      console.log("mintPrice:", p.mintPrice.toString());
      console.log("maxMintPerWallet index 12:", p[12]?.toString());
      console.log("index 11:", p[11]?.toString());
    } catch (e) {
      console.log("projects error:", e.shortMessage || e.message);
    }
    try {
      const p2 = await factory.getProject(token);
      console.log("getProject maxMintPerWallet:", p2.maxMintPerWallet.toString());
    } catch (e) {
      console.log("getProject error:", e.shortMessage || e.message);
    }
  }
}

main().catch(console.error);
