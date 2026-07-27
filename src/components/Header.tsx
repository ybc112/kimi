import { useState, useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Box,
  Rocket,
  CircleDollarSign,
  List,
  TrendingUp,
  FileText,
  ScrollText,
  Wallet,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Wand2,
} from "lucide-react";
import { KimiIcon } from "@/components/KimiIcon";
import { useWallet } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "首页" },
  { to: "/chat", icon: MessageSquare, label: "对话" },
  { to: "/vault", icon: Box, label: "金库生成" },
  { to: "/page-builder", icon: Wand2, label: "AI 页面" },
  { to: "/deploy", icon: Rocket, label: "合约部署" },
  { to: "/flap-launch", icon: CircleDollarSign, label: "Flap 发币" },
  { to: "/issued-tokens", icon: List, label: "已发代币" },
  { to: "/trending", icon: TrendingUp, label: "热搜榜" },
  { to: "/docs", icon: FileText, label: "规范文档" },
  { to: "/logs", icon: ScrollText, label: "服务日志" },
];

export function Header() {
  const wallet = useWallet();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayNetwork =
    wallet.chainId === 56
      ? "BNB Smart Chain"
      : wallet.chainId === 1
        ? "Ethereum"
        : wallet.chainId === 42161
          ? "Arbitrum One"
          : wallet.chainId === 8453
            ? "Base"
            : wallet.chainId
              ? `Chain ${wallet.chainId}`
              : "";

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[#23262A] bg-[#0B0D0E]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 lg:px-6">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-3 shrink-0">
            <KimiIcon size={36} className="h-9 w-9 rounded-lg" />
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold leading-tight text-white">Kimi</h1>
              <p className="text-[10px] font-medium tracking-wide text-[#84888C]">FLAP VAULT - V2</p>
            </div>
          </NavLink>

          {/* Desktop Nav */}
          <nav className="hidden xl:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#1A1D21] text-[#D0FF00]"
                      : "text-[#9CA3AF] hover:bg-[#1A1D21] hover:text-white"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right side status & wallet */}
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="hidden md:flex items-center gap-3 text-xs text-[#84888C]">
              <span>v1.0</span>
              <span className="flex items-center gap-1.5 rounded-full border border-[#23262A] bg-[#15171A] px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2EDEDB] animate-pulse" />
                ONLINE
              </span>
            </div>

            {!wallet.isConnected ? (
              <button
                onClick={wallet.connectWallet}
                disabled={wallet.loading}
                className="flex items-center gap-2 rounded-lg bg-[#D0FF00] px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {wallet.loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                ) : (
                  <Wallet className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">连接钱包</span>
                <span className="sm:hidden">连接</span>
              </button>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                    wallet.isBSC
                      ? "border-[#D0FF00]/30 bg-[#D0FF00]/10 text-[#D0FF00]"
                      : "border-[#FF6B6B]/30 bg-[#FF6B6B]/10 text-[#FF6B6B]"
                  )}
                >
                  <Wallet className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {wallet.account?.slice(0, 6)}...{wallet.account?.slice(-4)}
                  </span>
                  <span className="sm:hidden">
                    {wallet.account?.slice(0, 4)}...{wallet.account?.slice(-2)}
                  </span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", dropdownOpen && "rotate-180")} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[#23262A] bg-[#15171A] p-3 shadow-xl">
                    <div className="mb-3 space-y-2 border-b border-[#23262A] pb-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#84888C]">地址</span>
                        <span className="font-mono text-white">{wallet.account?.slice(0, 10)}...{wallet.account?.slice(-8)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#84888C]">网络</span>
                        <span className={wallet.isBSC ? "text-[#D0FF00]" : "text-[#FF6B6B]"}>
                          {displayNetwork || "未知网络"}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        wallet.disconnectWallet();
                        setDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#303236] bg-[#0B0D0E] py-2 text-xs text-[#9CA3AF] transition-colors hover:text-white"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      断开连接
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(true)}
              className="xl:hidden rounded-lg p-2 text-[#9CA3AF] transition-colors hover:bg-[#1A1D21] hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay nav */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-72 border-l border-[#23262A] bg-[#111215]">
            <div className="flex items-center justify-between border-b border-[#23262A] px-5 py-4">
              <div className="flex items-center gap-3">
                <KimiIcon size={32} className="h-8 w-8 rounded-lg" />
                <div>
                  <h1 className="text-sm font-bold text-white">Kimi</h1>
                  <p className="text-[10px] text-[#84888C]">FLAP VAULT - V2</p>
                </div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-[#9CA3AF] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="p-3">
              <ul className="space-y-1">
                {navItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
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
            <div className="absolute bottom-0 left-0 right-0 border-t border-[#23262A] p-4">
              <div className="flex items-center justify-between text-xs text-[#84888C]">
                <span>v1.0</span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#2EDEDB]" />
                  ONLINE
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
