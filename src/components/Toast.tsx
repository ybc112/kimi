import { useEffect } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";

export function Toast() {
  const { toast, hideToast } = useAppStore();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => hideToast(), toast.duration ?? 2500);
    return () => clearTimeout(timer);
  }, [toast, hideToast]);

  if (!toast) return null;

  const Icon =
    toast.type === "success" ? CheckCircle : toast.type === "error" ? AlertCircle : Info;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] toast-enter sm:bottom-6 sm:left-auto sm:right-6">
      <div
        className={cn(
          "mx-auto flex w-full max-w-md items-center gap-3 rounded-xl border px-4 py-3 shadow-xl sm:mx-0",
          toast.type === "success" && "border-[#D0FF00]/30 bg-[#15171A] text-[#D0FF00]",
          toast.type === "error" && "border-[#FF6B6B]/30 bg-[#15171A] text-[#FF6B6B]",
          toast.type === "info" && "border-[#2EDEDB]/30 bg-[#15171A] text-[#2EDEDB]"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1 break-words text-sm font-medium text-white">
          {toast.message}
        </span>
        <button
          onClick={hideToast}
          className="ml-2 shrink-0 text-[#9CA3AF] transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
