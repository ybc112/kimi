import { useState, useCallback } from "react";
import {
  Sparkles,
  Zap,
  Wallet,
  Rocket,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle,
  Copy,
  Loader2,
  ExternalLink,
  RefreshCw,
  Check,
  Dices,
} from "lucide-react";
import { ethers } from "ethers";
import { useAppStore } from "@/store";
import { useWallet } from "@/hooks/useWallet";
import { DEFAULT_MODEL, sendChatMessage } from "@/lib/kimi";
import { cn } from "@/lib/utils";
import {
  SNOWBALL_LAUNCHPAD_ADDRESS,
  CREATE_FEE_WEI,
  BSC_USDT_ADDRESS,
  LAUNCHPAD_ABI,
  buildCreateTokenParams,
  type CreateTokenFormValues,
} from "@/lib/contracts/snowball";

const DEFAULT_FORM: CreateTokenFormValues = {
  name: "",
  symbol: "",
  totalSupply: "1000000000",
  hiddenFeeReceiver: "",
  rewardToken: BSC_USDT_ADDRESS,
  buyHiddenTaxBp: "100",
  buyBurnBp: "100",
  buyLiquidityBp: "100",
  buyDividendBp: "100",
  sellHiddenTaxBp: "100",
  sellBurnBp: "100",
  sellLiquidityBp: "100",
  sellDividendBp: "100",
  ordinaryWhitelist: "",
  limitAccounts: "",
  limitQuotas: "",
  limitModeEnabled: false,
  requestAutoVerify: true,
};

type StringFormKey = {
  [K in keyof CreateTokenFormValues]: CreateTokenFormValues[K] extends string ? K : never;
}[keyof CreateTokenFormValues];

const TAX_FIELDS: Array<{ key: StringFormKey; label: string }> = [
  { key: "buyHiddenTaxBp", label: "隐藏费" },
  { key: "buyBurnBp", label: "销毁" },
  { key: "buyLiquidityBp", label: "流动性" },
  { key: "buyDividendBp", label: "分红" },
];

const SELL_TAX_FIELDS: Array<{ key: StringFormKey; label: string }> = [
  { key: "sellHiddenTaxBp", label: "隐藏费" },
  { key: "sellBurnBp", label: "销毁" },
  { key: "sellLiquidityBp", label: "流动性" },
  { key: "sellDividendBp", label: "分红" },
];

const GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)",
  "linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)",
  "linear-gradient(120deg, #fccb90 0%, #d57eeb 100%)",
  "linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
];

function randomAvatar() {
  const idx = Math.floor(Math.random() * GRADIENTS.length);
  return {
    background: GRADIENTS[idx],
    pattern: `radial-gradient(circle at ${20 + Math.random() * 60}% ${20 + Math.random() * 60}%, rgba(255,255,255,0.25) 0%, transparent 35%)`,
  };
}

