import { describe, expect, it } from "vitest";
import { DEFAULT_MINT_FACTORY_ADDRESS, mintLaunchpadConfig } from "./launchpad";

describe("Mint factory configuration", () => {
  it("uses the current factory and never the retired factory fallback", () => {
    expect(DEFAULT_MINT_FACTORY_ADDRESS).toBe("0xf4eCf0bd65461DBdB1C9653c8712589Da5C46D11");
    expect(mintLaunchpadConfig.factoryAddress.toLowerCase()).not.toBe(
      "0x084c85f7cf1d9cf3d638ef75b1561e464884dfbc",
    );
  });
});
