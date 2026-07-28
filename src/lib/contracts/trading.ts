import { ethers } from "ethers";
import { BSC_CHAIN_ID, SNOWBALL_LAUNCHPAD_ADDRESS } from "./snowball";

export const PANCAKE_V2_ROUTER_ADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
export const MIN_OPEN_TRADING_GAS_RESERVE = ethers.parseEther("0.001");

const TOKEN_ABI = [
  "function owner() external view returns (address)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function router() external view returns (address)",
  "function tradingOpen() external view returns (bool)",
  "function getDefaultPair() external view returns (address)",
  "function openTrading() external",
];

const LAUNCHPAD_TOKEN_ABI = [
  "function tokenCreator(address token) external view returns (address)",
];

const ROUTER_ABI = [
  "function addLiquidityETH(address token,uint256 amountTokenDesired,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) external payable returns (uint256 amountToken,uint256 amountETH,uint256 liquidity)",
];

const PAIR_ABI = [
  "function token0() external view returns (address)",
  "function getReserves() external view returns (uint112 reserve0,uint112 reserve1,uint32 blockTimestampLast)",
];

export interface SnowballTradingStatus {
  tokenAddress: string;
  creator: string;
  owner: string;
  symbol: string;
  decimals: number;
  routerAddress: string;
  tradingOpen: boolean;
  pairAddress: string;
  hasLiquidity: boolean;
  tokenReserve: bigint;
  bnbReserve: bigint;
  tokenBalance: bigint;
  bnbBalance: bigint;
  allowance: bigint;
}

export type OpenTradingStep = "checking" | "approval" | "liquidity" | "opening" | "complete";

export interface OpenTradingProgress {
  step: OpenTradingStep;
  message: string;
  txHash?: string;
}

export interface OpenTradingResult {
  approvalTxHash?: string;
  liquidityTxHash?: string;
  openTradingTxHash: string;
  pairAddress: string;
}

function requirePositiveAmount(amount: bigint, label: string): bigint {
  if (amount <= 0n) throw new Error(`${label}必须大于 0`);
  return amount;
}

export function parseTokenLiquidityAmount(value: string, decimals: number): bigint {
  const normalized = value.trim();
  if (!normalized) throw new Error("请填写加入流动性的代币数量");
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error("代币 decimals 无效");
  }
  try {
    return requirePositiveAmount(ethers.parseUnits(normalized, decimals), "代币数量");
  } catch (error) {
    if (error instanceof Error && /必须大于/.test(error.message)) throw error;
    if (decimals === 0) throw new Error("该代币不支持小数，流动性数量必须填写整数");
    throw new Error(`代币数量格式不正确，最多支持 ${decimals} 位小数`);
  }
}

export function parseBnbLiquidityAmount(value: string): bigint {
  const normalized = value.trim();
  if (!normalized) throw new Error("请填写加入流动性的 BNB 数量");
  try {
    return requirePositiveAmount(ethers.parseEther(normalized), "BNB 数量");
  } catch (error) {
    if (error instanceof Error && /必须大于/.test(error.message)) throw error;
    throw new Error("BNB 数量格式不正确，最多支持 18 位小数");
  }
}

export function parseSlippageBps(value: string): number {
  const percentage = Number(value.trim());
  if (!Number.isFinite(percentage) || percentage < 0.1 || percentage > 20) {
    throw new Error("滑点必须在 0.1% 到 20% 之间");
  }
  return Math.round(percentage * 100);
}

export function applySlippage(amount: bigint, slippageBps: number): bigint {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps >= 10_000) {
    throw new Error("滑点参数无效");
  }
  return (amount * BigInt(10_000 - slippageBps)) / 10_000n;
}

async function assertBsc(provider: ethers.Provider) {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== BSC_CHAIN_ID) {
    throw new Error("开盘功能仅支持 BNB Smart Chain（Chain ID 56）");
  }
}

