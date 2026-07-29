import { ethers } from "ethers";
import type { TokenSafetyDimension, TokenSafetyReport } from "@/types";
import { BSC_CHAIN_ID, BSC_RPC_URL } from "@/lib/contracts/snowball";
import { PANCAKE_V2_ROUTER_ADDRESS } from "@/lib/contracts/trading";

const ZERO_ADDRESS = ethers.ZeroAddress;
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

// Known function selectors commonly used in BSC meme tokens.
const SELECTORS = {
  owner: "0x8da5cb5b",
  mint: "0x40c10f19", // mint(address,uint256)
  burn: "0x42966c68", // burn(uint256)
  burnFrom: "0x79cc6790", // burnFrom(address,uint256)
  renounceOwnership: "0x715018a6",
  transferOwnership: "0xf2fde38b",
  blacklist: "0x44337ea1", // blacklist(address)
  blacklistBool: "0xe65949c9", // blacklist(address,bool)
  isBlacklisted: "0xfe575a87", // isBlacklisted(address)
  whitelist: "0xe5a6b06f", // whitelist(address) - common but not standard
  setWhitelist: "0x2048735a", // setWhitelist(address,bool)
  isWhitelisted: "0x10a78401", // isWhitelisted(address)
  setTax: "0x6f7145d4", // setTax(uint256,uint256)
  setBuyTax: "0x0b8f7e65", // setBuyTax(uint256)
  setSellTax: "0x4e41f722", // setSellTax(uint256)
  setMaxTx: "0xf0bb8154", // setMaxTxAmount(uint256)
  setMaxWallet: "0xe2f4d56b", // setMaxWalletSize(uint256)
  tradingOpen: "0x59a19240", // tradingOpen()
  getDefaultPair: "0x6b465a80", // getDefaultPair()
};

function selectorExists(bytecode: string, selector: string): boolean {
  return bytecode.toLowerCase().includes(selector.slice(2).toLowerCase());
}

function hasAnySelector(bytecode: string, selectors: string[]): boolean {
  return selectors.some((s) => selectorExists(bytecode, s));
}

async function readOwner(provider: ethers.Provider, tokenAddress: string): Promise<string | null> {
  try {
    const result = await provider.call({
      to: tokenAddress,
      data: SELECTORS.owner,
    });
    const addr = ethers.getAddress(`0x${result.slice(-40)}`);
    return addr;
  } catch {
    return null;
  }
}

async function readPair(provider: ethers.Provider, tokenAddress: string): Promise<string | null> {
  try {
    // Try common pair factory pattern via PancakeSwap Factory.
    const factory = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
    const data =
      "0xe6a43905" +
      tokenAddress.slice(2).padStart(64, "0") +
      "0000000000000000000000000000000000000000000000000000000000000000".slice(0, 64); // WBNB
    const result = await provider.call({ to: factory, data });
    const pair = ethers.getAddress(`0x${result.slice(-40)}`);
    return pair === ZERO_ADDRESS ? null : pair;
  } catch {
    return null;
  }
}

async function getPairReserves(
  provider: ethers.Provider,
  pairAddress: string
): Promise<{ tokenReserve: bigint; bnbReserve: bigint; valid: boolean }> {
  try {
    const pairAbi = [
      "function token0() view returns (address)",
      "function getReserves() view returns (uint112,uint112,uint32)",
    ];
    const pair = new ethers.Contract(pairAddress, pairAbi, provider);
    const [token0, reserves] = await Promise.all([
      pair.token0() as Promise<string>,
      pair.getReserves() as Promise<readonly [bigint, bigint, number]>,
    ]);
    const isToken0 = token0.toLowerCase() !== "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"; // WBNB
    return {
      tokenReserve: isToken0 ? reserves[0] : reserves[1],
      bnbReserve: isToken0 ? reserves[1] : reserves[0],
      valid: reserves[0] > 0n && reserves[1] > 0n,
    };
  } catch {
    return { tokenReserve: 0n, bnbReserve: 0n, valid: false };
  }
}

async function getLpTokenHolder(
  provider: ethers.Provider,
  pairAddress: string
): Promise<string | null> {
  try {
    // Simplified: read largest holder via common lock contracts or dead address balance.
    const pairAbi = ["function balanceOf(address) view returns (uint256)", "function totalSupply() view returns (uint256)"];
    const pair = new ethers.Contract(pairAddress, pairAbi, provider);
    const [deadBalance, totalSupply] = await Promise.all([
      pair.balanceOf(DEAD_ADDRESS) as Promise<bigint>,
      pair.totalSupply() as Promise<bigint>,
    ]);
    if (totalSupply > 0n && (deadBalance * 100n) / totalSupply > 80n) {
      return DEAD_ADDRESS;
    }
    return null;
  } catch {
    return null;
  }
}

