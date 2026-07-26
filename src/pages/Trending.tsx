import { Flame, Trophy, Eye, Activity } from "lucide-react";

const shorten = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const items = [
  {
    rank: 1,
    name: "Flap Genesis Vault",
    address: "0x9aa9cadec931c58c2a22bbc5381b266d12887777",
    tag: "Tax Vault",
    heat: 982,
    change: "+32%",
    views: "12.5w",
  },
  {
    rank: 2,
    name: "PandaSwap Buyback",
    address: "0x7a8bC2De9d54C78f6b9C4D3eE1F2a0B1c2d3E4f5",
    tag: "Buyback",
    heat: 874,
    change: "+18%",
    views: "9.8w",
  },
  {
    rank: 3,
    name: "MoonBeam Dividend",
    address: "0x3F5a1B2c3D4e5F6a7B8c9D0E1F2A3B4C5D6E7F8A9",
    tag: "Dividend",
    heat: 756,
    change: "+12%",
    views: "8.2w",
  },
  {
    rank: 4,
    name: "Satoshi Meme Launch",
    address: "0xA1B2C3d4E5F6a7B8C9D0E1F2A3b4C5D6E7F8A9B0",
    tag: "Launch",
    heat: 621,
    change: "+9%",
    views: "6.4w",
  },
  {
    rank: 5,
    name: "Aurora Treasury",
    address: "0xB2c3D4E5F6a7B8C9D0E1F2A3B4c5D6E7F8A9B0C1",
    tag: "Treasury",
    heat: 548,
    change: "+7%",
    views: "5.1w",
  },
  {
    rank: 6,
    name: "Nova Liquidity Vault",
    address: "0xC3d4E5F6a7B8C9D0E1F2A3B4C5d6E7F8A9B0C1D2",
    tag: "LP Vault",
    heat: 432,
    change: "+5%",
    views: "4.3w",
  },
  {
    rank: 7,
    name: "Quantum AI Oracle",
    address: "0xD4E5F6a7B8C9D0E1F2A3B4C5D6e7F8A9B0C1D2E3",
    tag: "AI Oracle",
    heat: 389,
    change: "+4%",
    views: "3.8w",
  },
  {
    rank: 8,
    name: "Pepe Vault V2",
    address: "0xE5F6a7B8C9D0E1F2A3B4C5D6E7f8A9B0C1D2E3F4",
    tag: "Tax Vault",
    heat: 312,
    change: "+3%",
    views: "2.9w",
  },
  {
    rank: 9,
    name: "DragonStake Pool",
    address: "0xF6a7B8C9D0E1F2A3B4C5D6E7F8a9B0C1D2E3F4A5",
    tag: "Staking",
    heat: 267,
    change: "+2%",
    views: "2.1w",
  },
  {
    rank: 10,
    name: "CyberBond Factory",
    address: "0xA7B8C9D0E1F2A3B4C5D6E7F8A9b0C1D2E3F4A5B6",
    tag: "Factory",
    heat: 198,
    change: "+1%",
    views: "1.5w",
  },
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

export default function Trending() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">热搜榜</h2>
        <p className="mt-1 text-sm text-[#84888C]">实时 Vault、Factory 与合约热度排行</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-4">
          <div className="mb-2 flex items-center gap-2 text-[#FF6B6B]">
            <Flame className="h-4 w-4" />
            <span className="text-xs font-medium">24h 最热</span>
          </div>
          <p className="text-2xl font-bold text-white">982w</p>
          <p className="text-xs text-[#5F656D]">Flap Genesis Vault</p>
        </div>
        <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-4">
          <div className="mb-2 flex items-center gap-2 text-[#2EDEDB]">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-medium">实时搜索</span>
          </div>
          <p className="text-2xl font-bold text-white">4.2w</p>
          <p className="text-xs text-[#5F656D]">过去 1 小时</p>
        </div>
        <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-4">
          <div className="mb-2 flex items-center gap-2 text-[#D0FF00]">
            <Eye className="h-4 w-4" />
            <span className="text-xs font-medium">总浏览</span>
          </div>
          <p className="text-2xl font-bold text-white">56.6w</p>
          <p className="text-xs text-[#5F656D]">全网合约页面</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[#FF6B6B]" />
            <h3 className="text-base font-semibold text-white">今日热搜</h3>
          </div>
          <span className="text-xs text-[#5F656D]">每小时更新</span>
        </div>

        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.rank}
              className="group flex items-center gap-3 rounded-lg bg-[#0B0D0E] px-4 py-3 transition-colors hover:bg-[#1A1D21]"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${
                  item.rank === 1
                    ? "bg-[#FF6B6B]/20 text-[#FF6B6B]"
                    : item.rank === 2
                      ? "bg-[#D0FF00]/20 text-[#D0FF00]"
                      : item.rank === 3
                        ? "bg-[#2EDEDB]/20 text-[#2EDEDB]"
                        : "bg-[#23262A] text-[#9CA3AF]"
                }`}
              >
                {item.rank}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-[#E8E8E8]">
                    {item.name}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      tagColor[item.tag] || "bg-[#23262A] text-[#9CA3AF]"
                    }`}
                  >
                    {item.tag}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-xs text-[#5F656D]">
                  {shorten(item.address)}
                </p>
              </div>

              <div className="hidden shrink-0 text-right sm:block">
                <p className="text-sm font-medium text-white">{item.heat}w</p>
                <p className="text-xs text-[#34D399]">{item.change}</p>
              </div>

              <div className="flex shrink-0 items-center gap-1 text-xs text-[#5F656D]">
                <Eye className="h-3 w-3" />
                <span>{item.views}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