export async function readSnowballTradingStatus(
  provider: ethers.Provider,
  tokenAddress: string,
  account?: string | null
): Promise<SnowballTradingStatus> {
  await assertBsc(provider);
  if (!ethers.isAddress(tokenAddress)) throw new Error("代币合约地址无效");
  const normalizedToken = ethers.getAddress(tokenAddress);
  const code = await provider.getCode(normalizedToken);
  if (code === "0x") throw new Error("代币合约在 BSC 上不存在");

  const launchpad = new ethers.Contract(SNOWBALL_LAUNCHPAD_ADDRESS, LAUNCHPAD_TOKEN_ABI, provider);
  const creator = ethers.getAddress((await launchpad.tokenCreator(normalizedToken)) as string);
  if (creator === ethers.ZeroAddress) {
    throw new Error("该代币不是当前已核验 KIMI 普通发币工厂创建的代币");
  }

  const token = new ethers.Contract(normalizedToken, TOKEN_ABI, provider);
  const [ownerRaw, symbol, decimalsRaw, routerRaw, tradingOpen, pairRaw] = await Promise.all([
    token.owner() as Promise<string>,
    token.symbol() as Promise<string>,
    token.decimals() as Promise<bigint>,
    token.router() as Promise<string>,
    token.tradingOpen() as Promise<boolean>,
    token.getDefaultPair() as Promise<string>,
  ]);

  const owner = ethers.getAddress(ownerRaw);
  const routerAddress = ethers.getAddress(routerRaw);
  if (routerAddress.toLowerCase() !== PANCAKE_V2_ROUTER_ADDRESS.toLowerCase()) {
    throw new Error("代币当前 Router 不是 PancakeSwap V2 官方 Router，已阻止开盘");
  }

  const pairAddress = ethers.getAddress(pairRaw);
  let tokenReserve = 0n;
  let bnbReserve = 0n;
  if (pairAddress !== ethers.ZeroAddress) {
    const pairCode = await provider.getCode(pairAddress);
    if (pairCode !== "0x") {
      const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
      const [token0Raw, reserves] = await Promise.all([
        pair.token0() as Promise<string>,
        pair.getReserves() as Promise<readonly [bigint, bigint, number]>,
      ]);
      const token0 = ethers.getAddress(token0Raw);
      if (token0.toLowerCase() === normalizedToken.toLowerCase()) {
        tokenReserve = reserves[0];
        bnbReserve = reserves[1];
      } else {
        tokenReserve = reserves[1];
        bnbReserve = reserves[0];
      }
    }
  }

  let tokenBalance = 0n;
  let bnbBalance = 0n;
  let allowance = 0n;
  if (account && ethers.isAddress(account)) {
    const normalizedAccount = ethers.getAddress(account);
    [tokenBalance, bnbBalance, allowance] = await Promise.all([
      token.balanceOf(normalizedAccount) as Promise<bigint>,
      provider.getBalance(normalizedAccount),
      token.allowance(normalizedAccount, routerAddress) as Promise<bigint>,
    ]);
  }

  return {
    tokenAddress: normalizedToken,
    creator,
    owner,
    symbol,
    decimals: Number(decimalsRaw),
    routerAddress,
    tradingOpen,
    pairAddress,
    hasLiquidity: tokenReserve > 0n && bnbReserve > 0n,
    tokenReserve,
    bnbReserve,
    tokenBalance,
    bnbBalance,
    allowance,
  };
}

async function waitForSuccessfulTransaction(
  tx: ethers.ContractTransactionResponse,
  failureMessage: string
): Promise<ethers.ContractTransactionReceipt> {
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(failureMessage);
  return receipt;
}

async function getSignerContext(signer: ethers.Signer, tokenAddress: string) {
  const provider = signer.provider;
  if (!provider) throw new Error("钱包 Provider 不可用");
  await assertBsc(provider);
  const account = ethers.getAddress(await signer.getAddress());
  const status = await readSnowballTradingStatus(provider, tokenAddress, account);
  if (status.owner.toLowerCase() !== account.toLowerCase()) {
    throw new Error(`只有代币 Owner 才能开盘，当前 Owner：${status.owner}`);
  }
  if (status.tradingOpen) throw new Error("该代币已经开盘，无需重复执行");
  return { provider, account, status };
}

