import { ethers } from "ethers";

export const SNOWBALL_LAUNCHPAD_ADDRESS = "0x08b6e62c01dcE3eACFc558609427348689c7773E";

export const BSC_CHAIN_ID = 56;
export const BSC_RPC_URL = "https://bsc-rpc.publicnode.com";

/** 源码部署时的默认创建费。链上 owner 可随时修改，页面不能把它当作实时费用。 */
export const DEFAULT_CREATE_FEE_WEI = "5000000000000000";

/** 兼容旧名 */
export const CREATE_FEE_WEI = DEFAULT_CREATE_FEE_WEI;

export const BSC_USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";

/** 与外部项目 Hardhat artifact 和 BSC 主网运行时代码逐字节核对后的哈希。 */
export const SNOWBALL_LAUNCHPAD_RUNTIME_HASH =
  "0x9adb672620bf25cc185a47d22a400f8298ef9a350923eff628e7fda5820b4fcc";

export interface CreateTokenFormValues {
  name: string;
  symbol: string;
  totalSupply: string;
  hiddenFeeReceiver: string;
  rewardToken: string;
  buyHiddenTaxBp: string;
  buyBurnBp: string;
  buyLiquidityBp: string;
  buyDividendBp: string;
  sellHiddenTaxBp: string;
  sellBurnBp: string;
  sellLiquidityBp: string;
  sellDividendBp: string;
  ordinaryWhitelist: string;
  limitAccounts: string;
  limitQuotas: string;
  limitModeEnabled: boolean;
  requestAutoVerify: boolean;
}

export interface CreateTokenParams {
  name: string;
  symbol: string;
  totalSupply: bigint;
  hiddenFeeReceiver: string;
  rewardToken: string;
  buyHiddenTaxBp: number;
  buyBurnBp: number;
  buyLiquidityBp: number;
  buyDividendBp: number;
  sellHiddenTaxBp: number;
  sellBurnBp: number;
  sellLiquidityBp: number;
  sellDividendBp: number;
  ordinaryWhitelist: string[];
  limitAccounts: string[];
  limitQuotas: bigint[];
  limitModeEnabled: boolean;
  requestAutoVerify: boolean;
}

export interface BuildCreateTokenOptions {
  defaultHiddenFeeReceiver?: string | null;
  defaultRewardToken?: string;
}

export interface CreateTokenPreflight {
  fee: bigint;
  predictedToken: string;
  gasEstimate: bigint;
}

export interface SnowballLaunchpadStatus {
  address: string;
  createFee: bigint;
  feeReceiver: string;
  defaultRewardToken: string;
  owner: string;
  tokenCount: bigint;
  runtimeHash: string;
  runtimeVerified: boolean;
}

export interface CreateFeeDisplay {
  amount: string;
  fullLabel: string;
  buttonLabel: string;
  isFree: boolean;
}

export const LAUNCHPAD_ABI = [
  {
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "totalSupply", type: "uint256" },
          { name: "hiddenFeeReceiver", type: "address" },
          { name: "rewardToken", type: "address" },
          { name: "buyHiddenTaxBp", type: "uint16" },
          { name: "buyBurnBp", type: "uint16" },
          { name: "buyLiquidityBp", type: "uint16" },
          { name: "buyDividendBp", type: "uint16" },
          { name: "sellHiddenTaxBp", type: "uint16" },
          { name: "sellBurnBp", type: "uint16" },
          { name: "sellLiquidityBp", type: "uint16" },
          { name: "sellDividendBp", type: "uint16" },
          { name: "ordinaryWhitelist", type: "address[]" },
          { name: "limitAccounts", type: "address[]" },
          { name: "limitQuotas", type: "uint256[]" },
          { name: "limitModeEnabled", type: "bool" },
          { name: "requestAutoVerify", type: "bool" },
        ],
      },
    ],
    name: "createToken",
    outputs: [{ name: "token", type: "address" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "createFee",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "defaultRewardToken",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "feeReceiver",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "creator", type: "address" }],
    name: "tokensOfCreator",
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "token", type: "address" }],
    name: "tokenCreator",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "allTokensLength",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "start", type: "uint256" },
      { name: "count", type: "uint256" },
    ],
    name: "allTokensSlice",
    outputs: [{ name: "result", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "creator", type: "address" },
      { indexed: true, name: "token", type: "address" },
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "symbol", type: "string" },
      { indexed: false, name: "totalSupply", type: "uint256" },
      { indexed: false, name: "hiddenFeeReceiver", type: "address" },
      { indexed: false, name: "rewardToken", type: "address" },
      { indexed: false, name: "paidFee", type: "uint256" },
    ],
    name: "TokenCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "creator", type: "address" },
      { indexed: true, name: "token", type: "address" },
    ],
    name: "AutoVerifyRequested",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, name: "fee", type: "uint256" }],
    name: "CreateFeeUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "receiver", type: "address" }],
    name: "FeeReceiverUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "rewardToken", type: "address" }],
    name: "DefaultRewardTokenUpdated",
    type: "event",
  },
  { inputs: [], name: "InvalidFee", type: "error" },
  { inputs: [], name: "InvalidInput", type: "error" },
  { inputs: [], name: "FeeTransferFailed", type: "error" },
  { inputs: [], name: "ZeroAddress", type: "error" },
];

