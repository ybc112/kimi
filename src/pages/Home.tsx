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
import { cn } from "@/lib/utils";

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
    description: "粘贴 Solidity 代码或 Bytecode，一键部署到 BNB Smart Chain 等主流网络。",
    icon: Rocket,
    to: "/deploy",
    color: "#D0FF00",
  },
  {
    title: "Flap 发币",
    description: "VaultAI 生成合约后，手把手教你把代币发到 Flap 平台。",
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
    title: "Meme 发射",
    description: "输入 Meme 概念自动生成代币名称与符号，连接钱包在 BSC 上发射。",
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
  { label: "发射台合约", value: "0x972D...A97EC", icon: ShieldCheck },
];

const todayStats = [
  { label: "已生成合约", value: "1,248", change: "+36", icon: FileCode },
  { label: "已部署代币", value: "86", change: "+5", icon: Flame },
  { label: "节省开发时间", value: "412h", change: "+28h", icon: Clock },
];

const activities = [
  { text: "刚刚生成了 MyFlapVault 合约", time: "2 分钟前", icon: FileCode },
  { text: "0x3a2f...e8c1 部署了代币 SATO", time: "5 分钟前", icon: Flame },
  { text: "AI 页面生成器生成了新的 Dashboard", time: "12 分钟前", icon: Wand2 },
  { text: "0x71ab...d4f2 完成了 Meme 一键发射", time: "18 分钟前", icon: Rocket },
  { text: "系统完成了一次热搜榜刷新", time: "30 分钟前", icon: TrendingUp },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-6">
      {/* Welcome */}
      <div className="relative overflow-hidden rounded-2xl border border-[#23262A] bg-[#15171A] p-6 lg:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#D0FF00]/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-[#2EDEDB]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <KimiIcon size={64} className="h-16 w-16 rounded-2xl border border-[#23262A] shadow-lg" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#D0FF00] text-[10px] text-black">
                <Sparkles className="h-3 w-3" />
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white lg:text-3xl">Kimi FLAP VAULT - V2</h1>
              <p className="mt-1 text-sm text-[#84888C]">
                AI 驱动的合约生成、合约部署与代币发射控制台
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/vault")}
            className="flex items-center justify-center gap-2 self-start rounded-lg bg-[#D0FF00] px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 sm:self-auto"
          >
            <MessageSquare className="h-4 w-4" />
            开始生成
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Today stats */}
        <div className="relative mt-6 grid grid-cols-1 gap-3 border-t border-[#23262A] pt-6 sm:grid-cols-3">
          {todayStats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-[#23262A] bg-[#0B0D0E] p-4 transition-colors hover:border-[#D0FF00]/20"
            >
              <div className="mb-2 flex items-center gap-2 text-[#5F656D]">
                <stat.icon className="h-4 w-4" />
                <p className="text-xs">{stat.label}</p>
              </div>
              <div className="flex items-end gap-3">
                <p className="text-xl font-bold text-white">{stat.value}</p>
                <span className="mb-1 text-xs font-medium text-[#D0FF00]">+{stat.change}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature grid */}
      <div>
        <h2 className="mb-4 text-sm font-semibold text-[#9CA3AF]">功能入口</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <button
              key={feature.to}
              onClick={() => navigate(feature.to)}
              className="group relative overflow-hidden rounded-xl border border-[#23262A] bg-[#15171A] p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:border-[#D0FF00]/30 hover:bg-[#1A1D21] hover:shadow-lg hover:shadow-[#D0FF00]/5"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#0B0D0E] transition-colors group-hover:bg-[#23262A]">
                <feature.icon className="h-5 w-5" style={{ color: feature.color }} />
              </div>
              <h3 className="mb-1.5 text-base font-semibold text-white group-hover:text-[#D0FF00]">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-[#84888C]">{feature.description}</p>
              <div className="absolute bottom-5 right-5 opacity-0 transition-opacity group-hover:opacity-100">
                <ArrowRight className="h-4 w-4 text-[#D0FF00]" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom: recent activity + status */}
      <div className="mt-auto grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-4 lg:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <Activity className="h-4 w-4 text-[#2EDEDB]" />
            最近动态
          </h3>
          <ul className="space-y-2">
            {activities.map((item, index) => (
              <li
                key={index}
                className="flex items-center justify-between rounded-lg bg-[#0B0D0E] px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className="h-3.5 w-3.5 text-[#9CA3AF]" />
                  <span className="text-[#E8E8E8]">{item.text}</span>
                </div>
                <span className="text-xs text-[#5F656D]">{item.time}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-[#23262A] bg-[#15171A] p-4 transition-colors hover:border-[#D0FF00]/20"
            >
              <div className="mb-2 flex items-center gap-2 text-[#5F656D]">
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
