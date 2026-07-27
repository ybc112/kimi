import { ethers } from "ethers";

// 雪球普通发币工厂合约（BSC mainnet）
// 如需重新部署，可运行 多零直发发射台/scripts/deploy-snowball-launchpad.js
export const DEPLOY_FACTORY_ADDRESS: string = "0x972D488F3e952b11a13b96C0aCCECbA9855A97EC";

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

// 通用工厂 ABI：部署字节码并返回合约地址
// 当用户部署真实工厂后，可在此替换为对应 ABI
export const DEPLOY_FACTORY_ABI = [
  "function deploy(bytes memory bytecode, bytes memory args) external payable returns (address deployed)",
  "function getDeployFee() external view returns (uint256)",
  "event ContractDeployed(address indexed deployer, address indexed deployed, uint256 fee)",
];

// 手动部署：使用 ethers ContractFactory
export async function deployBytecode(params: {
  signer: ethers.Signer;
  bytecode: string;
  abi: string;
  constructorArgs: unknown[];
  value?: bigint;
}) {
  const { signer, bytecode, abi, constructorArgs, value } = params;

  const parsedAbi = JSON.parse(abi) as ethers.InterfaceAbi;
  const factory = new ethers.ContractFactory(parsedAbi, bytecode, signer);

  const deployTx = await factory.deploy(...constructorArgs, { value });
  const contract = await deployTx.waitForDeployment();
  const address = await contract.getAddress();
  const deployTxHash = contract.deploymentTransaction()?.hash ?? "";

  return { address, deployTxHash };
}

// 工厂部署：调用外部工厂合约
export async function deployViaFactory(params: {
  signer: ethers.Signer;
  bytecode: string;
  args: string;
  value?: bigint;
}) {
  if (DEPLOY_FACTORY_ADDRESS === ethers.ZeroAddress) {
    throw new Error("工厂合约地址尚未配置，请先部署工厂合约并更新 DEPLOY_FACTORY_ADDRESS");
  }

  const contract = new ethers.Contract(DEPLOY_FACTORY_ADDRESS, DEPLOY_FACTORY_ABI, params.signer);
  const tx = await contract.deploy(params.bytecode, params.args, { value: params.value });
  const receipt = await tx.wait();

  const event = receipt?.logs
    ?.map((log: ethers.Log) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed?.name === "ContractDeployed");

  const deployedAddress = event?.args?.deployed ?? "";
  return { address: deployedAddress, deployTxHash: tx.hash };
}

export function getExplorerUrl(network: string, path: string) {
  const base = EXPLORERS[network] ?? EXPLORERS.bsc;
  return `${base}${path}`;
}

export function parseConstructorArgs(input: string): unknown[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  try {
    return JSON.parse(trimmed) as unknown[];
  } catch {
    // 尝试按逗号分隔解析（简单类型）
    return trimmed.split(",").map((item) => {
      const value = item.trim();
      if (value === "true") return true;
      if (value === "false") return false;
      if (/^0x[a-fA-F0-9]+$/.test(value)) return value;
      if (/^\d+$/.test(value)) return Number(value);
      return value;
    });
  }
}
