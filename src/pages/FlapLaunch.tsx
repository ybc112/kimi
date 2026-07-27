import { useState, useEffect } from "react";
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
  Check,
  Wallet,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet } from "@/hooks/useWallet";
import { useAppStore } from "@/store";
import { useIssuedTokens } from "@/hooks/useIssuedTokens";
import { useContractData } from "@/hooks/useContractData";
import { ethers } from "ethers";
import {
  SNOWBALL_LAUNCHPAD_ADDRESS,
  LAUNCHPAD_ABI,
  CREATE_FEE_WEI,
  BSC_USDT_ADDRESS,
  buildCreateTokenParams,
} from "@/lib/contracts/snowball";

const CHECKLIST_STORAGE_KEY = "kimi-flap-launch-checklist";

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

const CHECKLIST = [
  { id: "vault", label: "已在 VaultAI 生成 Vault 合约" },
  { id: "factory", label: "已部署 Factory 合约到链上" },
  { id: "token", label: "已确认 Token Name / Symbol / Supply" },
  { id: "tax", label: "已设置 Buy/Sell Tax 与拆分" },
  { id: "wallet", label: "已连接钱包并切换到 BSC" },
];

function readChecklist(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveChecklist(state: Record<string, boolean>) {
  localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state));
}

export default function FlapLaunch() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const { addLog, showToast } = useAppStore();
  const { addToken } = useIssuedTokens();
  const { recordLaunch } = useContractData();
  const [activeTab, setActiveTab] = useState<TabKey>("guide");
  const [checked, setChecked] = useState<Record<string, boolean>>(() => readChecklist());

  const [form, setForm] = useState({
    name: "",
    symbol: "",
    supply: "1000000000",
    tax: "500",
  });
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<{ address: string; txHash: string } | null>(null);

  useEffect(() => {
    saveChecklist(checked);
  }, [checked]);

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      return next;
    });
  };

  const handleInternalLaunch = async () => {
    if (!wallet.isConnected || !wallet.signer) {
      await wallet.connectWallet();
      return;
    }
    if (!wallet.isBSC) {
      await wallet.switchToBSC();
      return;
    }
    if (!form.name.trim() || !form.symbol.trim() || !form.supply) {
      showToast({ type: "error", message: "请填写完整的代币信息" });
      return;
    }

    setLaunching(true);
    addLog({ type: "info", message: "正在通过工厂合约创建代币" });

    try {
      const params = buildCreateTokenParams({
        name: form.name,
        symbol: form.symbol,
        totalSupply: form.supply,
        hiddenFeeReceiver: wallet.account || "",
        rewardToken: BSC_USDT_ADDRESS,
        buyHiddenTaxBp: "0",
        buyBurnBp: "0",
        buyLiquidityBp: "0",
        buyDividendBp: form.tax,
        sellHiddenTaxBp: "0",
        sellBurnBp: "0",
        sellLiquidityBp: "0",
        sellDividendBp: form.tax,
        ordinaryWhitelist: "",
        limitAccounts: "",
        limitQuotas: "",
        limitModeEnabled: false,
        requestAutoVerify: true,
      });

      const contract = new ethers.Contract(SNOWBALL_LAUNCHPAD_ADDRESS, LAUNCHPAD_ABI, wallet.signer);
      const tx = await contract.createToken(params, { value: CREATE_FEE_WEI });
      const receipt = await tx.wait();

      const event = receipt?.logs
        ?.map((log: ethers.Log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed: ethers.LogDescription | null) => parsed?.name === "TokenCreated");

      const tokenAddress = (event?.args?.token as string) || "";
      setResult({ address: tokenAddress, txHash: tx.hash });

      addToken({
        name: form.name,
        symbol: form.symbol,
        address: tokenAddress,
        deployer: wallet.account || "",
        network: "BNB Smart Chain",
        chainId: 56,
        txHash: tx.hash,
        status: "success",
        totalSupply: form.supply,
        type: "flap",
      });
      recordLaunch(form.name);

      addLog({ type: "success", message: "站内一键发币成功", detail: tokenAddress });
      showToast({ type: "success", message: "代币创建成功" });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      addLog({ type: "error", message: "站内一键发币失败", detail });
      showToast({ type: "error", message: "创建失败" });
    } finally {
      setLaunching(false);
    }
  };

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
          {/* Interactive checklist */}
          <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <CheckCircle2 className="h-4 w-4 text-[#D0FF00]" />
              发币前检查清单
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CHECKLIST.map((item) => (
                <label
                  key={item.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                    checked[item.id]
                      ? "border-[#D0FF00]/30 bg-[#D0FF00]/10"
                      : "border-[#303236] bg-[#0B0D0E] hover:border-[#D0FF00]/30"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                      checked[item.id]
                        ? "border-[#D0FF00] bg-[#D0FF00] text-black"
                        : "border-[#5F656D] bg-transparent"
                    )}
                  >
                    {checked[item.id] && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked[item.id] || false}
                    onChange={() => toggleCheck(item.id)}
                  />
                  <span className={cn("text-sm", checked[item.id] ? "text-white" : "text-[#9CA3AF]")}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

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
        <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-6 lg:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#D0FF00]/10">
              <MousePointerClick className="h-5 w-5 text-[#D0FF00]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">站内一键发币</h3>
              <p className="text-xs text-[#84888C]">填写基础参数，直接通过已配置工厂创建代币</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs text-[#84888C]">Token Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Fcodex Token"
                className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[#84888C]">Symbol</label>
              <input
                type="text"
                value={form.symbol}
                onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                placeholder="FCDX"
                className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[#84888C]">Total Supply</label>
              <input
                type="text"
                value={form.supply}
                onChange={(e) => setForm((f) => ({ ...f, supply: e.target.value.replace(/\D/g, "") }))}
                placeholder="1000000000"
                className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[#84888C]">Tax (Basis Points)</label>
              <input
                type="text"
                value={form.tax}
                onChange={(e) => setForm((f) => ({ ...f, tax: e.target.value.replace(/\D/g, "") }))}
                placeholder="500"
                className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-[#2EDEDB]/20 bg-[#2EDEDB]/5 p-3 text-xs text-[#2EDEDB]">
            <Info className="mb-1 inline-block h-3.5 w-3.5" />
            简化模式将使用默认分红代币 USDT，税收全部作为分红。如需更复杂参数请使用 Meme 发射或外部 Flap 页面。
          </div>

          {result && (
            <div className="mt-4 rounded-lg border border-[#D0FF00]/30 bg-[#D0FF00]/10 p-4 text-sm">
              <div className="mb-2 flex items-center gap-2 font-medium text-[#D0FF00]">
                <CheckCircle2 className="h-4 w-4" />
                代币创建成功
              </div>
              <div className="flex flex-col gap-1 text-xs text-[#84888C]">
                <div className="flex items-center gap-2">
                  <span>合约地址</span>
                  <code className="text-white">{result.address}</code>
                </div>
                <div className="flex items-center gap-2">
                  <span>交易哈希</span>
                  <code className="text-white">{result.txHash}</code>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleInternalLaunch}
            disabled={launching}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#D0FF00] py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {launching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : !wallet.isConnected ? (
              <Wallet className="h-4 w-4" />
            ) : !wallet.isBSC ? (
              <Wallet className="h-4 w-4" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            {launching
              ? "创建中…"
              : !wallet.isConnected
              ? "连接钱包"
              : !wallet.isBSC
              ? "切换到 BSC"
              : "确认创建代币"}
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
