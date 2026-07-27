import { useState, useEffect, useRef } from "react";
import {
  Send,
  Copy,
  Check,
  RefreshCw,
  Monitor,
  Tablet,
  Smartphone,
  Sparkles,
  LayoutTemplate,
  Download,
  Wand2,
  Code2,
  Eye,
} from "lucide-react";
import { DEFAULT_MODEL, sendChatMessage } from "@/lib/kimi";
import { useAppStore } from "@/store";
import { useContractData } from "@/hooks/useContractData";
import { cn } from "@/lib/utils";

type Device = "desktop" | "tablet" | "mobile";

const TEMPLATES = [
  { key: "landing", label: "落地页", icon: LayoutTemplate },
  { key: "dashboard", label: "Dashboard", icon: Monitor },
  { key: "form", label: "表单", icon: LayoutTemplate },
  { key: "product", label: "产品展示", icon: LayoutTemplate },
  { key: "team", label: "团队介绍", icon: LayoutTemplate },
];

const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

const DEVICE_LABELS: Record<Device, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

const EXAMPLE_PROMPT =
  "描述你想要的页面，例如：一个深色风格的 DeFi 仪表盘，包含收益卡片、折线图和交易记录列表";

const PAGE_BUILDER_PROMPT = `你是一名前端开发专家。请根据用户的需求，生成一个完整、独立、可运行的 HTML 文件字符串。

要求：
1. 只返回 HTML 文件内容，不要返回 markdown 代码块标记（如 \`\`\`html），不要任何解释。
2. 必须包含完整的 HTML 结构：<!DOCTYPE html><html><head><body>。
3. 使用 Tailwind CSS CDN：https://cdn.tailwindcss.com
4. 使用原生 JavaScript（<script> 标签内），不要引入 React/Vue/Angular。
5. 页面风格为深色现代科技感，主色调可使用青绿色 #2EDEDB、荧光黄 #D0FF00、暗色背景 #0B0D0E。
6. 布局响应式，内容充实，有真实感的假数据示例。
7. 交互元素（按钮、卡片 hover）添加简单的过渡动画。

请开始生成：`;

