import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet } from "@/hooks/useWallet";
import { useAppStore } from "@/store";
import { useIssuedTokens } from "@/hooks/useIssuedTokens";
import { useContractData } from "@/hooks/useContractData";
import { ethers } from "ethers";
import {
  SNOWBALL_LAUNCHPAD_ADDRESS,
  BSC_USDT_ADDRESS,
  buildCreateTokenParams,
  preflightCreateToken,
  submitCreateToken,
} from "@/lib/contracts/snowball";
import { burnKimiTokens, DEPLOY_BURN_AMOUNT, getKimiBalance } from "@/lib/contracts/deployer";
import { formatContractError } from "@/lib/contracts/errors";
import { TransactionError } from "@/components/TransactionError";

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
    desc: "外部 Flap 流程中，由你部署并符合 Flap 规范的 Vault Factory 地址。",
    example: "0xYourVaultFactoryAddress",
  },
  {
    name: "Dividend Token",
    desc: "分红代币合约地址，常用 USDT。",
    example: "0x55d398326f99059fF775485246999027B3197955",
  },
];

const CHECKLIST = [
  { id: "flow", label: "已选择站内一键发币或外部 Flap 流程" },
  { id: "factory", label: "外部流程已编译并部署 Vault / Factory" },
  { id: "token", label: "已确认 Token Name / Symbol / Supply" },
  { id: "tax", label: "已设置 Buy/Sell Tax 与拆分" },
  { id: "wallet", label: "已连接钱包并切换到 BSC" },
];

interface InternalLaunchForm {
  name: string;
  symbol: string;
  supply: string;
  tax: string;
}

function buildInternalLaunchParams(form: InternalLaunchForm, receiver: string) {
  if (!/^\d+$/.test(form.tax.trim())) throw new Error("Tax 必须是非负整数 Basis Points");
  const taxBasisPoints = Number(form.tax);
  if (!Number.isSafeInteger(taxBasisPoints) || taxBasisPoints < 0 || taxBasisPoints > 2500) {
    throw new Error("Tax 必须在 0 到 2500 Basis Points（0% 到 25%）之间");
  }
  const taxPercent = (taxBasisPoints / 100).toString();
  return buildCreateTokenParams(
    {
      name: form.name,
      symbol: form.symbol,
      totalSupply: form.supply,
      hiddenFeeReceiver: receiver,
      rewardToken: BSC_USDT_ADDRESS,
      buyHiddenTaxBp: "0",
      buyBurnBp: "0",
      buyLiquidityBp: "0",
      buyDividendBp: taxPercent,
      sellHiddenTaxBp: "0",
      sellBurnBp: "0",
      sellLiquidityBp: "0",
      sellDividendBp: taxPercent,
      ordinaryWhitelist: "",
      limitAccounts: "",
      limitQuotas: "",
      limitModeEnabled: false,
      requestAutoVerify: true,
    },
    { defaultHiddenFeeReceiver: receiver, defaultRewardToken: BSC_USDT_ADDRESS }
  );
}