export default function MemeLaunch() {
  const { addLog, showToast } = useAppStore();
  const wallet = useWallet();

  const [concept, setConcept] = useState("");
  const [form, setForm] = useState<CreateTokenFormValues>(DEFAULT_FORM);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [avatar, setAvatar] = useState(randomAvatar);
  const [generatedDescription, setGeneratedDescription] = useState("");

  const [generating, setGenerating] = useState(false);
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string>("");
  const [tokenAddress, setTokenAddress] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const updateForm = (key: keyof CreateTokenFormValues, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerate = useCallback(async () => {
    if (!concept.trim() || generating) return;
    setGenerating(true);
    setErrorMessage("");
    addLog({ type: "info", message: "正在生成 Meme 代币文案" });

    try {
      const prompt = `基于以下 Meme 概念生成一个代币信息，请严格按照 JSON 格式返回，不要包含任何额外解释：\n概念：${concept.trim()}\n\n要求字段：\n- name：代币全称（1-3 个英文单词，有趣、易记）\n- symbol：代币符号（3-5 个大写字母）\n- description：一句中文简介（20-50 字）\n\n示例输出：\n{\n  "name": "AI Cat Coin",\n  "symbol": "AICAT",\n  "description": "AI 猫是加密世界最聪明的猫咪，自动捕猎每一波行情。"\n}`;

      const content = await sendChatMessage({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "你是一个 Meme 代币命名专家。只返回合法 JSON，不要 Markdown 代码块，不要额外文字。",
          },
          { role: "user", content: prompt },
        ],
        stream: false,
        temperature: 0.8,
      });

      const jsonText = content.replace(/```(?:json)?\s*([\s\S]*?)```/, "$1").trim();
      const parsed = JSON.parse(jsonText);

      if (parsed.name && parsed.symbol && parsed.description) {
        setForm((prev) => ({
          ...prev,
          name: String(parsed.name),
          symbol: String(parsed.symbol).toUpperCase(),
        }));
        setGeneratedDescription(String(parsed.description));
        setAvatar(randomAvatar());
        addLog({
          type: "success",
          message: "Meme 文案生成成功",
          detail: String(parsed.description),
        });
        showToast({ type: "success", message: "Meme 文案生成成功" });
      } else {
        throw new Error("AI 返回格式不完整");
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setErrorMessage(`文案生成失败：${detail}`);
      addLog({ type: "error", message: "Meme 文案生成失败", detail });
      showToast({ type: "error", message: "文案生成失败，请重试" });
    } finally {
      setGenerating(false);
    }
  }, [concept, generating, addLog, showToast]);

  const handleLaunch = async () => {
    if (!wallet.isConnected || !wallet.signer) {
      await wallet.connectWallet();
      return;
    }
    if (!wallet.isBSC) {
      await wallet.switchToBSC();
      return;
    }

    setTxStatus("pending");
    setErrorMessage("");
    setTxHash("");
    setTokenAddress("");
    addLog({ type: "info", message: "正在调用 SnowballLaunchpad 创建代币" });

    try {
      const params = buildCreateTokenParams(form);
      const contract = new ethers.Contract(SNOWBALL_LAUNCHPAD_ADDRESS, LAUNCHPAD_ABI, wallet.signer);
      const tx = await contract.createToken(params, {
        value: CREATE_FEE_WEI,
      });
      setTxHash(tx.hash);
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

      const createdToken = event?.args?.token as string | undefined;
      if (createdToken) {
        setTokenAddress(createdToken);
      }
      setTxStatus("success");
      addLog({ type: "success", message: "代币创建成功", detail: createdToken });
      showToast({ type: "success", message: "代币发射成功" });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setErrorMessage(detail);
      setTxStatus("error");
      addLog({ type: "error", message: "代币创建失败", detail });
      showToast({ type: "error", message: "代币发射失败" });
    }
  };

  const copyTokenAddress = async () => {
    if (!tokenAddress) return;
    await navigator.clipboard.writeText(tokenAddress);
    setCopied(true);
    showToast({ type: "success", message: "代币地址已复制" });
    setTimeout(() => setCopied(false), 2000);
  };

  const totalBuyTax =
    Number(form.buyHiddenTaxBp || 0) +
    Number(form.buyBurnBp || 0) +
    Number(form.buyLiquidityBp || 0) +
    Number(form.buyDividendBp || 0);

  const totalSellTax =
    Number(form.sellHiddenTaxBp || 0) +
    Number(form.sellBurnBp || 0) +
    Number(form.sellLiquidityBp || 0) +
    Number(form.sellDividendBp || 0);

  const canLaunch = form.name.trim() && form.symbol.trim() && Number(form.totalSupply || 0) > 0;

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-4 lg:h-[calc(100vh-3rem)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Meme 一键发射</h2>
          <p className="text-xs text-[#84888C]">输入概念生成文案，连接钱包即可在 BSC 上发射代币</p>
        </div>
        <div className="flex items-center gap-2">
          {wallet.isConnected ? (
            <div className="flex items-center gap-2 rounded-lg border border-[#23262A] bg-[#15171A] px-3 py-2 text-xs">
              <span className="h-2 w-2 rounded-full bg-[#D0FF00]" />
              <span className="text-[#9CA3AF]">
                {wallet.account?.slice(0, 6)}...{wallet.account?.slice(-4)}
              </span>
              {!wallet.isBSC && (
                <button
                  onClick={wallet.switchToBSC}
                  className="ml-1 rounded bg-[#D0FF00]/10 px-1.5 py-0.5 text-[10px] text-[#D0FF00] hover:bg-[#D0FF00]/20"
                >
                  切换 BSC
                </button>
              )}
              <button
                onClick={wallet.disconnectWallet}
                className="ml-1 text-[#5F656D] hover:text-white"
              >
                断开
              </button>
            </div>
          ) : (
            <button
              onClick={wallet.connectWallet}
              disabled={wallet.loading}
              className="flex items-center gap-2 rounded-lg border border-[#23262A] bg-[#15171A] px-4 py-2 text-sm text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white disabled:opacity-50"
            >
              <Wallet className="h-4 w-4" />
              {wallet.loading ? "连接中" : "连接钱包"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:overflow-hidden">
        {/* Left: Concept */}
        <div className="flex w-full flex-col gap-4 lg:w-[420px] lg:overflow-auto">
          <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <Sparkles className="h-4 w-4 text-[#D0FF00]" />
              Meme 概念
            </h3>
            <textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="输入一个 Meme 概念，例如：AI 猫、火星狗、月球蛙..."
              rows={4}
              className="w-full resize-none rounded-lg border border-[#303236] bg-[#0B0D0E] p-3 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={!concept.trim() || generating}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#D0FF00] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    生成中
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    生成文案
                  </>
                )}
              </button>
              {form.name && (
                <button
                  onClick={handleGenerate}
                  disabled={!concept.trim() || generating}
                  title="重新生成"
                  className="flex items-center justify-center gap-2 rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 text-sm text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white disabled:opacity-40"
                >
                  <RefreshCw className={cn("h-4 w-4", generating && "animate-spin")} />
                </button>
              )}
            </div>

            {generatedDescription && (
              <div className="mt-4 rounded-lg border border-[#D0FF00]/20 bg-[#D0FF00]/5 p-3">
                <p className="text-xs text-[#84888C]">AI 生成简介</p>
                <p className="mt-1 text-sm text-[#E8E8E8]">{generatedDescription}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#23262A] bg-[#15171A] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-medium text-white">
                <ImageIcon className="h-4 w-4 text-[#2EDEDB]" />
                代币头像
              </h3>
              <button
                onClick={() => setAvatar(randomAvatar())}
                className="flex items-center gap-1 rounded-lg border border-[#303236] bg-[#0B0D0E] px-2 py-1 text-xs text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white"
              >
                <Dices className="h-3 w-3" />
                换一换
              </button>
            </div>
            <div
              className="flex aspect-square flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#303236] bg-[#0B0D0E] p-4 text-center"
              style={{
                backgroundImage: `${avatar.pattern}, ${imageUrl ? `url(${imageUrl})` : avatar.background}`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {!imageUrl && (
                <div className="rounded-full border-2 border-white/30 bg-black/20 px-4 py-2 text-xl font-bold text-white backdrop-blur-sm">
                  {form.symbol?.slice(0, 2) || "?"}
                </div>
              )}
            </div>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="预留 imageUrl（可粘贴测试图片链接）"
              className="mt-3 w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-xs text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
            />
          </div>
        </div>

        {/* Right: Token params */}
        <div className="flex flex-1 flex-col rounded-xl border border-[#23262A] bg-[#15171A] lg:min-h-0 lg:overflow-hidden">
          <div className="border-b border-[#23262A] px-5 py-4">
            <h3 className="font-semibold text-white">代币参数</h3>
          </div>

          <div className="flex-1 space-y-5 overflow-auto p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs text-[#84888C]">代币名称</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder="AI Cat Coin"
                  className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#84888C]">代币符号</label>
                <input
                  type="text"
                  value={form.symbol}
                  onChange={(e) => updateForm("symbol", e.target.value.toUpperCase())}
                  placeholder="AICAT"
                  className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#84888C]">总供应量</label>
                <input
                  type="text"
                  value={form.totalSupply}
                  onChange={(e) => updateForm("totalSupply", e.target.value.replace(/\D/g, ""))}
                  placeholder="1000000000"
                  className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-[#84888C]">隐藏费接收地址</label>
                <input
                  type="text"
                  value={form.hiddenFeeReceiver}
                  onChange={(e) => updateForm("hiddenFeeReceiver", e.target.value)}
                  placeholder="留空则默认为你的钱包地址"
                  className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#84888C]">分红代币地址</label>
                <input
                  type="text"
                  value={form.rewardToken}
                  onChange={(e) => updateForm("rewardToken", e.target.value)}
                  placeholder={BSC_USDT_ADDRESS}
                  className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                />
              </div>
            </div>

            <div className="rounded-lg border border-[#23262A] bg-[#0B0D0E] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-white">买入税率（Basis Points）</span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    totalBuyTax > 2500 ? "text-[#FF6B6B]" : "text-[#D0FF00]"
                  )}
                >
                  合计 {totalBuyTax} / 2500
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TAX_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-xs text-[#84888C]">{label}</label>
                    <input
                      type="text"
                      value={form[key]}
                      onChange={(e) => updateForm(key, e.target.value.replace(/\D/g, ""))}
                      placeholder="100"
                      className="w-full rounded-lg border border-[#303236] bg-[#15171A] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[#23262A] bg-[#0B0D0E] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-white">卖出税率（Basis Points）</span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    totalSellTax > 2500 ? "text-[#FF6B6B]" : "text-[#D0FF00]"
                  )}
                >
                  合计 {totalSellTax} / 2500
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {SELL_TAX_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-xs text-[#84888C]">{label}</label>
                    <input
                      type="text"
                      value={form[key]}
                      onChange={(e) => updateForm(key, e.target.value.replace(/\D/g, ""))}
                      placeholder="100"
                      className="w-full rounded-lg border border-[#303236] bg-[#15171A] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-[#84888C]">普通白名单地址</label>
                <textarea
                  value={form.ordinaryWhitelist}
                  onChange={(e) => updateForm("ordinaryWhitelist", e.target.value)}
                  placeholder="每行或逗号分隔一个地址"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[#303236] bg-[#0B0D0E] p-3 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                />
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs text-[#84888C]">限制账户地址</label>
                  <textarea
                    value={form.limitAccounts}
                    onChange={(e) => updateForm("limitAccounts", e.target.value)}
                    placeholder="每行或逗号分隔一个地址"
                    rows={3}
                    className="w-full resize-none rounded-lg border border-[#303236] bg-[#0B0D0E] p-3 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-[#84888C]">限制额度（与限制账户一一对应）</label>
              <textarea
                value={form.limitQuotas}
                onChange={(e) => updateForm("limitQuotas", e.target.value)}
                placeholder="每行或逗号分隔一个额度，数量需与限制账户一致"
                rows={2}
                className="w-full resize-none rounded-lg border border-[#303236] bg-[#0B0D0E] p-3 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#9CA3AF]">
                <input
                  type="checkbox"
                  checked={form.limitModeEnabled}
                  onChange={(e) => updateForm("limitModeEnabled", e.target.checked)}
                  className="h-4 w-4 rounded border-[#303236] bg-[#0B0D0E] text-[#D0FF00] accent-[#D0FF00]"
                />
                启用限制模式
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#9CA3AF]">
                <input
                  type="checkbox"
                  checked={form.requestAutoVerify}
                  onChange={(e) => updateForm("requestAutoVerify", e.target.checked)}
                  className="h-4 w-4 rounded border-[#303236] bg-[#0B0D0E] text-[#D0FF00] accent-[#D0FF00]"
                />
                请求自动验证
              </label>
            </div>

            {txStatus !== "idle" && (
              <div
                className={cn(
                  "rounded-lg border p-4",
                  txStatus === "success"
                    ? "border-[#D0FF00]/30 bg-[#D0FF00]/10"
                    : txStatus === "error"
                      ? "border-[#FF6B6B]/30 bg-[#FF6B6B]/10"
                      : "border-[#23262A] bg-[#0B0D0E]"
                )}
              >
                {txStatus === "pending" && (
                  <div className="flex items-center gap-3 text-sm text-[#9CA3AF]">
                    <Loader2 className="h-4 w-4 animate-spin text-[#D0FF00]" />
                    <span>交易已提交，等待链上确认…</span>
                    {txHash && (
                      <a
                        href={`https://bscscan.com/tx/${txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto flex items-center gap-1 text-[#D0FF00] hover:underline"
                      >
                        BscScan <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}

                {txStatus === "success" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#D0FF00]">
                      <CheckCircle className="h-4 w-4" />
                      <span>代币发射成功</span>
                    </div>
                    {tokenAddress && (
                      <div className="rounded-lg border border-[#23262A] bg-[#0B0D0E] p-3">
                        <p className="mb-1 text-xs text-[#84888C]">新代币地址</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 truncate text-sm text-[#D0FF00]">{tokenAddress}</code>
                          <button
                            onClick={copyTokenAddress}
                            className="text-[#9CA3AF] hover:text-white"
                          >
                            {copied ? (
                              <CheckCircle className="h-4 w-4 text-[#D0FF00]" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                          <a
                            href={`https://bscscan.com/token/${tokenAddress}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#9CA3AF] hover:text-white"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    )}
                    {txHash && (
                      <a
                        href={`https://bscscan.com/tx/${txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#D0FF00] hover:underline"
                      >
                        查看交易 <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}

                {txStatus === "error" && (
                  <div className="flex items-start gap-2 text-sm text-[#FF6B6B]">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{errorMessage || "交易失败"}</span>
                  </div>
                )}
              </div>
            )}

            {errorMessage && txStatus === "idle" && (
              <div className="flex items-start gap-2 rounded-lg border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 p-3 text-sm text-[#FF6B6B]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          <div className="border-t border-[#23262A] p-5">
            <button
              onClick={handleLaunch}
              disabled={txStatus === "pending" || !canLaunch}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D0FF00] py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {txStatus === "pending" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  发射中…
                </>
              ) : !wallet.isConnected ? (
                <>
                  <Wallet className="h-4 w-4" />
                  连接钱包
                </>
              ) : !wallet.isBSC ? (
                <>
                  <Wallet className="h-4 w-4" />
                  切换到 BSC
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  一键发射（0.005 BNB）
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
