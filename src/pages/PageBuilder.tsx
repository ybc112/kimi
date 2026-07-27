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
} from "lucide-react";
import { DEFAULT_MODEL, sendChatMessage } from "@/lib/kimi";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";

type Device = "desktop" | "tablet" | "mobile";

const TEMPLATES = [
  { key: "landing", label: "落地页" },
  { key: "dashboard", label: "Dashboard" },
  { key: "form", label: "表单" },
  { key: "product", label: "产品展示" },
  { key: "team", label: "团队介绍" },
];

const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
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

  const [prompt, setPrompt] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("page-builder-code");
    if (saved) setGeneratedCode(saved);
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
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

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">AI 页面生成器</h2>
          <p className="text-xs text-[#84888C]">描述需求，AI 生成 HTML + Tailwind 页面并实时预览</p>
        </div>
        <div className="flex items-center gap-2">
          {generatedCode && (
            <>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg border border-[#303236] bg-[#15171A] px-3 py-2 text-xs text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-[#D0FF00]" /> : <Copy className="h-3.5 w-3.5" />}
                复制代码
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-lg border border-[#303236] bg-[#15171A] px-3 py-2 text-xs text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white"
              >
                <Download className="h-3.5 w-3.5" />
                下载
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-12 lg:overflow-hidden">
        {/* Left: input */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          <div className="flex flex-1 flex-col rounded-xl border border-[#23262A] bg-[#15171A] p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <Wand2 className="h-4 w-4 text-[#D0FF00]" />
              需求输入
            </h3>

            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={EXAMPLE_PROMPT}
              className="min-h-[120px] w-full resize-none rounded-lg border border-[#303236] bg-[#0B0D0E] p-3 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D]"
            />

            <div className="mt-4">
              <p className="mb-2 text-xs text-[#84888C]">快速模板</p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => applyTemplate(t.key)}
                    className="flex items-center gap-1.5 rounded-full border border-[#303236] bg-[#0B0D0E] px-2.5 py-1 text-xs text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white"
                  >
                    <LayoutTemplate className="h-3 w-3" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || loading}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-[#D0FF00] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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

        {/* Middle: code editor */}
        <div className="flex flex-col rounded-xl border border-[#23262A] bg-[#15171A] lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[#23262A] px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-white">
              <Sparkles className="h-4 w-4 text-[#2EDEDB]" />
              代码编辑器
            </h3>
            <span className="text-xs text-[#5F656D]">HTML</span>
          </div>
          <textarea
            value={generatedCode}
            onChange={(e) => {
              setGeneratedCode(e.target.value);
              localStorage.setItem("page-builder-code", e.target.value);
            }}
            placeholder="生成的 HTML 代码会显示在这里，你也可以直接编辑…"
            className="flex-1 min-h-[300px] w-full resize-none bg-[#0B0D0E] p-4 font-mono text-xs leading-relaxed text-[#E8E8E8] outline-none placeholder:text-[#5F656D] lg:min-h-0"
            spellCheck={false}
          />
        </div>

        {/* Right: preview */}
        <div className="flex flex-col rounded-xl border border-[#23262A] bg-[#15171A] lg:col-span-4">
          <div className="flex items-center justify-between border-b border-[#23262A] px-4 py-3">
            <h3 className="text-sm font-medium text-white">实时预览</h3>
            <div className="flex items-center gap-1">
              {([
                { key: "desktop", icon: Monitor, label: "Desktop" },
                { key: "tablet", icon: Tablet, label: "Tablet" },
                { key: "mobile", icon: Smartphone, label: "Mobile" },
              ] as { key: Device; icon: typeof Monitor; label: string }[]).map((d) => (
                <button
                  key={d.key}
                  onClick={() => setDevice(d.key)}
                  title={d.label}
                  className={cn(
                    "rounded-lg p-1.5 transition-colors",
                    device === d.key
                      ? "bg-[#D0FF00]/10 text-[#D0FF00]"
                      : "text-[#5F656D] hover:text-white"
                  )}
                >
                  <d.icon className="h-4 w-4" />
                </button>
              ))}
              <button
                onClick={() => setPreviewKey((k) => k + 1)}
                title="刷新预览"
                className="ml-1 rounded-lg p-1.5 text-[#5F656D] transition-colors hover:text-white"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-auto bg-[#0B0D0E] p-3">
            {generatedCode ? (
              <div
                className="h-full overflow-hidden rounded-lg border border-[#303236] bg-white transition-all"
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
              <div className="flex flex-col items-center justify-center gap-3 px-6 text-center text-[#5F656D]">
                <Monitor className="h-10 w-10 text-[#303236]" />
                <p className="text-sm">在左侧输入需求并点击「生成页面」</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
