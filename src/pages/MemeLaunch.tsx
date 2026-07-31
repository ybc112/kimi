import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Sparkles,
  Zap,
  Wallet,
  Rocket,
  Image as ImageIcon,
  CheckCircle,
  Copy,
  Loader2,
  ExternalLink,
  RefreshCw,
  Dices,
  Settings2,
  ChevronDown,
} from "lucide-react";
import { useAppStore } from "@/store";
import { useWallet } from "@/hooks/useWallet";
import { useIssuedTokens } from "@/hooks/useIssuedTokens";
import { useContractData } from "@/hooks/useContractData";
import { DEFAULT_MODEL, sendChatMessage, generateImage } from "@/lib/kimi";
import { cn } from "@/lib/utils";
import { TransactionError } from "@/components/TransactionError";
import {
  SNOWBALL_LAUNCHPAD_ADDRESS,
  BSC_USDT_ADDRESS,
  buildCreateTokenParams,
  fetchSnowballLaunchpadStatus,
  formatCreateFee,
  preflightCreateToken,
  submitCreateToken,
  type CreateTokenFormValues,
  type SnowballLaunchpadStatus,
} from "@/lib/contracts/snowball";
import { chargeKimiTokens, DEPLOY_BURN_AMOUNT, getKimiBalance } from "@/lib/contracts/deployer";
import { formatContractError } from "@/lib/contracts/errors";
import { createImageThumbnail } from "@/lib/images";
import { compactImageUrl, safeGetItem, safeSetItem } from "@/lib/storage";
import { AiSecurityNotice } from "@/components/AiSecurityNotice";

