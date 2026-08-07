require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const FEE_TOKEN = "0x839578f40b9a79a3fe891dd96079f3083e6e7777";
const PLATFORM_FEE_RECEIVER = "0x436fB3245Ad8377DF443Ca1c67f997705D5843bb";
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const CREATION_FEE_AMOUNT = ethers.parseUnits("35000", 18);
const REQUIRED_TOKEN_SUFFIX = 0x7777;
const projectRoot = path.resolve(__dirname, "..");

function artifact(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

async function deploy(contractArtifact, signer, args = []) {
  const factory = new ethers.ContractFactory(contractArtifact.abi, contractArtifact.bytecode, signer);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function main() {
  const rawKey = String(process.env.PRIVATE_KEY || "").trim();
  if (!rawKey) throw new Error("PRIVATE_KEY is not configured");
  const rpcUrl = process.env.KIMIMINT_RPC_URL || process.env.BSC_RPC_URL || "https://bsc-mainnet.public.blastapi.io";
  const provider = new ethers.JsonRpcProvider(rpcUrl, 56, { staticNetwork: true });
  const signer = new ethers.Wallet(rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`, provider);
  const balance = await provider.getBalance(signer.address);

  console.log("Deployer:", signer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB");
  console.log("Fee token:", FEE_TOKEN);
  console.log("Creation fee: 35000 tokens (burned)");
  console.log("Platform receiver:", PLATFORM_FEE_RECEIVER);
  console.log("Platform share: 10% of each configured transaction tax");

  const tokenArtifact = artifact("artifacts/contracts/mint/KimiMintDeployers.sol/KimiMintTokenDeployer.json");
  const vaultArtifact = artifact("artifacts/contracts/mint/KimiMintDeployers.sol/KimiMintVaultDeployer.json");
  const factoryArtifact = artifact("artifacts/contracts/mint/KimiMintLaunchFactory.sol/KimiMintLaunchFactory.json");

  const reusedTokenDeployer = String(process.env.REUSE_TOKEN_DEPLOYER || "").trim();
  const reusedVaultDeployer = String(process.env.REUSE_VAULT_DEPLOYER || "").trim();
  const tokenDeployer = reusedTokenDeployer
    ? new ethers.Contract(reusedTokenDeployer, tokenArtifact.abi, signer)
    : await deploy(tokenArtifact, signer);
  const vaultDeployer = reusedVaultDeployer
    ? new ethers.Contract(reusedVaultDeployer, vaultArtifact.abi, signer)
    : await deploy(vaultArtifact, signer);
  const tokenDeployerAddress = await tokenDeployer.getAddress();
  const vaultDeployerAddress = await vaultDeployer.getAddress();
  const launchFactory = await deploy(factoryArtifact, signer, [
    PLATFORM_FEE_RECEIVER,
    0n,
    FEE_TOKEN,
    CREATION_FEE_AMOUNT,
    PANCAKE_ROUTER,
    tokenDeployerAddress,
    vaultDeployerAddress,
    REQUIRED_TOKEN_SUFFIX,
  ]);
  const factoryAddress = await launchFactory.getAddress();

  await (await tokenDeployer.setFactory(factoryAddress)).wait();
  await (await vaultDeployer.setFactory(factoryAddress)).wait();

  const result = {
    network: "bsc",
    chainId: 56,
    factory: factoryAddress,
    tokenDeployer: tokenDeployerAddress,
    vaultDeployer: vaultDeployerAddress,
    platformFeeReceiver: PLATFORM_FEE_RECEIVER,
    platformTaxShareBps: 1000,
    creationFeeToken: FEE_TOKEN,
    creationFeeAmount: CREATION_FEE_AMOUNT.toString(),
    creationFeeBurnAddress: "0x000000000000000000000000000000000000dEaD",
    liquidityRouter: PANCAKE_ROUTER,
    requiredTokenSuffix: REQUIRED_TOKEN_SUFFIX,
    deployedAt: new Date().toISOString(),
  };
  const output = path.join(projectRoot, "deployments", "bsc-kapi-mint.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2));

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
