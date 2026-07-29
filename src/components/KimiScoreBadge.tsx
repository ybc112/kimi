import { useEffect, useState } from "react";
import { Shield, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ethers } from "ethers";
import { cn } from "@/lib/utils";
import { analyzeTokenSafety, scoreColor, scoreBg, scoreLabel } from "@/lib/audit/tokenSafety";
import type { TokenSafetyReport } from "@/types";

interface KimiScoreBadgeProps {
  address: string;
  chainId?: number;
  onReport?: (report: TokenSafetyReport) => void;
  size?: "sm" | "md";
  detailed?: boolean;
}

export function KimiScoreBadge({
  address,
  chainId = 56,
  onReport,
  size = "sm",
  detailed = false,
}: KimiScoreBadgeProps) {
  const [report, setReport] = useState<TokenSafetyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!address || !ethers.isAddress(address) || chainId !== 56) {
        setReport(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await analyzeTokenSafety(address);
        if (!cancelled) {
          setReport(result);
          onReport?.(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [address, chainId, onReport]);

  if (chainId !== 56) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#25282C] bg-[#111215] px-2 py-0.5 text-[10px] text-[#6B7280]">
        暂不支持
      </span>
    );
  }

  if (loading || (!report && !error)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#25282C] bg-[#111215] px-2 py-0.5 text-[10px] text-[#9CA3AF]">
        <Loader2 className="h-3 w-3 animate-spin" />
        评分中
      </span>
    );
  }

  if (error || !report) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-2 py-0.5 text-[10px] text-[#F59E0B]">
        <AlertTriangle className="h-3 w-3" />
        评分失败
      </span>
    );
  }

  const iconSize = size === "md" ? "h-4 w-4" : "h-3 w-3";
  const textSize = size === "md" ? "text-xs" : "text-[10px]";

  return (
    <div className={cn("inline-flex flex-col gap-2", detailed && "w-full")}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
          textSize,
          scoreBg(report.score)
        )}
      >
        {report.score >= 80 ? (
          <CheckCircle2 className={cn(iconSize, scoreColor(report.score))} />
        ) : (
          <Shield className={cn(iconSize, scoreColor(report.score))} />
        )}
        <span className={scoreColor(report.score)}>Kimi {report.score}</span>
        <span className="text-[#6B7280]">·</span>
        <span className={scoreColor(report.score)}>{scoreLabel(report.score)}</span>
      </span>

      {detailed && (
        <div className="space-y-1.5 rounded-xl border border-[#25282C] bg-[#0A0B0D] p-2.5">
          {report.dimensions.map((dim, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-[#9CA3AF]">{dim.name}</span>
              <span className={cn("font-medium", dim.pass ? "text-[#D0FF00]" : "text-[#FF6B6B]")}>
                {dim.pass ? "通过" : "未通过"}
              </span>
            </div>
          ))}
          {report.warnings.length > 0 && (
            <div className="mt-2 space-y-1 border-t border-[#25282C] pt-2">
              {report.warnings.map((warning, idx) => (
                <p key={idx} className="text-[10px] text-[#F59E0B]">
                  {warning}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
