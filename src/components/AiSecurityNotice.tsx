import { ShieldCheck } from "lucide-react";

export function AiSecurityNotice() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[#2EDEDB]/25 bg-[#2EDEDB]/5 px-3 py-2.5 text-xs leading-relaxed text-[#7DE9E7]">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
      <span>AI 功能需要钱包签名并持有至少 20,000 KIMI；签名只用于防盗刷，不会发送交易或扣币。</span>
    </div>
  );
}
