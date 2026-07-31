import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import { encodeConstructorArgs, normalizeBytecode, parseConstructorArgs } from "./deployer";
import { buildTemplateDeployment, DEPLOY_TEMPLATES } from "./deployTemplates";

describe("built-in deployment templates", () => {
  it("ships valid creation bytecode and constructor ABIs", () => {
    expect(DEPLOY_TEMPLATES).toHaveLength(2);
    for (const template of DEPLOY_TEMPLATES) {
      expect(normalizeBytecode(template.bytecode).length).toBeGreaterThan(1000);
      const iface = new ethers.Interface(template.abi);
      expect(iface.deploy.inputs.map((input) => input.type)).toEqual(["string", "string", "uint256"]);
    }
  });

  it("builds fixed-supply constructor arguments in whole tokens", () => {
    const template = DEPLOY_TEMPLATES.find((item) => item.id === "fixed-supply")!;
    const deployment = buildTemplateDeployment(template, { name: "Kimi One", symbol: "KONE", supply: "1000000" });
    const encoded = encodeConstructorArgs(deployment.abi, parseConstructorArgs(deployment.constructorArgs));
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["string", "string", "uint256"], encoded);
    expect(decoded[2]).toBe(1_000_000n);
  });

  it("builds mintable constructor arguments in 18-decimal base units", () => {
    const template = DEPLOY_TEMPLATES.find((item) => item.id === "mintable-burnable")!;
    const deployment = buildTemplateDeployment(template, { name: "Kimi Plus", symbol: "KPLUS", supply: "1000000" });
    const encoded = encodeConstructorArgs(deployment.abi, parseConstructorArgs(deployment.constructorArgs));
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["string", "string", "uint256"], encoded);
    expect(decoded[2]).toBe(1_000_000n * 10n ** 18n);
  });

  it("rejects supplies that overflow uint256 after applying 18 decimals", () => {
    const template = DEPLOY_TEMPLATES.find((item) => item.id === "mintable-burnable")!;
    const overflow = (ethers.MaxUint256 / 10n ** 18n + 1n).toString();
    expect(() => buildTemplateDeployment(template, { name: "Overflow", symbol: "OVER", supply: overflow }))
      .toThrow(/超出 uint256/);
  });
});
