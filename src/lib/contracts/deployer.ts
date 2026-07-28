import { ethers } from "ethers";
import { KIMI_BURN_ADDRESS, KIMI_TOKEN_ADDRESS } from "./kimiToken";

export { KIMI_BURN_ADDRESS, KIMI_TOKEN_ADDRESS } from "./kimiToken";

const configuredDeployFactory = import.meta.env.VITE_DEPLOY_FACTORY_ADDRESS?.trim();

/**
 * 该适配器仅保留给已有的自定义 deploy(bytes,bytes) 集成；页面的“工厂部署”使用
 * SnowballLaunchpad.createToken，不能把两种接口混用。
 */
export const DEPLOY_FACTORY_ADDRESS: string =
  configuredDeployFactory && ethers.isAddress(configuredDeployFactory)
    ? ethers.getAddress(configuredDeployFactory)
    : ethers.ZeroAddress;

export const IS_DEPLOY_FACTORY_CONFIGURED = DEPLOY_FACTORY_ADDRESS !== ethers.ZeroAddress;

// 部署费：20,000 KIMI，18 位小数
export const DEPLOY_BURN_AMOUNT = 20_000n * 10n ** 18n;

export const BSC_RPC_URL = "https://bsc-dataseed.binance.org/";
export const BSC_CHAIN_ID = 56;
export const BSC_EXPLORER = "https://bscscan.com";

export const EXPLORERS: Record<string, string> = {
  bsc: "https://bscscan.com",
  eth: "https://etherscan.io",
  arb: "https://arbiscan.io",
  base: "https://basescan.org",
};

export const RPCS: Record<string, string> = {
  bsc: "https://bsc-dataseed.binance.org/",
  eth: "https://ethereum-rpc.publicnode.com",
  arb: "https://arbitrum-one.publicnode.com",
  base: "https://base.publicnode.com",
};

export const CHAIN_IDS: Record<string, number> = {
  bsc: 56,
  eth: 1,
  arb: 42161,
  base: 8453,
};

export const DEPLOY_FACTORY_ABI = [
  "function deploy(bytes bytecode, bytes args) external payable returns (address deployed)",
  "function getDeployFee() external view returns (uint256)",
  "event ContractDeployed(address indexed deployer, address indexed deployed, uint256 fee)",
];

export interface DeploymentResult {
  address: string;
  deployTxHash: string;
}

export interface DeploymentArtifact {
  abi: unknown[];
  bytecode: string;
  contractName?: string;
}

type ArtifactLike = {
  abi?: unknown;
  bytecode?: string | { object?: string };
  evm?: { bytecode?: { object?: string } };
  contractName?: unknown;
};

