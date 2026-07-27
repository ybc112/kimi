import { ethers } from "ethers";
import generatedTemplates from "./deployTemplates.generated.json";

export interface DeployTemplate {
  id: string;
  title: string;
  description: string;
  contractName: string;
  supplyMode: "wholeTokens" | "baseUnits";
  abi: ethers.InterfaceAbi;
  bytecode: string;
}

export const DEPLOY_TEMPLATES = generatedTemplates as DeployTemplate[];

const TOKEN_DECIMALS = 18n;
const TOKEN_UNIT = 10n ** TOKEN_DECIMALS;
const MAX_WHOLE_TOKEN_SUPPLY = ethers.MaxUint256 / TOKEN_UNIT;

export function buildTemplateDeployment(
  template: DeployTemplate,
  values: { name: string; symbol: string; supply: string }
) {
  const name = values.name.trim();
  const symbol = values.symbol.trim().toUpperCase();
  const supply = values.supply.trim();

  if (!name) throw new Error("请填写代币名称");
  if (!symbol) throw new Error("请填写代币符号");
  if (name.length > 64) throw new Error("代币名称不能超过 64 个字符");
  if (symbol.length > 16) throw new Error("代币符号不能超过 16 个字符");
  if (!/^\d+$/.test(supply) || BigInt(supply) <= 0n) throw new Error("总供应量必须是正整数");
  const wholeTokenSupply = BigInt(supply);
  if (wholeTokenSupply > MAX_WHOLE_TOKEN_SUPPLY) {
    throw new Error("总供应量过大，18 位精度下会超出 uint256");
  }

  const supplyArg = template.supplyMode === "baseUnits" ? (wholeTokenSupply * TOKEN_UNIT).toString() : supply;
  return {
    name,
    symbol,
    abi: JSON.stringify(template.abi, null, 2),
    bytecode: template.bytecode,
    constructorArgs: JSON.stringify([name, symbol, supplyArg]),
  };
}
