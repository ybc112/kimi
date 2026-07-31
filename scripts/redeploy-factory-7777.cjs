// Redeploy KimiMintLaunchFactory with requiredTokenSuffix = 0x7777
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const KIMI_ADDRESS = "0x9Aa9CADEc931C58c2a22Bbc5381b266d12887777";
const FEE_RECIPIENT = "0xc5c848Dc65d004Adc1c9DC54BBb3b3bB7084C1E9";
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const CREATION_FEE_AMOUNT = ethers.parseUnits("10000", 18);
const CREATION_FEE_NATIVE = 0n;
const REQUIRED_TOKEN_SUFFIX = 0x7777; // 靓号后缀 7777
const TOKEN_DEPLOYER_ADDR = "0x4c549bB4EB1d4BE475d00654999c86210E642Ca1";
const VAULT_DEPLOYER_ADDR = "0x2B8181B02D5bec9449440Eef88265C15bC4392e7";

const projectRoot = path.resolve(__dirname, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

async function deploy(abi, bytecode, signer, args = []) {
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function main() {
  const privateKey = (process.env.PRIVATE_KEY || "").startsWith("0x")
    ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`;
  const rpcUrl = process.env.BSC_RPC_URL || process.env.KIMIMINT_RPC_URL || "https://bsc.publicnode.com";
  const provider = new ethers.JsonRpcProvider(rpcUrl, 56);
  const signer = new ethers.Wallet(privateKey, provider);

  console.log("Redeploying Factory with suffix 7777");
  console.log("Account:", signer.address);
  const balance = await provider.getBalance(signer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB");
  console.log("");

  // Deploy Factory with requiredTokenSuffix = 0x7777
  console.log("Deploying KimiMintLaunchFactory...");
  const factoryArtifact = readJson("artifacts/contracts/mint/KimiMintLaunchFactory.sol/KimiMintLaunchFactory.json");
  const factory = await deploy(factoryArtifact.abi, factoryArtifact.bytecode, signer, [
    FEE_RECIPIENT,
    CREATION_FEE_NATIVE,
    KIMI_ADDRESS,
    CREATION_FEE_AMOUNT,
    PANCAKE_ROUTER,
    TOKEN_DEPLOYER_ADDR,
    VAULT_DEPLOYER_ADDR,
    REQUIRED_TOKEN_SUFFIX,
  ]);
  const factoryAddr = await factory.getAddress();
  console.log("   New Factory:", factoryAddr);

  // Set factory on deployers
  console.log("Updating factory on deployers...");
  const tokenDepArtifact = readJson("artifacts/contracts/mint/KimiMintDeployers.sol/KimiMintTokenDeployer.json");
  const tokenDepContract = new ethers.Contract(TOKEN_DEPLOYER_ADDR, tokenDepArtifact.abi, signer);
  let tx = await tokenDepContract.setFactory(factoryAddr);
  await tx.wait();
  console.log("   TokenDeployer.setFactory done");

  const vaultDepArtifact = readJson("artifacts/contracts/mint/KimiMintDeployers.sol/KimiMintVaultDeployer.json");
  const vaultDepContract = new ethers.Contract(VAULT_DEPLOYER_ADDR, vaultDepArtifact.abi, signer);
  tx = await vaultDepContract.setFactory(factoryAddr);
  await tx.wait();
  console.log("   VaultDeployer.setFactory done");

  // Verify suffix
  const suffix = await factory.requiredTokenSuffix();
  console.log("   requiredTokenSuffix:", Number(suffix), "hex:", Number(suffix).toString(16));

  // Save deployment
  const deployDir = path.join(projectRoot, "deployments");
  fs.mkdirSync(deployDir, { recursive: true });
  const deployData = {
    network: "bsc",
    chainId: 56,
    factory: factoryAddr,
    tokenDeployer: TOKEN_DEPLOYER_ADDR,
    vaultDeployer: VAULT_DEPLOYER_ADDR,
    feeRecipient: FEE_RECIPIENT,
    creationFeeToken: KIMI_ADDRESS,
    creationFeeAmount: CREATION_FEE_AMOUNT.toString(),
    liquidityRouter: PANCAKE_ROUTER,
    requiredTokenSuffix: REQUIRED_TOKEN_SUFFIX,
    deployedAt: new Date().toISOString(),
  };
  const deployFile = path.join(deployDir, "bsc-KimiMintLaunchFactory.json");
  fs.writeFileSync(deployFile, JSON.stringify(deployData, null, 2));

  console.log("");
  console.log("========================================");
  console.log("New Factory Address:", factoryAddr);
  console.log("Suffix: 0x7777");
  console.log("========================================");
  console.log("");
  console.log("Backend env vars to update:");
  console.log(`KIMIMINT_FACTORY_ADDRESS=${factoryAddr}`);
  console.log(`VITE_MINT_FACTORY_ADDRESS=${factoryAddr}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exitCode = 1;
});
