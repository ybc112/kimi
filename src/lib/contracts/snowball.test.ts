import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import { BSC_USDT_ADDRESS, buildCreateTokenParams, type CreateTokenFormValues } from "./snowball";

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