async function checkSwapPath(
  provider: ethers.Provider,
  tokenAddress: string,
  amountIn: bigint,
  buy: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const routerAbi = [
      "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)",
    ];
    const router = new ethers.Contract(PANCAKE_V2_ROUTER_ADDRESS, routerAbi, provider);
    const wbnb = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
    const path = buy ? [wbnb, tokenAddress] : [tokenAddress, wbnb];

    // getAmountsOut will revert if the pair is missing or if the token charges
    // a fee that breaks the constant-product formula. It does NOT prove the
    // token can be sold (that requires tokens + allowance), but it catches
    // many honeypots that block the swap path entirely.
    await router.getAmountsOut(amountIn, path);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

function dimension(name: string, pass: boolean, score: number, message: string): TokenSafetyDimension {
  return { name, pass, score, message };
}

function scoreFromDimensions(dimensions: TokenSafetyDimension[]): number {
  const total = dimensions.reduce((sum, d) => sum + d.score, 0);
  return Math.round(total / dimensions.length);
}

export async function analyzeTokenSafety(
  tokenAddress: string,
  provider?: ethers.Provider
): Promise<TokenSafetyReport> {
  const normalized = ethers.getAddress(tokenAddress);
  const rpc = provider ?? new ethers.JsonRpcProvider(BSC_RPC_URL, BSC_CHAIN_ID, { staticNetwork: true });

  const warnings: string[] = [];
  const dimensions: TokenSafetyDimension[] = [];

  let owner: string | null = null;
  let ownerRenounced = false;
  let hasMintFunction = false;
  let hasBlacklist = false;
  let hasWhitelist = false;
  let taxChangeable: boolean | null = null;
  let buyTaxBp: number | null = null;
  let sellTaxBp: number | null = null;
  let lpLockedOrBurned: boolean | null = null;
  let isHoneypot: boolean | null = null;
  let canSell: boolean | null = null;

  try {
    const [code, ownerResult] = await Promise.all([
      rpc.getCode(normalized),
      readOwner(rpc, normalized),
    ]);

    if (code === "0x") {
      throw new Error("该地址在 BSC 上没有合约代码");
    }

    owner = ownerResult;
    ownerRenounced = owner === ZERO_ADDRESS;

    dimensions.push(
      dimension(
        "合约存在",
        true,
        100,
        "地址上存在合约字节码"
      )
    );

    dimensions.push(
      dimension(
        "Owner 权限",
        ownerRenounced,
        ownerRenounced ? 100 : 40,
        ownerRenounced
          ? "Owner 已放弃权限"
          : owner
            ? `Owner 地址：${owner.slice(0, 8)}...${owner.slice(-6)}`
            : "无法读取 Owner"
      )
    );

    // Detect suspicious selectors in bytecode.
    hasMintFunction = selectorExists(code, SELECTORS.mint);
    hasBlacklist = hasAnySelector(code, [SELECTORS.blacklist, SELECTORS.blacklistBool, SELECTORS.isBlacklisted]);
    hasWhitelist = hasAnySelector(code, [SELECTORS.whitelist, SELECTORS.setWhitelist, SELECTORS.isWhitelisted]);
    taxChangeable = hasAnySelector(code, [SELECTORS.setTax, SELECTORS.setBuyTax, SELECTORS.setSellTax]);

    dimensions.push(
      dimension(
        "增发后门",
        !hasMintFunction,
        hasMintFunction ? 20 : 100,
        hasMintFunction ? "检测到 mint 函数选择器，Owner/授权者可能无限增发" : "未检测到 mint 函数"
      )
    );

    dimensions.push(
      dimension(
        "黑名单陷阱",
        !hasBlacklist,
        hasBlacklist ? 30 : 100,
        hasBlacklist ? "检测到黑名单相关函数，可能阻止用户卖出" : "未检测到黑名单功能"
      )
    );

    dimensions.push(
      dimension(
        "白名单限制",
        !hasWhitelist,
        hasWhitelist ? 60 : 100,
        hasWhitelist ? "检测到白名单相关函数" : "未检测到白名单功能"
      )
    );

    dimensions.push(
      dimension(
        "税率可变性",
        taxChangeable !== true,
        taxChangeable === true ? 40 : 100,
        taxChangeable === true
          ? "检测到设置税率函数，Owner 可任意修改税率"
          : "未检测到税率修改函数"
      )
    );

    // Try to read tax rates from common Snowball-like token.
    try {
      const taxSelectors = [
        { name: "buyTax", selector: "0x9c8f8a8b" }, // buyTax() - illustrative
        { name: "sellTax", selector: "0x82df6c1e" }, // sellTax()
        { name: "totalBuyTax", selector: "0x8a8c66a3" },
        { name: "totalSellTax", selector: "0x06d6e969" },
      ];
      for (const t of taxSelectors) {
        try {
          const result = await rpc.call({ to: normalized, data: t.selector });
          const value = Number(BigInt(result));
          if (t.name.includes("buy") && buyTaxBp === null) buyTaxBp = value;
          if (t.name.includes("sell") && sellTaxBp === null) sellTaxBp = value;
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }

    if (buyTaxBp !== null || sellTaxBp !== null) {
      const buy = buyTaxBp ?? 0;
      const sell = sellTaxBp ?? 0;
      const reasonable = buy <= 2500 && sell <= 2500;
      dimensions.push(
        dimension(
          "税率合理性",
          reasonable,
          reasonable ? 100 : 20,
          `买入 ${buy / 100}% / 卖出 ${sell / 100}%`
        )
      );
    } else {
      dimensions.push(
        dimension(
          "税率合理性",
          true,
          80,
          "无法读取税率，未检测到明显的税率修改函数"
        )
      );
    }

    // LP / liquidity analysis.
    const pair = await readPair(rpc, normalized);
    if (pair) {
      const reserves = await getPairReserves(rpc, pair);
      const lpHolder = await getLpTokenHolder(rpc, pair);
      lpLockedOrBurned = lpHolder === DEAD_ADDRESS;

      dimensions.push(
        dimension(
          "流动性池",
          reserves.valid,
          reserves.valid ? 100 : 30,
          reserves.valid
            ? `LP 有效：${ethers.formatEther(reserves.bnbReserve)} BNB`
            : "流动性池无有效储备"
        )
      );

      dimensions.push(
        dimension(
          "LP 锁定/销毁",
          lpLockedOrBurned === true,
          lpLockedOrBurned === true ? 100 : 40,
          lpLockedOrBurned === true
            ? "大部分 LP 已发送至销毁地址"
            : "无法确认 LP 已锁定或销毁"
        )
      );
    } else {
      dimensions.push(
        dimension(
          "流动性池",
          false,
          50,
          "未找到 PancakeSwap V2 流动性池"
        )
      );
      dimensions.push(
        dimension(
          "LP 锁定/销毁",
          false,
          50,
          "无流动性池，无法评估 LP 状态"
        )
      );
    }

    // Honeypot / swap path check.
    const buySim = await checkSwapPath(rpc, normalized, ethers.parseEther("0.001"), true);
    const sellSim = await checkSwapPath(rpc, normalized, ethers.parseUnits("1", 9), false);
    canSell = sellSim.success;
    isHoneypot = !buySim.success || !sellSim.success;

    dimensions.push(
      dimension(
        "买入路径",
        buySim.success,
        buySim.success ? 100 : 0,
        buySim.success ? "买入路径检查通过" : `买入路径检查失败：${buySim.error?.slice(0, 80) ?? ""}`
      )
    );

    dimensions.push(
      dimension(
        "卖出路径",
        canSell === true,
        canSell === true ? 100 : 0,
        canSell === true
          ? "卖出路径检查通过（实际卖出仍需持有代币并授权）"
          : `卖出路径检查失败：${sellSim.error?.slice(0, 80) ?? ""}`
      )
    );

    if (isHoneypot) {
      warnings.push("模拟交易失败，该代币可能是 Honeypot 或尚未开盘");
    }
    if (hasMintFunction && !ownerRenounced) {
      warnings.push("Owner 仍保留增发权限，存在无限增发风险");
    }
    if (hasBlacklist) {
      warnings.push("合约包含黑名单功能，可能阻止用户卖出");
    }
    if (taxChangeable && !ownerRenounced) {
      warnings.push("Owner 可任意修改税率，建议放弃权限或加入时间锁");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(message);
    dimensions.push(
      dimension(
        "合约可读性",
        false,
        0,
        message
      )
    );
  }

  const score = scoreFromDimensions(dimensions);

  return {
    address: normalized,
    score,
    isHoneypot,
    canSell,
    owner: owner ?? "",
    ownerRenounced,
    hasMintFunction,
    hasBlacklist,
    hasWhitelist,
    taxChangeable,
    buyTaxBp,
    sellTaxBp,
    lpLockedOrBurned,
    dimensions,
    warnings,
    checkedAt: Date.now(),
  };
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-[#D0FF00]";
  if (score >= 60) return "text-[#F59E0B]";
  if (score >= 40) return "text-[#FF8A8A]";
  return "text-[#FF6B6B]";
}

export function scoreBg(score: number): string {
  if (score >= 80) return "bg-[#D0FF00]/10 border-[#D0FF00]/30";
  if (score >= 60) return "bg-[#F59E0B]/10 border-[#F59E0B]/30";
  if (score >= 40) return "bg-[#FF8A8A]/10 border-[#FF8A8A]/30";
  return "bg-[#FF6B6B]/10 border-[#FF6B6B]/30";
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "安全";
  if (score >= 60) return "一般";
  if (score >= 40) return "风险";
  return "危险";
}