export default function PageBuilder() {
  const { addLog, showToast } = useAppStore();
  const { recordPage } = useContractData();

  const [prompt, setPrompt] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("page-builder-code");
    if (saved) setGeneratedCode(saved);
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [prompt]);

  const cleanCode = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.startsWith("```")) {
      return trimmed.replace(/^```(?:html)?\s*([\s\S]*?)```$/, "$1").trim();
    }
    return trimmed;
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    addLog({ type: "info", message: "正在使用 AI 生成页面" });

    try {
      const content = await sendChatMessage({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: PAGE_BUILDER_PROMPT },
          { role: "user", content: prompt.trim() },
        ],
        stream: false,
        temperature: 0.4,
      });

      const code = cleanCode(content);
      setGeneratedCode(code);
      localStorage.setItem("page-builder-code", code);
      setPreviewKey((k) => k + 1);
      recordPage();
      addLog({ type: "success", message: "AI 页面生成成功" });
      showToast({ type: "success", message: "页面生成成功" });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      addLog({ type: "error", message: "AI 页面生成失败", detail });
      showToast({ type: "error", message: "生成失败，请重试" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    showToast({ type: "success", message: "代码已复制" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!generatedCode) return;
    const blob = new Blob([generatedCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "generated-page.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast({ type: "success", message: "HTML 文件已下载" });
  };

  const applyTemplate = (key: string) => {
    const map: Record<string, string> = {
      landing:
        "一个现代深色风格的 Web3 项目落地页，包含 Hero 区域、功能特性三栏卡片、代币经济数据展示和 CTA 按钮。",
      dashboard:
        "一个深色 DeFi 仪表盘，包含总资产卡片、收益趋势折线图、最近交易记录表格和快捷操作按钮。",
      form:
        "一个深色科技风格的代币创建表单，包含输入框、下拉选择、税率滑块和提交按钮，带表单验证提示。",
      product:
        "一个产品展示页面，包含产品大图、特性列表、价格卡片和用户评价卡片。",
      team:
        "一个团队介绍页面，包含团队成员卡片（头像占位、姓名、职位、社交链接）和公司愿景文字。",
    };
    setPrompt(map[key] || "");
  };

  const lineCount = generatedCode.split("\n").length;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 lg:gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="kimi-page-title">AI 页面生成器</h2>
          <p className="kimi-page-subtitle">Page Builder · 描述需求，AI 生成 HTML + Tailwind 页面并实时预览</p>
        </div>
        <div className="flex items-center gap-2">
          {generatedCode && (
            <>
              <button onClick={handleCopy} className="kimi-btn-secondary">
                {copied ? <Check className="h-3.5 w-3.5 text-[#D0FF00]" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "已复制" : "复制代码"}
              </button>
              <button onClick={handleDownload} className="kimi-btn-secondary">
                <Download className="h-3.5 w-3.5" />
                下载
              </button>
            </>
          )}
        </div>
      </div>

      {/* 3-column layout: 25% / 37.5% / 37.5% -> 2/8, 3/8, 3/8 */}
      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-8 lg:overflow-hidden">
        {/* Left: input 25% */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="kimi-card flex flex-1 flex-col">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <Wand2 className="h-4 w-4 text-[#D0FF00]" />
              需求输入
            </h3>

            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={EXAMPLE_PROMPT}
              className="kimi-input min-h-[140px] flex-1 resize-none"
            />

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-[#9CA3AF]">快速模板</p>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => applyTemplate(t.key)}
                    className="flex items-center gap-1.5 rounded-xl border border-[#25282C] bg-[#0A0B0D] px-2.5 py-2 text-xs text-[#9CA3AF] transition-all hover:border-[#D0FF00]/30 hover:text-white"
                  >
                    <t.icon className="h-3 w-3" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || loading}
              className="kimi-btn-primary mt-auto w-full"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  生成中…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  生成页面
                </>
              )}
            </button>
          </div>
        </div>

        {/* Middle: code editor 37.5% */}
        <div className="flex flex-col rounded-2xl border border-[#25282C] bg-[#111215] lg:col-span-3 lg:min-h-0">
          <div className="flex items-center justify-between border-b border-[#25282C] px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Code2 className="h-4 w-4 text-[#2EDEDB]" />
              代码编辑器
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6B7280]">{lineCount} lines</span>
              <span className="rounded-lg bg-[#0A0B0D] px-2 py-0.5 text-xs text-[#9CA3AF]">HTML</span>
            </div>
          </div>

          {/* Line numbers + editor */}
          <div className="relative flex flex-1 overflow-hidden">
            <div className="hidden w-12 select-none overflow-hidden border-r border-[#25282C] bg-[#0A0B0D] py-4 text-right text-xs leading-6 text-[#6B7280] sm:block">
              {Array.from({ length: Math.max(lineCount, 20) }, (_, i) => (
                <div key={i} className="px-2">
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              value={generatedCode}
              onChange={(e) => {
                setGeneratedCode(e.target.value);
                localStorage.setItem("page-builder-code", e.target.value);
              }}
              placeholder="生成的 HTML 代码会显示在这里，你也可以直接编辑…"
              className="flex-1 resize-none bg-[#0A0B0D] p-4 font-mono text-xs leading-6 text-[#E8E8E8] outline-none placeholder:text-[#6B7280] sm:pl-4"
              spellCheck={false}
            />
            {generatedCode && (
              <div className="absolute right-3 top-3 flex gap-2">
                <button
                  onClick={handleCopy}
                  className="rounded-lg border border-[#25282C] bg-[#111215] p-1.5 text-[#9CA3AF] shadow-sm transition-colors hover:text-white"
                  title="复制"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-[#D0FF00]" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={handleDownload}
                  className="rounded-lg border border-[#25282C] bg-[#111215] p-1.5 text-[#9CA3AF] shadow-sm transition-colors hover:text-white"
                  title="下载"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: preview 37.5% */}
        <div className="flex flex-col rounded-2xl border border-[#25282C] bg-[#111215] lg:col-span-3 lg:min-h-0">
          <div className="flex items-center justify-between border-b border-[#25282C] px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Eye className="h-4 w-4 text-[#D0FF00]" />
              实时预览
            </h3>
            <div className="flex items-center gap-1">
              {([
                { key: "desktop", icon: Monitor },
                { key: "tablet", icon: Tablet },
                { key: "mobile", icon: Smartphone },
              ] as { key: Device; icon: typeof Monitor }[]).map((d) => (
                <button
                  key={d.key}
                  onClick={() => setDevice(d.key)}
                  title={DEVICE_LABELS[d.key]}
                  className={cn(
                    "rounded-lg p-1.5 transition-colors",
                    device === d.key
                      ? "bg-[#D0FF00]/10 text-[#D0FF00]"
                      : "text-[#6B7280] hover:text-white"
                  )}
                >
                  <d.icon className="h-4 w-4" />
                </button>
              ))}
              <button
                onClick={() => setPreviewKey((k) => k + 1)}
                title="刷新预览"
                className="ml-1 rounded-lg p-1.5 text-[#6B7280] transition-colors hover:text-white"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Mobile tab switcher */}
          <div className="flex border-b border-[#25282C] lg:hidden">
            {[
              { key: "code", label: "代码", icon: Code2 },
              { key: "preview", label: "预览", icon: Eye },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as typeof activeTab)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-medium transition-colors",
                  activeTab === t.key
                    ? "border-b-2 border-[#D0FF00] text-[#D0FF00]"
                    : "text-[#6B7280]"
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-auto bg-[#0A0B0D] p-4">
            {generatedCode ? (
              <div
                className={cn(
                  "h-full overflow-hidden rounded-xl border border-[#303236] bg-white transition-all",
                  device === "mobile" && "border-[8px] border-[#1A1D21] shadow-2xl",
                  device === "tablet" && "border-[6px] border-[#1A1D21] shadow-2xl"
                )}
                style={{ width: DEVICE_WIDTHS[device] }}
              >
                <iframe
                  key={previewKey}
                  srcDoc={generatedCode}
                  sandbox="allow-scripts"
                  className="h-full w-full"
                  title="Generated page preview"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 px-6 text-center text-[#6B7280]">
                <div className="kimi-empty-icon">
                  <Monitor className="h-7 w-7" />
                </div>
                <p className="text-sm">在左侧输入需求并点击「生成页面」</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