function readArtifactCandidate(value: unknown, fallbackName?: string): DeploymentArtifact | null {
  if (!value || typeof value !== "object") return null;
  const artifact = value as ArtifactLike;
  const bytecode =
    typeof artifact.bytecode === "string"
      ? artifact.bytecode
      : artifact.bytecode?.object || artifact.evm?.bytecode?.object || "";
  if (!Array.isArray(artifact.abi) || !bytecode) return null;
  return {
    abi: artifact.abi,
    bytecode: normalizeBytecode(bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`),
    contractName: typeof artifact.contractName === "string" ? artifact.contractName : fallbackName,
  };
}

export function extractDeploymentArtifact(value: unknown): DeploymentArtifact {
  const direct = readArtifactCandidate(value);
  if (direct) return direct;

  const contracts = (value as { contracts?: unknown } | null)?.contracts;
  if (contracts && typeof contracts === "object") {
    const candidates: DeploymentArtifact[] = [];
    for (const sourceContracts of Object.values(contracts)) {
      if (!sourceContracts || typeof sourceContracts !== "object") continue;
      for (const [contractName, artifact] of Object.entries(sourceContracts)) {
        const candidate = readArtifactCandidate(artifact, contractName);
        if (candidate) candidates.push(candidate);
      }
    }
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      throw new Error(`标准 JSON 中包含 ${candidates.length} 个可部署合约，请导出并上传单个合约 Artifact`);
    }
  }

  throw new Error("Artifact 必须包含 abi 和 creation bytecode；支持 Hardhat、Foundry 与 solc 标准 JSON");
}

function parseAbi(abi: string): ethers.InterfaceAbi {
  if (!abi.trim()) throw new Error("请填写合约 ABI");
  let parsed: unknown;
  try {
    parsed = JSON.parse(abi);
  } catch {
    throw new Error("ABI 不是有效的 JSON");
  }
  if (!Array.isArray(parsed)) throw new Error("ABI 必须是 JSON 数组");
  return parsed as ethers.InterfaceAbi;
}

export function normalizeBytecode(input: string): string {
  const bytecode = input.trim();
  if (!bytecode || bytecode === "0x") throw new Error("请填写编译后的合约创建 Bytecode，不能只填写 0x");
  if (!ethers.isHexString(bytecode) || bytecode.length % 2 !== 0) {
    throw new Error("Bytecode 必须是以 0x 开头、长度为偶数的十六进制数据");
  }
  return bytecode;
}

function rejectUnsafeNumbers(value: unknown, path = "构造参数") {
  if (typeof value === "number" && (!Number.isFinite(value) || !Number.isSafeInteger(value))) {
    throw new Error(`${path} 中的大整数请使用字符串，例如 "1000000000000000000"`);
  }
  if (Array.isArray(value)) value.forEach((item, index) => rejectUnsafeNumbers(item, `${path}[${index}]`));
  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value).forEach(([key, item]) => rejectUnsafeNumbers(item, `${path}.${key}`));
  }
}

export function parseConstructorArgs(input: string): unknown[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) throw new Error("构造参数必须是 JSON 数组");
    rejectUnsafeNumbers(parsed);
    return parsed;
  } catch (error) {
    if (error instanceof Error && /JSON 数组|大整数/.test(error.message)) throw error;
    return trimmed.split(",").map((item) => {
      const value = item.trim();
      if (value === "true") return true;
      if (value === "false") return false;
      // 整数保持为字符串，避免 uint256 精度丢失。
      if (/^-?\d+$/.test(value)) return value;
      return value;
    });
  }
}

export function encodeConstructorArgs(abi: string, constructorArgs: unknown[]): string {
  const iface = new ethers.Interface(parseAbi(abi));
  const inputs = iface.deploy.inputs;
  if (inputs.length !== constructorArgs.length) {
    throw new Error(`构造函数需要 ${inputs.length} 个参数，当前填写了 ${constructorArgs.length} 个`);
  }
  if (inputs.length === 0) return "0x";
  return ethers.AbiCoder.defaultAbiCoder().encode(inputs, constructorArgs);
}

export function parseDeployValue(value: string): bigint {
  const normalized = value.trim() || "0";
  try {
    const parsed = ethers.parseEther(normalized);
    if (parsed < 0n) throw new Error();
    return parsed;
  } catch {
    throw new Error("附带的 ETH/BNB 数量格式不正确");
  }
}

export async function preflightBytecodeDeployment(params: {
  signer: ethers.Signer;
  bytecode: string;
  abi: string;
  constructorArgs: unknown[];
  value?: bigint;
}): Promise<bigint> {
  const bytecode = normalizeBytecode(params.bytecode);
  const factory = new ethers.ContractFactory(parseAbi(params.abi), bytecode, params.signer);
  const request = await factory.getDeployTransaction(...params.constructorArgs, { value: params.value ?? 0n });
  return params.signer.estimateGas(request);
}

export async function deployBytecode(params: {
  signer: ethers.Signer;
  bytecode: string;
  abi: string;
  constructorArgs: unknown[];
  value?: bigint;
  skipPreflight?: boolean;
}): Promise<DeploymentResult> {
  const bytecode = normalizeBytecode(params.bytecode);
  if (!params.skipPreflight) {
    await preflightBytecodeDeployment({ ...params, bytecode });
  }
  const factory = new ethers.ContractFactory(parseAbi(params.abi), bytecode, params.signer);
  const contract = await factory.deploy(...params.constructorArgs, { value: params.value ?? 0n });
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const deployTxHash = contract.deploymentTransaction()?.hash ?? "";
  if (!ethers.isAddress(address) || !deployTxHash) throw new Error("部署交易已确认，但未取得合约地址或交易哈希");
  return { address: ethers.getAddress(address), deployTxHash };
}

export async function deployViaFactory(params: {
  signer: ethers.Signer;
  bytecode: string;
  encodedArgs: string;
  constructorValue?: bigint;
}): Promise<DeploymentResult> {
  if (!IS_DEPLOY_FACTORY_CONFIGURED) {
    throw new Error("通用 deploy(bytes,bytes) 工厂未配置；KIMI 发币请在页面选择 KIMI 工厂模式");
  }
  const provider = params.signer.provider;
  if (!provider) throw new Error("钱包 Provider 不可用");
  const code = await provider.getCode(DEPLOY_FACTORY_ADDRESS);
  if (code === "0x") throw new Error("当前网络没有部署通用部署工厂");

  const bytecode = normalizeBytecode(params.bytecode);
  const contract = new ethers.Contract(DEPLOY_FACTORY_ADDRESS, DEPLOY_FACTORY_ABI, params.signer);
  let deployFee: bigint;
  try {
    deployFee = (await contract.getDeployFee()) as bigint;
  } catch {
    throw new Error("配置的地址不兼容通用部署工厂 ABI，请检查 VITE_DEPLOY_FACTORY_ADDRESS");
  }
  const value = deployFee + (params.constructorValue ?? 0n);
  await contract.deploy.estimateGas(bytecode, params.encodedArgs, { value });
  const tx = await contract.deploy(bytecode, params.encodedArgs, { value });
  const receipt = await tx.wait();
  const event = receipt?.logs
    .map((log: ethers.Log) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed: ethers.LogDescription | null) => parsed?.name === "ContractDeployed");
  const deployedAddress = event?.args?.deployed as string | undefined;
  if (!deployedAddress || !ethers.isAddress(deployedAddress)) {
    throw new Error("部署交易成功，但未找到 ContractDeployed 事件");
  }
  return { address: ethers.getAddress(deployedAddress), deployTxHash: tx.hash };
}

export function getExplorerUrl(network: string, path: string) {
  const base = EXPLORERS[network] ?? EXPLORERS.bsc;
  return `${base}${path}`;
}

const KIMI_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

export async function getKimiBalance(signer: ethers.Signer, account?: string): Promise<bigint> {
  const owner = account || (await signer.getAddress());
  const provider = signer.provider;
  if (!provider) throw new Error("钱包 Provider 不可用");
  const code = await provider.getCode(KIMI_TOKEN_ADDRESS);
  if (code === "0x") throw new Error("当前网络没有部署 KIMI 代币，请切换到 BNB Smart Chain");
  const contract = new ethers.Contract(KIMI_TOKEN_ADDRESS, KIMI_ABI, signer);
  return (await contract.balanceOf(owner)) as bigint;
}

export async function chargeKimiTokens(params: { signer: ethers.Signer; amount?: bigint }) {
  const amount = params.amount ?? DEPLOY_BURN_AMOUNT;
  if (amount <= 0n) throw new Error("KIMI 扣费数量必须大于 0");
  const provider = params.signer.provider;
  if (!provider) throw new Error("钱包 Provider 不可用");
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== BSC_CHAIN_ID) {
    throw new Error("官方 KIMI 仅在 BNB Smart Chain 上扣费，请先切换到 BSC");
  }
  const balance = await getKimiBalance(params.signer);
  if (balance < amount) {
    throw new Error(`官方 KIMI 余额不足，需要至少 20,000 KIMI（${KIMI_TOKEN_ADDRESS}）`);
  }
  const contract = new ethers.Contract(KIMI_TOKEN_ADDRESS, KIMI_ABI, params.signer);
  const canTransfer = (await contract.transfer.staticCall(KIMI_BURN_ADDRESS, amount)) as boolean;
  if (!canTransfer) throw new Error("官方 KIMI 合约拒绝扣费转账");
  await contract.transfer.estimateGas(KIMI_BURN_ADDRESS, amount);
  const tx = await contract.transfer(KIMI_BURN_ADDRESS, amount);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error("KIMI 扣费交易未成功确认");
  return { txHash: tx.hash, receipt };
}