const DEFAULT_FORM: CreateTokenFormValues = {
  name: "",
  symbol: "",
  totalSupply: "1000000000",
  hiddenFeeReceiver: "",
  rewardToken: BSC_USDT_ADDRESS,
  buyHiddenTaxBp: "1",
  buyBurnBp: "1",
  buyLiquidityBp: "1",
  buyDividendBp: "1",
  sellHiddenTaxBp: "1",
  sellBurnBp: "1",
  sellLiquidityBp: "1",
  sellDividendBp: "1",
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

const MEME_STORAGE_KEY = "kimi-meme-launch";

function randomAvatar() {
  const idx = Math.floor(Math.random() * GRADIENTS.length);
  return {
    background: GRADIENTS[idx],
    pattern: `radial-gradient(circle at ${20 + Math.random() * 60}% ${20 + Math.random() * 60}%, rgba(255,255,255,0.25) 0%, transparent 35%)`,
  };
}

interface SavedMeme {
  concept: string;
  form: CreateTokenFormValues;
  description: string;
  avatar: ReturnType<typeof randomAvatar>;
  imageUrl: string;
}

function readSavedMeme(): SavedMeme | null {
  try {
    const raw = safeGetItem(MEME_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // 忽略损坏的旧版浏览器缓存。
  }
  return null;
}

function saveMeme(meme: SavedMeme) {
  const imageUrl = compactImageUrl(meme.imageUrl) ?? "";
  safeSetItem(MEME_STORAGE_KEY, JSON.stringify({ ...meme, imageUrl }));
}

export default function MemeLaunch() {
  const { addLog, showToast } = useAppStore();
  const wallet = useWallet();
  const { addToken } = useIssuedTokens();
  const { recordLaunch } = useContractData();

  const [concept, setConcept] = useState("");
  const [form, setForm] = useState<CreateTokenFormValues>(DEFAULT_FORM);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [avatar, setAvatar] = useState(randomAvatar);
  const [generatedDescription, setGeneratedDescription] = useState("");

  const [generating, setGenerating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string>("");
  const [tokenAddress, setTokenAddress] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorDetails, setErrorDetails] = useState<string>("");
  const [txStep, setTxStep] = useState<"idle" | "preflight" | "launch" | "fee">("idle");
  const [imageError, setImageError] = useState<string>("");
  const [imageFailed, setImageFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [launchpadStatus, setLaunchpadStatus] = useState<SnowballLaunchpadStatus | null>(null);
  const [preflightFee, setPreflightFee] = useState<bigint | null>(null);
  const [feeReadState, setFeeReadState] = useState<"loading" | "ready" | "error">("loading");
  const [feeReadError, setFeeReadError] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    const saved = readSavedMeme();
    if (saved) {
      setConcept(saved.concept);
      setForm((prev) => {
        const next = { ...prev, ...saved.form };
        // 兼容旧数据：如果税率字段是 basis points（>25），转换为百分比
        const taxKeys: Array<keyof CreateTokenFormValues> = [
          "buyHiddenTaxBp",
          "buyBurnBp",
          "buyLiquidityBp",
          "buyDividendBp",
          "sellHiddenTaxBp",
          "sellBurnBp",
          "sellLiquidityBp",
          "sellDividendBp",
        ];
        taxKeys.forEach((key) => {
          const value = Number(next[key]);
          if (value > 25) {
            (next as unknown as Record<string, string>)[key] = (value / 100).toString();
          }
        });
        return next;
      });
      setGeneratedDescription(saved.description);
      setAvatar(saved.avatar);
      setImageUrl(saved.imageUrl || "");
      setImageFailed(false);
    }
    let active = true;
    fetchSnowballLaunchpadStatus()
      .then((status) => {
        if (!active) return;
        setLaunchpadStatus(status);
        setFeeReadState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setFeeReadState("error");
        setFeeReadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, []);

  const updateForm = (key: keyof CreateTokenFormValues, value: string | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      saveMeme({ concept, form: next, description: generatedDescription, avatar, imageUrl });
      return next;
    });
  };

  const handleGenerateImage = async () => {
    if (!form.name.trim() || generatingImage) return;
    setGeneratingImage(true);
    setImageError("");
    addLog({ type: "info", message: "正在生成 Meme 代币头像" });

    try {
      const prompt = `A cute iconic meme crypto token mascot for "${form.name}", cartoon style, vibrant colors, clean background, token logo.`;
      const sourceUrl = await generateImage({ prompt, size: "1024x1024" });
      let url = sourceUrl;
      try {
        url = await createImageThumbnail(sourceUrl);
      } catch {
        // 远程图片可能不允许 canvas 跨域读取；继续用原图展示，但不会
        // 把超大的 data URL 强行写入 localStorage。
      }
      setImageUrl(url);
      setImageFailed(false);
      saveMeme({ concept, form, description: generatedDescription, avatar, imageUrl: url });
      addLog({ type: "success", message: "Meme 头像生成成功" });
      showToast({ type: "success", message: "头像生成成功" });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setImageError(detail);
      addLog({ type: "error", message: "Meme 头像生成失败", detail });
      showToast({ type: "error", message: "头像生成失败" });
    } finally {
      setGeneratingImage(false);
    }
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
        const nextAvatar = randomAvatar();
        const nextForm = {
          ...form,
          name: String(parsed.name),
          symbol: String(parsed.symbol).toUpperCase(),
        };
        setForm(nextForm);
        setGeneratedDescription(String(parsed.description));
        setAvatar(nextAvatar);
        saveMeme({ concept, form: nextForm, description: String(parsed.description), avatar: nextAvatar, imageUrl });
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
  }, [concept, generating, addLog, showToast, form, imageUrl]);

  const handleLaunch = async () => {
    if (!wallet.isConnected || !wallet.signer || !wallet.account) {
      await wallet.connectWallet();
      return;
    }
    if (!wallet.isBSC) {
      await wallet.switchToBSC();
      return;
    }

    setTxStatus("pending");
    setTxStep("preflight");
    setErrorMessage("");
    setErrorDetails("");
    setTxHash("");
    setTokenAddress("");
    addLog({ type: "info", message: "正在预检 KIMI 发币参数与链上工厂" });

    let kimiBurnTxHash = "";
    try {
      const params = buildCreateTokenParams(form, {
        defaultHiddenFeeReceiver: wallet.account,
        defaultRewardToken: BSC_USDT_ADDRESS,
      });
      const balance = await getKimiBalance(wallet.signer, wallet.account);
      if (balance < DEPLOY_BURN_AMOUNT) {
        throw new Error("KIMI 余额不足，需要至少 20,000 KIMI");
      }
      const preflight = await preflightCreateToken(wallet.signer, params);
      setPreflightFee(preflight.fee);
      setFeeReadState("ready");
      setFeeReadError("");
      addLog({
        type: "success",
        message: "KIMI 发币预检通过",
        detail: `预计 Gas ${preflight.gasEstimate.toString()}，预计地址 ${preflight.predictedToken}`,
      });

      // 纯前端无法把外部工厂创建和官方 KIMI 扣费合并成一笔原子交易。
      // 为避免用户通过取消第二笔交易绕过平台费，预检通过后先转入销毁地址。
      setTxStep("fee");
      const burnResult = await chargeKimiTokens({ signer: wallet.signer, amount: DEPLOY_BURN_AMOUNT });
      kimiBurnTxHash = burnResult.txHash;
      addLog({ type: "success", message: "20,000 官方 KIMI 已转入销毁地址", detail: burnResult.txHash });

      setTxStep("launch");
      const result = await submitCreateToken(wallet.signer, params, preflight.fee);
      setTxHash(result.txHash);
      setTokenAddress(result.tokenAddress);
      try {
        addToken({
          name: form.name,
          symbol: form.symbol,
          address: result.tokenAddress,
          deployer: wallet.account,
          network: "BNB Smart Chain",
          chainId: 56,
          txHash: result.txHash,
          status: "success",
          totalSupply: form.totalSupply,
          type: "snowball",
          imageUrl: compactImageUrl(imageUrl, 32_000),
          tradingOpen: false,
        });
        recordLaunch(form.name);
      } catch (recordError) {
        addLog({
          type: "error",
          message: "代币已创建，但本地记录保存失败",
          detail: recordError instanceof Error ? recordError.message : String(recordError),
        });
      }

      setTxStatus("success");
      setTxStep("idle");
      addLog({ type: "success", message: "KIMI 普通代币创建成功", detail: result.tokenAddress });
      showToast({ type: "success", message: "KIMI 代币发射成功" });
    } catch (error) {
      const friendly = formatContractError(error, "代币发射失败");
      const summary = kimiBurnTxHash
        ? `20,000 KIMI 已销毁，但代币创建未完成：${friendly.summary}`
        : friendly.summary;
      const details = kimiBurnTxHash
        ? `${friendly.details}\nKIMI 销毁交易：https://bscscan.com/tx/${kimiBurnTxHash}`
        : friendly.details;
      setErrorMessage(summary);
      setErrorDetails(details);
      setTxStatus("error");
      setTxStep("idle");
      addLog({ type: "error", message: "代币创建失败", detail: details });
      showToast({ type: "error", message: summary });
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

  const isBuyTaxValid = totalBuyTax <= 25;
  const isSellTaxValid = totalSellTax <= 25;

  const formValidationMessage = useMemo(() => {
    try {
      buildCreateTokenParams(form, {
        defaultHiddenFeeReceiver: wallet.account || "0x000000000000000000000000000000000000dEaD",
        defaultRewardToken: BSC_USDT_ADDRESS,
      });
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }, [form, wallet.account]);
  const canLaunch = !formValidationMessage && isBuyTaxValid && isSellTaxValid;
  const displayedCreateFee = preflightFee ?? launchpadStatus?.createFee ?? null;
  const createFeeDisplay = useMemo(
    () => (displayedCreateFee === null ? null : formatCreateFee(displayedCreateFee)),
    [displayedCreateFee]
  );

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="kimi-page-title">KIMI 普通代币一键发射</h2>
          <p className="kimi-page-subtitle">KIMI Launch · 使用已核验的普通代币合约，输入 Meme 概念后即可在 BSC 发币</p>
        </div>
        <div className="flex items-center gap-2">
          {wallet.isConnected ? (
            <div className="kimi-card flex-row items-center gap-2 py-2 px-3">
              <span className="h-2 w-2 rounded-full bg-[#D0FF00]" />
              <span className="text-xs text-[#9CA3AF]">
                {wallet.account?.slice(0, 6)}...{wallet.account?.slice(-4)}
              </span>
              <span className="text-xs text-[#6B7280]">{Number(wallet.balance).toFixed(4)} BNB</span>
              {!wallet.isBSC && (
                <button
                  onClick={wallet.switchToBSC}
                  className="ml-1 rounded bg-[#D0FF00]/10 px-1.5 py-0.5 text-[10px] text-[#D0FF00] hover:bg-[#D0FF00]/20"
                >
                  切换 BSC
                </button>
              )}
              <button onClick={wallet.disconnectWallet} className="ml-1 text-xs text-[#6B7280] hover:text-white">
                断开
              </button>
            </div>
          ) : (
            <button onClick={wallet.connectWallet} disabled={wallet.loading} className="kimi-btn-secondary">
              {wallet.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              连接钱包
            </button>
          )}
        </div>
      </div>
      {wallet.error && <TransactionError summary={wallet.error} />}
      <AiSecurityNotice />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Left: Concept */}
        <div className="flex w-full flex-col gap-4 lg:w-[420px]">
          <div className="kimi-card">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4 text-[#D0FF00]" />
              Meme 概念
            </h3>
            <textarea
              value={concept}
              onChange={(e) => {
                setConcept(e.target.value);
                saveMeme({ concept: e.target.value, form, description: generatedDescription, avatar, imageUrl });
              }}
              placeholder="输入一个 Meme 概念，例如：AI 猫、火星狗、月球蛙..."
              rows={4}
              className="kimi-input min-h-[100px] resize-none"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={!concept.trim() || generating}
                className="kimi-btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                生成文案
              </button>
              {form.name && (
                <button
                  onClick={handleGenerate}
                  disabled={!concept.trim() || generating}
                  title="重新生成"
                  className="kimi-btn-secondary px-3 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RefreshCw className={cn("h-4 w-4", generating && "animate-spin")} />
                </button>
              )}
            </div>

            {generatedDescription && (
              <div className="mt-4 rounded-xl border border-[#D0FF00]/20 bg-[#D0FF00]/5 p-3">
                <p className="text-xs text-[#9CA3AF]">AI 生成简介</p>
                <p className="mt-1 text-sm text-[#E8E8E8]">{generatedDescription}</p>
              </div>
            )}
          </div>

          <div className="kimi-card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <ImageIcon className="h-4 w-4 text-[#2EDEDB]" />
                代币头像
              </h3>
              <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const next = randomAvatar();
                      setAvatar(next);
                      saveMeme({ concept, form, description: generatedDescription, avatar: next, imageUrl });
                    }}
                    className="kimi-btn-secondary py-1.5 px-2 text-xs"
                  >
                    <Dices className="h-3 w-3" />
                    换一换
                  </button>
                  <button
                    onClick={handleGenerateImage}
                    disabled={!form.name || generatingImage}
                    className="kimi-btn-primary py-1.5 px-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {generatingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
                    AI 生图
                  </button>
                </div>
            </div>
            <div className="relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#303236] bg-[#0A0B0D] p-4 text-center sm:aspect-square">
              {imageUrl && !imageFailed ? (
                <img
                  src={imageUrl}
                  alt={form.symbol}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  onError={() => {
                    setImageFailed(true);
                    setImageError("头像链接已失效，已切换为默认头像");
                    saveMeme({ concept, form, description: generatedDescription, avatar, imageUrl: "" });
                  }}
                />
              ) : (
                <>
                  <div
                    className="absolute inset-0 opacity-80"
                    style={{
                      backgroundImage: `${avatar.pattern}, ${avatar.background}`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <div className="relative rounded-full border-2 border-white/30 bg-black/20 px-4 py-2 text-xl font-bold text-white backdrop-blur-sm">
                    {form.symbol?.slice(0, 2) || "?"}
                  </div>
                </>
              )}
            </div>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                setImageFailed(false);
                setImageError("");
                saveMeme({ concept, form, description: generatedDescription, avatar, imageUrl: e.target.value });
              }}
              placeholder="AI 生成的头像链接会显示在这里，也支持粘贴自定义图片链接"
              className="kimi-input mt-3 text-xs"
            />
            {imageError && (
              <div className="mt-2 rounded-lg border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 px-3 py-2 text-xs text-[#FF6B6B]">
                {imageError}
              </div>
            )}
          </div>
        </div>

        {/* Right: Token params */}
        <div className="flex flex-1 flex-col rounded-2xl border border-[#25282C] bg-[#111215] lg:self-start">
          <div className="border-b border-[#25282C] px-5 py-4">
            <h3 className="font-semibold text-white">代币参数</h3>
          </div>

          <div className="space-y-5 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs text-[#9CA3AF]">代币名称</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder="AI Cat Coin"
                  className="kimi-input"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#9CA3AF]">代币符号</label>
                <input
                  type="text"
                  value={form.symbol}
                  onChange={(e) => updateForm("symbol", e.target.value.toUpperCase())}
                  placeholder="AICAT"
                  className="kimi-input"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#9CA3AF]">总供应量</label>
                <input
                  type="text"
                  value={form.totalSupply}
                  onChange={(e) => updateForm("totalSupply", e.target.value.replace(/\D/g, ""))}
                  placeholder="1000000000"
                  className="kimi-input"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAdvancedOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#303236] bg-[#0A0B0D] px-4 py-3 text-left transition-colors hover:border-[#D0FF00]/30"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Settings2 className="h-4 w-4 shrink-0 text-[#2EDEDB]" />
                <span>
                  <span className="block text-sm font-medium text-white">高级参数</span>
                  <span className="block text-[11px] text-[#6B7280]">税率、分红地址、白名单与限制模式</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-[#D0FF00]">
                买 {totalBuyTax.toFixed(2)}% · 卖 {totalSellTax.toFixed(2)}%
                <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
              </span>
            </button>

            {advancedOpen && <div className="space-y-5 rounded-xl border border-[#25282C] bg-[#0A0B0D]/40 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-[#9CA3AF]">隐藏费接收地址</label>
                <input
                  type="text"
                  value={form.hiddenFeeReceiver}
                  onChange={(e) => updateForm("hiddenFeeReceiver", e.target.value)}
                  placeholder="留空则默认为你的钱包地址"
                  className="kimi-input"
                />
                {!form.hiddenFeeReceiver.trim() && (
                  <p className="mt-1 text-[11px] text-[#6B7280]">发射时会自动使用当前连接的钱包地址。</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#9CA3AF]">分红代币地址</label>
                <input
                  type="text"
                  value={form.rewardToken}
                  onChange={(e) => updateForm("rewardToken", e.target.value)}
                  placeholder={BSC_USDT_ADDRESS}
                  className="kimi-input"
                />
              </div>
            </div>

            <div className="rounded-xl border border-[#25282C] bg-[#0A0B0D] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-white">买入税率（%）</span>
                <span className={cn("text-xs font-medium", isBuyTaxValid ? "text-[#D0FF00]" : "text-[#FF6B6B]")}>
                  合计 {totalBuyTax.toFixed(2)}% / 25%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TAX_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-xs text-[#9CA3AF]">{label} (%)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form[key]}
                      onChange={(e) => updateForm(key, e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
                      placeholder="1"
                      className="kimi-input"
                    />
                  </div>
                ))}
              </div>
              {!isBuyTaxValid && (
                <p className="mt-2 text-xs text-[#FF6B6B]">买入税率合计不能超过 25%</p>
              )}
            </div>

            <div className="rounded-xl border border-[#25282C] bg-[#0A0B0D] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-white">卖出税率（%）</span>
                <span className={cn("text-xs font-medium", isSellTaxValid ? "text-[#D0FF00]" : "text-[#FF6B6B]")}>
                  合计 {totalSellTax.toFixed(2)}% / 25%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {SELL_TAX_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-xs text-[#9CA3AF]">{label} (%)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form[key]}
                      onChange={(e) => updateForm(key, e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
                      placeholder="1"
                      className="kimi-input"
                    />
                  </div>
                ))}
              </div>
              {!isSellTaxValid && (
                <p className="mt-2 text-xs text-[#FF6B6B]">卖出税率合计不能超过 25%</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-[#9CA3AF]">普通白名单地址</label>
                <textarea
                  value={form.ordinaryWhitelist}
                  onChange={(e) => updateForm("ordinaryWhitelist", e.target.value)}
                  placeholder="每行或逗号分隔一个地址"
                  rows={3}
                  className="kimi-input min-h-[80px] resize-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#9CA3AF]">限制账户地址</label>
                <textarea
                  value={form.limitAccounts}
                  onChange={(e) => updateForm("limitAccounts", e.target.value)}
                  placeholder="每行或逗号分隔一个地址"
                  rows={3}
                  className="kimi-input min-h-[80px] resize-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-[#9CA3AF]">限制额度（与限制账户一一对应）</label>
              <textarea
                value={form.limitQuotas}
                onChange={(e) => updateForm("limitQuotas", e.target.value)}
                placeholder="每行或逗号分隔一个额度，数量需与限制账户一致"
                rows={2}
                className="kimi-input min-h-[60px] resize-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#9CA3AF]">
                <input
                  type="checkbox"
                  checked={form.limitModeEnabled}
                  onChange={(e) => updateForm("limitModeEnabled", e.target.checked)}
                  className="h-4 w-4 rounded border-[#303236] bg-[#0A0B0D] text-[#D0FF00] accent-[#D0FF00]"
                />
                启用限制模式
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#9CA3AF]">
                <input
                  type="checkbox"
                  checked={form.requestAutoVerify}
                  onChange={(e) => updateForm("requestAutoVerify", e.target.checked)}
                  className="h-4 w-4 rounded border-[#303236] bg-[#0A0B0D] text-[#D0FF00] accent-[#D0FF00]"
                />
                请求自动验证
              </label>
            </div>
            </div>}

            {txStatus !== "idle" && (
              <div
                className={cn(
                  "rounded-xl border p-4",
                  txStatus === "success"
                    ? "border-[#D0FF00]/30 bg-[#D0FF00]/10"
                    : txStatus === "error"
                      ? "border-[#FF6B6B]/30 bg-[#FF6B6B]/10"
                      : "border-[#25282C] bg-[#0A0B0D]"
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
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#D0FF00]">
                      <CheckCircle className="h-4 w-4" />
                      <span>KIMI 代币发射成功</span>
                    </div>
                    {tokenAddress && (
                      <div className="rounded-xl border border-[#25282C] bg-[#0A0B0D] p-3">
                        <p className="mb-1 text-xs text-[#9CA3AF]">新代币地址</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 truncate text-sm text-[#D0FF00]">{tokenAddress}</code>
                          <button onClick={copyTokenAddress} className="text-[#9CA3AF] hover:text-white">
                            {copied ? <CheckCircle className="h-4 w-4 text-[#D0FF00]" /> : <Copy className="h-4 w-4" />}
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

                {txStatus === "error" && <TransactionError summary={errorMessage || "交易失败"} details={errorDetails} />}
              </div>
            )}

            {errorMessage && txStatus === "idle" && (
              <TransactionError summary={errorMessage} details={errorDetails} />
            )}
          </div>

          <div className="border-t border-[#25282C] p-5">
            <div className="mb-4 rounded-xl border border-[#25282C] bg-[#0A0B0D] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-[#9CA3AF]">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0 text-[#D0FF00]" />
                   KIMI 发币工厂 · 合约已核对
                </span>
                <a
                  href={`https://bscscan.com/address/${SNOWBALL_LAUNCHPAD_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#D0FF00] hover:underline"
                >
                  BscScan <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <code className="block truncate text-xs text-[#E8E8E8]">{SNOWBALL_LAUNCHPAD_ADDRESS}</code>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-[#6B7280]">链上创建费</span>
                <span className={cn("font-medium", feeReadState === "error" ? "text-[#F59E0B]" : "text-[#D0FF00]")}>
                  {feeReadState === "loading"
                    ? "正在读取…"
                    : createFeeDisplay?.fullLabel || "交易前实时读取"}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-[#6B7280]">平台费用（发币前销毁）</span>
                <span className="font-medium text-[#D0FF00]">20,000 KIMI</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[#F59E0B]">
                钱包会先确认销毁 KIMI，再确认发币交易；销毁确认后不可撤销。
              </p>
              {createFeeDisplay?.isFree && (
                <p className="mt-2 text-[11px] leading-relaxed text-[#7DE9E7]">
                   当前发币工厂免收创建费；合约源码初始默认值是 0.005 BNB，钱包仍需保留少量 BNB 支付网络 Gas。
                </p>
              )}
              {feeReadState === "error" && (
                <p className="mt-2 text-[11px] leading-relaxed text-[#F59E0B]" title={feeReadError}>
                  公共 RPC 暂时未读到费用，点击发射后会通过钱包 Provider 再次校验，绝不会用默认值直接付款。
                </p>
              )}
            </div>
            {formValidationMessage && <p className="mb-3 text-xs text-[#FF6B6B]">{formValidationMessage}</p>}
            <button
              onClick={handleLaunch}
              disabled={txStatus === "pending" || (wallet.isConnected && wallet.isBSC && !canLaunch)}
              className="kimi-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              {txStatus === "pending" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : !wallet.isConnected ? (
                <Wallet className="h-4 w-4" />
              ) : !wallet.isBSC ? (
                <Wallet className="h-4 w-4" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              {txStatus === "pending"
                ? txStep === "preflight"
                  ? "正在安全预检…"
                   : txStep === "fee"
                    ? "正在扣除 20,000 官方 KIMI…"
                    : "正在链上创建代币…"
                : !wallet.isConnected
                  ? "连接钱包"
                  : !wallet.isBSC
                    ? "切换到 BSC"
                    : `一键发射（${createFeeDisplay?.buttonLabel || "交易前读取费用"}）`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
