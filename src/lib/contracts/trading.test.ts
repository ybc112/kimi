import { describe, expect, it } from "vitest";
import {
  applySlippage,
  parseBnbLiquidityAmount,
  parseSlippageBps,
  parseTokenLiquidityAmount,
} from "./trading";

describe("open-trading liquidity validation", () => {
  it("parses the Snowball token's integer-only liquidity amount", () => {
    expect(parseTokenLiquidityAmount("250000000", 0)).toBe(250_000_000n);
    expect(() => parseTokenLiquidityAmount("1.5", 0)).toThrow(/不支持小数/);
  });

  it("parses BNB without floating-point precision loss", () => {
    expect(parseBnbLiquidityAmount("0.012345678901234567")).toBe(12_345_678_901_234_567n);
  });

  it("converts percentage slippage to basis points", () => {
    expect(parseSlippageBps("3")).toBe(300);
    expect(parseSlippageBps("0.5")).toBe(50);
    expect(() => parseSlippageBps("25")).toThrow(/0.1% 到 20%/);
  });

  it("calculates minimum amounts using bigint math", () => {
    expect(applySlippage(1_000_000n, 300)).toBe(970_000n);
  });
});
