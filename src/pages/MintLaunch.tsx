import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  AtSign,
  Check,
  ChevronDown,
  Globe2,
  ImagePlus,
  Info,
  Loader2,
  Plus,
  Rocket,
  Send,
  Shield,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Wallet,
} from "lucide-react";
import { JsonRpcProvider } from "ethers";
import { cn } from "@/lib/utils";
import { useWallet } from "@/hooks/useWallet";
import { useAppStore } from "@/store";
import {
  allocationMeta,
  initialAdvancedTax,
  initialMintAllocation,
  initialMintForm,
  MINT_BNB_CHAIN,
  MINT_USDT_ADDRESS,
  mintTemplates,
} from "@/lib/mintLaunch/data";
import {
  createMintLaunchToken,
  isMintLaunchpadConfigured,
  mintLaunchpadConfig,
  queueMintProjectVerification,
  readMintLaunchCreatedToken,
  waitForMintTransactionReceipt,
} from "@/lib/mintLaunch/launchpad";
import type {
  AdvancedTaxState,
  AllocationKey,
  AllocationState,
  MintFormState,
  MintLaunchDraft,
  MintTemplateId,
} from "@/lib/mintLaunch/types";

const avatarAcceptedTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/gif", "image/webp"];
const avatarAccept = avatarAcceptedTypes.join(",");
const avatarMaxSourceBytes = 1024 * 1024;
const avatarCanvasSize = 256;

const sectionCard =
  "rounded-2xl border border-[#25282C] bg-[#111215]/80 p-5 lg:p-6 transition-all duration-200 hover:border-[#303236]";
const sectionCardGlow =
  "relative overflow-hidden before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-[#D0FF00]/5 before:via-transparent before:to-[#2EDEDB]/5 before:pointer-events-none";
const sectionTitle = "flex items-center gap-2 text-base font-semibold text-white";
const sectionNumber =
  "flex h-5 w-5 items-center justify-center rounded-md bg-[#D0FF00]/15 text-[11px] font-bold text-[#D0FF00]";
const labelClass = "mb-1.5 block text-xs font-medium text-[#9CA3AF]";
const gradientText =
  "bg-gradient-to-r from-[#D0FF00] via-[#E8FF5C] to-[#2EDEDB] bg-clip-text text-transparent";

