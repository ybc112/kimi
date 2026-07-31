// Debug: test if backend vanity computation matches chain
require("dotenv").config();
const { Contract, JsonRpcProvider, getAddress, ContractFactory, keccak256, solidityPackedKeccak256, hexlify, randomBytes, ZeroAddress } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  const rootDir = process.cwd();
  const provider = new JsonRpcProvider(process.env.KIMIMINT_RPC_URL || process.env.BSC_RPC_URL, 56);
  const factoryArt = JSON.parse(fs.readFileSync(path.join(rootDir, "artifacts/contracts/mint/KimiMintLaunchFactory.sol/KimiMintLaunchFactory.json"), "utf8"));
  const tokenArt = JSON.parse(fs.readFileSync(path.join(rootDir, "artifacts/contracts/mint/KimiMintToken.sol/KimiMintToken.json"), "utf8"));

  const factoryAddr = process.env.KIMIMINT_FACTORY_ADDRESS || process.env.VITE_MINT_FACTORY_ADDRESS;
  const factory = new Contract(factoryAddr, factoryArt.abi, provider);

  const [feeRecipient, tokenDeployerAddr, suffix] = await Promise.all([
    factory.feeRecipient().then(v => getAddress(v)),
    factory.tokenDeployer().then(v => getAddress(v)),
    factory.requiredTokenSuffix(),
  ]);

  console.log("Factory:", factoryAddr);
  console.log("TokenDeployer:", tokenDeployerAddr);
  console.log("FeeRecipient:", feeRecipient);
  console.log("Suffix:", Number(suffix), "= 0x" + Number(suffix).toString(16));

  const creator = "0xe1F9Fb65BBb39ebd4d0C204c95513d3f6421c407";
  const params = {
    name: "TEST", symbol: "TST",
    metadataUri: "", templateId: "0x0000000000000000000000000000000000000000000000000000000000000000",
    receiver: creator, paymentToken: ZeroAddress,
    rewardToken: "0x55d398326f99059fF775485246999027B3197955",
    rewardThreshold: 0n, totalSupply: 1000000000000000000000000n,
  };
  const taxConfig = {
    buyTaxBps: 0, sellTaxBps: 0, transferTaxBps: 0,
    addLiquidityTaxBps: 0, removeLiquidityTaxBps: 0,
    launchProtectionTaxBps: 0, launchProtectionBlocks: 0,
    claimWait: 60, fundFeeBps: 0, lpFeeBps: 0,
    dividendFeeBps: 0, burnFeeBps: 0,
  };

  const tokenFactory = new ContractFactory(tokenArt.abi, tokenArt.bytecode);
  const deployTx = await tokenFactory.getDeployTransaction(
    {
      name: params.name, symbol: params.symbol, projectUri: params.metadataUri,
      templateId: params.templateId, receiver: params.receiver,
      platformFeeReceiver: feeRecipient, paymentToken: params.paymentToken,
      rewardToken: params.rewardToken, rewardThreshold: params.rewardThreshold,
      totalSupply: params.totalSupply,
    },
    taxConfig,
    factoryAddr,
  );

  const initCodeHash = keccak256(deployTx.data);
  console.log("initCodeHash:", initCodeHash);

  let found = false;
  for (let i = 0; i < 10000; i++) {
    const salt = hexlify(randomBytes(32));
    const tokenSalt = solidityPackedKeccak256(
      ["address", "bytes32", "string", "string", "uint256"],
      [creator, salt, params.name, params.symbol, 56],
    );
    const { ethers } = require("ethers");
    const addr = ethers.getCreate2Address(tokenDeployerAddr, tokenSalt, initCodeHash);
    if (addr.toLowerCase().endsWith("7777")) {
      console.log("FOUND! attempts:", i + 1, "Address:", addr);
      found = true;
      break;
    }
  }
  if (!found) console.log("NOT FOUND in 10000 attempts — BYTECODE MISMATCH!");
}
main().catch(e => console.error(e.message));
