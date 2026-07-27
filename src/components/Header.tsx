import { useState, useRef, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Box,
  Wand2,
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
  MoreHorizontal,
  Zap,
} from "lucide-react";
import { KimiIcon } from "@/components/KimiIcon";
import { useWallet } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { to: "/", icon: LayoutDashboard, label: "首页" },
  { to: "/vault", icon: Box, label: "金库生成" },
  { to: "/page-builder", icon: Wand2, label: "AI 网页" },
  { to: "/deploy", icon: Rocket, label: "合约部署" },
  { to: "/flap-launch", icon: CircleDollarSign, label: "Flap 发币" },
  { to: "/issued-tokens", icon: List, label: "已发代币" },
  { to: "/trending", icon: TrendingUp, label: "热搜榜" },
];

const moreNavItems = [
  { to: "/docs", icon: FileText, label: "规范文档" },
  { to: "/logs", icon: ScrollText, label: "服务日志" },
  { to: "/meme-launch", icon: Zap, label: "Meme 发射" },
];

export function Header() {
  const wallet = useWallet();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
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

  const isMoreActive = moreNavItems.some((item) => location.pathname === item.to);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[#25282C] bg-[#0A0B0D]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 lg:px-6">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-3 shrink-0">
            <KimiIcon size={36} className="h-9 w-9 rounded-xl" />
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold leading-tight text-white">Kimi</h1>
              <p className="text-[10px] font-medium tracking-wide text-[#6B7280]">FLAP VAULT - V2</p>
            </div>
          </NavLink>

          {/* Desktop Nav */}
          <nav className="hidden xl:flex items-center gap-1">
            {mainNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "text-[#D0FF00]"
                      : "text-[#9CA3AF] hover:bg-[#1A1D21] hover:text-white"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    {isActive && (
                      <span className="absolute -bottom-[13px] left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-[#D0FF00]" />
                    )}
                  </>
                )}
              </NavLink>
            ))}

            {/* More dropdown */}
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className={cn(
                  "relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  isMoreActive ? "text-[#D0FF00]" : "text-[#9CA3AF] hover:bg-[#1A1D21] hover:text-white"
                )}
              >
                <MoreHorizontal className="h-4 w-4" />
                更多
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")} />
                {isMoreActive && (
                  <span className="absolute -bottom-[13px] left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-[#D0FF00]" />
                )}
              </button>

              {moreOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[#25282C] bg-[#111215] p-2 shadow-xl">
                  {moreNavItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-[#D0FF00]/10 text-[#D0FF00]"
                            : "text-[#9CA3AF] hover:bg-[#1A1D21] hover:text-white"
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Right side status & wallet */}
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="hidden md:flex items-center gap-3 text-xs text-[#6B7280]">
              <span>v1.0</span>
              <span className="flex items-center gap-1.5 rounded-full border border-[#25282C] bg-[#111215] px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2EDEDB] animate-pulse" />
                ONLINE
              </span>
            </div>

            {!wallet.isConnected ? (
              <button
                onClick={wallet.connectWallet}
                disabled={wallet.loading}
                className="flex items-center gap-2 rounded-xl bg-[#D0FF00] px-4 py-2 text-sm font-semibold text-black transition-all hover:brightness-110 hover:scale-[1.02] disabled:opacity-50"
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
                  className="flex items-center gap-2 rounded-xl border border-[#25282C] bg-[#111215] px-3 py-2 text-sm text-white transition-all hover:border-[#D0FF00]/30 hover:bg-[#1A1D21]"
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      wallet.isBSC ? "bg-[#D0FF00]" : "bg-[#FF6B6B]"
                    )}
                  />
                  <span className="hidden sm:inline">
                    {wallet.account?.slice(0, 6)}...{wallet.account?.slice(-4)}
                  </span>
                  <span className="sm:hidden">
                    {wallet.account?.slice(0, 4)}...{wallet.account?.slice(-2)}
                  </span>
                  <ChevronDown className={cn("h-3.5 w-3.5 text-[#9CA3AF] transition-transform", dropdownOpen && "rotate-180")} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-[#25282C] bg-[#111215] p-3 shadow-xl">
                    <div className="mb-3 space-y-2 border-b border-[#25282C] pb-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#6B7280]">地址</span>
                        <span className="font-mono text-white">{wallet.account?.slice(0, 10)}...{wallet.account?.slice(-8)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#6B7280]">网络</span>
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
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#25282C] bg-[#0A0B0D] py-2 text-xs text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white"
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
              className="xl:hidden rounded-xl p-2 text-[#9CA3AF] transition-colors hover:bg-[#1A1D21] hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay nav */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-80 border-l border-[#25282C] bg-[#111215]">
            <div className="flex items-center justify-between border-b border-[#25282C] px-5 py-4">
              <div className="flex items-center gap-3">
                <KimiIcon size={32} className="h-8 w-8 rounded-xl" />
                <div>
                  <h1 className="text-sm font-bold text-white">Kimi</h1>
                  <p className="text-[10px] text-[#6B7280]">FLAP VAULT - V2</p>
                </div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-[#9CA3AF] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="p-3">
              <ul className="space-y-1">
                {[...mainNavItems, ...moreNavItems].map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-[#D0FF00]/10 text-[#D0FF00]"
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
            <div className="absolute bottom-0 left-0 right-0 border-t border-[#25282C] p-4">
              <div className="flex items-center justify-between text-xs text-[#6B7280]">
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
