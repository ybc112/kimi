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

function parseAddressList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseQuotaList(raw: string): bigint[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => BigInt(s));
}

function pctToBp(value: string | undefined): number {
  const num = Number(value || "0");
  // 兼容两种输入习惯：
  // - 百分比（如 5 表示 5%）→ 转换为 500 basis points
  // - basis points（如 500 表示 5%）→ 直接使用
  return num <= 25 ? Math.round(num * 100) : Math.round(num);
}

export function buildCreateTokenParams(formValues: CreateTokenFormValues): CreateTokenParams {
  return {
    name: formValues.name.trim(),
    symbol: formValues.symbol.trim().toUpperCase(),
    totalSupply: BigInt(formValues.totalSupply || "0"),
    hiddenFeeReceiver: formValues.hiddenFeeReceiver.trim(),
    rewardToken: formValues.rewardToken.trim(),
    buyHiddenTaxBp: pctToBp(formValues.buyHiddenTaxBp),
    buyBurnBp: pctToBp(formValues.buyBurnBp),
    buyLiquidityBp: pctToBp(formValues.buyLiquidityBp),
    buyDividendBp: pctToBp(formValues.buyDividendBp),
    sellHiddenTaxBp: pctToBp(formValues.sellHiddenTaxBp),
    sellBurnBp: pctToBp(formValues.sellBurnBp),
    sellLiquidityBp: pctToBp(formValues.sellLiquidityBp),
    sellDividendBp: pctToBp(formValues.sellDividendBp),
    ordinaryWhitelist: parseAddressList(formValues.ordinaryWhitelist),
    limitAccounts: parseAddressList(formValues.limitAccounts),
    limitQuotas: parseQuotaList(formValues.limitQuotas),
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
