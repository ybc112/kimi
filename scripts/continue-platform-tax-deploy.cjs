require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const TOKEN_DEPLOYER = process.env.KIMIMINT_TOKEN_DEPLOYER_ADDRESS;
const FEE_RECIPIENT = "0xc5c848Dc65d004Adc1c9DC54BBb3b3bB7084C1E9";
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const CREATION_FEE = ethers.parseEther("0.005");
const ZERO_ADDRESS = ethers.ZeroAddress;
const REQUIRED_TOKEN_SUFFIX = 0x7777;
const projectRoot = path.resolve(__dirname, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

async function deploy(artifact, signer, args = []) {
  const contract = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer).deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function main() {
  if (!TOKEN_DEPLOYER || !ethers.isAddress(TOKEN_DEPLOYER)) {
    throw new Error("KIMIMINT_TOKEN_DEPLOYER_ADDRESS is required");
  }
  const rawKey = process.env.PRIVATE_KEY || "";
  if (!rawKey) throw new Error("PRIVATE_KEY is required");

  const rpc = process.env.DEPLOY_RPC_URL || "https://bsc-dataseed.binance.org/";
  const provider = new ethers.JsonRpcProvider(rpc, 56, { staticNetwork: true });
  const signer = new ethers.Wallet(rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`, provider);
  const tokenArtifact = readJson("artifacts/contracts/mint/KimiMintDeployers.sol/KimiMintTokenDeployer.json");
  const vaultArtifact = readJson("artifacts/contracts/mint/KimiMintDeployers.sol/KimiMintVaultDeployer.json");
  const factoryArtifact = readJson("artifacts/contracts/mint/KimiMintLaunchFactory.sol/KimiMintLaunchFactory.json");

  console.log("Account:", signer.address);
  console.log("Balance:", ethers.formatEther(await provider.getBalance(signer.address)), "BNB");
  console.log("TokenDeployer:", TOKEN_DEPLOYER);

  const vaultDeployer = await deploy(vaultArtifact, signer);
  const vaultDeployerAddress = await vaultDeployer.getAddress();
  console.log("VaultDeployer:", vaultDeployerAddress);

  const factory = await deploy(factoryArtifact, signer, [
    FEE_RECIPIENT,
    CREATION_FEE,
    ZERO_ADDRESS,
    0n,
    PANCAKE_ROUTER,
    TOKEN_DEPLOYER,
    vaultDeployerAddress,
    REQUIRED_TOKEN_SUFFIX,
  ]);
  const factoryAddress = await factory.getAddress();
  console.log("Factory:", factoryAddress);

  const tokenDeployer = new ethers.Contract(TOKEN_DEPLOYER, tokenArtifact.abi, signer);
  await (await tokenDeployer.setFactory(factoryAddress)).wait();
  await (await vaultDeployer.setFactory(factoryAddress)).wait();

  const deployment = {
    network: "bsc",
    chainId: 56,
    factory: factoryAddress,
    tokenDeployer: TOKEN_DEPLOYER,
    vaultDeployer: vaultDeployerAddress,
    feeRecipient: FEE_RECIPIENT,
    creationFee: CREATION_FEE.toString(),
    creationFeeToken: ZERO_ADDRESS,
    creationFeeAmount: "0",
    liquidityRouter: PANCAKE_ROUTER,
    requiredTokenSuffix: REQUIRED_TOKEN_SUFFIX,
    platformTaxShareBps: 1_000,
    deployedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.join(projectRoot, "deployments"), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, "deployments", "bsc-KimiMintLaunchFactory.json"),
    `${JSON.stringify(deployment, null, 2)}\n`,
  );
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error.shortMessage || error.message || error);
  process.exitCode = 1;
});
