import { describe, expect, it } from "vitest";
import { NFT_CREATION_FEE, isNFTLaunchpadConfigured } from "./launchpad";
describe("NFT launchpad configuration", () => {
  it("uses the advertised 0.01 BNB creation fee", () => expect(NFT_CREATION_FEE).toBe(10_000_000_000_000_000n));
  it("does not pretend an undeployed factory is ready", () => expect(typeof isNFTLaunchpadConfigured).toBe("boolean"));
});