export async function addLiquidityAndOpenTrading(params: {
  signer: ethers.Signer;
  tokenAddress: string;
  tokenAmount: bigint;
  bnbAmount: bigint;
  slippageBps: number;
  deadlineSeconds?: number;
  onProgress?: (progress: OpenTradingProgress) => void;
}): Promise<OpenTradingResult> {
  requirePositiveAmount(params.tokenAmount, "代币数量");
  requirePositiveAmount(params.bnbAmount, "BNB 数量");
  applySlippage(params.tokenAmount, params.slippageBps);
  const deadlineSeconds = params.deadlineSeconds ?? 1_200;
  if (!Number.isInteger(deadlineSeconds) || deadlineSeconds < 60 || deadlineSeconds > 7_200) {
    throw new Error("交易截止时间无效");
  }

  params.onProgress?.({ step: "checking", message: "正在核验 Owner、余额、Router 与链上交易状态" });
  const { provider, account, status } = await getSignerContext(params.signer, params.tokenAddress);
  if (status.tokenBalance < params.tokenAmount) {
    throw new Error(`${status.symbol} 余额不足，当前余额 ${ethers.formatUnits(status.tokenBalance, status.decimals)}`);
  }
  if (status.bnbBalance < params.bnbAmount + MIN_OPEN_TRADING_GAS_RESERVE) {
    throw new Error("BNB 余额不足：除流动性金额外，钱包还需至少预留约 0.001 BNB 支付 Gas");
  }

  const token = new ethers.Contract(status.tokenAddress, TOKEN_ABI, params.signer);
  let approvalTxHash: string | undefined;
  if (status.allowance < params.tokenAmount) {
    params.onProgress?.({ step: "approval", message: `请在钱包确认精确授权 ${status.symbol}` });
    const canApprove = (await token.approve.staticCall(PANCAKE_V2_ROUTER_ADDRESS, params.tokenAmount)) as boolean;
    if (!canApprove) throw new Error("代币合约拒绝授权 PancakeSwap Router");
    await token.approve.estimateGas(PANCAKE_V2_ROUTER_ADDRESS, params.tokenAmount);
    const approvalTx = await token.approve(PANCAKE_V2_ROUTER_ADDRESS, params.tokenAmount);
    approvalTxHash = approvalTx.hash;
    params.onProgress?.({ step: "approval", message: "授权交易已发送，正在等待确认", txHash: approvalTx.hash });
    await waitForSuccessfulTransaction(approvalTx, "代币授权交易失败");
  } else {
    params.onProgress?.({ step: "approval", message: "现有授权额度充足，已跳过授权交易" });
  }

  const amountTokenMin = applySlippage(params.tokenAmount, params.slippageBps);
  const amountBnbMin = applySlippage(params.bnbAmount, params.slippageBps);
  const deadline = BigInt(Math.floor(Date.now() / 1_000) + deadlineSeconds);
  const router = new ethers.Contract(PANCAKE_V2_ROUTER_ADDRESS, ROUTER_ABI, params.signer);
  const liquidityArgs = [
    status.tokenAddress,
    params.tokenAmount,
    amountTokenMin,
    amountBnbMin,
    account,
    deadline,
  ] as const;

  params.onProgress?.({ step: "liquidity", message: "请确认向 PancakeSwap V2 加入初始流动性" });
  await router.addLiquidityETH.estimateGas(...liquidityArgs, { value: params.bnbAmount });
  const liquidityTx = await router.addLiquidityETH(...liquidityArgs, { value: params.bnbAmount });
  params.onProgress?.({
    step: "liquidity",
    message: "流动性交易已发送，LP Token 将返回当前钱包",
    txHash: liquidityTx.hash,
  });
  await waitForSuccessfulTransaction(liquidityTx, "PancakeSwap 加入流动性交易失败");

  const afterLiquidity = await readSnowballTradingStatus(provider, status.tokenAddress, account);
  if (!afterLiquidity.hasLiquidity || afterLiquidity.pairAddress === ethers.ZeroAddress) {
    throw new Error("流动性交易已确认，但未检测到有效的 PancakeSwap 交易池，已停止开启交易");
  }

  params.onProgress?.({ step: "opening", message: "流动性已确认，请最后确认开启代币交易" });
  await token.openTrading.staticCall();
  await token.openTrading.estimateGas();
  const openTx = await token.openTrading();
  params.onProgress?.({ step: "opening", message: "开启交易请求已发送，正在等待确认", txHash: openTx.hash });
  await waitForSuccessfulTransaction(openTx, "开启交易失败");

  const finalStatus = await readSnowballTradingStatus(provider, status.tokenAddress, account);
  if (!finalStatus.tradingOpen) throw new Error("开盘交易已确认，但链上 tradingOpen 仍为 false");
  params.onProgress?.({ step: "complete", message: "PancakeSwap 流动性和链上交易均已开启", txHash: openTx.hash });

  return {
    approvalTxHash,
    liquidityTxHash: liquidityTx.hash,
    openTradingTxHash: openTx.hash,
    pairAddress: finalStatus.pairAddress,
  };
}

export async function openTradingWithExistingLiquidity(params: {
  signer: ethers.Signer;
  tokenAddress: string;
  onProgress?: (progress: OpenTradingProgress) => void;
}): Promise<OpenTradingResult> {
  params.onProgress?.({ step: "checking", message: "正在核验现有 PancakeSwap 流动性" });
  const { provider, account, status } = await getSignerContext(params.signer, params.tokenAddress);
  if (!status.hasLiquidity || status.pairAddress === ethers.ZeroAddress) {
    throw new Error("当前交易池没有有效流动性，不能直接开盘");
  }

  const token = new ethers.Contract(status.tokenAddress, TOKEN_ABI, params.signer);
  params.onProgress?.({ step: "opening", message: "请在钱包确认开启代币交易" });
  await token.openTrading.staticCall();
  await token.openTrading.estimateGas();
  const openTx = await token.openTrading();
  params.onProgress?.({ step: "opening", message: "开启交易请求已发送，正在等待确认", txHash: openTx.hash });
  await waitForSuccessfulTransaction(openTx, "开启交易失败");

  const finalStatus = await readSnowballTradingStatus(provider, status.tokenAddress, account);
  if (!finalStatus.tradingOpen) throw new Error("开盘交易已确认，但链上 tradingOpen 仍为 false");
  params.onProgress?.({ step: "complete", message: "链上交易已开启", txHash: openTx.hash });
  return {
    openTradingTxHash: openTx.hash,
    pairAddress: finalStatus.pairAddress,
  };
}

export function getPancakeSwapUrl(tokenAddress: string): string {
  return `https://pancakeswap.finance/swap?chain=bsc&outputCurrency=${ethers.getAddress(tokenAddress)}`;
}
