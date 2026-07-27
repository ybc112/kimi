import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

interface EmptyProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export default function Empty({
  title = "暂无数据",
  subtitle = "当前列表为空",
  action,
  className,
  icon,
}: EmptyProps) {
  return (
    <div className={cn("kimi-empty", className)}>
      <div className="kimi-empty-icon">{icon ?? <Inbox className="h-7 w-7" />}</div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="max-w-xs text-sm text-[#9CA3AF]">{subtitle}</p>
      {action}
    </div>
  );
}
