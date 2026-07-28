import type { TrendingItem } from "@/types";
import { KIMI_TOKEN_ADDRESS } from "@/lib/contracts/kimiToken";

export const KIMI_PANCAKE_PAIR_ADDRESS = "0x7D87df7a679bCF066a5dC7992434a975049619Ce";
export const KIMI_DEXSCREENER_API = `https://api.dexscreener.com/latest/dex/tokens/${KIMI_TOKEN_ADDRESS}`;
export const KIMI_DEXSCREENER_URL = `https://dexscreener.com/bsc/${KIMI_PANCAKE_PAIR_ADDRESS}`;

type DexPair = {
  chainId?: unknown;
  dexId?: unknown;
  url?: unknown;
  pairAddress?: unknown;
  labels?: unknown;
  baseToken?: { address?: unknown; name?: unknown; symbol?: unknown };
  priceUsd?: unknown;
  txns?: { h24?: { buys?: unknown; sells?: unknown } };
  volume?: { h24?: unknown };
  priceChange?: { m5?: unknown; h1?: unknown; h6?: unknown; h24?: unknown };
  liquidity?: { usd?: unknown };
  fdv?: unknown;
  marketCap?: unknown;
  pairCreatedAt?: unknown;
};

type DexPayload = { pairs?: unknown };

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function readableText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function formatCompactUsd(value: number | null): string {
  if (value === null || value < 0) return "--";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value === 0) return "$0";
  const precision = value < 0.0001 ? 8 : value < 0.001 ? 7 : 6;
  return `$${value.toFixed(precision).replace(/0+$/, "").replace(/\.$/, "")}`;
}

function formatChange(value: number | null): string {
  const change = value ?? 0;
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildSparkline(pair: DexPair): number[] {
  const h24 = clamp(finiteNumber(pair.priceChange?.h24) ?? 0, -80, 300);
  const h6 = clamp(finiteNumber(pair.priceChange?.h6) ?? h24 / 4, -60, 180);
  const h1 = clamp(finiteNumber(pair.priceChange?.h1) ?? h6 / 6, -30, 80);
  const m5 = clamp(finiteNumber(pair.priceChange?.m5) ?? h1 / 12, -15, 30);
  const end = Math.max(5, 100 + h24);
  return Array.from({ length: 10 }, (_, index) => {
    const progress = index / 9;
    const base = 100 + (end - 100) * progress;
    const shortMomentum = (h6 * 0.08 * Math.sin(progress * Math.PI)) + h1 * 0.05 + m5 * 0.03;
    return Math.max(1, Number((base + shortMomentum).toFixed(3)));
  });
}

export function createOfficialKimiFallback(): TrendingItem {
  return {
    rank: 1,
    name: "Kimi Ai一键金库生成",
    symbol: "Kimi Ai",
    address: KIMI_TOKEN_ADDRESS,
    price: "行情加载中",
    change24h: "+0.00%",
    volume24h: "--",
    marketCap: "--",
    hotScore: 1,
    sparkline: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
    tag: "官方 KIMI",
    url: KIMI_DEXSCREENER_URL,
    pairAddress: KIMI_PANCAKE_PAIR_ADDRESS,
    liquidity: "--",
    txCount24h: 0,
    isOfficial: true,
    source: "fallback",
  };
}

function isOfficialBasePair(pair: DexPair) {
  return (
    String(pair.chainId || "").toLowerCase() === "bsc" &&
    String(pair.baseToken?.address || "").toLowerCase() === KIMI_TOKEN_ADDRESS.toLowerCase()
  );
}

function pairScore(pair: DexPair) {
  const liquidity = finiteNumber(pair.liquidity?.usd) ?? 0;
  const isPancake = String(pair.dexId || "").toLowerCase() === "pancakeswap" ? 1_000_000_000 : 0;
  const isV2 = Array.isArray(pair.labels) && pair.labels.some((label) => String(label).toLowerCase() === "v2")
    ? 100_000_000
    : 0;
  return isPancake + isV2 + liquidity;
}

export function parseOfficialKimiTrending(payload: unknown): TrendingItem {
  const pairs = Array.isArray((payload as DexPayload | null)?.pairs)
    ? ((payload as { pairs: DexPair[] }).pairs).filter(isOfficialBasePair)
    : [];
  const pair = pairs.sort((left, right) => pairScore(right) - pairScore(left))[0];
  if (!pair) throw new Error("DexScreener 暂未返回官方 KIMI 的 BSC 交易池");

  const buys = finiteNumber(pair.txns?.h24?.buys) ?? 0;
  const sells = finiteNumber(pair.txns?.h24?.sells) ?? 0;
  const txCount24h = Math.max(0, Math.round(buys + sells));
  const marketCap = finiteNumber(pair.marketCap) ?? finiteNumber(pair.fdv);
  const pairAddress = readableText(pair.pairAddress, KIMI_PANCAKE_PAIR_ADDRESS);

  return {
    rank: 1,
    name: readableText(pair.baseToken?.name, "Kimi Ai一键金库生成"),
    symbol: readableText(pair.baseToken?.symbol, "Kimi Ai"),
    address: KIMI_TOKEN_ADDRESS,
    price: formatCompactUsd(finiteNumber(pair.priceUsd)),
    change24h: formatChange(finiteNumber(pair.priceChange?.h24)),
    volume24h: formatCompactUsd(finiteNumber(pair.volume?.h24)),
    marketCap: formatCompactUsd(marketCap),
    hotScore: Math.max(txCount24h, 1),
    sparkline: buildSparkline(pair),
    tag: "官方 KIMI",
    url: readableText(pair.url, `https://dexscreener.com/bsc/${pairAddress}`),
    pairAddress,
    liquidity: formatCompactUsd(finiteNumber(pair.liquidity?.usd)),
    txCount24h,
    pairCreatedAt: finiteNumber(pair.pairCreatedAt) ?? undefined,
    updatedAt: Date.now(),
    isOfficial: true,
    source: "dexscreener",
  };
}

export async function fetchOfficialKimiTrending(signal?: AbortSignal): Promise<TrendingItem> {
  const response = await fetch(KIMI_DEXSCREENER_API, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`行情接口返回 HTTP ${response.status}`);
  return parseOfficialKimiTrending(await response.json());
}

export function readCachedOfficialKimi(value: unknown): TrendingItem {
  if (!Array.isArray(value)) return createOfficialKimiFallback();
  const cached = value.find(
    (item): item is TrendingItem =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as TrendingItem).address === "string" &&
      (item as TrendingItem).address.toLowerCase() === KIMI_TOKEN_ADDRESS.toLowerCase()
  );
  return cached ? { ...createOfficialKimiFallback(), ...cached, rank: 1, isOfficial: true } : createOfficialKimiFallback();
}