function shortAddress(address: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

function compressAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > avatarMaxSourceBytes) {
      reject(new Error("图片建议小于 1MB"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = avatarCanvasSize;
        canvas.height = avatarCanvasSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 不可用"));
          return;
        }
        ctx.drawImage(img, 0, 0, avatarCanvasSize, avatarCanvasSize);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("图片读取失败"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function AllocationRing({
  allocation,
  total,
}: {
  allocation: AllocationState;
  total: number;
}) {
  const unallocated = Math.max(0, 100 - total);
  const data = [
    { key: "marketing", value: allocation.marketing, color: allocationMeta.find((m) => m.key === "marketing")?.color },
    { key: "liquidity", value: allocation.liquidity, color: allocationMeta.find((m) => m.key === "liquidity")?.color },
    { key: "rewards", value: allocation.rewards, color: allocationMeta.find((m) => m.key === "rewards")?.color },
    { key: "burn", value: allocation.burn, color: allocationMeta.find((m) => m.key === "burn")?.color },
    { key: "unallocated", value: unallocated, color: "#303236" },
  ];

  let cumulative = 0;
  const segments = data
    .filter((item) => item.value > 0)
    .map((item) => {
      const start = cumulative;
      cumulative += item.value;
      const end = cumulative;
      const largeArc = item.value > 50 ? 1 : 0;
      const startAngle = (start / 100) * Math.PI * 2 - Math.PI / 2;
      const endAngle = (end / 100) * Math.PI * 2 - Math.PI / 2;
      const x1 = 50 + 42 * Math.cos(startAngle);
      const y1 = 50 + 42 * Math.sin(startAngle);
      const x2 = 50 + 42 * Math.cos(endAngle);
      const y2 = 50 + 42 * Math.sin(endAngle);
      return {
        ...item,
        d: `M 50 50 L ${x1} ${y1} A 42 42 0 ${largeArc} 1 ${x2} ${y2} Z`,
      };
    });

  return (
    <div className="relative mx-auto h-40 w-40">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        {segments.map((segment) => (
          <path
            key={segment.key}
            d={segment.d}
            fill={segment.color}
            stroke="#111215"
            strokeWidth="2"
          />
        ))}
        <circle cx="50" cy="50" r="26" fill="#111215" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{total}%</span>
        <span className="text-[10px] text-[#9CA3AF]">总分配</span>
      </div>
    </div>
  );
}

export default function MintLaunch() {
  const wallet = useWallet();
  const { showToast } = useAppStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<MintFormState>(initialMintForm);
  const [allocation, setAllocation] = useState<AllocationState>(initialMintAllocation);
  const [advancedTax, setAdvancedTax] = useState<AdvancedTaxState>(initialAdvancedTax);
  const [buyTax, setBuyTax] = useState(3);
  const [sellTax, setSellTax] = useState(3);
  const [templateId, setTemplateId] = useState<MintTemplateId>("standard");
  const [avatar, setAvatar] = useState("");
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<{ hash: string; token?: string; predicted?: string } | null>(null);

  const selectedTemplate = useMemo(
    () => mintTemplates.find((t) => t.id === templateId) || mintTemplates[0],
    [templateId],
  );

  const allocationTotal = useMemo(
    () => allocation.marketing + allocation.liquidity + allocation.rewards + allocation.burn,
    [allocation],
  );

  const totalMintCount = useMemo(
    () => (Number(form.publicMintCount) || 0) + (Number(form.whitelistMintCount) || 0),
    [form.publicMintCount, form.whitelistMintCount],
  );

  const tokensPerMint = useMemo(() => {
    const total = Number(form.supply) || 0;
    return totalMintCount > 0 ? total / totalMintCount : 0;
  }, [form.supply, totalMintCount]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, mintCount: String(totalMintCount) }));
  }, [totalMintCount]);

  useEffect(() => {
    if (wallet.isConnected && wallet.account && !form.receiverWallet) {
      setForm((prev) => ({ ...prev, receiverWallet: wallet.account || "" }));
    }
  }, [wallet.isConnected, wallet.account, form.receiverWallet]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!avatarAcceptedTypes.includes(file.type)) {
      showToast({ type: "error", message: "请上传 PNG、JPEG、SVG、GIF 或 WebP 图片" });
      return;
    }
    try {
      const dataUrl = await compressAvatar(file);
      setAvatar(dataUrl);
    } catch (error) {
      showToast({ type: "error", message: error instanceof Error ? error.message : "图片处理失败" });
    }
  };

  const updateForm = <K extends keyof MintFormState>(key: K, value: MintFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateAllocation = (key: AllocationKey, value: number) => {
    setAllocation((prev) => ({ ...prev, [key]: Math.max(0, Math.min(100, value)) }));
  };

  const handleDeploy = async () => {
    if (!wallet.isConnected || !wallet.signer) {
      showToast({ type: "error", message: "请先连接钱包" });
      return;
    }
    if (!wallet.isBSC) {
      showToast({ type: "error", message: "请切换到 BNB Smart Chain" });
      return;
    }

    const draft: MintLaunchDraft = {
      form,
      allocation,
      advancedTax,
      buyTax,
      sellTax,
      templateId,
      avatar,
      whitelistEnabled,
    };

    setDeploying(true);
    try {
      const txResult = await createMintLaunchToken(wallet.signer, draft);
      const receipt = await waitForMintTransactionReceipt(
        new JsonRpcProvider(MINT_BNB_CHAIN.rpcUrls[0]),
        txResult.hash,
      );
      const token = readMintLaunchCreatedToken(receipt);
      await queueMintProjectVerification(token);
      setResult({ hash: txResult.hash, token, predicted: txResult.predictedTokenAddress });
      showToast({ type: "success", message: "部署成功" });
    } catch (error) {
      showToast({ type: "error", message: error instanceof Error ? error.message : "部署失败" });
    } finally {
      setDeploying(false);
    }
  };

  const statusItems = [
    { label: "部署费", value: selectedTemplate.fee },
    { label: "铸造份数", value: totalMintCount.toLocaleString() },
    { label: "每份代币", value: tokensPerMint.toLocaleString() },
    { label: "税率", value: `${buyTax}% / ${sellTax}%` },
  ];

  if (result) {
    return (
      <div className="page-fade-in mx-auto max-w-3xl px-4 py-10">
        <div className={cn(sectionCard, sectionCardGlow, "text-center")}>
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D0FF00]/20 to-[#2EDEDB]/10 ring-1 ring-[#D0FF00]/20">
            <Rocket className="h-9 w-9 text-[#D0FF00]" />
          </div>
          <h2 className="text-2xl font-bold text-white">KimiMint 发射成功</h2>
          <p className="mt-2 text-sm text-[#9CA3AF]">
            你的代币和金库已经部署到 BNB Smart Chain
          </p>
          <div className="mt-6 space-y-3 text-left">
            <div className="rounded-xl border border-[#25282C] bg-[#0A0B0D] p-4">
              <span className="text-xs text-[#9CA3AF]">交易哈希</span>
              <div className="mt-1 flex items-center gap-2 break-all font-mono text-xs text-white">
                {result.hash}
              </div>
            </div>
            {result.token && (
              <div className="rounded-xl border border-[#25282C] bg-[#0A0B0D] p-4">
                <span className="text-xs text-[#9CA3AF]">代币合约</span>
                <div className="mt-1 flex items-center gap-2 break-all font-mono text-xs text-white">
                  {result.token}
                </div>
              </div>
            )}
            {result.predicted && (
              <div className="rounded-xl border border-[#25282C] bg-[#0A0B0D] p-4">
                <span className="text-xs text-[#9CA3AF]">预测地址</span>
                <div className="mt-1 break-all font-mono text-xs text-white">{result.predicted}</div>
              </div>
            )}
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button className="kimi-btn-primary" onClick={() => navigate("/issued-tokens")}>
              查看已发代币
            </button>
            <button className="kimi-btn-secondary" onClick={() => setResult(null)}>
              继续部署
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade-in mx-auto max-w-7xl px-4 py-6 lg:py-8">
      {/* Hero / status strip */}
      <section className={cn(sectionCard, sectionCardGlow, "mb-6 flex flex-col gap-5 lg:flex-row lg:items-center")}>
        <div className="flex items-start gap-4 lg:flex-1">
          <div
            className={cn(
              "mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-[#111215] shadow-[0_0_8px_currentColor]",
              wallet.isConnected && wallet.isBSC ? "bg-[#D0FF00] text-[#D0FF00]" : "bg-[#6B7280] text-[#6B7280]",
            )}
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Rocket className="h-5 w-5 text-[#D0FF00]" />
              <h1 className={cn("text-2xl font-black tracking-tight lg:text-3xl", gradientText)}>
                KimiMint
              </h1>
              <span className="rounded-md bg-[#D0FF00]/10 px-2 py-0.5 text-[10px] font-bold text-[#D0FF00]">
                LAUNCH
              </span>
            </div>
            <p className="mt-1.5 text-sm text-[#9CA3AF]">
              在 KimiMint 上创建独立 ERC20 和 Mint 金库，配置铸造、税收、奖励和接收钱包
            </p>
            <p className="mt-1 text-xs text-[#6B7280]">
              {wallet.isConnected
                ? `${shortAddress(wallet.account || "")} · Factory ${shortAddress(mintLaunchpadConfig.factoryAddress)}`
                : "连接钱包后会自动填入创建者接收地址"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[560px]">
          {statusItems.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[#25282C] bg-[#0A0B0D]/80 p-3 text-center transition-colors hover:border-[#D0FF00]/20"
            >
              <div className="text-xs text-[#6B7280]">{item.label}</div>
              <div className="mt-1 text-sm font-bold text-white">{item.value}</div>
            </div>
          ))}
        </div>

        {wallet.isConnected && !wallet.isBSC && (
          <button className="kimi-btn-primary shrink-0" onClick={wallet.switchToBSC}>
            切换网络
          </button>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* 01 Basic info */}
          <section className={cn(sectionCard, sectionCardGlow)}>
            <div className={sectionTitle}>
              <span className={sectionNumber}>01</span>
              基础信息
              <span className="ml-auto text-xs font-normal text-[#6B7280]">部署费 0.005 BNB</span>
            </div>
            <p className="mt-1 text-xs text-[#9CA3AF]">填写名称、符号、头像和项目简介。</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>代币名称</label>
                <input
                  className="kimi-input"
                  placeholder="输入代币名称"
                  value={form.tokenName}
                  onChange={(e) => updateForm("tokenName", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>代币符号</label>
                <input
                  className="kimi-input"
                  placeholder="输入代币符号"
                  value={form.symbol}
                  onChange={(e) => updateForm("symbol", e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className={labelClass}>头像图片</label>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-4 rounded-xl border border-dashed p-4 transition-all",
                  avatar
                    ? "border-[#D0FF00]/40 bg-[#D0FF00]/5"
                    : "border-[#303236] bg-[#0A0B0D] hover:border-[#D0FF00]/30",
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={avatarAccept}
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <span
                  className={cn(
                    "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl",
                    avatar
                      ? "bg-transparent"
                      : "border border-[#303236] bg-[#1A1D21]",
                  )}
                >
                  {avatar ? (
                    <img src={avatar} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <Plus className="h-6 w-6 text-[#6B7280]" />
                  )}
                </span>
                <span className="flex-1">
                  <strong className="block text-sm text-white">
                    {avatar ? "头像已加入部署信息" : "上传项目头像"}
                  </strong>
                  <em className="mt-0.5 block text-xs not-italic text-[#6B7280]">
                    支持 PNG、JPEG、SVG、GIF、WebP，建议小于 1MB
                  </em>
                </span>
              </label>
              {avatar && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <label className="kimi-btn-secondary cursor-pointer py-1.5 text-xs">
                    <ImagePlus className="h-3.5 w-3.5" />
                    更换
                    <input type="file" accept={avatarAccept} className="hidden" onChange={handleAvatarUpload} />
                  </label>
                  <button
                    className="kimi-btn border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 py-1.5 text-xs text-[#FF6B6B] hover:bg-[#FF6B6B]/20"
                    onClick={() => setAvatar("")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    移除
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className={labelClass}>代币简介（选填）</label>
              <textarea
                className="kimi-input min-h-[80px] resize-none"
                placeholder="简单介绍项目定位、玩法或社区信息"
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
              />
            </div>
          </section>

          {/* 02 Templates */}
          <section className={cn(sectionCard, sectionCardGlow)}>
            <div className={sectionTitle}>
              <span className={sectionNumber}>02</span>
              选择合约模板
              <span className="ml-auto rounded-md bg-[#1A1D21] px-2 py-0.5 text-xs text-[#D0FF00]">
                {selectedTemplate.tag}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {mintTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setTemplateId(template.id)}
                  className={cn(
                    "flex flex-col gap-1 rounded-xl border p-4 text-left transition-all",
                    templateId === template.id
                      ? "border-[#D0FF00]/50 bg-[#D0FF00]/10"
                      : "border-[#25282C] bg-[#0A0B0D] hover:border-[#D0FF00]/30",
                  )}
                >
                  <span className="text-xs text-[#6B7280]">{template.tag}</span>
                  <span className="font-semibold text-white">{template.name}</span>
                  <p className="text-xs text-[#9CA3AF]">{template.summary}</p>
                  {templateId === template.id && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {template.checks.map((check) => (
                        <span
                          key={check}
                          className="flex items-center gap-1 rounded bg-[#D0FF00]/10 px-1.5 py-0.5 text-[10px] text-[#D0FF00]"
                        >
                          <Check className="h-3 w-3" />
                          {check}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* 03 Mint config */}
          <section className={cn(sectionCard, sectionCardGlow)}>
            <div className={sectionTitle}>
              <span className={sectionNumber}>03</span>
              Mint 配置
              <span className="ml-auto rounded-md bg-[#1A1D21] px-2 py-0.5 text-xs text-[#9CA3AF]">
                BNB
              </span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>单次价格（BNB）</label>
                <input
                  className="kimi-input"
                  value={form.mintPrice}
                  onChange={(e) =>
                    updateForm("mintPrice", e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))
                  }
                />
              </div>
              <div>
                <label className={labelClass}>总铸造次数</label>
                <input className="kimi-input" value={form.mintCount} readOnly />
              </div>
              <div>
                <label className={labelClass}>公开铸造次数</label>
                <input
                  className="kimi-input"
                  value={form.publicMintCount}
                  onChange={(e) => updateForm("publicMintCount", e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div>
                <label className={labelClass}>白名单铸造次数</label>
                <input
                  className="kimi-input"
                  value={form.whitelistMintCount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    updateForm("whitelistMintCount", value);
                    setWhitelistEnabled(Number(value) > 0);
                  }}
                />
              </div>
              <div>
                <label className={labelClass}>单钱包最多 Mint（0 = 不限制）</label>
                <input
                  className="kimi-input"
                  value={form.maxMintPerWallet}
                  onChange={(e) => updateForm("maxMintPerWallet", e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div>
                <label className={labelClass}>发行总量</label>
                <input
                  className="kimi-input"
                  value={form.supply}
                  onChange={(e) => updateForm("supply", e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-[#0A0B0D] p-4">
              <div>
                <div className="text-sm font-medium text-white">开启白名单 Mint</div>
                <div className="text-xs text-[#6B7280]">开启后，只有写入白名单的钱包可以 mint</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !whitelistEnabled;
                  setWhitelistEnabled(next);
                  if (!next) {
                    updateForm("whitelistMintCount", "0");
                  } else if (Number(form.whitelistMintCount) <= 0) {
                    updateForm("whitelistMintCount", "30");
                  }
                }}
              >
                {whitelistEnabled ? (
                  <ToggleRight className="h-7 w-7 text-[#D0FF00]" />
                ) : (
                  <ToggleLeft className="h-7 w-7 text-[#6B7280]" />
                )}
              </button>
            </div>

            {whitelistEnabled && Number(form.whitelistMintCount || 0) > 0 && Number(form.publicMintCount || 0) <= 0 && (
              <div className="mt-3 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/10 p-3 text-xs text-[#FFD700]">
                当前是纯白名单池：未加白钱包不能 Mint，白名单打满前公开不会开放。
              </div>
            )}
            {Number(form.maxMintPerWallet || 0) > 0 && (
              <div className="mt-3 rounded-xl border border-[#D0FF00]/20 bg-[#D0FF00]/5 p-3 text-xs text-[#D0FF00]">
                单钱包最多 {form.maxMintPerWallet} 份；转账即 Mint 也会受这个限制。
              </div>
            )}
          </section>

          {/* 04 Tax */}
          <section className={cn(sectionCard, sectionCardGlow)}>
            <div className={sectionTitle}>
              <span className={sectionNumber}>04</span>
              买卖税与四项分配
              <span
                className={cn(
                  "ml-auto text-xs",
                  allocationTotal <= 100 ? "text-[#D0FF00]" : "text-[#FF6B6B]",
                )}
              >
                总计 {allocationTotal}%
              </span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>买入税 {buyTax}%</label>
                <input
                  type="range"
                  min={0}
                  max={25}
                  step={0.5}
                  value={buyTax}
                  onChange={(e) => setBuyTax(Number(e.target.value))}
                  className="w-full accent-[#D0FF00]"
                />
              </div>
              <div>
                <label className={labelClass}>卖出税 {sellTax}%</label>
                <input
                  type="range"
                  min={0}
                  max={25}
                  step={0.5}
                  value={sellTax}
                  onChange={(e) => setSellTax(Number(e.target.value))}
                  className="w-full accent-[#D0FF00]"
                />
              </div>
            </div>

            <button
              type="button"
              className="mt-4 flex items-center gap-1 text-xs text-[#9CA3AF] hover:text-white"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              高级税收
              <ChevronDown className={cn("h-3 w-3 transition-transform", advancedOpen && "rotate-180")} />
            </button>
            {advancedOpen && (
              <div className="mt-4 grid gap-4 rounded-xl bg-[#0A0B0D] p-4 sm:grid-cols-2">
                {[
                  { key: "transferTax" as const, label: "转账税" },
                  { key: "addLiquidityTax" as const, label: "加池税" },
                  { key: "removeLiquidityTax" as const, label: "撤池税" },
                  { key: "launchProtectionTax" as const, label: "开盘保护税" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className={labelClass}>
                      {label} {advancedTax[key]}%
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={25}
                      step={0.5}
                      value={advancedTax[key]}
                      onChange={(e) =>
                        setAdvancedTax((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                      }
                      className="w-full accent-[#D0FF00]"
                    />
                  </div>
                ))}
                <div>
                  <label className={labelClass}>保护区块</label>
                  <input
                    className="kimi-input"
                    value={advancedTax.launchProtectionBlocks}
                    onChange={(e) =>
                      setAdvancedTax((prev) => ({
                        ...prev,
                        launchProtectionBlocks: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>分红间隔（秒）</label>
                  <input
                    className="kimi-input"
                    value={advancedTax.claimWaitSeconds}
                    onChange={(e) =>
                      setAdvancedTax((prev) => ({
                        ...prev,
                        claimWaitSeconds: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-5 rounded-xl border border-[#25282C] bg-[#0A0B0D] p-4 sm:grid-cols-[180px_1fr]">
              <AllocationRing allocation={allocation} total={allocationTotal} />
              <div className="space-y-4">
                {allocationMeta.map(({ key, label, hint }) => (
                  <div key={key}>
                    <label className={labelClass}>
                      {label} {allocation[key]}% <span className="text-[#6B7280]">({hint})</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={allocation[key]}
                      onChange={(e) => updateAllocation(key as AllocationKey, Number(e.target.value))}
                      className="w-full accent-[#D0FF00]"
                    />
                  </div>
                ))}
                <p
                  className={cn(
                    "rounded-lg p-2.5 text-xs font-medium",
                    allocationTotal > 100
                      ? "border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 text-[#FF6B6B]"
                      : "border border-[#D0FF00]/20 bg-[#D0FF00]/5 text-[#D0FF00]",
                  )}
                >
                  {allocationTotal > 100
                    ? "分配总和超过 100%，合约会拒绝部署。"
                    : `未分配 ${Math.max(0, 100 - allocationTotal)}%`}
                </p>
              </div>
            </div>
          </section>

          {/* 05 Receiver */}
          <section className={cn(sectionCard, sectionCardGlow)}>
            <div className={sectionTitle}>
              <span className={sectionNumber}>05</span>
              接收与分红
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>接收钱包</label>
                <input
                  className="kimi-input"
                  placeholder="0x..."
                  value={form.receiverWallet}
                  onChange={(e) => updateForm("receiverWallet", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>分红代币地址</label>
                <input
                  className="kimi-input"
                  placeholder={`默认 USDT ${shortAddress(MINT_USDT_ADDRESS)}`}
                  value={form.rewardToken}
                  onChange={(e) => updateForm("rewardToken", e.target.value)}
                />
                <em className="mt-1 block text-xs not-italic text-[#6B7280]">
                  默认 USDT：{shortAddress(MINT_USDT_ADDRESS)}
                </em>
              </div>
              <div>
                <label className={labelClass}>持仓门槛</label>
                <input
                  className="kimi-input"
                  value={form.rewardThreshold}
                  onChange={(e) =>
                    updateForm("rewardThreshold", e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))
                  }
                />
              </div>
            </div>
          </section>

          {/* 06 Links */}
          <section className={cn(sectionCard, sectionCardGlow)}>
            <div className={sectionTitle}>
              <span className={sectionNumber}>06</span>
              社区入口（选填）
            </div>
            <div className="mt-4 space-y-3">
              {[
                { icon: Send, label: "Telegram 链接", value: form.telegram, key: "telegram" },
                { icon: AtSign, label: "X / Twitter 链接", value: form.xLink, key: "xLink" },
                { icon: Globe2, label: "官网", value: form.website, key: "website" },
              ].map(({ icon: Icon, label, value, key }) => (
                <label
                  key={key}
                  className="flex items-center gap-3 rounded-xl border border-[#25282C] bg-[#0A0B0D] p-3 transition-colors hover:border-[#D0FF00]/20"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#303236] bg-[#111215] text-[#D0FF00]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="w-28 shrink-0 text-sm text-[#9CA3AF]">{label}</span>
                  <input
                    className="kimi-input border-0 bg-transparent px-0 focus:ring-0"
                    placeholder="https://..."
                    value={value}
                    onChange={(e) => updateForm(key as keyof MintFormState, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>

          {!isMintLaunchpadConfigured && (
            <div className="flex items-center gap-2 rounded-xl border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 p-4 text-sm text-[#FF6B6B]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Mint Factory 未配置，请先设置 VITE_MINT_FACTORY_ADDRESS 环境变量。
            </div>
          )}

          <button
            type="button"
            className={cn(
              "group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#D0FF00] to-[#B8E600] py-3.5 text-sm font-bold text-black shadow-[0_0_24px_rgba(208,255,0,0.25)] transition-all hover:shadow-[0_0_32px_rgba(208,255,0,0.4)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100",
              deploying && "opacity-70",
            )}
            disabled={deploying || !isMintLaunchpadConfigured}
            onClick={handleDeploy}
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
            <span className="relative flex items-center justify-center gap-2">
              {deploying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : !wallet.isConnected ? (
                <Wallet className="h-4 w-4" />
              ) : !wallet.isBSC ? (
                <Shield className="h-4 w-4" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              {deploying
                ? "KimiMint 部署中..."
                : !wallet.isConnected
                  ? "连接钱包"
                  : !wallet.isBSC
                    ? "切换网络"
                    : "确认 KimiMint 部署"}
            </span>
          </button>
        </div>

        {/* Right sticky preview */}
        <div className="space-y-5">
          <div className={cn(sectionCard, sectionCardGlow, "sticky top-4")}>
            <div className="text-center">
              {avatar ? (
                <img
                  src={avatar}
                  alt="preview"
                  className="mx-auto h-24 w-24 rounded-2xl object-cover ring-2 ring-[#25282C]"
                />
              ) : (
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D0FF00]/25 via-[#D0FF00]/10 to-[#2EDEDB]/20 text-3xl font-black text-[#D0FF00] ring-1 ring-[#D0FF00]/20">
                  {form.symbol.slice(0, 2) || "KM"}
                </div>
              )}
              <h3 className="mt-4 text-xl font-bold text-white">{form.tokenName || "KimiMint Token"}</h3>
              <p className="text-sm text-[#9CA3AF]">
                {form.symbol || "KMINT"} · {selectedTemplate.name}
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#D0FF00]/10 px-2.5 py-1 text-[10px] font-medium text-[#D0FF00]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D0FF00]" />
                KimiMint 发射台
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              {[
                { label: "模板", value: selectedTemplate.name },
                { label: "工厂", value: shortAddress(mintLaunchpadConfig.factoryAddress), mono: true },
                { label: "部署费", value: selectedTemplate.fee },
                { label: "付款代币", value: "BNB" },
                { label: "铸造份数", value: form.mintCount || "0" },
                { label: "每份代币", value: tokensPerMint.toLocaleString() },
                {
                  label: "单钱包上限",
                  value: Number(form.maxMintPerWallet || 0) > 0 ? form.maxMintPerWallet : "不限制",
                },
                { label: "白名单", value: whitelistEnabled ? "开启" : "关闭", highlight: whitelistEnabled },
                { label: "税率", value: `${buyTax}% / ${sellTax}%` },
              ].map((item) => (
                <div key={item.label} className="flex justify-between border-b border-[#25282C]/50 pb-2 text-[#9CA3AF] last:border-0 last:pb-0">
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      item.mono && "font-mono",
                      item.highlight ? "text-[#D0FF00]" : "text-white",
                    )}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-[#25282C] bg-[#0A0B0D]/80 p-4">
              <div className="mb-3 text-xs font-medium text-[#9CA3AF]">税收分配</div>
              <AllocationRing allocation={allocation} total={allocationTotal} />
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {allocationMeta.map(({ key, label, color }) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[#9CA3AF]">{label}</span>
                    <span className="ml-auto text-white">{allocation[key]}%</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#303236]" />
                  <span className="text-[#9CA3AF]">未分配</span>
                  <span className="ml-auto text-white">{Math.max(0, 100 - allocationTotal)}%</span>
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-[#6B7280]">
              <Info className="mb-1 inline h-3 w-3" /> 预览仅作参考，实际参数以链上交易为准。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
