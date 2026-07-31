import { describe, expect, it } from "vitest";
import { DEFAULT_NFT_FACTORY_ADDRESS, NFT_CREATION_FEE, isNFTLaunchpadConfigured } from "./launchpad";
describe("NFT launchpad configuration", () => {
  it("uses the advertised 0.01 BNB creation fee", () => expect(NFT_CREATION_FEE).toBe(10_000_000_000_000_000n));
  it("points at the deployed BSC Factory by default", () => expect(DEFAULT_NFT_FACTORY_ADDRESS).toBe("0xbE8EDD0A8cfA0ddb3d4bcd6D877641e7AF77ca34"));
  it("does not pretend an undeployed factory is ready", () => expect(typeof isNFTLaunchpadConfigured).toBe("boolean"));
});
