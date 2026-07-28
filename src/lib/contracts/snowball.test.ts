import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import {
  BSC_USDT_ADDRESS,
  SNOWBALL_LAUNCHPAD_RUNTIME_HASH,
  buildCreateTokenParams,
  formatCreateFee,
  type CreateTokenFormValues,
} from "./snowball";

const ACCOUNT = "0xe1F9Fb65BBb39ebd4d0C204c95513d3f6421c407";

function form(overrides: Partial<CreateTokenFormValues> = {}): CreateTokenFormValues {
  return {
    name: "Good Boy",
    symbol: "GOOD",
    totalSupply: "1000000000",
    hiddenFeeReceiver: "",
    rewardToken: BSC_USDT_ADDRESS,
    buyHiddenTaxBp: "1",
    buyBurnBp: "1",
    buyLiquidityBp: "1",
    buyDividendBp: "1",
    sellHiddenTaxBp: "1",
    sellBurnBp: "1",
    sellLiquidityBp: "1",
    sellDividendBp: "1",
    ordinaryWhitelist: "",
    limitAccounts: "",
    limitQuotas: "",
    limitModeEnabled: false,
    requestAutoVerify: true,
    ...overrides,
  };
}

describe("buildCreateTokenParams", () => {
  it("uses the connected wallet when the hidden-fee receiver is blank", () => {
    const params = buildCreateTokenParams(form(), { defaultHiddenFeeReceiver: ACCOUNT });
    expect(params.hiddenFeeReceiver).toBe(ethers.getAddress(ACCOUNT));
  });

  it("converts percentage inputs to basis points", () => {
    const params = buildCreateTokenParams(form(), { defaultHiddenFeeReceiver: ACCOUNT });
    expect(params.buyHiddenTaxBp).toBe(100);
    expect(params.sellDividendBp).toBe(100);
  });

  it("does not reinterpret percentage input as basis points", () => {
    expect(() =>
      buildCreateTokenParams(form({ buyHiddenTaxBp: "30" }), { defaultHiddenFeeReceiver: ACCOUNT })
    ).toThrow(/买入总税率不能超过 25%/);
  });

  it("rejects invalid reward-token addresses before wallet transactions", () => {
    expect(() =>
      buildCreateTokenParams(form({ rewardToken: "not-an-address" }), { defaultHiddenFeeReceiver: ACCOUNT })
    ).toThrow(/分红代币地址/);
  });

  it("rejects mismatched limit accounts and quotas", () => {
    expect(() =>
      buildCreateTokenParams(
        form({ limitAccounts: ACCOUNT, limitQuotas: "1,2", limitModeEnabled: true }),
        { defaultHiddenFeeReceiver: ACCOUNT }
      )
    ).toThrow(/数量必须一致/);
  });
});

describe("Snowball factory metadata and fee display", () => {
  it("shows a zero on-chain fee as free instead of the ambiguous 0.0000 BNB", () => {
    expect(formatCreateFee(0n)).toEqual({
      amount: "0",
      fullLabel: "当前免创建费（0 BNB）",
      buttonLabel: "免创建费 · 仅需 Gas",
      isFree: true,
    });
  });

  it("preserves the source default fee without unnecessary trailing zeroes", () => {
    expect(formatCreateFee(5_000_000_000_000_000n)).toMatchObject({
      amount: "0.005",
      fullLabel: "0.005 BNB",
      buttonLabel: "0.005 BNB + Gas",
      isFree: false,
    });
  });

  it("pins the verified BSC runtime hash", () => {
    expect(SNOWBALL_LAUNCHPAD_RUNTIME_HASH).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
