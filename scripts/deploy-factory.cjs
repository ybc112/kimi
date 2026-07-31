// Deploy KimiMint ecosystem directly using ethers.js + pre-compiled artifacts
// Usage: node scripts/deploy-factory.cjs
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const KIMI_ADDRESS = "0x9Aa9CADEc931C58c2a22Bbc5381b266d12887777";
const FEE_RECIPIENT = "0xc5c848Dc65d004Adc1c9DC54BBb3b3bB7084C1E9";
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const CREATION_FEE_AMOUNT = ethers.parseUnits("10000", 18); // 10,000 KIMI
const CREATION_FEE_NATIVE = 0n;
const REQUIRED_TOKEN_SUFFIX = 0;

const projectRoot = path.resolve(__dirname, "..");

function readJson(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    throw new Error(`Failed to read ${filePath}: ${e.message}`);
  }
}

function getEnv(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

async function deploy(abi, bytecode, signer, args = []) {
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function main() {
  const privateKey = getEnv("PRIVATE_KEY");
  const rpcUrl = process.env.BSC_RPC_URL || process.env.RPC_URL || "https://bsc.publicnode.com";
  const provider = new ethers.JsonRpcProvider(rpcUrl, 56);
  const signer = new ethers.Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`, provider);

  console.log("Deploying with account:", signer.address);
  console.log("RPC:", rpcUrl);
  const balance = await provider.getBalance(signer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB");
  console.log("");

  // 1. TokenDeployer
  console.log("1/4 Deploying KimiMintTokenDeployer...");
  const tokenDepArtifact = readJson("artifacts/contracts/mint/KimiMintDeployers.sol/KimiMintTokenDeployer.json");
  const tokenDeployer = await deploy(tokenDepArtifact.abi, tokenDepArtifact.bytecode, signer);
  const tokenDeployerAddr = await tokenDeployer.getAddress();
  console.log("   TokenDeployer:", tokenDeployerAddr);

  // 2. VaultDeployer
  console.log("2/4 Deploying KimiMintVaultDeployer...");
  const vaultDepArtifact = readJson("artifacts/contracts/mint/KimiMintDeployers.sol/KimiMintVaultDeployer.json");
  const vaultDeployer = await deploy(vaultDepArtifact.abi, vaultDepArtifact.bytecode, signer);
  const vaultDeployerAddr = await vaultDeployer.getAddress();
  console.log("   VaultDeployer:", vaultDeployerAddr);

  // 3. Factory
  console.log("3/4 Deploying KimiMintLaunchFactory...");
  const factoryArtifact = readJson("artifacts/contracts/mint/KimiMintLaunchFactory.sol/KimiMintLaunchFactory.json");
  const factory = await deploy(factoryArtifact.abi, factoryArtifact.bytecode, signer, [
    FEE_RECIPIENT,
    CREATION_FEE_NATIVE,
    KIMI_ADDRESS,
    CREATION_FEE_AMOUNT,
    PANCAKE_ROUTER,
    tokenDeployerAddr,
    vaultDeployerAddr,
    REQUIRED_TOKEN_SUFFIX,
  ]);
  const factoryAddr = await factory.getAddress();
  console.log("   Factory:", factoryAddr);

  // 4. Set factory on deployers
  console.log("4/4 Setting factory on deployers...");
  const tokenDepContract = new ethers.Contract(tokenDeployerAddr, tokenDepArtifact.abi, signer);
  let tx = await tokenDepContract.setFactory(factoryAddr);
  await tx.wait();
  console.log("   TokenDeployer.setFactory done");

  const vaultDepContract = new ethers.Contract(vaultDeployerAddr, vaultDepArtifact.abi, signer);
  tx = await vaultDepContract.setFactory(factoryAddr);
  await tx.wait();
  console.log("   VaultDeployer.setFactory done");

  // Summary
  console.log("");
  console.log("=".repeat(56));
  console.log("Deployment Complete!");
  console.log("=".repeat(56));
  console.log("TokenDeployer:", tokenDeployerAddr);
  console.log("VaultDeployer:", vaultDeployerAddr);
  console.log("Factory:      ", factoryAddr);
  console.log("FeeRecipient: ", FEE_RECIPIENT);
  console.log("FeeToken:     ", KIMI_ADDRESS);
  console.log("FeeAmount:     10000 KIMI");
  console.log("Router:       ", PANCAKE_ROUTER);
  console.log("=".repeat(56));

  // Save deployment
  const deployDir = path.join(projectRoot, "deployments");
  fs.mkdirSync(deployDir, { recursive: true });
  const deployData = {
    network: "bsc",
    chainId: 56,
    factory: factoryAddr,
    tokenDeployer: tokenDeployerAddr,
    vaultDeployer: vaultDeployerAddr,
    feeRecipient: FEE_RECIPIENT,
    creationFeeToken: KIMI_ADDRESS,
    creationFeeAmount: CREATION_FEE_AMOUNT.toString(),
    liquidityRouter: PANCAKE_ROUTER,
    requiredTokenSuffix: REQUIRED_TOKEN_SUFFIX,
    deployedAt: new Date().toISOString(),
  };
  const deployFile = path.join(deployDir, "bsc-KimiMintLaunchFactory.json");
  fs.writeFileSync(deployFile, JSON.stringify(deployData, null, 2));
  console.log("\nSaved to:", deployFile);
  console.log("\nSet these env vars for backend:");
  console.log(`KIMIMINT_FACTORY_ADDRESS=${factoryAddr}`);
  console.log(`VITE_MINT_FACTORY_ADDRESS=${factoryAddr}`);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exitCode = 1;
});
