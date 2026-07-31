import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowUpDown,
  ExternalLink,
  AlertCircle,
  Wallet,
  Loader2,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import { fetchMintLaunchProjects } from "@/lib/mintLaunch/launchpad";
import type { MintLaunchProject } from "@/lib/mintLaunch/types";
import {
  approvePancakeSwapToken,
  buildPancakeSwapUrl,
  executePancakeSwap,
  fetchPancakeSwapQuote,
  type PancakeSwapDirection,
  type PancakeSwapQuote,
  PANCAKE_V2_ROUTER_ADDRESS,
} from "@/lib/contracts/pancake";

function shortAddress(address: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

function slippageToBps(value: string) {
  const percentage = Number(value.trim());
  if (!Number.isFinite(percentage) || percentage < 0.1 || percentage > 50) {
    throw new Error("滑点必须在 0.1% 到 50% 之间");
  }
  return Math.round(percentage * 100);
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export default function Swap() {
  const wallet = useWallet();
  const { showToast } = useAppStore();
  const [searchParams] = useSearchParams();
  const [tokenAddress, setTokenAddress] = useState(searchParams.get("token") ?? "");
  const [direction, setDirection] = useState<PancakeSwapDirection>("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("8");
  const [quote, setQuote] = useState<PancakeSwapQuote | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [quoteError, setQuoteError] = useState("");
  const [pendingAction, setPendingAction] = useState<"" | "approve" | "swap">("");
  const [projects, setProjects] = useState<MintLaunchProject[]>([]);
  const [projectsStatus, setProjectsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const tradableProjects = useMemo(() => projects.filter((p) => p.finalized), [projects]);
  const selectedProject = tradableProjects.find(
    (p) => p.token.toLowerCase() === tokenAddress.trim().toLowerCase(),
  );

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    if (tokenFromUrl) setTokenAddress(tokenFromUrl);
  }, [searchParams]);

  useEffect(() => {
    setQuote(null);
    setQuoteError("");
    setQuoteStatus("idle");
  }, [amount, direction, slippage, tokenAddress]);

  useEffect(() => {
    let mounted = true;
    setProjectsStatus("loading");
    fetchMintLaunchProjects(wallet.account || "")
      .then((data) => {
        if (!mounted) return;
        setProjects(data);
        setProjectsStatus("ready");
      })
      .catch((err) => {
        if (!mounted) return;
        setProjectsStatus("error");
        console.error("加载 Mint 项目失败", err);
      });
    return () => {
      mounted = false;
    };
  }, [wallet.account]);

  const readQuote = async () => {
    setQuoteStatus("loading");
    setQuoteError("");
    try {
      const nextQuote = await fetchPancakeSwapQuote({
        tokenAddress,
        amount,
        direction,
        slippageBps: slippageToBps(slippage),
        account: wallet.account || undefined,
        locale: "zh",
      });
      setQuote(nextQuote);
      setQuoteStatus("ready");
    } catch (error) {
      setQuote(null);
      setQuoteStatus("error");
      setQuoteError(readErrorMessage(error));
    }
  };

  const approve = async () => {
    if (!quote || !wallet.signer) return;
    setPendingAction("approve");
    try {
      const result = await approvePancakeSwapToken(wallet.signer, tokenAddress, quote.amountIn, "zh");
      showToast({ type: "success", message: `授权已确认：${shortAddress(result.hash)}` });
      await readQuote();
    } catch (error) {
      showToast({ type: "error", message: readErrorMessage(error) });
    } finally {
      setPendingAction("");
    }
  };

  const swap = async () => {
    if (!wallet.signer) {
      showToast({ type: "error", message: "请先连接钱包" });
      return;
    }
    setPendingAction("swap");
    try {
      const result = await executePancakeSwap(wallet.signer, {
        tokenAddress,
        amount,
        direction,
        slippageBps: slippageToBps(slippage),
        locale: "zh",
      });
      showToast({ type: "success", message: `Swap 已确认：${shortAddress(result.hash)}` });
      setQuote(null);
      setQuoteStatus("idle");
    } catch (error) {
      showToast({ type: "error", message: readErrorMessage(error) });
    } finally {
      setPendingAction("");
    }
  };

  const isLoadingQuote = quoteStatus === "loading";

  return (
    <div className="page-fade-in mx-auto max-w-5xl px-4 py-6 lg:py-8">
      <section className="rounded-2xl border border-[#25282C] bg-[#111215]/80 p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5 text-[#D0FF00]" />
              <h1 className="text-2xl font-black tracking-tight text-white">PancakeSwap 交易</h1>
            </div>
            <p className="mt-1 text-sm text-[#9CA3AF]">
              通过 PancakeSwap V2 Router 直接兑换，成交取决于项目是否已经添加 BNB 流动性。
            </p>
          </div>
          {!wallet.isConnected ? (
            <button onClick={wallet.connectWallet} className="kimi-btn-primary">
              <Wallet className="h-4 w-4" />
              连接钱包
            </button>
          ) : (
            <div className="rounded-xl border border-[#25282C] bg-[#0A0B0D] px-4 py-2 text-sm text-white">
              {shortAddress(wallet.account || "")}
            </div>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <form
          className="lg:col-span-2 rounded-2xl border border-[#25282C] bg-[#111215]/80 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void readQuote();
          }}
        >
          <div
            className="inline-flex rounded-xl border border-[#25282C] bg-[#0A0B0D] p-1"
            role="group"
          >
            <button
              type="button"
              onClick={() => setDirection("buy")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                direction === "buy"
                  ? "bg-[#D0FF00] text-black"
                  : "text-[#9CA3AF] hover:text-white",
              )}
            >
              买入
            </button>
            <button
              type="button"
              onClick={() => setDirection("sell")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                direction === "sell"
                  ? "bg-[#D0FF00] text-black"
                  : "text-[#9CA3AF] hover:text-white",
              )}
            >
              卖出
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-[#9CA3AF]">选择项目</label>
              <select
                value={selectedProject ? selectedProject.token : "custom"}
                onChange={(e) => {
                  if (e.target.value !== "custom") {
                    setTokenAddress(e.target.value);
                  }
                }}
                className="kimi-input w-full appearance-none"
              >
                <option value="custom">自定义代币地址</option>
                {tradableProjects.map((project) => (
                  <option key={project.token} value={project.token}>
                    {project.name} ({project.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-[#9CA3AF]">代币合约地址</label>
              <input
                className="kimi-input w-full font-mono"
                placeholder="0x..."
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-[#9CA3AF]">
                  数量 {direction === "buy" ? "BNB" : quote?.tokenSymbol || ""}
                </label>
                <input
                  className="kimi-input w-full"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#9CA3AF]">滑点 (%)</label>
                <input
                  className="kimi-input w-full"
                  placeholder="8"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoadingQuote}
            className="kimi-btn-primary mt-5 w-full disabled:opacity-50"
          >
            {isLoadingQuote ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpDown className="h-4 w-4" />
            )}
            {quote ? "刷新报价" : "获取报价"}
          </button>

          {projectsStatus === "ready" && tradableProjects.length === 0 && (
            <p className="mt-4 text-xs text-[#6B7280]">暂无已开盘的可交易项目。</p>
          )}

          {quoteError && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 p-3 text-sm text-[#FF6B6B]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {quoteError}
            </div>
          )}

          {quote && (
            <div className="mt-4 space-y-2 rounded-xl border border-[#25282C] bg-[#0A0B0D]/80 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-[#6B7280]">兑换路径</span>
                <span className="text-white">{quote.routeLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">预计到账</span>
                <span className="text-white">
                  {quote.formattedAmountOut} {quote.targetSymbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">最小到账</span>
                <span className="text-white">
                  {quote.formattedMinimumAmountOut} {quote.targetSymbol}
                </span>
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-3">
            {quote?.needsApproval && (
              <button
                type="button"
                disabled={pendingAction === "approve" || !wallet.signer}
                onClick={approve}
                className="kimi-btn-secondary flex-1 disabled:opacity-50"
              >
                {pendingAction === "approve" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wallet className="h-4 w-4" />
                )}
                授权 Router
              </button>
            )}
            <button
              type="button"
              disabled={!quote || quote.needsApproval || pendingAction === "swap" || !wallet.signer}
              onClick={swap}
              className={cn(
                "flex-1 disabled:opacity-50",
                quote?.needsApproval ? "kimi-btn-primary" : "kimi-btn-primary w-full",
              )}
            >
              {pendingAction === "swap" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpDown className="h-4 w-4" />
              )}
              确认兑换
            </button>
          </div>
        </form>

        <aside className="h-fit rounded-2xl border border-[#25282C] bg-[#111215]/80 p-5">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#6B7280]">薄饼 Router</span>
              <span className="font-mono text-white">{shortAddress(PANCAKE_V2_ROUTER_ADDRESS)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B7280]">路径</span>
              <span className="text-white">
                {quote?.routeLabel ?? (direction === "buy" ? "BNB -> TOKEN" : "TOKEN -> BNB")}
              </span>
            </div>
          </div>
          <p className="mt-4 text-xs text-[#6B7280]">
            报价来自 PancakeSwap，含税代币实际到账可能低于显示值。
          </p>
          <button
            type="button"
            onClick={() => window.open(buildPancakeSwapUrl(tokenAddress, direction), "_blank", "noreferrer")}
            className="kimi-btn-secondary mt-4 w-full"
          >
            <ExternalLink className="h-4 w-4" />
            打开薄饼
          </button>
        </aside>
      </div>
    </div>
  );
}
