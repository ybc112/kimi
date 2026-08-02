import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { MINT_PLATFORM_TAX_SHARE_BPS } from "./launchpad";

const tokenSource = readFileSync(resolve("contracts/mint/KimiMintToken.sol"), "utf8");

describe("KimiMint platform tax settlement", () => {
  it("discloses the same 10% collected-tax share used by the token", () => {
    expect(MINT_PLATFORM_TAX_SHARE_BPS).toBe(1_000);
    expect(tokenSource).toContain("PLATFORM_TAX_SHARE_BPS = 1_000");
  });

  it("restricts swap helpers to token self-calls", () => {
    expect(tokenSource).toMatch(/function _swapBackNative[\s\S]*?external\s+onlySelf/);
    expect(tokenSource).toMatch(/function _swapBackDividend[\s\S]*?external\s+onlySelf/);
  });

  it("blocks settlement reentry while a swap is running", () => {
    expect(tokenSource).toMatch(/function processTaxTokens\(\) external \{\s*if \(_swapping\)/);
    expect(tokenSource).toMatch(/function _swapBackIfNeeded\(\) private \{\s*if \(\s*_swapping/);
  });

  it("only clears retained buckets after successful settlement", () => {
    const selection = tokenSource.slice(
      tokenSource.indexOf("function _swapBackIfNeeded"),
      tokenSource.indexOf("function _selectTaxBps"),
    );
    expect(selection).not.toContain("tokensForPlatform -=");

    const settlement = tokenSource.slice(
      tokenSource.indexOf("function _swapBack("),
      tokenSource.indexOf("function _swapTokensForNative"),
    );
    expect(settlement).toMatch(/returns \(uint256 nr\)[\s\S]*?tokensForPlatform -= platformTokens/);
    expect(settlement).toMatch(/returns \(uint256 rr\)[\s\S]*?tokensForDividends -= dividendTokens/);
  });
});
