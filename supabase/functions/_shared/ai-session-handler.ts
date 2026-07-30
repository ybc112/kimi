import { ethers } from "npm:ethers@6.17.0";
import {
  SecurityError,
  assertAllowedOrigin,
  assertClientIpAllowed,
  assertWalletNotBlocked,
  createAiSessionToken,
  enforceRateLimit,
  jsonResponse,
  readJsonBody,
  readPositiveInt,
  securityErrorResponse,
  buildWalletAccessMessage,
} from "./ai-security.ts";

const KIMI_TOKEN_ADDRESS = "0x9Aa9CADEc931C58c2a22Bbc5381b266d12887777";
const BSC_RPC_URL = Deno.env.get("BSC_RPC_URL") || "https://bsc-rpc.publicnode.com";
// Default session TTL reduced to 5 minutes to limit token reuse if stolen.
const SESSION_TTL_SECONDS = readPositiveInt("AI_SESSION_TTL_SECONDS", 300, 1_800);

type SessionRequest = {
  address?: unknown;
  origin?: unknown;
  timestamp?: unknown;
  nonce?: unknown;
  signature?: unknown;
  turnstileToken?: unknown;
};

function getMinimumKimi(): { label: string; amount: bigint } {
  const configured = (Deno.env.get("AI_MIN_KIMI_BALANCE") || "100000").trim();
  try {
    const amount = ethers.parseUnits(configured, 18);
    if (amount < 0n) throw new Error();
    return { label: configured, amount };
  } catch {
    return { label: "100000", amount: ethers.parseUnits("100000", 18) };
  }
}

async function getKimiBalance(address: string): Promise<bigint> {
  const data = `0x70a08231${address.slice(2).toLowerCase().padStart(64, "0")}`;
  const response = await fetch(BSC_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: KIMI_TOKEN_ADDRESS, data }, "latest"],
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new SecurityError(503, "BSC_RPC_UNAVAILABLE", "暂时无法读取 KIMI 持仓");
  const payload = await response.json() as { result?: unknown; error?: { message?: unknown } };
  if (typeof payload.result !== "string" || !/^0x[0-9a-fA-F]+$/.test(payload.result)) {
    console.error("[ai-session] invalid BSC RPC response", payload.error?.message || "missing result");
    throw new SecurityError(503, "BSC_RPC_UNAVAILABLE", "暂时无法读取 KIMI 持仓");
  }
  return BigInt(payload.result);
}

// Cloudflare Turnstile server-side verification.
async function verifyTurnstileToken(token: string, clientIp: string): Promise<void> {
  const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!turnstileSecret) {
    throw new SecurityError(503, "TURNSTILE_SECRET_MISSING", "人机验证服务未配置");
  }

  const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: turnstileSecret,
      response: token,
      remoteip: clientIp,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  const verifyResult = await verifyResponse.json() as {
    success: boolean;
    "error-codes"?: string[];
  };
  if (!verifyResult.success) {
    const errorCodes = verifyResult["error-codes"]?.join(", ") || "unknown";
    throw new SecurityError(403, "TURNSTILE_VERIFY_FAILED", `人机验证失败（${errorCodes}），请重试`);
  }
}

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "apikey, x-client-info, authorization, content-type, x-kimi-ai-action, x-kimi-ai-session",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

export async function handleAiSessionRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeadersFor(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  try {
    const origin = assertAllowedOrigin(req);
    const clientIp = await assertClientIpAllowed(req);
    // 每个 IP / 钱包创建 session 的频率严格控制，防止恶意地址池轮换刷签名
    enforceRateLimit(`ai-session:ip:${clientIp}`, 5, 60 * 60_000);

    const body = await readJsonBody<SessionRequest>(req, 16_384);

    // Cloudflare Turnstile human verification is mandatory for creating an AI session.
    const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
    if (!turnstileToken) {
      throw new SecurityError(400, "TURNSTILE_REQUIRED", "需要完成人机验证才能继续");
    }
    await verifyTurnstileToken(turnstileToken, clientIp);

    if (typeof body.origin !== "string" || body.origin.trim().toLowerCase() !== origin) {
      throw new SecurityError(403, "ORIGIN_MISMATCH", "签名站点与当前来源不一致");
    }
    if (typeof body.address !== "string" || !ethers.isAddress(body.address)) {
      throw new SecurityError(400, "WALLET_INVALID", "钱包地址无效");
    }
    if (typeof body.timestamp !== "number" || !Number.isInteger(body.timestamp)) {
      throw new SecurityError(400, "TIMESTAMP_INVALID", "签名时间无效");
    }
    if (Math.abs(Date.now() - body.timestamp) > 120_000) {
      throw new SecurityError(401, "SIGNATURE_EXPIRED", "钱包签名已过期，请重新签名");
    }
    if (typeof body.nonce !== "string" || !/^[A-Za-z0-9-]{16,128}$/.test(body.nonce)) {
      throw new SecurityError(400, "NONCE_INVALID", "签名随机码无效");
    }
    if (typeof body.signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(body.signature)) {
      throw new SecurityError(400, "SIGNATURE_INVALID", "钱包签名无效");
    }

    const address = ethers.getAddress(body.address);
    assertWalletNotBlocked(address);
    enforceRateLimit(`ai-session:wallet:${address.toLowerCase()}`, 3, 60 * 60_000);
    enforceRateLimit(`ai-session:wallet-day:${address.toLowerCase()}`, 10, 24 * 60 * 60_000);

    const message = buildWalletAccessMessage({
      origin,
      address,
      timestamp: body.timestamp,
      nonce: body.nonce,
    });
    let recovered: string;
    try {
      recovered = ethers.getAddress(ethers.verifyMessage(message, body.signature));
    } catch {
      throw new SecurityError(401, "SIGNATURE_INVALID", "钱包签名校验失败");
    }
    if (recovered !== address) {
      throw new SecurityError(401, "SIGNATURE_MISMATCH", "签名钱包与请求钱包不一致");
    }

    const minimum = getMinimumKimi();
    const balance = await getKimiBalance(address);
    if (balance < minimum.amount) {
      throw new SecurityError(403, "KIMI_BALANCE_LOW", `AI 功能需要钱包至少持有 ${minimum.label} KIMI`);
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + SESSION_TTL_SECONDS;
    const session = await createAiSessionToken({
      v: 1,
      wallet: address.toLowerCase(),
      origin,
      iat: now,
      exp: expiresAt,
    });

    console.log("[ai-session] issued", { wallet: address, clientIp, expiresAt });
    return jsonResponse(req, {
      session,
      expiresAt,
      wallet: address,
      minimumKimi: minimum.label,
    });
  } catch (error) {
    return securityErrorResponse(req, error);
  }
}