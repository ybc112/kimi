// Deploy Snowball Launch TokenFactory (BananaToken) on BSC mainnet
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

// 走系统代理（WSL 直连 RPC 不稳定，curl 走 https_proxy 稳定）
let proxyDispatcher;
try {
  const { ProxyAgent } = require("undici");
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxyUrl) proxyDispatcher = new ProxyAgent(proxyUrl);
} catch { /* undici 缺失时忽略 */ }

const FEE_RECIPIENT = "0x718CF3Ee064f063E5ef2779F56dd89Be9123A91C"; // 2026-08-17 平台税新地址
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const CREATION_FEE_NATIVE = ethers.parseEther("0.005");
const REQUIRED_TOKEN_SUFFIX = 0;

// 显式 gasLimit：公共 RPC 的 eth_estimateGas 返回错误值(53793)会导致部署失败。
// 本地 EVM 实测：TokenDeployer 5.3M / DividendTracker 1.6M / TokenFactory 2.1M，此处加 20-30% 余量。
const GAS_LIMITS = {
  BananaTokenDeployer: 6_500_000,
  BABYTOKENDividendTracker: 2_200_000,
  TokenFactory: 2_800_000,
  setFactory: 1_000_000,
};
// 显式 gasPrice：节点返回的 0.05 gwei 可能低于链最低值被拒；1 gwei 足够（可被 GAS_PRICE_GWEI 覆盖）
const GAS_PRICE = ethers.parseUnits(process.env.GAS_PRICE_GWEI || "1", "gwei");

const projectRoot = path.resolve(__dirname, "..");

function readJson(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function deployArtifact(name, signer, args = [], gasLimit) {
  const artifact = readJson(`artifacts/contracts/tokenfactory/${name}.sol/${name}.json`);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(...args, { gasLimit, gasPrice: GAS_PRICE });
  await contract.waitForDeployment();
  return contract;
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("Missing PRIVATE_KEY");
  const rpcUrl = process.env.BSC_RPC_URL || process.env.RPC_URL || "https://bsc.drpc.org";
  // batchMaxCount: 1 避免免费 RPC 拒绝批量请求；pollingInterval 降低轮询频率防限流
  const provider = new ethers.JsonRpcProvider(rpcUrl, 56, {
    batchMaxCount: 1,
    pollingInterval: 5000,
    fetchOptions: proxyDispatcher ? { dispatcher: proxyDispatcher } : undefined,
  });
  const signer = new ethers.Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`, provider);

  console.log("Deploying Snowball Factory with account:", signer.address);
  console.log("RPC:", rpcUrl);
  const balance = await provider.getBalance(signer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB");
  if (balance < ethers.parseEther("0.02")) {
    console.warn("余额低于 0.02 BNB，部署可能失败");
  }
  console.log("");

  // 1. TokenDeployer
  console.log("1/4 Deploying BananaTokenDeployer...");
  const tokenDeployer = await deployArtifact("BananaTokenDeployer", signer, [], GAS_LIMITS.BananaTokenDeployer);
  const tokenDeployerAddr = await tokenDeployer.getAddress();
  console.log("   TokenDeployer:", tokenDeployerAddr);

  // 2. DividendTracker implementation
  console.log("2/4 Deploying BABYTOKENDividendTracker implementation...");
  const trackerArtifact = readJson("artifacts/contracts/tokenfactory/BananaToken.sol/BABYTOKENDividendTracker.json");
  const trackerFactory = new ethers.ContractFactory(trackerArtifact.abi, trackerArtifact.bytecode, signer);
  const trackerImpl = await trackerFactory.deploy({ gasLimit: GAS_LIMITS.BABYTOKENDividendTracker, gasPrice: GAS_PRICE });
  await trackerImpl.waitForDeployment();
  const trackerImplAddr = await trackerImpl.getAddress();
  console.log("   DividendTrackerImpl:", trackerImplAddr);

  // 3. TokenFactory
  console.log("3/4 Deploying TokenFactory...");
  const factoryArtifact = readJson("artifacts/contracts/tokenfactory/TokenFactory.sol/TokenFactory.json");
  const factoryFactory = new ethers.ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, signer);
  const factory = await factoryFactory.deploy(
    FEE_RECIPIENT,
    CREATION_FEE_NATIVE,
    PANCAKE_ROUTER,
    trackerImplAddr,
    tokenDeployerAddr,
    REQUIRED_TOKEN_SUFFIX,
    { gasLimit: GAS_LIMITS.TokenFactory, gasPrice: GAS_PRICE }
  );
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("   Factory:", factoryAddr);

  // 4. Set factory on deployer
  console.log("4/4 Setting factory on BananaTokenDeployer...");
  const tx = await tokenDeployer.setFactory(factoryAddr, { gasLimit: GAS_LIMITS.setFactory, gasPrice: GAS_PRICE });
  await tx.wait();
  console.log("   TokenDeployer.setFactory done");

  console.log("");
  console.log("=".repeat(56));
  console.log("Snowball Factory Deployment Complete");
  console.log("=".repeat(56));
  console.log("TokenDeployer:", tokenDeployerAddr);
  console.log("DividendTrackerImpl:", trackerImplAddr);
  console.log("Factory:      ", factoryAddr);
  console.log("FeeRecipient: ", FEE_RECIPIENT);
  console.log("CreationFee:  ", ethers.formatEther(CREATION_FEE_NATIVE), "BNB");
  console.log("Router:       ", PANCAKE_ROUTER);
  console.log("=".repeat(56));

  const deployDir = path.join(projectRoot, "deployments");
  fs.mkdirSync(deployDir, { recursive: true });
  const deployData = {
    network: "bsc",
    chainId: 56,
    factory: factoryAddr,
    tokenDeployer: tokenDeployerAddr,
    dividendTrackerImpl: trackerImplAddr,
    feeRecipient: FEE_RECIPIENT,
    creationFee: CREATION_FEE_NATIVE.toString(),
    creationFeeToken: ethers.ZeroAddress,
    liquidityRouter: PANCAKE_ROUTER,
    requiredTokenSuffix: REQUIRED_TOKEN_SUFFIX,
    deployedAt: new Date().toISOString(),
  };
  const deployFile = path.join(deployDir, "bsc-SnowballTokenFactory.json");
  fs.writeFileSync(deployFile, JSON.stringify(deployData, null, 2));
  console.log("\nSaved to:", deployFile);
  console.log("\nSet these env vars:");
  console.log(`VITE_SNOWBALL_FACTORY_ADDRESS=${factoryAddr}`);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exitCode = 1;
});
