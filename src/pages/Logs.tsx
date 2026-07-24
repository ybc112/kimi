import { useAppStore } from "@/store";
import { ScrollText, Trash2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Logs() {
  const { logs, clearLogs } = useAppStore();

  const typeIcon = {
    info: Info,
    error: AlertCircle,
    success: CheckCircle2,
  };

  const typeColor = {
    info: "text-[#2EDEDB] bg-[#2EDEDB]/10",
    error: "text-[#FF6B6B] bg-[#FF6B6B]/10",
    success: "text-[#D0FF00] bg-[#D0FF00]/10",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">服务日志</h2>
          <p className="mt-1 text-sm text-[#84888C]">记录 API 调用、错误与系统事件</p>
        </div>
        {logs.length > 0 && (
          <button
            onClick={clearLogs}
            className="flex items-center gap-2 rounded-lg border border-[#303236] px-4 py-2 text-sm text-[#9CA3AF] transition-colors hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
            清空日志
          </button>
        )}
      </div>

      <div className="rounded-xl border border-[#23262A] bg-[#15171A]">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#23262A]">
              <ScrollText className="h-6 w-6 text-[#5F656D]" />
            </div>
            <p className="text-sm text-[#5F656D]">暂无日志</p>
            <p className="text-xs text-[#5F656D]">在「金库生成」页面与 Kimi 交互后将产生记录</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#23262A]">
            {logs.map((log) => {
              const Icon = typeIcon[log.type];
              return (
                <li key={log.id} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", typeColor[log.type])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-white">{log.message}</span>
                        <span className="text-xs text-[#5F656D]">
                          {new Date(log.timestamp).toLocaleString("zh-CN")}
                        </span>
                      </div>
                      {log.detail && (
                        <p className="mt-1 break-words text-xs text-[#84888C]">{log.detail}</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
