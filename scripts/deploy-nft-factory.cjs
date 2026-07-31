require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { ethers } = require("hardhat");

async function main() {
  const recipient = process.env.NFT_FEE_RECIPIENT || process.env.KIMIMINT_FEE_RECIPIENT;
  if (!recipient || !ethers.isAddress(recipient)) throw new Error("NFT_FEE_RECIPIENT is required");
  const suffixText = String(process.env.NFT_REQUIRED_SUFFIX || "0").replace(/^0x/i, "");
  const suffix = Number.parseInt(suffixText || "0", 16);
  if (!Number.isInteger(suffix) || suffix < 0 || suffix > 0xffff) throw new Error("NFT_REQUIRED_SUFFIX must be 0-ffff");
  const Factory = await ethers.getContractFactory("KimiNFTLaunchFactory");
  const factory = await Factory.deploy(recipient, suffix);
  await factory.waitForDeployment();
  const address = await factory.getAddress();
  const network = await ethers.provider.getNetwork();
  const output = { network: network.name, chainId: Number(network.chainId), factory: address, feeRecipient: ethers.getAddress(recipient), creationFee: ethers.parseEther("0.01").toString(), requiredCollectionSuffix: suffixText.padStart(4, "0"), deployedAt: new Date().toISOString() };
  const target = path.join(process.cwd(), "deployments", `${network.name}-KimiNFTLaunchFactory.json`);
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, JSON.stringify(output, null, 2));
  console.log(`VITE_NFT_FACTORY_ADDRESS=${address}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
