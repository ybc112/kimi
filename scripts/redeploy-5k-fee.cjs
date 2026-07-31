// Redeploy: TokenDeployer + VaultDeployer + Factory with 5000 KIMI fee + suffix 7777
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const KIMI_ADDRESS = "0x9Aa9CADEc931C58c2a22Bbc5381b266d12887777";
const FEE_RECIPIENT = "0xc5c848Dc65d004Adc1c9DC54BBb3b3bB7084C1E9";
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const CREATION_FEE_AMOUNT = ethers.parseUnits("5000", 18); // 5000 KIMI
const CREATION_FEE_NATIVE = 0n;
const REQUIRED_TOKEN_SUFFIX = 0x7777;

const projectRoot = path.resolve(__dirname, "..");
function readJson(r) { return JSON.parse(fs.readFileSync(path.join(projectRoot, r), "utf8")); }

async function deploy(abi, bytecode, signer, args = []) {
  const f = new ethers.ContractFactory(abi, bytecode, signer);
  const c = await f.deploy(...args);
  await c.waitForDeployment();
  return c;
}

async function main() {
  const pk = (process.env.PRIVATE_KEY || "").startsWith("0x") ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`;
  const rpc = process.env.BSC_RPC_URL || "https://aged-bitter-borough.bsc.quiknode.pro/54b8018087f29ffeb7ac53126a9e3053d1e06bc0/";
  const provider = new ethers.JsonRpcProvider(rpc, 56);
  const signer = new ethers.Wallet(pk, provider);

  console.log("Account:", signer.address);
  console.log("Balance:", ethers.formatEther(await provider.getBalance(signer.address)), "BNB");
  console.log("");

  // 1. TokenDeployer
  console.log("1/4 TokenDeployer...");
  const td = await deploy(readJson("artifacts/contracts/mint/KimiMintDeployers.sol/KimiMintTokenDeployer.json").abi, readJson("artifacts/contracts/mint/KimiMintDeployers.sol/KimiMintTokenDeployer.json").bytecode, signer);
  const tdAddr = await td.getAddress();
  console.log("   ", tdAddr);

  // 2. VaultDeployer
  console.log("2/4 VaultDeployer...");
  const vd = await deploy(readJson("artifacts/contracts/mint/KimiMintDeployers.sol/KimiMintVaultDeployer.json").abi, readJson("artifacts/contracts/mint/KimiMintDeployers.sol/KimiMintVaultDeployer.json").bytecode, signer);
  const vdAddr = await vd.getAddress();
  console.log("   ", vdAddr);

  // 3. Factory
  console.log("3/4 Factory (5000 KIMI, suffix 7777)...");
  const factory = await deploy(readJson("artifacts/contracts/mint/KimiMintLaunchFactory.sol/KimiMintLaunchFactory.json").abi, readJson("artifacts/contracts/mint/KimiMintLaunchFactory.sol/KimiMintLaunchFactory.json").bytecode, signer, [FEE_RECIPIENT, CREATION_FEE_NATIVE, KIMI_ADDRESS, CREATION_FEE_AMOUNT, PANCAKE_ROUTER, tdAddr, vdAddr, REQUIRED_TOKEN_SUFFIX]);
  const fAddr = await factory.getAddress();
  console.log("   ", fAddr);

  // 4. Set factory
  console.log("4/4 setFactory...");
  await (new ethers.Contract(tdAddr, readJson("artifacts/contracts/mint/KimiMintDeployers.sol/KimiMintTokenDeployer.json").abi, signer)).setFactory(fAddr);
  await (new ethers.Contract(vdAddr, readJson("artifacts/contracts/mint/KimiMintDeployers.sol/KimiMintVaultDeployer.json").abi, signer)).setFactory(fAddr);
  console.log("   Done");

  console.log("");
  console.log("=".repeat(56));
  console.log("TokenDeployer:", tdAddr);
  console.log("VaultDeployer:", vdAddr);
  console.log("Factory:      ", fAddr);
  console.log("Fee:           5000 KIMI");
  console.log("Suffix:        0x7777");
  console.log("=".repeat(56));

  const dd = path.join(projectRoot, "deployments");
  fs.mkdirSync(dd, { recursive: true });
  fs.writeFileSync(path.join(dd, "bsc-KimiMintLaunchFactory.json"), JSON.stringify({ network: "bsc", chainId: 56, factory: fAddr, tokenDeployer: tdAddr, vaultDeployer: vdAddr, feeRecipient: FEE_RECIPIENT, creationFeeToken: KIMI_ADDRESS, creationFeeAmount: CREATION_FEE_AMOUNT.toString(), liquidityRouter: PANCAKE_ROUTER, requiredTokenSuffix: REQUIRED_TOKEN_SUFFIX, deployedAt: new Date().toISOString() }, null, 2));
  console.log("\nKIMIMINT_FACTORY_ADDRESS=" + fAddr);
}

main().catch(e => { console.error(e); process.exitCode = 1; });
