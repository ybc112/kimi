// Full redeploy: TokenDeployer + VaultDeployer + Factory with suffix 7777
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const KIMI_ADDRESS = "0x9Aa9CADEc931C58c2a22Bbc5381b266d12887777";
const FEE_RECIPIENT = "0xc5c848Dc65d004Adc1c9DC54BBb3b3bB7084C1E9";
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const REQUIRED_TOKEN_SUFFIX = 0x7777;
const CREATION_FEE_AMOUNT = ethers.parseUnits("10000", 18);
const CREATION_FEE_NATIVE = 0n;

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

  console.log("Full redeploy with suffix 7777");
  console.log("Account:", signer.address);
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

  // 3. Factory with suffix 7777
  console.log("3/4 Deploying KimiMintLaunchFactory (suffix 7777)...");
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
  let tx = await tokenDeployer.setFactory(factoryAddr);
  await tx.wait();
  tx = await vaultDeployer.setFactory(factoryAddr);
  await tx.wait();
  console.log("   Done");

  // Verify
  const suffix = await factory.requiredTokenSuffix();
  console.log("   requiredTokenSuffix:", Number(suffix), "=", "0x" + Number(suffix).toString(16));

  console.log("");
  console.log("=".repeat(56));
  console.log("Deployment Complete (suffix 7777)");
  console.log("=".repeat(56));
  console.log("TokenDeployer:", tokenDeployerAddr);
  console.log("VaultDeployer:", vaultDeployerAddr);
  console.log("Factory:      ", factoryAddr);
  console.log("=".repeat(56));

  const deployDir = path.join(projectRoot, "deployments");
  fs.mkdirSync(deployDir, { recursive: true });
  const deployData = {
    network: "bsc", chainId: 56,
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
  fs.writeFileSync(path.join(deployDir, "bsc-KimiMintLaunchFactory.json"), JSON.stringify(deployData, null, 2));
  console.log("\nBackend env:");
  console.log(`KIMIMINT_FACTORY_ADDRESS=${factoryAddr}`);
  console.log(`VITE_MINT_FACTORY_ADDRESS=${factoryAddr}`);
}

main().catch((err) => { console.error("Failed:", err); process.exitCode = 1; });
