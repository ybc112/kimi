import { useState, useMemo } from "react";
import { Shield, AlertTriangle, CheckCircle2, Loader2, FileSearch, Lock, Unlock, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";
import { auditSolidityCode, severityColor, severityBg } from "@/lib/audit/solidityAudit";
import type { AuditReport, AuditSeverity } from "@/types";

interface AuditReportPanelProps {
  code: string;
  required?: boolean;
  onAudit?: (report: AuditReport) => void;
}

export function AuditReportPanel({ code, required = false, onAudit }: AuditReportPanelProps) {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAudit = () => {
    if (!code || loading) return;
    setLoading(true);
    // Run asynchronously to keep UI responsive for large code.
    setTimeout(() => {
      const result = auditSolidityCode(code);
      setReport(result);
      onAudit?.(result);
      setLoading(false);
    }, 50);
  };

  const counts = useMemo(() => {
    if (!report) return null;
    const severityOrder: AuditSeverity[] = ["critical", "high", "medium", "low", "info"];
    return severityOrder.map((severity) => ({
      severity,
      count: report.findings.filter((f) => f.severity === severity).length,
    }));
  }, [report]);

  return (
    <div className="rounded-xl border border-[#25282C] bg-[#0A0B0D] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#D0FF00]" />
          <h4 className="text-sm font-semibold text-white">AI 合约审计</h4>
        </div>
        <button
          onClick={handleAudit}
          disabled={!code || loading}
          className="kimi-btn-secondary py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              审计中
            </>
          ) : (
            <>
              <FileSearch className="h-3.5 w-3.5" />
              {report ? "重新审计" : "开始审计"}
            </>
          )}
        </button>
      </div>

      {!report ? (
        <div className="space-y-3">
          <p className="text-xs text-[#6B7280]">
            点击「开始审计」对当前 Solidity 代码进行静态扫描，覆盖重入、权限、税率溢出、除零、Owner 权限等 17 项规则。
          </p>
          {required && (
            <div className="flex items-center gap-2 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2 text-xs text-[#F59E0B]">
              <AlertTriangle className="h-3.5 w-3.5" />
              部署前必须通过审计（无 critical/high 问题且分数 ≥ 70）。
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div
            className={cn(
              "rounded-xl border p-3",
              report.passed
                ? "border-[#D0FF00]/30 bg-[#D0FF00]/10"
                : report.score >= 50
                  ? "border-[#F59E0B]/30 bg-[#F59E0B]/10"
                  : "border-[#FF6B6B]/30 bg-[#FF6B6B]/10"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {report.passed ? (
                  <CheckCircle2 className="h-5 w-5 text-[#D0FF00]" />
                ) : report.score >= 50 ? (
                  <AlertTriangle className="h-5 w-5 text-[#F59E0B]" />
                ) : (
                  <AlertOctagon className="h-5 w-5 text-[#FF6B6B]" />
                )}
                <span className="text-sm font-medium text-white">
                  {report.passed ? "审计通过" : report.score >= 50 ? "存在风险" : "审计未通过"}
                </span>
              </div>
              <span
                className={cn(
                  "text-xl font-bold",
                  report.passed ? "text-[#D0FF00]" : report.score >= 50 ? "text-[#F59E0B]" : "text-[#FF6B6B]"
                )}
              >
                {report.score}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#E8E8E8]">{report.summary}</p>
          </div>

          {counts && (
            <div className="grid grid-cols-5 gap-1.5">
              {counts.map(({ severity, count }) => (
                <div
                  key={severity}
                  className={cn(
                    "flex flex-col items-center rounded-lg border px-1 py-2",
                    count > 0 ? severityBg(severity) : "border-[#25282C] bg-[#111215]"
                  )}
                >
                  <span className={cn("text-sm font-bold", count > 0 ? severityColor(severity) : "text-[#6B7280]")}>
                    {count}
                  </span>
                  <span className="text-[9px] uppercase text-[#6B7280]">{severity}</span>
                </div>
              ))}
            </div>
          )}

          {required && !report.passed && (
            <div className="flex items-center gap-2 rounded-lg border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 px-3 py-2 text-xs text-[#FF6B6B]">
              <Lock className="h-3.5 w-3.5" />
              当前代码未通过审计，无法继续部署。请修复 critical/high 问题。
            </div>
          )}

          {required && report.passed && (
            <div className="flex items-center gap-2 rounded-lg border border-[#D0FF00]/30 bg-[#D0FF00]/10 px-3 py-2 text-xs text-[#D0FF00]">
              <Unlock className="h-3.5 w-3.5" />
              审计通过，允许部署。
            </div>
          )}

          <div className="max-h-[240px] space-y-2 overflow-auto pr-1">
            {report.findings.length === 0 ? (
              <p className="text-center text-xs text-[#6B7280]">未发现明显问题</p>
            ) : (
              report.findings.map((finding, index) => (
                <div
                  key={index}
                  className={cn(
                    "rounded-lg border p-3",
                    severityBg(finding.severity)
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("text-xs font-semibold", severityColor(finding.severity))}>
                      {finding.rule}
                    </span>
                    <span className="shrink-0 rounded bg-[#0A0B0D] px-1.5 py-0.5 text-[10px] uppercase text-[#9CA3AF]">
                      {finding.severity}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#E8E8E8]">{finding.message}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#6B7280]">
                    建议：{finding.suggestion}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
