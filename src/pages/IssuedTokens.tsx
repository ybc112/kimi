import {
  ExternalLink,
  CheckCircle2,
  Clock,
  List,
  Search,
  Copy,
  Share2,
  Trash2,
  Filter,
  Rocket,
  Flame,
  Box,
  Zap,
  Droplets,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useIssuedTokens } from "@/hooks/useIssuedTokens";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import type { IssuedToken, TokenStatus, TokenType } from "@/types";
import Empty from "@/components/Empty";
import { OpenTradingModal } from "@/components/OpenTradingModal";
import { BSC_CHAIN_ID, BSC_RPC_URL } from "@/lib/contracts/snowball";
import { readSnowballTradingStatus } from "@/lib/contracts/trading";
import { KimiScoreBadge } from "@/components/KimiScoreBadge";

const EXPLORERS: Record<string, string> = {
  "BNB Smart Chain": "https://bscscan.com/token",
  Ethereum: "https://etherscan.io/token",
  "Arbitrum One": "https://arbiscan.io/token",
  Base: "https://basescan.org/token",
};

const statusConfig: Record<
  TokenStatus,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  success: { label: "部署成功", color: "text-[#D0FF00]", bg: "bg-[#D0FF00]/10", icon: CheckCircle2 },
  pending: { label: "部署中", color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10", icon: Clock },
  failed: { label: "失败", color: "text-[#FF6B6B]", bg: "bg-[#FF6B6B]/10", icon: Clock },
};

const typeConfig: Record<TokenType, { label: string; icon: React.ElementType; color: string }> = {
  snowball: { label: "KIMI 发币", icon: Flame, color: "text-[#FF6B6B]" },
  flap: { label: "Flap", icon: Box, color: "text-[#2EDEDB]" },
  meme: { label: "Meme", icon: Zap, color: "text-[#A78BFA]" },
  custom: { label: "Custom", icon: Rocket, color: "text-[#9CA3AF]" },
};

const typeFilters: { value: TokenType | "all"; label: string; icon: React.ElementType }[] = [
  { value: "all", label: "全部类型", icon: Filter },
  { value: "snowball", label: "KIMI 发币", icon: Flame },
  { value: "flap", label: "Flap", icon: Box },
  { value: "meme", label: "Meme", icon: Zap },
  { value: "custom", label: "Custom", icon: Rocket },
];

const statusFilters: { value: TokenStatus | "all"; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "success", label: "部署成功" },
  { value: "pending", label: "部署中" },
  { value: "failed", label: "失败" },
];