function readChecklist(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // 忽略损坏的旧版浏览器缓存。
  }
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

  const [form, setForm] = useState<InternalLaunchForm>({
    name: "",
    symbol: "",
    supply: "1000000000",
    tax: "500",
  });
  const [launching, setLaunching] = useState(false);
  const [launchStep, setLaunchStep] = useState<"preflight" | "launch" | "fee">("preflight");
  const [result, setResult] = useState<{ address: string; txHash: string } | null>(null);
  const [launchError, setLaunchError] = useState<{ summary: string; details: string } | null>(null);
  const [feeWarning, setFeeWarning] = useState<{ summary: string; details: string } | null>(null);
  const internalValidationMessage = useMemo(() => {
    try {
      buildInternalLaunchParams(form, wallet.account || "0x000000000000000000000000000000000000dEaD");
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }, [form, wallet.account]);
  const taxPercentLabel = Number.isFinite(Number(form.tax)) ? (Number(form.tax) / 100).toFixed(2) : "0.00";

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
    if (!wallet.isConnected || !wallet.signer || !wallet.account) {
      await wallet.connectWallet();
      return;
    }
    if (!ethers.isAddress(wallet.account)) {
      showToast({ type: "error", message: "钱包地址无效，请重新连接" });
      return;
    }
    if (!wallet.isBSC) {
      await wallet.switchToBSC();
      return;
    }
    setLaunching(true);
    setLaunchStep("preflight");
    setLaunchError(null);
    setFeeWarning(null);
    setResult(null);
    addLog({ type: "info", message: "正在预检站内发币参数" });

    try {
      const params = buildInternalLaunchParams(form, wallet.account);

      const balance = await getKimiBalance(wallet.signer, wallet.account);
      if (balance < DEPLOY_BURN_AMOUNT) {
        throw new Error("KIMI 余额不足，需要至少 20,000 KIMI");
      }
      const preflight = await preflightCreateToken(wallet.signer, params);
      addLog({
        type: "success",
        message: "站内发币预检通过",
        detail: `预计 Gas ${preflight.gasEstimate.toString()}，预计地址 ${preflight.predictedToken}`,
      });

      setLaunchStep("launch");
      const launch = await submitCreateToken(wallet.signer, params, preflight.fee);
      setResult({ address: launch.tokenAddress, txHash: launch.txHash });

      addToken({
        name: form.name,
        symbol: form.symbol,
        address: launch.tokenAddress,
        deployer: wallet.account,
        network: "BNB Smart Chain",
        chainId: 56,
        txHash: launch.txHash,
        status: "success",
        totalSupply: form.supply,
        type: "flap",
      });
      recordLaunch(form.name);

      setLaunchStep("fee");
      try {
        const burnResult = await burnKimiTokens({ signer: wallet.signer, amount: DEPLOY_BURN_AMOUNT });
        addLog({ type: "success", message: "已销毁 20,000 KIMI 发币费用", detail: burnResult.txHash });
      } catch (feeError) {
        const friendly = formatContractError(feeError, "KIMI 费用支付失败");
        setFeeWarning({
          summary: `代币已经创建，但 20,000 KIMI 费用未完成：${friendly.summary}`,
          details: friendly.details,
        });
        addLog({ type: "error", message: "代币已创建，但 KIMI 费用未完成", detail: friendly.details });
      }

      addLog({ type: "success", message: "站内一键发币成功", detail: launch.tokenAddress });
      showToast({ type: "success", message: "代币创建成功" });
    } catch (error) {
      const friendly = formatContractError(error, "站内一键发币失败");
      setLaunchError(friendly);
      addLog({ type: "error", message: "站内一键发币失败", detail: friendly.details });
      showToast({ type: "error", message: friendly.summary });
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
          站内一键发币无需自备 Factory；外部 Flap 流程则需要先编译并部署符合规范的 Vault / Factory。
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
              title="在 Kimi 生成 Vault 合约"
              desc="回到金库生成页面，填写项目参数并生成符合 Flap Tax Vault V2 规范的合约代码。"
              icon={Box}
              action="去金库生成"
              onClick={() => navigate("/vault")}
            />
            <StepCard
              step={2}
              title="编译并部署 Vault / Factory"
              desc="Solidity 源码不能直接上链。先使用 Hardhat、Foundry 或 Remix 编译 Artifact，再到部署页上链并记下地址。"
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
              第二步：编译并部署
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
              <label className="mb-1.5 flex items-center justify-between gap-2 text-xs text-[#84888C]">
                <span>Tax (Basis Points)</span>
                <span className="text-[#D0FF00]">≈ {taxPercentLabel}%</span>
              </label>
              <input
                type="text"
                value={form.tax}
                onChange={(e) => setForm((f) => ({ ...f, tax: e.target.value.replace(/\D/g, "") }))}
                placeholder="500"
                className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-[#2EDEDB]/20 bg-[#2EDEDB]/5 p-3 text-xs leading-relaxed text-[#2EDEDB]">
            <Info className="mb-1 mr-1 inline-block h-3.5 w-3.5" />
            站内模式直接调用已验证的 Snowball Factory，并使用默认分红代币 USDT；税收全部作为分红。
            <code className="mt-2 block break-all rounded bg-black/20 p-2 text-[11px] text-white">{SNOWBALL_LAUNCHPAD_ADDRESS}</code>
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
                  <code className="min-w-0 break-all text-white">{result.address}</code>
                </div>
                <div className="flex items-center gap-2">
                  <span>交易哈希</span>
                  <code className="min-w-0 break-all text-white">{result.txHash}</code>
                </div>
              </div>
            </div>
          )}

          {launchError && (
            <div className="mt-4">
              <TransactionError summary={launchError.summary} details={launchError.details} />
            </div>
          )}

          {feeWarning && (
            <div className="mt-4">
              <TransactionError summary={feeWarning.summary} details={feeWarning.details} />
            </div>
          )}

          {wallet.error && (
            <div className="mt-4">
              <TransactionError summary={wallet.error} />
            </div>
          )}

          {internalValidationMessage && (
            <p className="mt-4 rounded-lg border border-[#FF6B6B]/25 bg-[#FF6B6B]/10 px-3 py-2 text-xs text-[#FF8A8A]">
              {internalValidationMessage}
            </p>
          )}

          <button
            onClick={handleInternalLaunch}
            disabled={launching || (wallet.isConnected && wallet.isBSC && Boolean(internalValidationMessage))}
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
              ? launchStep === "preflight"
                ? "正在安全预检…"
                : launchStep === "fee"
                  ? "代币已创建，正在支付 KIMI…"
                  : "正在链上创建代币…"
              : !wallet.isConnected
              ? "连接钱包"
              : !wallet.isBSC
              ? "切换到 BSC"
              : internalValidationMessage
              ? "请先完善发币参数"
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
