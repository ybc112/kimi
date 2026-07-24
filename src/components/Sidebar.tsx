import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  ScrollText,
} from "lucide-react";
import { KimiIcon } from "@/components/KimiIcon";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "仪表盘" },
  { to: "/chat", icon: MessageSquare, label: "金库生成" },
  { to: "/docs", icon: FileText, label: "规范文档" },
  { to: "/logs", icon: ScrollText, label: "服务日志" },
];

export function Sidebar() {
  return (
    <aside className="flex w-64 flex-col border-r border-[#23262A] bg-[#111215]">
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D0FF00]">
          <KimiIcon size={20} className="text-black" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white">Kimi</h1>
          <p className="text-xs text-[#84888C]">Flap Vault 合约生成器</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#1A1D21] text-[#D0FF00]"
                      : "text-[#9CA3AF] hover:bg-[#1A1D21] hover:text-white"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-[#23262A] p-4">
        <p className="text-xs text-[#5F656D]">v0.1.0 · Kimi 驱动</p>
      </div>
    </aside>
  );
}
