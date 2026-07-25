import { TrendingUp, Flame } from "lucide-react";

const placeholders = Array.from({ length: 10 }).map((_, i) => ({
  rank: i + 1,
  keyword: `热门 Vault 关键词 #${i + 1}`,
  heat: Math.floor(Math.random() * 90) + 10,
}));

export default function Trending() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">热搜榜</h2>
        <p className="mt-1 text-sm text-[#84888C]">实时 Vault 与合约热度排行</p>
      </div>

      <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-6">
        <div className="mb-4 flex items-center gap-2">
          <Flame className="h-5 w-5 text-[#FF6B6B]" />
          <h3 className="text-base font-semibold text-white">今日热搜</h3>
        </div>

        <ul className="space-y-2">
          {placeholders.map((item) => (
            <li
              key={item.rank}
              className="flex items-center gap-4 rounded-lg bg-[#0B0D0E] px-4 py-3 transition-colors hover:bg-[#1A1D21]"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${
                  item.rank <= 3
                    ? "bg-[#FF6B6B]/20 text-[#FF6B6B]"
                    : "bg-[#23262A] text-[#9CA3AF]"
                }`}
              >
                {item.rank}
              </span>
              <span className="flex-1 text-sm text-[#E8E8E8]">{item.keyword}</span>
              <div className="flex items-center gap-1 text-xs text-[#5F656D]">
                <TrendingUp className="h-3 w-3" />
                <span>{item.heat}w</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
