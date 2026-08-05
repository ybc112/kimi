import { describe, expect, it } from "vitest";
import { DEFAULT_MINT_FACTORY_ADDRESS, mintLaunchpadConfig } from "./launchpad";

describe("Mint factory configuration", () => {
  it("uses the current factory and never the retired factory fallback", () => {
    expect(DEFAULT_MINT_FACTORY_ADDRESS).toBe("0xE1CD783bcE52E8945B0FB539AA106aa35b08879e");
    expect(mintLaunchpadConfig.factoryAddress.toLowerCase()).not.toBe(
      "0x084c85f7cf1d9cf3d638ef75b1561e464884dfbc",
    );
  });
});