function formatTime(ts: number) {
  return new Date(ts).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type TradingCheck = {
  state: "loading" | "open" | "closed" | "error";
  pairAddress?: string;
  error?: string;
};

function supportsOpenTrading(token: IssuedToken) {
  return token.chainId === BSC_CHAIN_ID && token.type !== "custom";
}

export default function IssuedTokens() {
  const { tokens, updateToken, removeToken, clearTokens } = useIssuedTokens();
  const { showToast } = useAppStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TokenStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TokenType | "all">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(() => new Set());
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [tradingChecks, setTradingChecks] = useState<Record<string, TradingCheck>>({});

  const selectedToken = selectedTokenId ? tokens.find((token) => token.id === selectedTokenId) ?? null : null;

  useEffect(() => {
    const launchTokens = tokens.filter(supportsOpenTrading);
    if (launchTokens.length === 0) return;
    let cancelled = false;
    const provider = new ethers.JsonRpcProvider(BSC_RPC_URL, BSC_CHAIN_ID, { staticNetwork: true });

    setTradingChecks((current) => {
      const next = { ...current };
      launchTokens.forEach((token) => {
        if (!next[token.id] || next[token.id].state === "error") next[token.id] = { state: "loading" };
      });
      return next;
    });

    void Promise.allSettled(
      launchTokens.map(async (token) => {
        try {
          const status = await readSnowballTradingStatus(provider, token.address);
          if (!cancelled) {
            setTradingChecks((current) => ({
              ...current,
              [token.id]: {
                state: status.tradingOpen ? "open" : "closed",
                pairAddress: status.pairAddress,
              },
            }));
          }
        } catch (error) {
          if (!cancelled) {
            setTradingChecks((current) => ({
              ...current,
              [token.id]: {
                state: "error",
                error: error instanceof Error ? error.message : String(error),
              },
            }));
          }
        }
      })
    );

    return () => {
      cancelled = true;
      provider.destroy();
    };
  }, [tokens]);

  const markImageFailed = (id: string) => {
    setFailedImageIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    return tokens.filter((t) => {
      const s = search.toLowerCase();
      const matchesSearch =
        t.name.toLowerCase().includes(s) ||
        t.symbol.toLowerCase().includes(s) ||
        t.address.toLowerCase().includes(s) ||
        t.deployer.toLowerCase().includes(s);
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      const matchesType = typeFilter === "all" || t.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [tokens, search, statusFilter, typeFilter]);

  const handleCopy = async (token: (typeof tokens)[number]) => {
    await navigator.clipboard.writeText(token.address);
    setCopiedId(token.id);
    showToast({ type: "success", message: "地址已复制" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = async (token: (typeof tokens)[number]) => {
    const text = `${token.name} (${token.symbol}) 合约地址：${token.address}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: token.name, text });
      } catch {
        await navigator.clipboard.writeText(text);
        showToast({ type: "success", message: "分享内容已复制" });
      }
    } else {
      await navigator.clipboard.writeText(text);
      showToast({ type: "success", message: "分享内容已复制" });
    }
  };

  const stats = useMemo(() => {
    const launchTokens = tokens.filter(supportsOpenTrading);
    const opened = launchTokens.filter((token) => tradingChecks[token.id]?.state === "open" || token.tradingOpen).length;
    return {
      total: tokens.length,
      opened,
      waiting: Math.max(launchTokens.length - opened, 0),
    };
  }, [tokens, tradingChecks]);

  const handleTradingComplete = (token: IssuedToken, updates: Partial<IssuedToken>) => {
    updateToken(token.id, updates);
    setTradingChecks((current) => ({
      ...current,
      [token.id]: {
        state: "open",
        pairAddress: updates.pairAddress,
      },
    }));
    showToast({ type: "success", message: `${token.symbol} 已成功开盘` });
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="kimi-page-title">已发代币</h2>
          <p className="kimi-page-subtitle">Issued Tokens · 用户与平台已部署的代币列表</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索名称 / Symbol / 地址"
              className="kimi-input w-full pl-9 lg:w-64"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TokenStatus | "all")}
            className="kimi-input"
          >
            {statusFilters.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TokenType | "all")}
            className="kimi-input"
          >
            {typeFilters.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {filtered.map((token) => {
          const status = statusConfig[token.status];
          const StatusIcon = status.icon;
          const tcfg = typeConfig[token.type];
          const TypeIcon = tcfg.icon;
          const explorerBase = EXPLORERS[token.network] ?? EXPLORERS["BNB Smart Chain"];
          const canOpen = supportsOpenTrading(token);
          const tradingCheck = tradingChecks[token.id];
          return (
            <article key={token.id} className="rounded-2xl border border-[#25282C] bg-[#111215] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#25282C] bg-[#0A0B0D]", (!token.imageUrl || failedImageIds.has(token.id)) && tcfg.color)}>
                    {token.imageUrl && !failedImageIds.has(token.id) ? (
                      <img
                        src={token.imageUrl}
                        alt={token.symbol}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={() => markImageFailed(token.id)}
                      />
                    ) : (
                      <TypeIcon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-white">{token.name}</h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[#6B7280]">
                      <span className="rounded bg-[#25282C] px-1.5 py-0.5 font-medium text-[#D0FF00]">{token.symbol}</span>
                      <span>{tcfg.label}</span>
                    </div>
                  </div>
                </div>
                <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium", status.bg, status.color)}>
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </span>
              </div>

              {canOpen && (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-[#25282C] bg-[#0A0B0D] px-3 py-2 text-xs">
                  <span className="text-[#6B7280]">交易状态</span>
                  {tradingCheck?.state === "loading" || !tradingCheck ? (
                    <span className="inline-flex items-center gap-1 text-[#2EDEDB]"><Loader2 className="h-3.5 w-3.5 animate-spin" />检查中</span>
                  ) : tradingCheck.state === "open" || token.tradingOpen ? (
                    <span className="inline-flex items-center gap-1 text-[#D0FF00]"><CheckCircle2 className="h-3.5 w-3.5" />已开盘</span>
                  ) : tradingCheck.state === "error" ? (
                    <span className="text-[#F59E0B]" title={tradingCheck.error}>待检查</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[#F59E0B]"><Clock className="h-3.5 w-3.5" />待开盘</span>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between rounded-xl border border-[#25282C] bg-[#0A0B0D] px-3 py-2 text-xs">
                <span className="text-[#6B7280]">安全评分</span>
                <KimiScoreBadge address={token.address} chainId={token.chainId} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-[#25282C] bg-[#0A0B0D] p-3 text-xs">
                <div className="col-span-2">
                  <p className="text-[#6B7280]">合约地址</p>
                  <code className="mt-1 block truncate text-[#E8E8E8]">{token.address}</code>
                </div>
                <div>
                  <p className="text-[#6B7280]">网络</p>
                  <p className="mt-1 text-[#E8E8E8]">{token.network}</p>
                </div>
                <div>
                  <p className="text-[#6B7280]">部署时间</p>
                  <p className="mt-1 text-[#E8E8E8]">{formatTime(token.createdAt)}</p>
                </div>
              </div>

              {canOpen && (
                <button
                  onClick={() => setSelectedTokenId(token.id)}
                  className={cn(
                    "mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition",
                    tradingCheck?.state === "open" || token.tradingOpen
                      ? "border border-[#25282C] bg-[#111215] text-[#D0FF00] hover:border-[#D0FF00]/30"
                      : "bg-[#D0FF00] text-black hover:bg-[#BCE800]"
                  )}
                >
                  <Droplets className="h-4 w-4" />
                  {tradingCheck?.state === "open" || token.tradingOpen ? "查看开盘与交易池" : "加入流动性并开盘"}
                </button>
              )}

              <div className="mt-3 grid grid-cols-4 gap-2">
                <button onClick={() => handleCopy(token)} className="kimi-btn-secondary px-2 py-2 text-xs" title="复制地址">
                  {copiedId === token.id ? <CheckCircle2 className="h-3.5 w-3.5 text-[#D0FF00]" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <a href={`${explorerBase}/${token.address}`} target="_blank" rel="noreferrer" className="kimi-btn-secondary px-2 py-2 text-xs" title="查看浏览器">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button onClick={() => handleShare(token)} className="kimi-btn-secondary px-2 py-2 text-xs" title="分享">
                  <Share2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => removeToken(token.id)} className="flex items-center justify-center rounded-xl border border-[#25282C] bg-[#0A0B0D] px-2 py-2 text-[#9CA3AF] transition-colors hover:border-[#FF6B6B]/30 hover:text-[#FF6B6B]" title="删除">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-[#25282C] bg-[#111215]">
            <Empty
              icon={<List className="h-7 w-7" />}
              title={tokens.length === 0 ? "暂无代币" : "未找到匹配代币"}
              subtitle={tokens.length === 0 ? "部署合约或一键发币后，代币会出现在这里" : "尝试调整搜索或筛选条件"}
            />
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-[#25282C] bg-[#111215] md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#25282C] text-[#6B7280]">
                <th className="px-5 py-4 font-medium">代币</th>
                <th className="px-5 py-4 font-medium">合约地址</th>
                <th className="px-5 py-4 font-medium">网络</th>
                <th className="px-5 py-4 font-medium">部署时间</th>
                <th className="px-5 py-4 font-medium">状态</th>
                <th className="px-5 py-4 font-medium">安全评分</th>
                <th className="px-5 py-4 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((token) => {
                const status = statusConfig[token.status];
                const StatusIcon = status.icon;
                const tcfg = typeConfig[token.type];
                const TypeIcon = tcfg.icon;
                const explorerBase = EXPLORERS[token.network] ?? EXPLORERS["BNB Smart Chain"];
                const canOpen = supportsOpenTrading(token);
                const tradingCheck = tradingChecks[token.id];
                return (
                  <tr
                    key={token.id}
                    className="border-b border-[#25282C] last:border-0 transition-colors hover:bg-[#0A0B0D]/50"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#25282C] bg-[#0A0B0D]",
                            (!token.imageUrl || failedImageIds.has(token.id)) && tcfg.color
                          )}
                        >
                          {token.imageUrl && !failedImageIds.has(token.id) ? (
                            <img
                              src={token.imageUrl}
                              alt={token.symbol}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              onError={() => markImageFailed(token.id)}
                            />
                          ) : (
                            <TypeIcon className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-white">{token.name}</div>
                          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                            <span className="rounded bg-[#25282C] px-1.5 py-0.5 font-medium text-[#D0FF00]">
                              {token.symbol}
                            </span>
                            <span>{tcfg.label}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-[#9CA3AF]">
                      {token.address.slice(0, 8)}...{token.address.slice(-6)}
                    </td>
                    <td className="px-5 py-4 text-[#9CA3AF]">{token.network}</td>
                    <td className="px-5 py-4 text-[#9CA3AF]">{formatTime(token.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                            status.bg,
                            status.color
                          )}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </span>
                        {canOpen && (
                      tradingCheck?.state === "loading" || !tradingCheck ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#2EDEDB]"><Loader2 className="h-3 w-3 animate-spin" />检查交易状态</span>
                      ) : tradingCheck.state === "open" || token.tradingOpen ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#D0FF00]"><Droplets className="h-3 w-3" />已开盘</span>
                      ) : tradingCheck.state === "error" ? (
                        <span className="text-[11px] text-[#F59E0B]" title={tradingCheck.error}>交易状态待检查</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#F59E0B]"><Clock className="h-3 w-3" />待开盘</span>
                      )
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <KimiScoreBadge address={token.address} chainId={token.chainId} />
                </td>
                <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canOpen && (
                          <button
                            onClick={() => setSelectedTokenId(token.id)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                              tradingCheck?.state === "open" || token.tradingOpen
                                ? "border border-[#25282C] bg-[#0A0B0D] text-[#D0FF00] hover:border-[#D0FF00]/30"
                                : "bg-[#D0FF00] text-black hover:bg-[#BCE800]"
                            )}
                            title={tradingCheck?.state === "open" || token.tradingOpen ? "查看交易池" : "加入 PancakeSwap 流动性并开启交易"}
                          >
                            <Droplets className="h-3.5 w-3.5" />
                            {tradingCheck?.state === "open" || token.tradingOpen ? "已开盘" : "开盘"}
                          </button>
                        )}
                        <button
                          onClick={() => handleCopy(token)}
                          className="kimi-btn-secondary py-1.5 px-2 text-xs"
                          title="复制地址"
                        >
                          {copiedId === token.id ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#D0FF00]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <a
                          href={`${explorerBase}/${token.address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="kimi-btn-secondary py-1.5 px-2 text-xs"
                          title="查看浏览器"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <button
                          onClick={() => handleShare(token)}
                          className="kimi-btn-secondary py-1.5 px-2 text-xs"
                          title="分享"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeToken(token.id)}
                          className="rounded-xl border border-[#25282C] bg-[#0A0B0D] px-2 py-1.5 text-[#9CA3AF] transition-colors hover:border-[#FF6B6B]/30 hover:text-[#FF6B6B]"
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <Empty
            icon={<List className="h-7 w-7" />}
            title={tokens.length === 0 ? "暂无代币" : "未找到匹配代币"}
            subtitle={tokens.length === 0 ? "部署合约或一键发币后，代币会出现在这里" : "尝试调整搜索或筛选条件"}
          />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: "已部署代币", value: stats.total.toString() },
          { label: "已开盘", value: stats.opened.toString() },
          { label: "待开盘", value: stats.waiting.toString() },
        ].map((stat) => (
          <div key={stat.label} className="kimi-card p-3 sm:p-5 lg:p-6">
            <p className="text-xs text-[#6B7280]">{stat.label}</p>
            <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{stat.value}</p>
          </div>
        ))}
      </div>

      {tokens.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={clearTokens}
            className="flex items-center gap-2 rounded-xl border border-[#25282C] bg-[#111215] px-4 py-2 text-xs text-[#9CA3AF] transition-colors hover:border-[#FF6B6B]/30 hover:text-[#FF6B6B]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            清空本地代币记录
          </button>
        </div>
      )}

      {selectedToken && (
        <OpenTradingModal
          token={selectedToken}
          onClose={() => setSelectedTokenId(null)}
          onComplete={(updates) => handleTradingComplete(selectedToken, updates)}
        />
      )}
    </div>
  );
}
