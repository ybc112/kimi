import { ExternalLink, CheckCircle2, Clock, List, Search, Copy, Share2, Trash2, Filter, Rocket, Flame, Box, Zap } from "lucide-react";
import { useState, useMemo } from "react";
import { useIssuedTokens } from "@/hooks/useIssuedTokens";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import type { TokenStatus, TokenType } from "@/types";
import Empty from "@/components/Empty";

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
  success: { label: "已激活", color: "text-[#D0FF00]", bg: "bg-[#D0FF00]/10", icon: CheckCircle2 },
  pending: { label: "部署中", color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10", icon: Clock },
  failed: { label: "失败", color: "text-[#FF6B6B]", bg: "bg-[#FF6B6B]/10", icon: Clock },
};

const typeConfig: Record<TokenType, { label: string; icon: React.ElementType; color: string }> = {
  snowball: { label: "Snowball", icon: Flame, color: "text-[#FF6B6B]" },
  flap: { label: "Flap", icon: Box, color: "text-[#2EDEDB]" },
  meme: { label: "Meme", icon: Zap, color: "text-[#A78BFA]" },
  custom: { label: "Custom", icon: Rocket, color: "text-[#9CA3AF]" },
};

const typeFilters: { value: TokenType | "all"; label: string; icon: React.ElementType }[] = [
  { value: "all", label: "全部类型", icon: Filter },
  { value: "snowball", label: "Snowball", icon: Flame },
  { value: "flap", label: "Flap", icon: Box },
  { value: "meme", label: "Meme", icon: Zap },
  { value: "custom", label: "Custom", icon: Rocket },
];

const statusFilters: { value: TokenStatus | "all"; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "success", label: "已激活" },
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

export default function IssuedTokens() {
  const { tokens, removeToken, clearTokens } = useIssuedTokens();
  const { showToast } = useAppStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TokenStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TokenType | "all">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    return {
      total: tokens.length,
      success: tokens.filter((t) => t.status === "success").length,
      pending: tokens.filter((t) => t.status === "pending").length,
    };
  }, [tokens]);

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

      <div className="rounded-2xl border border-[#25282C] bg-[#111215] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#25282C] text-[#6B7280]">
                <th className="px-5 py-4 font-medium">代币</th>
                <th className="px-5 py-4 font-medium">合约地址</th>
                <th className="px-5 py-4 font-medium">网络</th>
                <th className="px-5 py-4 font-medium">部署时间</th>
                <th className="px-5 py-4 font-medium">状态</th>
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
                return (
                  <tr
                    key={token.id}
                    className="border-b border-[#25282C] last:border-0 transition-colors hover:bg-[#0A0B0D]/50"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A0B0D]", tcfg.color)}>
                          <TypeIcon className="h-4 w-4" />
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
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "已部署代币", value: stats.total.toString() },
          { label: "已激活", value: stats.success.toString() },
          { label: "部署中", value: stats.pending.toString() },
        ].map((stat) => (
          <div key={stat.label} className="kimi-card">
            <p className="text-xs text-[#6B7280]">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{stat.value}</p>
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
    </div>
  );
}
