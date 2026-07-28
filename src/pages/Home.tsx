import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Rocket,
  FileText,
  ScrollText,
  TrendingUp,
  Zap,
  Sparkles,
  ArrowRight,
  Box,
  CircleDollarSign,
  List,
  ShieldCheck,
  Activity,
  Wand2,
  FileCode,
  Flame,
  Clock,
} from "lucide-react";
import { KimiIcon } from "@/components/KimiIcon";
import { useContractData } from "@/hooks/useContractData";
import { cn } from "@/lib/utils";
import { SNOWBALL_LAUNCHPAD_ADDRESS } from "@/lib/contracts/snowball";

const features = [
  {
    title: "金库生成",
    description: "基于 Kimi + Flap Tax Vault V2 规范，一句话生成 Solidity 合约代码。",
    icon: Box,
    to: "/vault",
    color: "#D0FF00",
  },
  {
    title: "AI 页面生成器",
    description: "描述需求即可生成 HTML + Tailwind 页面，支持实时预览与一键复制。",
    icon: Wand2,
    to: "/page-builder",
    color: "#A78BFA",
  },
  {
    title: "合约部署",
    description: "使用已编译 ERC-20 模板或 Artifact，一键部署到 BNB Smart Chain 等主流网络。",
    icon: Rocket,
    to: "/deploy",
    color: "#D0FF00",
  },
  {
    title: "Flap 发币",
    description: "Kimi 生成合约后，手把手教你把代币发到 Flap 平台。",
    icon: CircleDollarSign,
    to: "/flap-launch",
    color: "#2EDEDB",
  },
  {
    title: "已发代币",
    description: "查看用户与平台已部署代币列表、状态与链上浏览器链接。",
    icon: List,
    to: "/issued-tokens",
    color: "#2EDEDB",
  },
  {
    title: "热搜榜",
    description: "实时追踪链上热门 Vault、Factory 与合约热度排行。",
    icon: TrendingUp,
    to: "/trending",
    color: "#FF6B6B",
  },
  {
    title: "Snowball 发币",
    description: "使用普通 SnowballToken 合约，输入 Meme 概念后连接钱包即可在 BSC 发射。",
    icon: Zap,
    to: "/meme-launch",
    color: "#A78BFA",
  },
  {
    title: "规范文档",
    description: "Flap Tax Vault V2 规范、部署指南与最佳实践。",
    icon: FileText,
    to: "/docs",
    color: "#9CA3AF",
  },
  {
    title: "服务日志",
    description: "查看生成、部署、发射等操作的历史记录与状态。",
    icon: ScrollText,
    to: "/logs",
    color: "#9CA3AF",
  },
];

const stats = [
  { label: "AI 模型", value: "Kimi / DeepSeek-v4-flash", icon: Sparkles },
  { label: "部署网络", value: "BNB Smart Chain Mainnet", icon: Activity },
  {
    label: "Snowball 发射台",
    value: `${SNOWBALL_LAUNCHPAD_ADDRESS.slice(0, 8)}...${SNOWBALL_LAUNCHPAD_ADDRESS.slice(-6)}`,
    icon: ShieldCheck,
  },
];

const activityIcons: Record<string, React.ElementType> = {
  generate: FileCode,
  deploy: Flame,
  launch: Rocket,
  page: Wand2,
  system: Activity,
};

