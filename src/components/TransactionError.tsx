import { AlertCircle } from "lucide-react";

interface TransactionErrorProps {
  summary: string;
  details?: string;
}

export function TransactionError({ summary, details }: TransactionErrorProps) {
  return (
    <div className="rounded-xl border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 p-3 text-[#FF6B6B]">
      <div className="flex items-start gap-2 text-sm font-medium">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="min-w-0 break-words">{summary}</span>
      </div>
      {details && details !== summary && (
        <details className="mt-2 pl-6 text-xs text-[#FF9B9B]">
          <summary className="cursor-pointer select-none">查看技术详情</summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/20 p-2 font-mono leading-relaxed">
            {details}
          </pre>
        </details>
      )}
    </div>
  );
}
