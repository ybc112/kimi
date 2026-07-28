import { ExternalLink, ShieldCheck } from "lucide-react";
import { KIMI_TOKEN_ADDRESS } from "@/lib/contracts/kimiToken";

export function AiSecurityNotice() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[#2EDEDB]/25 bg-[#2EDEDB]/5 px-3 py-2.5 text-xs leading-relaxed text-[#7DE9E7]">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        AI 功能需要钱包签名并持有至少 200,000 官方 KIMI；签名只用于防盗刷，不会发送交易或扣币。
        <a
          href={`https://bscscan.com/token/${KIMI_TOKEN_ADDRESS}`}
          target="_blank"
          rel="noreferrer"
          className="ml-1 inline-flex items-center gap-0.5 underline decoration-dotted underline-offset-2 hover:text-white"
        >
          核对合约 <ExternalLink className="h-3 w-3" />
        </a>
      </span>
    </div>
  );
}
