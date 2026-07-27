import { ExternalLink, CheckCircle2, Clock, List, Search } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const EXPLORERS: Record<string, string> = {
  "BNB Smart Chain": "https://bscscan.com/token",
  Ethereum: "https://etherscan.io/token",
  "Arbitrum One": "https://arbiscan.io/token",
  Base: "https://basescan.org/token",
};

type TokenStatus = "active" | "pending" | "verified";

interface Token {
  id: string;
  name: string;
  symbol: string;
  address: string;
  network: string;
  deployedAt: string;
  status: TokenStatus;
}

const tokens: Token[] = [
  {
    id: "1",
    name: "Fcodex Token",
    symbol: "FCDX",
    address: "0x9aa9cadec931c58c2a22bbc5381b266d12887777",
    network: "BNB Smart Chain",
    deployedAt: "2026-07-25 14:32",
    status: "verified",
  },
  {
    id: "2",
    name: "AI Cat Coin",
    symbol: "AICAT",
    address: "0x7a8bC2De9d54C78f6b9C4D3eE1F2a0B1c2d3E4f5",
    network: "BNB Smart Chain",
    deployedAt: "2026-07-24 09:15",
    status: "active",
  },
  {
    id: "3",
    name: "MoonBeam Dividend",
    symbol: "MBD",
    address: "0x3F5a1B2c3D4e5F6a7B8c9D0E1F2A3B4C5D6E7F8A9",
    network: "Arbitrum One",
    deployedAt: "2026-07-23 18:44",
    status: "active",
  },
  {
    id: "4",
    name: "PandaSwap Buyback",
    symbol: "PANDA",
    address: "0xA1B2C3d4E5F6a7B8C9D0E1F2A3b4C5D6E7F8A9B0",
    network: "Base",
    deployedAt: "2026-07-22 11:08",
    status: "pending",
  },
  {
    id: "5",
    name: "Nova Liquidity Vault",
    symbol: "NOVA",
    address: "0xB2c3D4E5F6a7B8C9D0E1F2A3B4c5D6E7F8A9B0C1",
    network: "Ethereum",
    deployedAt: "2026-07-21 22:56",
    status: "verified",
  },
  {
    id: "6",
    name: "Satoshi Meme Launch",
    symbol: "SATO",
    address: "0xC3d4E5F6a7B8C9D0E1F2A3B4C5d6E7F8A9B0C1D2",
    network: "BNB Smart Chain",
    deployedAt: "2026-07-20 08:21",
    status: "active",
  },
  {
    id: "7",
    name: "CyberBond Factory",
    symbol: "CYBER",
    address: "0xD4E5F6a7B8C9D0E1F2A3B4C5D6e7F8A9B0C1D2E3",
    network: "BNB Smart Chain",
    deployedAt: "2026-07-19 16:40",
    status: "verified",
  },
  {
    id: "8",
    name: "Pepe Vault V2",
    symbol: "PEPEV2",
    address: "0xE5F6a7B8C9D0E1F2A3B4C5D6E7f8A9B0C1D2E3F4",
    network: "Base",
    deployedAt: "2026-07-18 13:12",
    status: "active",
  },
];

const statusConfig: Record<
  TokenStatus,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  active: { label: "已激活", color: "text-[#D0FF00]", bg: "bg-[#D0FF00]/10", icon: CheckCircle2 },
  pending: { label: "部署中", color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10", icon: Clock },
  verified: { label: "已验证", color: "text-[#2EDEDB]", bg: "bg-[#2EDEDB]/10", icon: CheckCircle2 },
};

export default function IssuedTokens() {
  const [search, setSearch] = useState("");

  const filtered = tokens.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-[#23262A] bg-[#15171A] p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">已发代币</h1>
          <p className="mt-1 text-sm text-[#84888C]">用户与平台已部署的代币列表，点击可跳转链上浏览器</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5F656D]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索名称 / Symbol / 地址"
            className="w-full rounded-lg border border-[#303236] bg-[#0B0D0E] py-2 pl-9 pr-4 text-sm text-white outline-none transition-colors focus:border-[#D0FF00]/50 placeholder:text-[#5F656D] lg:w-72"
          />
        </div>
      </div>

      <div className="rounded-xl border border-[#23262A] bg-[#15171A] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#23262A] text-[#84888C]">
                <th className="px-5 py-4 font-medium">代币名称</th>
                <th className="px-5 py-4 font-medium">Symbol</th>
                <th className="px-5 py-4 font-medium">合约地址</th>
                <th className="px-5 py-4 font-medium">部署网络</th>
                <th className="px-5 py-4 font-medium">部署时间</th>
                <th className="px-5 py-4 font-medium">状态</th>
                <th className="px-5 py-4 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((token) => {
                const status = statusConfig[token.status];
                const StatusIcon = status.icon;
                const explorerBase = EXPLORERS[token.network] ?? EXPLORERS["BNB Smart Chain"];
                return (
                  <tr
                    key={token.id}
                    className="border-b border-[#23262A] last:border-0 transition-colors hover:bg-[#0B0D0E]/50"
                  >
                    <td className="px-5 py-4 font-medium text-white">{token.name}</td>
                    <td className="px-5 py-4">
                      <span className="rounded bg-[#23262A] px-2 py-1 text-xs font-medium text-[#D0FF00]">
                        {token.symbol}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-[#9CA3AF]">
                      {token.address.slice(0, 8)}...{token.address.slice(-6)}
                    </td>
                    <td className="px-5 py-4 text-[#9CA3AF]">{token.network}</td>
                    <td className="px-5 py-4 text-[#9CA3AF]">{token.deployedAt}</td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                          status.bg,
                          status.color
                        )}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <a
                        href={`${explorerBase}/${token.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#303236] bg-[#0B0D0E] px-3 py-1.5 text-xs text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        浏览器
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#23262A]">
              <List className="h-6 w-6 text-[#5F656D]" />
            </div>
            <p className="text-sm text-[#5F656D]">未找到匹配的代币</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "已部署代币", value: tokens.length.toString() },
          { label: "已验证", value: tokens.filter((t) => t.status === "verified").length.toString() },
          { label: "部署中", value: tokens.filter((t) => t.status === "pending").length.toString() },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[#23262A] bg-[#15171A] p-4">
            <p className="text-xs text-[#5F656D]">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
