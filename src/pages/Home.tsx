import { useAppStore } from "@/store";
import { MessageSquare, FileText, ScrollText, Bot, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Home() {
  const { sessions, logs } = useAppStore();

  const stats = [
    { label: "对话会话", value: sessions.length, icon: MessageSquare, color: "text-[#2EDEDB]", bg: "bg-[#2EDEDB]/10" },
    { label: "服务日志", value: logs.length, icon: ScrollText, color: "text-[#FF6B6B]", bg: "bg-[#FF6B6B]/10" },
  ];

  const quickActions = [
    { to: "/chat", label: "开始生成合约", desc: "通过 Kimi 对话生成 Flap Vault", icon: MessageSquare },
    { to: "/docs", label: "查看规范文档", desc: "了解 Flap V2 合约要求", icon: FileText },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">仪表盘</h2>
          <p className="mt-1 text-sm text-[#84888C]">Flap Tax Vault V2 合约生成器概览</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[#23262A] bg-[#15171A] p-5 transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-[#84888C]">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {quickActions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group flex items-center justify-between rounded-xl border border-[#23262A] bg-[#15171A] p-5 transition-all hover:border-[#D0FF00]/30 hover:bg-[#1A1D21]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#23262A]">
                <action.icon className="h-5 w-5 text-[#D0FF00]" />
              </div>
              <div>
                <p className="font-medium text-white group-hover:text-[#D0FF00]">{action.label}</p>
                <p className="text-xs text-[#84888C]">{action.desc}</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-[#5F656D] transition-colors group-hover:text-[#D0FF00]" />
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#D0FF00]/10">
            <Bot className="h-5 w-5 text-[#D0FF00]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">快速开始</h3>
            <p className="text-xs text-[#84888C]">三步生成符合 Flap V2 规范的合约</p>
          </div>
        </div>
        <ol className="space-y-3 text-sm text-[#9CA3AF]">
          <li className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#23262A] text-xs text-[#D0FF00]">1</span>
            <span>进入「金库生成」页面，用自然语言描述你想要的 Vault 机制</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#23262A] text-xs text-[#D0FF00]">2</span>
            <span>Kimi 会自动注入 Flap V2 规范上下文，生成合规的 Solidity 代码</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#23262A] text-xs text-[#D0FF00]">3</span>
            <span>复制代码，基于 Flap V2 规范进行部署与测试</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
