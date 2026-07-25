import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send,
  Plus,
  Copy,
  Download,
  Check,
  FileCheck,
  Shield,
  Layers,
  Sparkles,
  AlertCircle,
  Rocket,
} from "lucide-react";
import { useAppStore } from "@/store";
import { DEFAULT_MODEL, sendChatMessage } from "@/lib/kimi";
import { FLAP_SYSTEM_PROMPT } from "@/lib/flapContext";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";

const vaultTypes = [
  { value: "mint-treasury", label: "Mint Treasury", mode: "Mint" },
  { value: "buyback", label: "Buyback Vault", mode: "Buyback" },
  { value: "dividend", label: "Dividend Vault", mode: "Dividend" },
  { value: "lp", label: "LP Vault", mode: "Liquidity" },
  { value: "custom", label: "Custom", mode: "Custom" },
];

const TEMPLATE_CHECKS = [
  { label: "VaultBaseV2 继承", status: "required", pass: true },
  { label: "guardian 权限控制", status: "required", pass: true },
  { label: "receive() gas 限制", status: "required", pass: true },
];

const EXAMPLE_PROMPT = `例如：帮我写一个燃烧池税金库，金库合约将 0.2 BNB 自动回购销毁。`;

export default function Chat() {
  const { addLog } = useAppStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"generate" | "params" | "example">("generate");
  const [prompt, setPrompt] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [params, setParams] = useState({
    projectName: "",
    contractName: "",
    vaultType: "mint-treasury",
    treasuryReceiver: "",
    mintPrice: "0.2",
    mintAmount: "100000",
    treasurySplit: "80",
    secondWallet: "",
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [prompt, adjustTextareaHeight]);

  const updateParam = (key: keyof typeof params, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const buildUserPrompt = () => {
    const type = vaultTypes.find((v) => v.value === params.vaultType);
    const isMint = params.vaultType === "mint-treasury";
    return [
      prompt,
      "",
      "## 项目参数",
      `项目名称：${params.projectName || "未填写"}`,
      `合约名称：${params.contractName || "未填写"}`,
      `金库类型：${type?.label || "Custom"}`,
      `Treasury 接收地址：${params.treasuryReceiver || "部署时指定"}`,
      isMint ? `Mint 价格（BNB）：${params.mintPrice}` : "",
      isMint ? `每次 Mint 份额：${params.mintAmount}` : "",
      `Treasury 分成比例：${params.treasurySplit}%`,
      params.secondWallet ? `二级钱包地址：${params.secondWallet}` : "",
      "",
      "请生成完整的 Solidity 合约代码，并确保符合 Flap Tax Vault V2 规范。",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const extractCode = (text: string) => {
    const match = /```(?:solidity)?\s*([\s\S]*?)```/.exec(text);
    return match ? match[1].trim() : text.trim();
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    addLog({ type: "info", message: "正在请求 Kimi 生成合约" });

    try {
      const userPrompt = buildUserPrompt();
      const content = await sendChatMessage({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: FLAP_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        temperature: 0.3,
      });

      const code = extractCode(content);
      setGeneratedCode(code);
      localStorage.setItem("flap-generated-code", code);
      addLog({ type: "success", message: "合约代码生成成功" });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      addLog({ type: "error", message: "Kimi 请求失败", detail });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!generatedCode) return;
    const blob = new Blob([generatedCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${params.contractName || "FlapVault"}.sol`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSelectAll = () => {
    const el = document.getElementById("generated-code");
    if (!el) return;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const selectedType = vaultTypes.find((v) => v.value === params.vaultType);

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-4 lg:h-[calc(100vh-3rem)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">金库生成</h2>
          <p className="text-xs text-[#84888C]">基于 Kimi + Flap Tax Vault V2 规范生成合约代码</p>
        </div>
        <button
          onClick={() => {
            setPrompt("");
            setGeneratedCode("");
            localStorage.removeItem("flap-generated-code");
            setParams({
              projectName: "",
              contractName: "",
              vaultType: "mint-treasury",
              treasuryReceiver: "",
              mintPrice: "0.2",
              mintAmount: "100000",
              treasurySplit: "80",
              secondWallet: "",
            });
          }}
          className="flex items-center justify-center gap-2 rounded-lg border border-[#23262A] bg-[#15171A] px-4 py-2 text-sm text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white sm:justify-start"
        >
          <Plus className="h-4 w-4" />
          新建生成
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:overflow-hidden">
        {/* Left: Parameters */}
        <div className="flex w-full flex-col rounded-xl border border-[#23262A] bg-[#15171A] lg:w-[420px]">
          <div className="flex items-center justify-between border-b border-[#23262A] px-5 py-4">
            <h3 className="font-semibold text-white">生成参数</h3>
            <span className="rounded-full bg-[#D0FF00]/10 px-2 py-0.5 text-xs text-[#D0FF00]">可配置 Remix</span>
          </div>

          <div className="flex border-b border-[#23262A]">
            {[
              { key: "generate", label: "生成说明" },
              { key: "params", label: "参数说明" },
              { key: "example", label: "示例说明" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={cn(
                  "flex-1 border-b-2 py-2.5 text-xs font-medium transition-colors",
                  activeTab === tab.key
                    ? "border-[#D0FF00] text-[#D0FF00]"
                    : "border-transparent text-[#5F656D] hover:text-[#9CA3AF]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5 lg:flex-1 lg:overflow-auto">
            {activeTab === "generate" && (
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-medium text-[#9CA3AF]">需求描述</label>
                  <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={EXAMPLE_PROMPT}
                    rows={4}
                    className="w-full resize-none rounded-lg border border-[#303236] bg-[#0B0D0E] p-3 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                  />
                  <p className="mt-1.5 text-xs text-[#5F656D]">
                    输入需求后会自动识别：金库类型、接收地址、Mint 价格、每次份额、分成比例、提现/救援/Guardian，并立即生成合规代码。
                  </p>
                </div>

                <div className="grid gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs text-[#84888C]">项目名称</label>
                    <input
                      type="text"
                      value={params.projectName}
                      onChange={(e) => updateParam("projectName", e.target.value)}
                      placeholder="Fcodex"
                      className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-[#84888C]">合约名称</label>
                    <input
                      type="text"
                      value={params.contractName}
                      onChange={(e) => updateParam("contractName", e.target.value)}
                      placeholder="FcodexMintVault"
                      className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-[#84888C]">金库类型</label>
                    <select
                      value={params.vaultType}
                      onChange={(e) => updateParam("vaultType", e.target.value)}
                      className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50"
                    >
                      {vaultTypes.map((t) => (
                        <option key={t.value} value={t.value} className="bg-[#15171A]">
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-[#84888C]">接收次数钱包</label>
                    <input
                      type="text"
                      value={params.treasuryReceiver}
                      onChange={(e) => updateParam("treasuryReceiver", e.target.value)}
                      placeholder="0x..."
                      className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                    />
                  </div>

                  {params.vaultType === "mint-treasury" && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs text-[#84888C]">Mint 价格 BNB</label>
                        <input
                          type="text"
                          value={params.mintPrice}
                          onChange={(e) => updateParam("mintPrice", e.target.value)}
                          placeholder="0.2"
                          className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs text-[#84888C]">每次 Mint 份额</label>
                        <input
                          type="text"
                          value={params.mintAmount}
                          onChange={(e) => updateParam("mintAmount", e.target.value)}
                          placeholder="100000"
                          className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs text-[#84888C]">Treasury split %</label>
                      <input
                        type="text"
                        value={params.treasurySplit}
                        onChange={(e) => updateParam("treasurySplit", e.target.value)}
                        placeholder="80"
                        className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-[#84888C]">Second wallet</label>
                      <input
                        type="text"
                        value={params.secondWallet}
                        onChange={(e) => updateParam("secondWallet", e.target.value)}
                        placeholder="0x..."
                        className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D0FF00] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? (
                    <>
                      <span className="inline-flex gap-1">
                        <span className="animate-bounce">.</span>
                        <span className="animate-bounce [animation-delay:0.2s]">.</span>
                        <span className="animate-bounce [animation-delay:0.4s]">.</span>
                      </span>
                      生成中
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      生成代码
                    </>
                  )}
                </button>
              </div>
            )}

            {activeTab === "params" && (
              <div className="space-y-4 text-sm text-[#9CA3AF]">
                <p>参数说明：</p>
                <ul className="list-disc space-y-2 pl-4">
                  <li>项目名称：用于注释和标识，不影响合约逻辑。</li>
                  <li>合约名称：生成的 Solidity contract 名称。</li>
                  <li>金库类型：决定 Vault 的核心机制（Mint、Buyback、Dividend、LP）。</li>
                  <li>接收地址：税收或 Mint 资金的接收钱包。</li>
                  <li>Mint 价格：每次 Mint 需要支付的 BNB 数量。</li>
                  <li>每次 Mint 份额：用户每次 Mint 获得的代币数量。</li>
                  <li>Treasury split：进入金库的分成比例。</li>
                  <li>Second wallet：用于二次分配或备用接收地址。</li>
                </ul>
              </div>
            )}

            {activeTab === "example" && (
              <div className="space-y-4 text-sm text-[#9CA3AF]">
                <p>示例需求：</p>
                <div className="rounded-lg border border-[#303236] bg-[#0B0D0E] p-3 text-[#D0FF00]">
                  {EXAMPLE_PROMPT}
                </div>
                <p>填写参数后点击「生成代码」，Kimi 会根据 Flap V2 规范生成完整合约。</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Generated Code */}
        <div className="flex flex-col rounded-xl border border-[#23262A] bg-[#15171A] lg:flex-1 lg:min-h-0">
          <div className="flex flex-col gap-3 border-b border-[#23262A] px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-5">
            <h3 className="font-semibold text-white">生成代码</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                disabled={!generatedCode}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-1.5 text-xs text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy
              </button>
              <button
                onClick={handleDownload}
                disabled={!generatedCode}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-1.5 text-xs text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
              <button
                onClick={handleSelectAll}
                disabled={!generatedCode}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-1.5 text-xs text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial"
              >
                <Layers className="h-3.5 w-3.5" />
                Select
              </button>
              <button
                onClick={() => navigate("/deploy")}
                disabled={!generatedCode}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#D0FF00]/30 bg-[#D0FF00]/10 px-3 py-1.5 text-xs font-medium text-[#D0FF00] transition-colors hover:bg-[#D0FF00]/20 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial"
              >
                <Rocket className="h-3.5 w-3.5" />
                部署
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-1 lg:flex-row lg:overflow-hidden">
            <div className="min-h-[360px] flex-1 overflow-auto p-0 lg:min-h-0">
              {!generatedCode ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-[#5F656D]">
                  <Sparkles className="h-10 w-10 text-[#303236]" />
                  <p className="text-sm">在上方填写参数并点击「生成代码」</p>
                </div>
              ) : (
                <div id="generated-code" className="h-full min-w-[600px]">
                  <SyntaxHighlighter
                    language="solidity"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: "1.25rem",
                      fontSize: "0.8125rem",
                      lineHeight: 1.6,
                      background: "transparent",
                      minHeight: "100%",
                    }}
                  >
                    {generatedCode}
                  </SyntaxHighlighter>
                </div>
              )}
            </div>

            {/* Template Check Sidebar */}
            <div className="w-full border-t border-[#23262A] bg-[#111215] p-4 lg:w-[260px] lg:border-l lg:border-t-0">
              <div className="mb-4 flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-[#D0FF00]" />
                <h4 className="text-sm font-semibold text-white">模板检查</h4>
              </div>

              <div className="mb-4 rounded-lg border border-[#23262A] bg-[#0B0D0E] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#84888C]">Required hooks</span>
                  <span className="text-sm font-bold text-[#D0FF00]">3/3</span>
                </div>
              </div>

              <div className="mb-4 space-y-2">
                {TEMPLATE_CHECKS.map((check, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-[#23262A] bg-[#0B0D0E] px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-[#2EDEDB]" />
                      <span className="text-xs text-[#9CA3AF]">{check.label}</span>
                    </div>
                    <span className="text-[10px] uppercase text-[#5F656D]">{check.status}</span>
                  </div>
                ))}
              </div>

              <div className="mb-4 rounded-lg border border-[#23262A] bg-[#0B0D0E] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-[#FF6B6B]" />
                  <span className="text-xs font-medium text-white">Guards</span>
                </div>
                <div className="text-2xl font-bold text-white">3</div>
              </div>

              <div className="mb-4 rounded-lg border border-[#23262A] bg-[#0B0D0E] p-3">
                <div className="mb-2 text-xs text-[#84888C]">Mode</div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#D0FF00]/10 px-2.5 py-1 text-xs text-[#D0FF00]">
                  {selectedType?.mode || "Custom"}
                </div>
              </div>

              <div className="rounded-lg border border-[#303236] bg-[#15171A] p-3">
                <div className="mb-2 flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 text-[#84888C]" />
                  <span className="text-xs font-medium text-white">Flap 规范提示</span>
                </div>
                <p className="text-xs leading-relaxed text-[#5F656D]">
                  模板检查基于 Flap Tax Vault V2 规范。生成代码后请人工复核 Guardian、TWAP、Buyback
                  触发条件等关键逻辑，上线前务必审计。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