function formatTimeAgo(time: number) {
  const diff = Math.floor((Date.now() - time) / 1000);
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

export default function Home() {
  const navigate = useNavigate();
  const { stats: todayStats, activities } = useContractData();

  const todayStatsList = [
    { label: "已生成合约", value: todayStats.generated.toLocaleString("zh-CN"), change: "+1", icon: FileCode },
    { label: "已部署代币", value: todayStats.deployed.toLocaleString("zh-CN"), change: "+1", icon: Flame },
    { label: "节省开发时间", value: `${todayStats.savedHours}h`, change: "+1h", icon: Clock },
  ];

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-6 lg:gap-8">
      {/* Welcome */}
      <div className="relative overflow-hidden rounded-2xl border border-[#25282C] bg-[#111215] p-6 lg:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#D0FF00]/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-[#2EDEDB]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <KimiIcon size={64} className="h-16 w-16 rounded-2xl border border-[#25282C] shadow-lg" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#D0FF00] text-[10px] text-black">
                <Sparkles className="h-3 w-3" />
              </span>
            </div>
            <div>
              <h1 className="kimi-page-title">Kimi FLAP VAULT - V2</h1>
              <p className="kimi-page-subtitle">
                AI 驱动的合约生成、合约部署与代币发射控制台
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/vault")}
            className="kimi-btn-primary self-start sm:self-auto"
          >
            <MessageSquare className="h-4 w-4" />
            开始生成
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Today stats */}
        <div className="relative mt-6 grid grid-cols-1 gap-3 border-t border-[#25282C] pt-6 sm:grid-cols-3">
          {todayStatsList.map((stat) => (
            <div
              key={stat.label}
              className="kimi-card kimi-card-hover"
            >
              <div className="mb-2 flex items-center gap-2 text-[#6B7280]">
                <stat.icon className="h-4 w-4" />
                <p className="text-xs">{stat.label}</p>
              </div>
              <div className="flex items-end gap-3">
                <p className="text-xl font-bold text-white">{stat.value}</p>
                <span className="mb-1 text-xs font-medium text-[#D0FF00]">{stat.change}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature grid */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">功能入口</h2>
            <p className="text-xs text-[#6B7280]">FEATURES</p>
          </div>
          <div className="flex-1 border-t border-[#25282C]" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <button
              key={feature.to}
              onClick={() => navigate(feature.to)}
              className="kimi-card group text-left transition-all duration-200 hover:-translate-y-1 hover:border-[#D0FF00]/30 hover:bg-[#1A1D21] hover:shadow-[0_0_20px_rgba(208,255,0,0.08)]"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A0B0D] transition-colors group-hover:bg-[#25282C]">
                <feature.icon className="h-5 w-5" style={{ color: feature.color }} />
              </div>
              <h3 className="mb-1.5 text-base font-semibold text-white group-hover:text-[#D0FF00]">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-[#9CA3AF]">{feature.description}</p>
              <div className="absolute bottom-5 right-5 opacity-0 transition-opacity group-hover:opacity-100">
                <ArrowRight className="h-4 w-4 text-[#D0FF00]" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom: recent activity + status */}
      <div className="mt-auto grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="kimi-card lg:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
            <Activity className="h-4 w-4 text-[#2EDEDB]" />
            最近动态
            <span className="text-xs font-normal text-[#6B7280]">/ RECENT ACTIVITY</span>
          </h3>
          {activities.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#25282C] bg-[#0A0B0D] px-6 py-10 text-center">
              <p className="text-sm text-[#6B7280]">暂无动态，去生成你的第一个合约吧</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {activities.slice(0, 6).map((item) => {
                const Icon = activityIcons[item.type] || Activity;
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-xl bg-[#0A0B0D] px-4 py-3 text-sm transition-colors hover:bg-[#1A1D21]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1A1D21]">
                        <Icon className="h-3.5 w-3.5 text-[#9CA3AF]" />
                      </div>
                      <span className="text-[#E8E8E8]">{item.text}</span>
                    </div>
                    <span className="text-xs text-[#6B7280]">{formatTimeAgo(item.time)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="kimi-card transition-all hover:border-[#D0FF00]/20"
            >
              <div className="mb-2 flex items-center gap-2 text-[#6B7280]">
                <stat.icon className="h-4 w-4" />
                <p className="text-xs">{stat.label}</p>
              </div>
              <p className={cn("text-sm font-medium", stat.label === "发射台合约" ? "text-[#D0FF00]" : "text-white")}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
