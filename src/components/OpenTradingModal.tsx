import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Droplets,
  ExternalLink,
  Loader2,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { ethers } from "ethers";
import { useWallet } from "@/hooks/useWallet";
import type { IssuedToken } from "@/types";
import { BSC_CHAIN_ID, BSC_RPC_URL } from "@/lib/contracts/snowball";
import {
  MIN_OPEN_TRADING_GAS_RESERVE,
  addLiquidityAndOpenTrading,
  getPancakeSwapUrl,
  openTradingWithExistingLiquidity,
  parseBnbLiquidityAmount,
  parseSlippageBps,
  parseTokenLiquidityAmount,
  readSnowballTradingStatus,
  type OpenTradingProgress,
  type SnowballTradingStatus,
} from "@/lib/contracts/trading";
import { formatContractError, type FriendlyContractError } from "@/lib/contracts/errors";
import { TransactionError } from "@/components/TransactionError";
import { cn } from "@/lib/utils";

interface OpenTradingModalProps {
  token: IssuedToken;
  onClose: () => void;
  onComplete: (updates: Partial<IssuedToken>) => void;
}

function trimUnits(value: bigint, decimals: number, maxFraction = 6) {
  const formatted = ethers.formatUnits(value, decimals);
  const [whole, fraction = ""] = formatted.split(".");
  const trimmedFraction = fraction.slice(0, maxFraction).replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

function shortAddress(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export function OpenTradingModal({ token, onClose, onComplete }: OpenTradingModalProps) {
  const wallet = useWallet();
  const [status, setStatus] = useState<SnowballTradingStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [tokenAmount, setTokenAmount] = useState("");
  const [bnbAmount, setBnbAmount] = useState("");
  const [slippage, setSlippage] = useState("3");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<OpenTradingProgress[]>([]);
  const [error, setError] = useState<FriendlyContractError | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError(null);
    try {
      const provider = wallet.isBSC && wallet.provider
        ? wallet.provider
        : new ethers.JsonRpcProvider(BSC_RPC_URL, BSC_CHAIN_ID, { staticNetwork: true });
      const next = await readSnowballTradingStatus(provider, token.address, wallet.account);
      setStatus(next);
    } catch (loadError) {
      setStatus(null);
      setError(formatContractError(loadError, "读取代币开盘状态失败"));
    } finally {
      setLoadingStatus(false);
    }
  }, [token.address, wallet.account, wallet.isBSC, wallet.provider]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const isOwner = Boolean(
    status && wallet.account && status.owner.toLowerCase() === wallet.account.toLowerCase()
  );

  const initialPrice = useMemo(() => {
    const tokenValue = Number(tokenAmount);
    const bnbValue = Number(bnbAmount);
    if (!Number.isFinite(tokenValue) || !Number.isFinite(bnbValue) || tokenValue <= 0 || bnbValue <= 0) {
      return null;
    }
    return {
      tokenInBnb: bnbValue / tokenValue,
      tokensPerBnb: tokenValue / bnbValue,
    };
  }, [bnbAmount, tokenAmount]);

  const recordProgress = useCallback((next: OpenTradingProgress) => {
    setProgress((current) => {
      const existingIndex = current.findIndex((item) => item.step === next.step);
      if (existingIndex === -1) return [...current, next];
      const copy = [...current];
      copy[existingIndex] = next;
      return copy;
    });
  }, []);

  const finishOpen = async (updates: Partial<IssuedToken>) => {
    onComplete({ tradingOpen: true, ...updates });
    await loadStatus();
  };

  const handleAddLiquidityAndOpen = async () => {
    if (!wallet.signer || !status) return;
    setSubmitting(true);
    setProgress([]);
    setError(null);
    try {
      const result = await addLiquidityAndOpenTrading({
        signer: wallet.signer,
        tokenAddress: token.address,
        tokenAmount: parseTokenLiquidityAmount(tokenAmount, status.decimals),
        bnbAmount: parseBnbLiquidityAmount(bnbAmount),
        slippageBps: parseSlippageBps(slippage),
        onProgress: recordProgress,
      });
      await finishOpen({
        pairAddress: result.pairAddress,
        liquidityTxHash: result.liquidityTxHash,
        openTradingTxHash: result.openTradingTxHash,
      });
    } catch (submitError) {
      setError(formatContractError(submitError, "开盘流程执行失败"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenExisting = async () => {
    if (!wallet.signer || !status) return;
    setSubmitting(true);
    setProgress([]);
    setError(null);
    try {
      const result = await openTradingWithExistingLiquidity({
        signer: wallet.signer,
        tokenAddress: token.address,
        onProgress: recordProgress,
      });
      await finishOpen({
        pairAddress: result.pairAddress,
        openTradingTxHash: result.openTradingTxHash,
      });
    } catch (submitError) {
      setError(formatContractError(submitError, "开启交易失败"));
    } finally {
      setSubmitting(false);
    }
  };

  const setMaximumToken = () => {
    if (status) setTokenAmount(ethers.formatUnits(status.tokenBalance, status.decimals));
  };

  const setMaximumBnb = () => {
    if (!status) return;
    const available = status.bnbBalance > MIN_OPEN_TRADING_GAS_RESERVE
      ? status.bnbBalance - MIN_OPEN_TRADING_GAS_RESERVE
      : 0n;
    setBnbAmount(available > 0n ? ethers.formatEther(available) : "");
  };

  const completed = status?.tradingOpen || progress.some((item) => item.step === "complete");

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-[#25282C] bg-[#0D0E10] shadow-2xl sm:max-w-2xl sm:rounded-3xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#25282C] bg-[#0D0E10]/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-[#2EDEDB]" />
              <h3 className="text-lg font-bold text-white">{token.symbol} 开盘</h3>
            </div>
            <p className="mt-1 text-xs text-[#6B7280]">PancakeSwap V2 初始流动性 + 链上开启交易</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-[#25282C] p-2 text-[#9CA3AF] transition hover:text-white disabled:opacity-40"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-3 rounded-2xl border border-[#25282C] bg-[#111215] p-4 text-xs sm:grid-cols-2">
            <div>
              <p className="text-[#6B7280]">代币合约</p>
              <a
                href={`https://bscscan.com/token/${token.address}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 font-mono text-[#E8E8E8] hover:text-[#D0FF00]"
              >
                {shortAddress(token.address)} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div>
              <p className="text-[#6B7280]">链上状态</p>
              <div className="mt-1 flex items-center gap-2">
                {loadingStatus ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin text-[#2EDEDB]" /><span className="text-[#9CA3AF]">检查中</span></>
                ) : status?.tradingOpen ? (
                  <><CheckCircle2 className="h-3.5 w-3.5 text-[#D0FF00]" /><span className="text-[#D0FF00]">已开盘</span></>
                ) : (
                  <><Circle className="h-3.5 w-3.5 text-[#F59E0B]" /><span className="text-[#F59E0B]">待开盘</span></>
                )}
              </div>
            </div>
            {status && (
              <>
                <div>
                  <p className="text-[#6B7280]">Owner</p>
                  <p className={cn("mt-1 font-mono", isOwner ? "text-[#D0FF00]" : "text-[#E8E8E8]")}>{shortAddress(status.owner)}</p>
                </div>
                <div>
                  <p className="text-[#6B7280]">PancakeSwap Pair</p>
                  {status.pairAddress === ethers.ZeroAddress ? (
                    <p className="mt-1 text-[#9CA3AF]">尚未创建</p>
                  ) : (
                    <a
                      href={`https://bscscan.com/address/${status.pairAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 font-mono text-[#E8E8E8] hover:text-[#D0FF00]"
                    >
                      {shortAddress(status.pairAddress)} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </>
            )}
          </div>

          {!wallet.isConnected ? (
            <button onClick={wallet.connectWallet} disabled={wallet.loading} className="kimi-btn-primary w-full py-3">
              {wallet.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              连接 Owner 钱包
            </button>
          ) : !wallet.isBSC ? (
            <button onClick={wallet.switchToBSC} disabled={wallet.loading} className="kimi-btn-primary w-full py-3">
              {wallet.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              切换到 BNB Smart Chain
            </button>
          ) : loadingStatus ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#9CA3AF]">
              <Loader2 className="h-4 w-4 animate-spin text-[#2EDEDB]" /> 正在读取链上数据
            </div>
          ) : status?.tradingOpen ? (
            <div className="rounded-2xl border border-[#D0FF00]/25 bg-[#D0FF00]/5 p-4">
              <div className="flex items-center gap-2 font-semibold text-[#D0FF00]">
                <CheckCircle2 className="h-5 w-5" /> 该代币已经开盘
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#9CA3AF]">交易池已建立，链上 tradingOpen = true。</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={getPancakeSwapUrl(token.address)} target="_blank" rel="noreferrer" className="kimi-btn-primary text-xs">
                  去 PancakeSwap 交易 <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {status.pairAddress !== ethers.ZeroAddress && (
                  <a href={`https://bscscan.com/address/${status.pairAddress}`} target="_blank" rel="noreferrer" className="kimi-btn-secondary text-xs">
                    查看 Pair <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          ) : status && !isOwner ? (
            <div className="rounded-2xl border border-[#F59E0B]/30 bg-[#F59E0B]/5 p-4 text-sm text-[#FBBF24]">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>当前钱包不是代币 Owner。请切换到 <span className="font-mono">{status.owner}</span> 后再开盘。</p>
              </div>
            </div>
          ) : status ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 flex items-center justify-between text-xs text-[#9CA3AF]">
                    <span>加入流动性的 {status.symbol}</span>
                    <button type="button" onClick={setMaximumToken} className="text-[#2EDEDB] hover:text-white">最大</button>
                  </span>
                  <input
                    value={tokenAmount}
                    onChange={(event) => setTokenAmount(event.target.value)}
                    inputMode={status.decimals === 0 ? "numeric" : "decimal"}
                    placeholder={status.decimals === 0 ? "例如 250000000" : "请输入代币数量"}
                    className="kimi-input w-full"
                    disabled={submitting}
                  />
                  <span className="mt-1.5 block text-[11px] text-[#6B7280]">
                    余额 {trimUnits(status.tokenBalance, status.decimals)} {status.symbol}
                    {status.decimals === 0 ? " · 只能填写整数" : ""}
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center justify-between text-xs text-[#9CA3AF]">
                    <span>加入流动性的 BNB</span>
                    <button type="button" onClick={setMaximumBnb} className="text-[#2EDEDB] hover:text-white">最大（留 Gas）</button>
                  </span>
                  <input
                    value={bnbAmount}
                    onChange={(event) => setBnbAmount(event.target.value)}
                    inputMode="decimal"
                    placeholder="例如 0.005"
                    className="kimi-input w-full"
                    disabled={submitting}
                  />
                  <span className="mt-1.5 block text-[11px] text-[#6B7280]">余额 {trimUnits(status.bnbBalance, 18)} BNB</span>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs text-[#9CA3AF]">滑点保护</span>
                <div className="relative max-w-[180px]">
                  <input
                    value={slippage}
                    onChange={(event) => setSlippage(event.target.value)}
                    inputMode="decimal"
                    className="kimi-input w-full pr-8"
                    disabled={submitting}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6B7280]">%</span>
                </div>
              </label>

              {initialPrice && (
                <div className="rounded-xl border border-[#2EDEDB]/20 bg-[#2EDEDB]/5 px-4 py-3 text-xs text-[#7DE9E7]">
                  初始池价格约为 1 {status.symbol} = {initialPrice.tokenInBnb.toExponential(6)} BNB，1 BNB = {initialPrice.tokensPerBnb.toLocaleString("en-US", { maximumFractionDigits: 4 })} {status.symbol}
                </div>
              )}

              <div className="rounded-2xl border border-[#25282C] bg-[#111215] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                  <ShieldCheck className="h-4 w-4 text-[#2EDEDB]" /> 钱包确认流程
                </div>
                <ol className="space-y-2 text-xs text-[#9CA3AF]">
                  <li>1. 精确授权本次填写的 {status.symbol} 数量（已有足够授权时自动跳过）</li>
                  <li>2. 向 PancakeSwap V2 加入 {status.symbol} / BNB 流动性，LP Token 返回你的钱包</li>
                  <li>3. 流动性确认后调用代币合约 openTrading() 正式开盘</li>
                </ol>
              </div>

              {status.hasLiquidity && (
                <div className="rounded-xl border border-[#F59E0B]/25 bg-[#F59E0B]/5 p-3 text-xs leading-relaxed text-[#FBBF24]">
                  已检测到现有流动性：{trimUnits(status.tokenReserve, status.decimals)} {status.symbol} / {trimUnits(status.bnbReserve, 18)} BNB。你可以继续增加流动性，也可以直接使用现有池开启交易。
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={handleAddLiquidityAndOpen}
                  disabled={submitting || completed}
                  className="kimi-btn-primary flex-1 py-3"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  加入流动性并开盘
                </button>
                {status.hasLiquidity && (
                  <button
                    onClick={handleOpenExisting}
                    disabled={submitting || completed}
                    className="kimi-btn-secondary py-3 sm:px-5"
                  >
                    直接开启现有池
                  </button>
                )}
              </div>
            </>
          ) : null}

          {!loadingStatus && !status && (
            <button onClick={() => void loadStatus()} className="kimi-btn-secondary w-full py-2.5">
              <RefreshCw className="h-4 w-4" /> 重新读取链上状态
            </button>
          )}

          {progress.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-[#25282C] bg-[#111215] p-4">
              {progress.map((item) => (
                <div key={item.step} className="flex items-start gap-2 text-xs">
                  {item.step === "complete" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D0FF00]" />
                  ) : submitting ? (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[#2EDEDB]" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2EDEDB]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={item.step === "complete" ? "text-[#D0FF00]" : "text-[#E8E8E8]"}>{item.message}</p>
                    {item.txHash && (
                      <a href={`https://bscscan.com/tx/${item.txHash}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-mono text-[#6B7280] hover:text-white">
                        {shortAddress(item.txHash)} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {wallet.error && <TransactionError summary={wallet.error} />}
          {error && <TransactionError summary={error.summary} details={error.details} />}
        </div>
      </section>
    </div>
  );
}
