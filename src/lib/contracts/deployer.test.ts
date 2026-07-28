import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import {
  KIMI_BURN_ADDRESS,
  KIMI_TOKEN_ADDRESS,
  encodeConstructorArgs,
  extractDeploymentArtifact,
  normalizeBytecode,
  parseConstructorArgs,
  parseDeployValue,
} from "./deployer";

const constructorAbi = JSON.stringify([
  {
    inputs: [
      { name: "name", type: "string" },
      { name: "supply", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
]);

describe("deployment input validation", () => {
  it("uses the official KIMI token and an irreversible burn receiver", () => {
    expect(KIMI_TOKEN_ADDRESS).toBe("0x9Aa9CADEc931C58c2a22Bbc5381b266d12887777");
    expect(KIMI_BURN_ADDRESS).toBe("0x000000000000000000000000000000000000dEaD");
  });

  it("rejects empty creation bytecode", () => {
    expect(() => normalizeBytecode("0x")).toThrow(/不能只填写 0x/);
  });

  it("preserves uint256 constructor values as strings", () => {
    const args = parseConstructorArgs('["Kimi","1000000000000000000"]');
    const encoded = encodeConstructorArgs(constructorAbi, args);
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["string", "uint256"], encoded);
    expect(decoded[0]).toBe("Kimi");
    expect(decoded[1]).toBe(1_000_000_000_000_000_000n);
  });

  it("checks constructor argument counts", () => {
    expect(() => encodeConstructorArgs(constructorAbi, ["Kimi"])).toThrow(/需要 2 个参数/);
  });

  it("parses native deployment value without floating-point math", () => {
    expect(parseDeployValue("0.123456789123456789")).toBe(123_456_789_123_456_789n);
  });

  it("imports Hardhat and Foundry artifacts", () => {
    expect(extractDeploymentArtifact({ abi: [], bytecode: "0x6000", contractName: "HardhatToken" })).toEqual({
      abi: [],
      bytecode: "0x6000",
      contractName: "HardhatToken",
    });
    expect(extractDeploymentArtifact({ abi: [], bytecode: { object: "6001" } })).toEqual({
      abi: [],
      bytecode: "0x6001",
      contractName: undefined,
    });
  });

  it("imports a single contract from solc standard JSON", () => {
    const artifact = extractDeploymentArtifact({
      contracts: {
        "Token.sol": {
          Token: { abi: [], evm: { bytecode: { object: "6002" } } },
        },
      },
    });
    expect(artifact).toEqual({ abi: [], bytecode: "0x6002", contractName: "Token" });
  });

  it("rejects ambiguous multi-contract standard JSON", () => {
    expect(() => extractDeploymentArtifact({
      contracts: {
        "Tokens.sol": {
          TokenA: { abi: [], evm: { bytecode: { object: "6002" } } },
          TokenB: { abi: [], evm: { bytecode: { object: "6003" } } },
        },
      },
    })).toThrow(/包含 2 个可部署合约/);
  });
});