function splitList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function requireAddress(value: string, label: string): string {
  if (!ethers.isAddress(value)) throw new Error(`${label}不是有效的 EVM 地址`);
  return ethers.getAddress(value);
}

function parseAddressList(raw: string, label: string): string[] {
  return splitList(raw).map((value, index) => requireAddress(value, `${label}第 ${index + 1} 项`));
}

function parseQuotaList(raw: string): bigint[] {
  return splitList(raw).map((value, index) => {
    if (!/^\d+$/.test(value)) throw new Error(`限制额度第 ${index + 1} 项必须是非负整数`);
    return BigInt(value);
  });
}

function pctToBp(value: string | undefined): number {
  const num = Number(value || "0");
  if (!Number.isFinite(num) || num < 0) throw new Error("税率必须是非负数字");
  // 页面字段统一使用百分比；需要 basis points 的页面应先显式除以 100。
  const basisPoints = Math.round(num * 100);
  if (basisPoints > 65535) throw new Error("单项税率超出 uint16 范围");
  return basisPoints;
}

export function buildCreateTokenParams(
  formValues: CreateTokenFormValues,
  options: BuildCreateTokenOptions = {}
): CreateTokenParams {
  const name = formValues.name.trim();
  const symbol = formValues.symbol.trim().toUpperCase();
  if (!name) throw new Error("请填写代币名称");
  if (!symbol) throw new Error("请填写代币符号");
  if (name.length > 64) throw new Error("代币名称不能超过 64 个字符");
  if (symbol.length > 16) throw new Error("代币符号不能超过 16 个字符");
  if (!/^\d+$/.test(formValues.totalSupply.trim())) throw new Error("总供应量必须是正整数");

  const totalSupply = BigInt(formValues.totalSupply.trim());
  if (totalSupply <= 0n) throw new Error("总供应量必须大于 0");

  const receiverInput = formValues.hiddenFeeReceiver.trim() || options.defaultHiddenFeeReceiver?.trim() || "";
  const rewardInput = formValues.rewardToken.trim() || options.defaultRewardToken || "";
  const ordinaryWhitelist = parseAddressList(formValues.ordinaryWhitelist, "普通白名单地址");
  const limitAccounts = parseAddressList(formValues.limitAccounts, "限制账户地址");
  const limitQuotas = parseQuotaList(formValues.limitQuotas);

  if (limitAccounts.length !== limitQuotas.length) {
    throw new Error("限制账户与限制额度数量必须一致");
  }
  if (formValues.limitModeEnabled && limitAccounts.length === 0) {
    throw new Error("启用限制模式时至少需要填写一个限制账户及额度");
  }

  const buyHiddenTaxBp = pctToBp(formValues.buyHiddenTaxBp);
  const buyBurnBp = pctToBp(formValues.buyBurnBp);
  const buyLiquidityBp = pctToBp(formValues.buyLiquidityBp);
  const buyDividendBp = pctToBp(formValues.buyDividendBp);
  const sellHiddenTaxBp = pctToBp(formValues.sellHiddenTaxBp);
  const sellBurnBp = pctToBp(formValues.sellBurnBp);
  const sellLiquidityBp = pctToBp(formValues.sellLiquidityBp);
  const sellDividendBp = pctToBp(formValues.sellDividendBp);

  if (buyHiddenTaxBp + buyBurnBp + buyLiquidityBp + buyDividendBp > 2500) {
    throw new Error("买入总税率不能超过 25%");
  }
  if (sellHiddenTaxBp + sellBurnBp + sellLiquidityBp + sellDividendBp > 2500) {
    throw new Error("卖出总税率不能超过 25%");
  }

  return {
    name,
    symbol,
    totalSupply,
    hiddenFeeReceiver: requireAddress(receiverInput, "隐藏费接收地址"),
    rewardToken: requireAddress(rewardInput, "分红代币地址"),
    buyHiddenTaxBp,
    buyBurnBp,
    buyLiquidityBp,
    buyDividendBp,
    sellHiddenTaxBp,
    sellBurnBp,
    sellLiquidityBp,
    sellDividendBp,
    ordinaryWhitelist,
    limitAccounts,
    limitQuotas,
    limitModeEnabled: formValues.limitModeEnabled,
    requestAutoVerify: formValues.requestAutoVerify,
  };
}

function trimFormattedAmount(value: string): string {
  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}

