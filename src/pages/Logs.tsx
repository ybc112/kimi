import { useState, useMemo } from "react";
import { useAppStore } from "@/store";
import { ScrollText, Trash2, AlertCircle, CheckCircle2, Info, Download, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LogEntry } from "@/types";

type LogType = LogEntry["type"] | "all";

export default function Logs() {
  const { logs, clearLogs, showToast } = useAppStore();
  const [typeFilter, setTypeFilter] = useState<LogType>("all");

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

  const filteredLogs = useMemo(() => {
    if (typeFilter === "all") return logs;
    return logs.filter((log) => log.type === typeFilter);
  }, [logs, typeFilter]);

  const exportCsv = () => {
    if (logs.length === 0) {
      showToast({ type: "info", message: "暂无日志可导出" });
      return;
    }
    const rows = [
      ["时间", "类型", "消息", "详情"],
      ...logs.map((log) => [
        new Date(log.timestamp).toLocaleString("zh-CN"),
        log.type,
        log.message,
        log.detail || "",
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast({ type: "success", message: "日志已导出 CSV" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">服务日志</h2>
          <p className="mt-1 text-sm text-[#84888C]">记录 API 调用、错误与系统事件</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-lg border border-[#303236] bg-[#15171A] p-1">
            <Filter className="ml-2 h-3.5 w-3.5 text-[#5F656D]" />
            {(["all", "info", "success", "error"] as LogType[]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  typeFilter === t
                    ? "bg-[#D0FF00]/10 text-[#D0FF00]"
                    : "text-[#9CA3AF] hover:text-white"
                )}
              >
                {t === "all" ? "全部" : t === "info" ? "信息" : t === "success" ? "成功" : "错误"}
              </button>
            ))}
          </div>
          <button
            onClick={exportCsv}
            className="flex items-center justify-center gap-2 rounded-lg border border-[#303236] bg-[#15171A] px-4 py-2 text-sm text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white"
          >
            <Download className="h-4 w-4" />
            导出 CSV
          </button>
          {logs.length > 0 && (
            <button
              onClick={clearLogs}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#303236] bg-[#15171A] px-4 py-2 text-sm text-[#9CA3AF] transition-colors hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
              清空日志
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#23262A] bg-[#15171A]">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#23262A]">
              <ScrollText className="h-6 w-6 text-[#5F656D]" />
            </div>
            <p className="text-sm text-[#5F656D]">
              {logs.length === 0 ? "暂无日志" : "没有符合筛选条件的日志"}
            </p>
            <p className="text-xs text-[#5F656D]">在「金库生成」页面与 Kimi 交互后将产生记录</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#23262A]">
            {filteredLogs.map((log) => {
              const Icon = typeIcon[log.type];
              return (
                <li key={log.id} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", typeColor[log.type])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
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
