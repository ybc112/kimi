const fs = require("node:fs");
const path = require("node:path");
const { ContractFactory, JsonRpcProvider, Wallet, isAddress, getAddress } = require("ethers");

async function main() {
  const rpc = process.env.BSC_RPC_URL || process.env.RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  const recipient = process.env.NFT_FEE_RECIPIENT || process.env.KIMIMINT_FEE_RECIPIENT;
  if (!rpc || !privateKey || !recipient || !isAddress(recipient)) throw new Error("BSC_RPC_URL, PRIVATE_KEY and NFT_FEE_RECIPIENT are required");
  const suffixText = String(process.env.NFT_REQUIRED_SUFFIX || "0").replace(/^0x/i, "");
  const suffix = Number.parseInt(suffixText || "0", 16);
  if (!Number.isInteger(suffix) || suffix < 0 || suffix > 0xffff) throw new Error("NFT_REQUIRED_SUFFIX must be 0-ffff");
  const artifact = JSON.parse(fs.readFileSync(path.join(process.cwd(), "artifacts/contracts/nft/KimiNFTLaunchFactory.sol/KimiNFTLaunchFactory.json"), "utf8"));
  const provider = new JsonRpcProvider(rpc, 56);
  const signer = new Wallet(privateKey, provider);
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);
  const gasPrice = await provider.getFeeData();
  const contract = await factory.deploy(getAddress(recipient), suffix, {
    gasLimit: 3_000_000n,
    maxFeePerGas: gasPrice.maxFeePerGas || undefined,
    maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas || undefined,
  });
  console.log(`broadcast ${contract.deploymentTransaction()?.hash || ""}`);
  const tx = contract.deploymentTransaction();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const network = await provider.getNetwork();
  const output = { network: "bsc", chainId: Number(network.chainId), factory: address, deployer: signer.address, deploymentTx: tx?.hash || "", feeRecipient: getAddress(recipient), creationFee: "10000000000000000", requiredCollectionSuffix: suffixText.padStart(4, "0"), deployedAt: new Date().toISOString() };
  const target = path.join(process.cwd(), "deployments", "bsc-KimiNFTLaunchFactory.json");
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify({ factory: address, deploymentTx: tx?.hash || "", chainId: Number(network.chainId) }));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
