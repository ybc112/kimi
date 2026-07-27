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
} from "lucide-react";
import { KimiIcon } from "@/components/KimiIcon";

const features = [
  {
    title: "Kimi 金库生成",
    description: "基于 Kimi + Flap Tax Vault V2 规范，一句话生成 Solidity 合约代码。",
    icon: MessageSquare,
    to: "/chat",
    color: "#D0FF00",
  },
  {
    title: "Meme 一键发射",
    description: "输入 Meme 概念自动生成代币名称与符号，连接钱包在 BSC 上发射。",
    icon: Zap,
    to: "/meme-launch",
    color: "#2EDEDB",
  },
  {
    title: "自定义部署合约",
    description: "粘贴 Solidity 代码，一键部署到 BNB Smart Chain 等主流网络。",
    icon: Rocket,
    to: "/deploy",
    color: "#D0FF00",
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
  {
    title: "热搜榜",
    description: "实时追踪链上热门代币与趋势。",
    icon: TrendingUp,
    to: "/trending",
    color: "#FF6B6B",
  },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-6 lg:h-[calc(100vh-3rem)] lg:overflow-auto">
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
              <h1 className="text-2xl font-bold text-white lg:text-3xl">欢迎来到 Kimi 控制台</h1>
              <p className="mt-1 text-sm text-[#84888C]">
                AI 驱动的合约生成与 Meme 代币发射平台
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/chat")}
            className="flex items-center justify-center gap-2 self-start rounded-lg bg-[#D0FF00] px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 sm:self-auto"
          >
            开始生成
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <button
            key={feature.to}
            onClick={() => navigate(feature.to)}
            className="group relative overflow-hidden rounded-xl border border-[#23262A] bg-[#15171A] p-5 text-left transition-all hover:border-[#D0FF00]/30 hover:bg-[#1A1D21]"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#0B0D0E]">
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

      {/* Bottom status strip */}
      <div className="mt-auto grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-4">
          <p className="text-xs text-[#5F656D]">AI 模型</p>
          <p className="mt-1 text-sm font-medium text-white">Kimi / DeepSeek-v4-flash</p>
        </div>
        <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-4">
          <p className="text-xs text-[#5F656D]">部署网络</p>
          <p className="mt-1 text-sm font-medium text-white">BNB Smart Chain Mainnet</p>
        </div>
        <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-4">
          <p className="text-xs text-[#5F656D]">发射台合约</p>
          <p className="mt-1 truncate text-sm font-medium text-[#D0FF00]">
            0x972D...A97EC
          </p>
        </div>
      </div>
    </div>
  );
}
