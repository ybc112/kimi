import { useState, useMemo } from "react";
import { Flame, Trophy, Eye, Activity, Search, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type TabKey = "gainers" | "new" | "search";
type TrendItem = {
  rank: number;
  name: string;
  address: string;
  tag: string;
  heat: number;
  change: string;
  views: string;
  sparkline: number[];
};

const shorten = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const baseItems: TrendItem[] = [
  {
    rank: 1,
    name: "Flap Genesis Vault",
    address: "0x9aa9cadec931c58c2a22bbc5381b266d12887777",
    tag: "Tax Vault",
    heat: 982,
    change: "+32%",
    views: "12.5w",
    sparkline: [42, 48, 45, 55, 52, 60, 58, 68, 72, 82],
  },
  {
    rank: 2,
    name: "PandaSwap Buyback",
    address: "0x7a8bC2De9d54C78f6b9C4D3eE1F2a0B1c2d3E4f5",
    tag: "Buyback",
    heat: 874,
    change: "+18%",
    views: "9.8w",
    sparkline: [50, 52, 51, 54, 53, 56, 58, 60, 62, 68],
  },
  {
    rank: 3,
    name: "MoonBeam Dividend",
    address: "0x3F5a1B2c3D4e5F6a7B8c9D0E1F2A3B4C5D6E7F8A9",
    tag: "Dividend",
    heat: 756,
    change: "+12%",
    views: "8.2w",
    sparkline: [60, 58, 59, 61, 60, 63, 65, 64, 66, 70],
  },
  {
    rank: 4,
    name: "Satoshi Meme Launch",
    address: "0xA1B2C3d4E5F6a7B8C9D0E1F2A3b4C5D6E7F8A9B0",
    tag: "Launch",
    heat: 621,
    change: "+9%",
    views: "6.4w",
    sparkline: [40, 42, 41, 43, 45, 44, 46, 48, 47, 50],
  },
  {
    rank: 5,
    name: "Aurora Treasury",
    address: "0xB2c3D4E5F6a7B8C9D0E1F2A3B4c5D6E7F8A9B0C1",
    tag: "Treasury",
    heat: 548,
    change: "+7%",
    views: "5.1w",
    sparkline: [55, 54, 56, 55, 57, 56, 58, 59, 58, 60],
  },
  {
    rank: 6,
    name: "Nova Liquidity Vault",
    address: "0xC3d4E5F6a7B8C9D0E1F2A3B4C5d6E7F8A9B0C1D2",
    tag: "LP Vault",
    heat: 432,
    change: "+5%",
    views: "4.3w",
    sparkline: [48, 47, 49, 48, 50, 49, 51, 50, 52, 53],
  },
  {
    rank: 7,
    name: "Quantum AI Oracle",
    address: "0xD4E5F6a7B8C9D0E1F2A3B4C5D6e7F8A9B0C1D2E3",
    tag: "AI Oracle",
    heat: 389,
    change: "+4%",
    views: "3.8w",
    sparkline: [50, 49, 50, 51, 50, 52, 51, 52, 53, 54],
  },
  {
    rank: 8,
    name: "Pepe Vault V2",
    address: "0xE5F6a7B8C9D0E1F2A3B4C5D6E7f8A9B0C1D2E3F4",
    tag: "Tax Vault",
    heat: 312,
    change: "+3%",
    views: "2.9w",
    sparkline: [45, 44, 45, 46, 45, 47, 46, 47, 48, 49],
  },
  {
    rank: 9,
    name: "DragonStake Pool",
    address: "0xF6a7B8C9D0E1F2A3B4C5D6E7F8a9B0C1D2E3F4A5",
    tag: "Staking",
    heat: 267,
    change: "+2%",
    views: "2.1w",
    sparkline: [52, 51, 52, 52, 53, 52, 53, 54, 53, 54],
  },
  {
    rank: 10,
    name: "CyberBond Factory",
    address: "0xA7B8C9D0E1F2A3B4C5D6E7F8A9b0C1D2E3F4A5B6",
    tag: "Factory",
    heat: 198,
    change: "+1%",
    views: "1.5w",
    sparkline: [50, 50, 49, 50, 51, 50, 50, 51, 50, 51],
  },
];

const newItems: TrendItem[] = [
  { rank: 1, name: "NeonAI Vault", address: "0x11a9cadec931c58c2a22bbc5381b266d12887771", tag: "AI Oracle", heat: 245, change: "+120%", views: "1.2w", sparkline: [10, 15, 14, 22, 30, 45, 42, 60, 85, 120] },
  { rank: 2, name: "Galaxy Meme", address: "0x22a9cadec931c58c2a22bbc5381b266d12887772", tag: "Launch", heat: 198, change: "+85%", views: "0.9w", sparkline: [20, 22, 25, 24, 35, 38, 45, 55, 70, 85] },
  { rank: 3, name: "Orbit Treasury", address: "0x33a9cadec931c58c2a22bbc5381b266d12887773", tag: "Treasury", heat: 156, change: "+62%", views: "0.7w", sparkline: [30, 32, 31, 38, 40, 44, 48, 52, 58, 62] },
  { rank: 4, name: "Flux Buyback", address: "0x44a9cadec931c58c2a22bbc5381b266d12887774", tag: "Buyback", heat: 132, change: "+45%", views: "0.6w", sparkline: [25, 28, 27, 30, 32, 35, 36, 40, 43, 45] },
  { rank: 5, name: "Pulse Dividend", address: "0x55a9cadec931c58c2a22bbc5381b266d12887775", tag: "Dividend", heat: 98, change: "+33%", views: "0.4w", sparkline: [40, 41, 42, 43, 44, 46, 47, 49, 50, 53] },
];

const searchItems: TrendItem[] = [
  { rank: 1, name: "Flap Genesis Vault", address: "0x9aa9cadec931c58c2a22bbc5381b266d12887777", tag: "Tax Vault", heat: 982, change: "+32%", views: "12.5w", sparkline: [42, 48, 45, 55, 52, 60, 58, 68, 72, 82] },
  { rank: 2, name: "PandaSwap Buyback", address: "0x7a8bC2De9d54C78f6b9C4D3eE1F2a0B1c2d3E4f5", tag: "Buyback", heat: 874, change: "+18%", views: "9.8w", sparkline: [50, 52, 51, 54, 53, 56, 58, 60, 62, 68] },
  { rank: 3, name: "Kimi AI Coder", address: "0x88a9cadec931c58c2a22bbc5381b266d12887788", tag: "AI Oracle", heat: 720, change: "+15%", views: "7.8w", sparkline: [35, 40, 38, 45, 48, 52, 55, 60, 66, 72] },
  { rank: 4, name: "Snowball Launchpad", address: "0x99a9cadec931c58c2a22bbc5381b266d12887799", tag: "Launch", heat: 645, change: "+11%", views: "6.1w", sparkline: [50, 51, 52, 51, 53, 54, 55, 56, 58, 60] },
  { rank: 5, name: "XVS Reward Vault", address: "0x00a9cadec931c58c2a22bbc5381b266d12887700", tag: "LP Vault", heat: 512, change: "+8%", views: "4.8w", sparkline: [45, 46, 45, 47, 48, 47, 49, 50, 51, 53] },
];

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

const tabs: { key: TabKey; label: string }[] = [
  { key: "gainers", label: "24h 涨幅榜" },
  { key: "new", label: "新币榜" },
  { key: "search", label: "搜索榜" },
];

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
  const [activeTab, setActiveTab] = useState<TabKey>("gainers");
  const [search, setSearch] = useState("");

  const currentItems = useMemo(() => {
    const map: Record<TabKey, TrendItem[]> = {
      gainers: baseItems,
      new: newItems,
      search: searchItems,
    };
    const list = map[activeTab];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter(
      (i) =>
        i.name.toLowerCase().includes(s) ||
        i.tag.toLowerCase().includes(s) ||
        i.address.toLowerCase().includes(s)
    );
  }, [activeTab, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">热搜榜</h2>
          <p className="mt-1 text-sm text-[#84888C]">实时 Vault、Factory 与合约热度排行</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5F656D]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索名称 / 标签 / 地址"
            className="w-full rounded-lg border border-[#303236] bg-[#15171A] py-2 pl-9 pr-4 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-4 transition-colors hover:border-[#FF6B6B]/30">
          <div className="mb-2 flex items-center gap-2 text-[#FF6B6B]">
            <Flame className="h-4 w-4" />
            <span className="text-xs font-medium">24h 最热</span>
          </div>
          <p className="text-2xl font-bold text-white">982w</p>
          <p className="text-xs text-[#5F656D]">Flap Genesis Vault</p>
        </div>
        <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-4 transition-colors hover:border-[#2EDEDB]/30">
          <div className="mb-2 flex items-center gap-2 text-[#2EDEDB]">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-medium">实时搜索</span>
          </div>
          <p className="text-2xl font-bold text-white">4.2w</p>
          <p className="text-xs text-[#5F656D]">过去 1 小时</p>
        </div>
        <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-4 transition-colors hover:border-[#D0FF00]/30">
          <div className="mb-2 flex items-center gap-2 text-[#D0FF00]">
            <Eye className="h-4 w-4" />
            <span className="text-xs font-medium">总浏览</span>
          </div>
          <p className="text-2xl font-bold text-white">56.6w</p>
          <p className="text-xs text-[#5F656D]">全网合约页面</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-5">
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
                    : "text-[#9CA3AF] hover:bg-[#23262A] hover:text-white"
                )}
              >
                {t.label}
              </button>
            ))}
            <span className="ml-2 text-xs text-[#5F656D]">每小时更新</span>
          </div>
        </div>

        <ul className="space-y-2">
          {currentItems.map((item) => {
            const isUp = item.change.startsWith("+");
            const isDown = item.change.startsWith("-");
            const TrendIcon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
            return (
              <li
                key={`${activeTab}-${item.rank}`}
                className="group flex items-center gap-3 rounded-lg bg-[#0B0D0E] px-4 py-3 transition-colors hover:bg-[#1A1D21]"
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
                          : "bg-[#23262A] text-[#9CA3AF]"
                  )}
                >
                  {item.rank}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[#E8E8E8]">{item.name}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                        tagColor[item.tag] || "bg-[#23262A] text-[#9CA3AF]"
                      )}
                    >
                      {item.tag}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-[#5F656D]">{shorten(item.address)}</p>
                </div>

                <div className="hidden shrink-0 sm:block">
                  <Sparkline data={item.sparkline} change={item.change} />
                </div>

                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-sm font-medium text-white">{item.heat}w</p>
                  <p
                    className={cn(
                      "flex items-center justify-end text-xs",
                      isUp ? "text-[#34D399]" : isDown ? "text-[#FF6B6B]" : "text-[#9CA3AF]"
                    )}
                  >
                    <TrendIcon className="mr-0.5 h-3 w-3" />
                    {item.change}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1 text-xs text-[#5F656D]">
                  <Eye className="h-3 w-3" />
                  <span>{item.views}</span>
                </div>
              </li>
            );
          })}
          {currentItems.length === 0 && (
            <li className="py-10 text-center text-sm text-[#5F656D]">未找到匹配项目</li>
          )}
        </ul>
      </div>
    </div>
  );
}
