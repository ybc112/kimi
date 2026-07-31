import { describe, expect, it } from "vitest";
import { KIMI_TOKEN_ADDRESS } from "./contracts/kimiToken";
import {
  createOfficialKimiFallback,
  formatCompactUsd,
  parseOfficialKimiTrending,
  readCachedOfficialKimi,
} from "./trending";

const payload = {
  pairs: [
    {
      chainId: "bsc",
      dexId: "pancakeswap",
      labels: ["v2"],
      url: "https://dexscreener.com/bsc/pair",
      pairAddress: "0x7D87df7a679bCF066a5dC7992434a975049619Ce",
      baseToken: {
        address: KIMI_TOKEN_ADDRESS,
        name: "Kimi Ai一键金库生成",
        symbol: "Kimi Ai",
      },
      priceUsd: "0.0002734",
      txns: { h24: { buys: 4058, sells: 1646 } },
      volume: { h24: 282412.83 },
      priceChange: { m5: 2.46, h1: -5.31, h6: 94.75, h24: 13.45 },
      liquidity: { usd: 45966.24 },
      marketCap: 226907,
      pairCreatedAt: 1785069614000,
    },
  ],
};

describe("official KIMI trending data", () => {
  it("converts the live DexScreener pair into the ranking model", () => {
    const item = parseOfficialKimiTrending(payload);
    expect(item).toMatchObject({
      rank: 1,
      address: KIMI_TOKEN_ADDRESS,
      price: "$0.0002734",
      change24h: "+13.45%",
      volume24h: "$282.4K",
      marketCap: "$226.9K",
      liquidity: "$46.0K",
      txCount24h: 5704,
      isOfficial: true,
      source: "dexscreener",
    });
    expect(item.sparkline).toHaveLength(10);
  });

  it("keeps the official token visible when no cache exists", () => {
    expect(readCachedOfficialKimi([]).address).toBe(KIMI_TOKEN_ADDRESS);
    expect(createOfficialKimiFallback().price).toBe("行情加载中");
  });

  it("formats small and large USD values compactly", () => {
    expect(formatCompactUsd(0.0002734)).toBe("$0.0002734");
    expect(formatCompactUsd(282412.83)).toBe("$282.4K");
  });
});