export function formatCreateFee(feeValue: bigint | string): CreateFeeDisplay {
  const fee = typeof feeValue === "bigint" ? feeValue : BigInt(feeValue);
  if (fee < 0n) throw new Error("创建费不能是负数");
  if (fee === 0n) {
    return {
      amount: "0",
      fullLabel: "当前免创建费（0 BNB）",
      buttonLabel: "免创建费 · 仅需 Gas",
      isFree: true,
    };
  }
  const amount = trimFormattedAmount(ethers.formatEther(fee));
  return {
    amount,
    fullLabel: `${amount} BNB`,
    buttonLabel: `${amount} BNB + Gas`,
    isFree: false,
  };
}

async function verifySnowballLaunchpad(provider: ethers.Provider): Promise<string> {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== BSC_CHAIN_ID) {
    throw new Error("KIMI 发币工厂仅部署在 BNB Smart Chain（Chain ID 56）");
  }
  const code = await provider.getCode(SNOWBALL_LAUNCHPAD_ADDRESS);
  if (code === "0x") throw new Error("当前网络没有部署 KIMI 发币工厂");
  const runtimeHash = ethers.keccak256(code);
  if (runtimeHash.toLowerCase() !== SNOWBALL_LAUNCHPAD_RUNTIME_HASH.toLowerCase()) {
    throw new Error("KIMI 发币工厂运行时代码与已核验源码不一致，已阻止交易");
  }
  return runtimeHash;
}

/** 读取并校验 Snowball Factory 的主网实时状态，不使用源码默认值冒充链上值。 */
export async function fetchSnowballLaunchpadStatus(
  provider: ethers.Provider = new ethers.JsonRpcProvider(BSC_RPC_URL, BSC_CHAIN_ID, { staticNetwork: true })
): Promise<SnowballLaunchpadStatus> {
  const runtimeHash = await verifySnowballLaunchpad(provider);
  const contract = new ethers.Contract(SNOWBALL_LAUNCHPAD_ADDRESS, LAUNCHPAD_ABI, provider);
  const [createFee, feeReceiver, defaultRewardToken, owner, tokenCount] = await Promise.all([
    contract.createFee() as Promise<bigint>,
    contract.feeReceiver() as Promise<string>,
    contract.defaultRewardToken() as Promise<string>,
    contract.owner() as Promise<string>,
    contract.allTokensLength() as Promise<bigint>,
  ]);
  return {
    address: SNOWBALL_LAUNCHPAD_ADDRESS,
    createFee,
    feeReceiver: ethers.getAddress(feeReceiver),
    defaultRewardToken: ethers.getAddress(defaultRewardToken),
    owner: ethers.getAddress(owner),
    tokenCount,
    runtimeHash,
    runtimeVerified: true,
  };
}

/** 从链上读取当前创建费用（单位：wei）；读取失败时抛错，避免错误显示为 0 或 0.005。 */
export async function fetchCreateFee(): Promise<string> {
  return (await fetchSnowballLaunchpadStatus()).createFee.toString();
}

export async function preflightCreateToken(
  signer: ethers.Signer,
  params: CreateTokenParams
): Promise<CreateTokenPreflight> {
  const provider = signer.provider;
  if (!provider) throw new Error("钱包 Provider 不可用");
  await verifySnowballLaunchpad(provider);

  const contract = new ethers.Contract(SNOWBALL_LAUNCHPAD_ADDRESS, LAUNCHPAD_ABI, signer);
  const fee = (await contract.createFee()) as bigint;
  const predictedToken = (await contract.createToken.staticCall(params, { value: fee })) as string;
  const gasEstimate = (await contract.createToken.estimateGas(params, { value: fee })) as bigint;
  return { fee, predictedToken, gasEstimate };
}

export async function submitCreateToken(
  signer: ethers.Signer,
  params: CreateTokenParams,
  expectedFee: bigint
): Promise<{
  tokenAddress: string;
  txHash: string;
  paidFee: bigint;
  receipt: ethers.ContractTransactionReceipt | null;
}> {
  const provider = signer.provider;
  if (!provider) throw new Error("钱包 Provider 不可用");
  await verifySnowballLaunchpad(provider);
  const contract = new ethers.Contract(SNOWBALL_LAUNCHPAD_ADDRESS, LAUNCHPAD_ABI, signer);
  const fee = (await contract.createFee()) as bigint;
  if (fee !== expectedFee) {
    await contract.createToken.estimateGas(params, { value: fee });
  }
  const tx = await contract.createToken(params, { value: fee });
  const receipt = await tx.wait();
  const event = receipt?.logs
    .map((log: ethers.Log) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed: ethers.LogDescription | null) => parsed?.name === "TokenCreated");
  const tokenAddress = (event?.args?.token as string | undefined) ?? "";
  if (!ethers.isAddress(tokenAddress)) throw new Error("交易成功，但未找到 TokenCreated 事件中的代币地址");
  return { tokenAddress: ethers.getAddress(tokenAddress), txHash: tx.hash, paidFee: fee, receipt };
}
