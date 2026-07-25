import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { KimiIcon } from "./KimiIcon";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-[#0B0D0E] text-[#E8E8E8]">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-[#23262A] bg-[#111215] px-4 py-3 lg:hidden">
          <div className="flex items-center gap-3">
            <KimiIcon size={32} className="h-8 w-8 rounded-lg" />
            <div>
              <h1 className="text-sm font-bold text-white">Kimi</h1>
              <p className="text-[10px] text-[#84888C]">Flap Vault 合约生成器</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-[#9CA3AF] transition-colors hover:bg-[#1A1D21] hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
