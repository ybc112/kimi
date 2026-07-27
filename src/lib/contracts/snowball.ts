import { ethers } from "ethers";

export const SNOWBALL_LAUNCHPAD_ADDRESS = "0x08b6e62c01dcE3eACFc558609427348689c7773E";

export const BSC_RPC_URL = "https://bsc-dataseed.binance.org/";

/** 默认创建费用，启动时会从链上读取最新值 */
export const DEFAULT_CREATE_FEE_WEI = "5000000000000000";

/** 兼容旧名 */
export const CREATE_FEE_WEI = DEFAULT_CREATE_FEE_WEI;

export const BSC_USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";

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
  // 兼容两种输入习惯：
  // - 百分比（如 5 表示 5%）→ 转换为 500 basis points
  // - basis points（如 500 表示 5%）→ 直接使用
  const basisPoints = num <= 25 ? Math.round(num * 100) : Math.round(num);
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

/** 从链上读取当前创建费用（单位：wei） */
export async function fetchCreateFee(): Promise<string> {
  try {
    const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
    const contract = new ethers.Contract(SNOWBALL_LAUNCHPAD_ADDRESS, LAUNCHPAD_ABI, provider);
    const fee = await contract.createFee();
    return fee.toString();
  } catch {
    return DEFAULT_CREATE_FEE_WEI;
  }
}

export async function preflightCreateToken(
  signer: ethers.Signer,
  params: CreateTokenParams
): Promise<CreateTokenPreflight> {
  const provider = signer.provider;
  if (!provider) throw new Error("钱包 Provider 不可用");
  const code = await provider.getCode(SNOWBALL_LAUNCHPAD_ADDRESS);
  if (code === "0x") throw new Error("当前网络未部署发币 Factory，请切换到 BNB Smart Chain");

  const contract = new ethers.Contract(SNOWBALL_LAUNCHPAD_ADDRESS, LAUNCHPAD_ABI, signer);
  const fee = (await contract.createFee()) as bigint;
  const predictedToken = (await contract.createToken.staticCall(params, { value: fee })) as string;
  const gasEstimate = (await contract.createToken.estimateGas(params, { value: fee })) as bigint;
  return { fee, predictedToken, gasEstimate };
}

export async function submitCreateToken(
  signer: ethers.Signer,
  params: CreateTokenParams,
  fee: bigint
): Promise<{ tokenAddress: string; txHash: string; receipt: ethers.ContractTransactionReceipt | null }> {
  const contract = new ethers.Contract(SNOWBALL_LAUNCHPAD_ADDRESS, LAUNCHPAD_ABI, signer);
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
  return { tokenAddress: ethers.getAddress(tokenAddress), txHash: tx.hash, receipt };
}
