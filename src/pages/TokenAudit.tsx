import { useState } from "react";
import { Search, Shield, AlertTriangle, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { ethers } from "ethers";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { analyzeTokenSafety, scoreColor, scoreBg, scoreLabel } from "@/lib/audit/tokenSafety";
import type { TokenSafetyReport } from "@/types";

const EXPLORER = "https://bscscan.com/token";

export default function TokenAudit() {
  const { showToast } = useAppStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<TokenSafetyReport | null>(null);

  const handleCheck = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      showToast({ type: "error", message: "请输入代币地址" });
      return;
    }
    if (!ethers.isAddress(trimmed)) {
      showToast({ type: "error", message: "请输入合法的 BSC 地址" });
      return;
    }

    setLoading(true);
    setReport(null);

    try {
      const result = await analyzeTokenSafety(trimmed);
      setReport(result);
      showToast({
        type: result.isHoneypot ? "error" : "success",
        message: result.isHoneypot ? "检测到 Honeypot 风险" : `安全评分：${result.score} · ${scoreLabel(result.score)}`,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      showToast({ type: "error", message: detail || "检测失败" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-6">
      <div>
        <h2 className="kimi-page-title">代币安全检测</h2>
        <p className="kimi-page-subtitle">Honeypot 检测器 · Kimi Score · BSC 链上合约风险扫描</p>
      </div>

      <div className="kimi-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-2 block text-xs font-medium text-[#9CA3AF]">BSC 代币合约地址</label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="0x..."
              className="kimi-input font-mono"
            />
          </div>
          <button
            onClick={handleCheck}
            disabled={loading}
            className="kimi-btn-primary min-w-[120px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                检测中
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                开始检测
              </>
            )}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: "检测维度", value: "Owner / Mint / 黑名单 / 税率 / LP / 交易模拟" },
            { label: "目标网络", value: "BNB Smart Chain" },
            { label: "注意", value: "结果仅供参考，不构成投资建议" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-[#25282C] bg-[#0A0B0D] p-3">
              <p className="text-xs text-[#6B7280]">{item.label}</p>
              <p className="mt-1 text-sm text-[#E8E8E8]">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {report && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="kimi-card lg:col-span-1">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#D0FF00]" />
                <h3 className="font-semibold text-white">Kimi Score</h3>
              </div>
              <a
                href={`${EXPLORER}/${report.address}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#2EDEDB] hover:underline"
              >
                BscScan <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-2xl border p-6",
                scoreBg(report.score)
              )}
            >
              <span className={cn("text-5xl font-bold", scoreColor(report.score))}>{report.score}</span>
              <span className={cn("mt-1 text-sm font-medium", scoreColor(report.score))}>
                {scoreLabel(report.score)}
              </span>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#9CA3AF]">Honeypot</span>
                <span
                  className={cn(
                    "font-medium",
                    report.isHoneypot === true ? "text-[#FF6B6B]" : report.isHoneypot === false ? "text-[#D0FF00]" : "text-[#9CA3AF]"
                  )}
                >
                  {report.isHoneypot === true ? "疑似" : report.isHoneypot === false ? "未发现" : "未知"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#9CA3AF]">可卖出</span>
                <span
                  className={cn(
                    "font-medium",
                    report.canSell === true ? "text-[#D0FF00]" : report.canSell === false ? "text-[#FF6B6B]" : "text-[#9CA3AF]"
                  )}
                >
                  {report.canSell === true ? "是" : report.canSell === false ? "否" : "未知"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#9CA3AF]">Owner</span>
                <span className={cn("font-medium", report.ownerRenounced ? "text-[#D0FF00]" : "text-[#F59E0B]")}>
                  {report.ownerRenounced ? "已放弃" : report.owner ? `${report.owner.slice(0, 8)}...${report.owner.slice(-6)}` : "未知"}
                </span>
              </div>
              {report.buyTaxBp !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#9CA3AF]">买入税</span>
                  <span className="font-medium text-white">{report.buyTaxBp / 100}%</span>
                </div>
              )}
              {report.sellTaxBp !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#9CA3AF]">卖出税</span>
                  <span className="font-medium text-white">{report.sellTaxBp / 100}%</span>
                </div>
              )}
            </div>
          </div>

          <div className="kimi-card lg:col-span-2">
            <h3 className="mb-4 font-semibold text-white">维度详情</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {report.dimensions.map((dim, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-3",
                    dim.pass ? "border-[#25282C] bg-[#0A0B0D]" : "border-[#FF6B6B]/30 bg-[#FF6B6B]/10"
                  )}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-[#E8E8E8]">{dim.name}</span>
                    <span className="text-[10px] text-[#6B7280]">{dim.message}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {dim.pass ? (
                      <CheckCircle2 className="h-4 w-4 text-[#D0FF00]" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-[#FF6B6B]" />
                    )}
                    <span className={cn("text-sm font-bold", dim.pass ? "text-[#D0FF00]" : "text-[#FF6B6B]")}>
                      {dim.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {report.warnings.length > 0 && (
              <div className="mt-6 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                  <span className="text-sm font-semibold text-[#F59E0B]">风险提示</span>
                </div>
                <ul className="list-disc space-y-1 pl-4 text-xs text-[#E8E8E8]">
                  {report.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 rounded-xl border border-[#25282C] bg-[#0A0B0D] p-4">
              <p className="text-xs leading-relaxed text-[#6B7280]">
                本检测基于链上静态分析与 PancakeSwap Router 模拟调用，仅供参考。某些复杂合约（如代理合约、自定义 Router、白名单开盘期）可能导致误判。投资前请通过多个工具交叉验证，并自行承担风险。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
