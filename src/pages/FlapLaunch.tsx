import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  MousePointerClick,
  Box,
  Rocket,
  ExternalLink,
  ArrowRight,
  Info,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "guide", label: "发币指南", icon: BookOpen },
  { key: "internal", label: "站内一键发币", icon: MousePointerClick },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const formFields = [
  {
    name: "Token Name",
    desc: "代币全称，比如 \"Fcodex Token\"。对应你金库项目里的名称。",
    example: "Fcodex Token",
  },
  {
    name: "Symbol",
    desc: "交易对里显示的简称，建议 3-5 个大写字母。",
    example: "FCDX",
  },
  {
    name: "Total Supply",
    desc: "代币总供应量，直接填数字，不要小数。",
    example: "1000000000",
  },
  {
    name: "Buy Tax",
    desc: "买入税率，以 Basis Points 为单位（100 = 1%）。",
    example: "500",
  },
  {
    name: "Sell Tax",
    desc: "卖出税率，以 Basis Points 为单位（100 = 1%）。",
    example: "500",
  },
  {
    name: "Tax Split",
    desc: "税率拆分：销毁 / 流动性 / 分红 / 营销等比例，加起来等于 Buy/Sell Tax。",
    example: "100, 200, 150, 50",
  },
  {
    name: "Vault Factory",
    desc: "你在「合约部署」页面部署好的 Factory 合约地址。",
    example: "0x972D488F3e952b11a13b96C0aCCECbA9855A97EC",
  },
  {
    name: "Dividend Token",
    desc: "分红代币合约地址，常用 USDT。",
    example: "0x55d398326f99059fF775485246999027B3197955",
  },
];

export default function FlapLaunch() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("guide");

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-6">
      {/* Header */}
      <div className="rounded-2xl border border-[#23262A] bg-[#15171A] p-6 lg:p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#D0FF00]/30 bg-[#D0FF00]/10 px-3 py-1 text-xs font-medium text-[#D0FF00]">
          <BookOpen className="h-3.5 w-3.5" />
          FLAP LAUNCH GUIDE
        </div>
        <h1 className="text-2xl font-bold text-white lg:text-3xl">在 Flap 上发币 · 小白版指南</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#84888C]">
          用 VaultAI 生成合约之后，这一页告诉你发到哪、点哪里、填什么——不用懂代码。
        </p>

        {/* Tabs */}
        <div className="mt-6 flex border-b border-[#23262A]">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  activeTab === tab.key
                    ? "border-[#D0FF00] text-[#D0FF00]"
                    : "border-transparent text-[#9CA3AF] hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "guide" && (
        <>
          {/* Steps */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StepCard
              step={1}
              title="在 VaultAI 生成 Vault 合约"
              desc="回到金库生成页面，填写项目参数并生成符合 Flap Tax Vault V2 规范的合约代码。"
              icon={Box}
              action="去金库生成"
              onClick={() => navigate("/vault")}
            />
            <StepCard
              step={2}
              title="把 Factory 合约部署到链上"
              desc="复制生成的合约 Bytecode 与 ABI，到合约部署页面上链；记下 Factory 地址。"
              icon={Rocket}
              action="去合约部署"
              onClick={() => navigate("/deploy")}
            />
            <StepCard
              step={3}
              title="去 Flap 官网发币"
              desc="打开 flap.sh/launch，按下方字段说明填写，绑定你的 Vault Factory 地址即可。"
              icon={ExternalLink}
              action="打开 Flap"
              onClick={() => window.open("https://flap.sh/launch", "_blank", "noreferrer")}
              external
            />
          </div>

          {/* Form guide */}
          <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-5 lg:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Info className="h-5 w-5 text-[#2EDEDB]" />
              <h3 className="text-base font-semibold text-white">Flap 页面每栏怎么填？</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {formFields.map((field) => (
                <div
                  key={field.name}
                  className="rounded-lg border border-[#23262A] bg-[#0B0D0E] p-4 transition-colors hover:border-[#D0FF00]/30"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#D0FF00]" />
                    <span className="text-sm font-medium text-white">{field.name}</span>
                  </div>
                  <p className="mb-2 text-xs leading-relaxed text-[#9CA3AF]">{field.desc}</p>
                  <p className="font-mono text-xs text-[#2EDEDB]">示例：{field.example}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              onClick={() => navigate("/vault")}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#23262A] bg-[#15171A] p-4 text-sm font-medium text-white transition-all hover:border-[#D0FF00]/30 hover:bg-[#1A1D21]"
            >
              <Box className="h-4 w-4 text-[#D0FF00]" />
              第一步：生成合约
              <ArrowRight className="h-4 w-4 text-[#D0FF00]" />
            </button>
            <button
              onClick={() => navigate("/deploy")}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#23262A] bg-[#15171A] p-4 text-sm font-medium text-white transition-all hover:border-[#D0FF00]/30 hover:bg-[#1A1D21]"
            >
              <Rocket className="h-4 w-4 text-[#2EDEDB]" />
              第二步：部署 Factory
              <ArrowRight className="h-4 w-4 text-[#2EDEDB]" />
            </button>
            <button
              onClick={() => window.open("https://flap.sh/launch", "_blank", "noreferrer")}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#D0FF00] p-4 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              <ExternalLink className="h-4 w-4" />
              第三步：去 Flap 发币
            </button>
          </div>
        </>
      )}

      {activeTab === "internal" && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#23262A] bg-[#15171A] p-10 text-center">
          <MousePointerClick className="mb-4 h-12 w-12 text-[#D0FF00]" />
          <h3 className="mb-2 text-lg font-semibold text-white">站内一键发币</h3>
          <p className="max-w-md text-sm text-[#84888C]">
            该功能正在对接 Flap SDK，完成后可直接在站内完成代币创建。现在请先使用「发币指南」前往 Flap 官网操作。
          </p>
          <button
            onClick={() => setActiveTab("guide")}
            className="mt-6 flex items-center gap-2 rounded-lg bg-[#D0FF00] px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            查看发币指南
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function StepCard({
  step,
  title,
  desc,
  icon: Icon,
  action,
  onClick,
  external,
}: {
  step: number;
  title: string;
  desc: string;
  icon: React.ElementType;
  action: string;
  onClick: () => void;
  external?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-5 transition-all hover:border-[#D0FF00]/30 hover:bg-[#1A1D21]">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D0FF00]/10 text-xs font-bold text-[#D0FF00]">
          {step}
        </span>
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-[#84888C]">{desc}</p>
      <button
        onClick={onClick}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#303236] bg-[#0B0D0E] py-2.5 text-sm font-medium text-white transition-colors hover:border-[#D0FF00]/30 hover:text-[#D0FF00]"
      >
        <Icon className="h-4 w-4" />
        {action}
        {external && <ExternalLink className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
