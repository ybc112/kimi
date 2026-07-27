import { useState, useMemo } from "react";
import { Flame, Trophy, Eye, Activity, Search, ArrowUpRight, ArrowDownRight, RefreshCw, Loader2, TrendingUp } from "lucide-react";
import { useContractData } from "@/hooks/useContractData";
import { cn } from "@/lib/utils";
import Empty from "@/components/Empty";

const tabs = [
  { key: "gainers", label: "24h 涨幅榜" },
  { key: "new", label: "新币榜" },
  { key: "search", label: "搜索榜" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

const tagColor: Record<string, string> = {
  "Tax Vault": "bg-[#D0FF00]/10 text-[#D0FF00]",
  Buyback: "bg-[#2EDEDB]/10 text-[#2EDEDB]",
  Dividend: "bg-[#A78BFA]/10 text-[#A78BFA]",
  Launch: "bg-[#FF6B6B]/10 text-[#FF6B6B]",
  Treasury: "bg-[#F59E0B]/10 text-[#F59E0B]",
  "LP Vault": "bg-[#34D399]/10 text-[#34D399]",
  "AI Oracle": "bg-[#60A5FA]/10 text-[#60A5FA]",
  Staking: "bg-[#F472B6]/10 text-[#F472B6]",
  Factory: "bg-[#9CA3AF]/10 text-[#9CA3AF]",
};

const shorten = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

function Sparkline({ data, change }: { data: number[]; change: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 28;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
  const isUp = change.startsWith("+");
  const isDown = change.startsWith("-");
  const color = isUp ? "#34D399" : isDown ? "#FF6B6B" : "#9CA3AF";

  return (
    <svg width={width} height={height} className="shrink-0 overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle cx={width} cy={height - ((data[data.length - 1] - min) / range) * height} r="2.5" fill={color} />
    </svg>
  );
}

export default function Trending() {
  const { trending, loading, refreshTrending } = useContractData();
  const [activeTab, setActiveTab] = useState<TabKey>("gainers");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return trending;
    const s = search.toLowerCase();
    return trending.filter(
      (i) =>
        i.name.toLowerCase().includes(s) ||
        i.symbol.toLowerCase().includes(s) ||
        i.address.toLowerCase().includes(s)
    );
  }, [trending, search]);

  const topItem = trending[0];
  const totalVolume = useMemo(() => {
    return trending.reduce((acc, cur) => {
      const n = Number(cur.volume24h.replace(/[^0-9.]/g, "")) || 0;
      return acc + n;
    }, 0);
  }, [trending]);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="kimi-page-title">热搜榜</h2>
          <p className="kimi-page-subtitle">Trending · 实时 Vault、Factory 与合约热度排行</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索名称 / Symbol / 地址"
              className="kimi-input w-full pl-9"
            />
          </div>
          <button
            onClick={refreshTrending}
            disabled={loading}
            className="kimi-btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            刷新
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="kimi-card kimi-card-hover">
          <div className="mb-2 flex items-center gap-2 text-[#FF6B6B]">
            <Flame className="h-4 w-4" />
            <span className="text-xs font-medium">24h 最热</span>
          </div>
          <p className="text-2xl font-bold text-white">{topItem ? topItem.hotScore : "-"}</p>
          <p className="text-xs text-[#6B7280]">{topItem ? topItem.name : "暂无数据"}</p>
        </div>
        <div className="kimi-card kimi-card-hover">
          <div className="mb-2 flex items-center gap-2 text-[#2EDEDB]">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-medium">实时搜索</span>
          </div>
          <p className="text-2xl font-bold text-white">{trending.length ? (trending.length * 0.42).toFixed(1) + "w" : "-"}</p>
          <p className="text-xs text-[#6B7280]">过去 1 小时</p>
        </div>
        <div className="kimi-card kimi-card-hover">
          <div className="mb-2 flex items-center gap-2 text-[#D0FF00]">
            <Eye className="h-4 w-4" />
            <span className="text-xs font-medium">总浏览</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalVolume ? totalVolume.toFixed(1) + "w" : "-"}</p>
          <p className="text-xs text-[#6B7280]">全网合约页面</p>
        </div>
      </div>

      <div className="kimi-card">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[#FF6B6B]" />
            <h3 className="text-base font-semibold text-white">今日热搜</h3>
          </div>
          <div className="flex items-center gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  activeTab === t.key
                    ? "bg-[#D0FF00]/10 text-[#D0FF00]"
                    : "text-[#9CA3AF] hover:bg-[#1A1D21] hover:text-white"
                )}
              >
                {t.label}
              </button>
            ))}
            <span className="ml-2 text-xs text-[#6B7280]">每小时更新</span>
          </div>
        </div>

        {loading && trending.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#9CA3AF]">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在刷新热度数据…
          </div>
        ) : filtered.length === 0 ? (
          <Empty
            icon={<TrendingUp className="h-7 w-7" />}
            title="暂无热搜数据"
            subtitle="点击右上角「刷新」按钮获取最新热度排行"
            action={
              <button onClick={refreshTrending} disabled={loading} className="kimi-btn-primary">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                立即刷新
              </button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {filtered.map((item) => {
              const changeNum = Number(item.change24h.replace(/[^0-9.-]/g, ""));
              const isUp = changeNum >= 0;
              const TrendIcon = isUp ? ArrowUpRight : ArrowDownRight;
              const tag = item.rank === 1 ? "Tax Vault" : ["Buyback", "Dividend", "Launch", "Treasury", "LP Vault", "AI Oracle", "Staking", "Factory"][item.rank % 9];
              return (
                <li
                  key={`${activeTab}-${item.rank}`}
                  className="group flex items-center gap-3 rounded-xl bg-[#0A0B0D] px-4 py-3 transition-colors hover:bg-[#1A1D21]"
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold",
                      item.rank === 1
                        ? "bg-[#FF6B6B]/20 text-[#FF6B6B]"
                        : item.rank === 2
                          ? "bg-[#D0FF00]/20 text-[#D0FF00]"
                          : item.rank === 3
                            ? "bg-[#2EDEDB]/20 text-[#2EDEDB]"
                            : "bg-[#25282C] text-[#9CA3AF]"
                    )}
                  >
                    {item.rank}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[#E8E8E8]">{item.name}</span>
                      <span className="rounded bg-[#25282C] px-1.5 py-0.5 text-[10px] font-medium text-[#D0FF00]">
                        {item.symbol}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                          tagColor[tag] || "bg-[#25282C] text-[#9CA3AF]"
                        )}
                      >
                        {tag}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-[#6B7280]">{shorten(item.address)}</p>
                  </div>

                  <div className="hidden shrink-0 sm:block">
                    <Sparkline data={item.sparkline} change={item.change24h} />
                  </div>

                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-medium text-white">{item.price}</p>
                    <p
                      className={cn(
                        "flex items-center justify-end text-xs",
                        isUp ? "text-[#34D399]" : "text-[#FF6B6B]"
                      )}
                    >
                      <TrendIcon className="mr-0.5 h-3 w-3" />
                      {item.change24h}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs text-[#6B7280]">
                    <span>{item.volume24h}</span>
                    <span className="text-[10px]">MCap {item.marketCap}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
