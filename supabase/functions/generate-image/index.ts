// Supabase Edge Function: authenticated image generation proxy.
// Requests require a short-lived wallet/KIMI session issued by ai-session.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  SecurityError,
  assertClientIpAllowed,
  corsHeaders,
  enforceRateLimit,
  jsonResponse,
  readJsonBody,
  readPositiveInt,
  securityErrorResponse,
  verifyAiSession,
} from "../_shared/ai-security.ts";

type ImageRequestBody = {
  prompt?: unknown;
  size?: unknown;
};

const ALLOWED_SIZES = new Set(["1024x1024", "1792x1024", "1024x1792"]);
const IMAGE_RATE_PER_TEN_MINUTES = readPositiveInt("AI_IMAGE_RATE_LIMIT_PER_10_MINUTES", 1, 20);
const IMAGE_IP_RATE_PER_TEN_MINUTES = readPositiveInt("AI_IMAGE_IP_RATE_LIMIT_PER_10_MINUTES", 2, 60);
const IMAGE_RATE_PER_DAY = readPositiveInt("AI_IMAGE_RATE_LIMIT_PER_DAY", 5, 100);
const IMAGE_UPSTREAM_TIMEOUT_MS = readPositiveInt("OPENAI_IMAGE_TIMEOUT_MS", 300_000, 360_000);

function readUpstreamMessage(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const error = (data as { error?: unknown }).error;
    if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message.slice(0, 500);
    }
  }
  return `生图服务返回状态 ${status}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  try {
    const clientIp = assertClientIpAllowed(req);
    const session = await verifyAiSession(req);
    enforceRateLimit(`image:wallet:${session.wallet}`, IMAGE_RATE_PER_TEN_MINUTES, 10 * 60_000);
    enforceRateLimit(`image:wallet-day:${session.wallet}`, IMAGE_RATE_PER_DAY, 24 * 60 * 60_000);
    enforceRateLimit(`image:ip:${clientIp}`, IMAGE_IP_RATE_PER_TEN_MINUTES, 10 * 60_000);

    const body = await readJsonBody<ImageRequestBody>(req, 16_384);
    if (typeof body.prompt !== "string" || !body.prompt.trim()) {
      throw new SecurityError(400, "PROMPT_REQUIRED", "生图提示词不能为空");
    }
    const prompt = body.prompt.trim();
    if (prompt.length > 1_200) {
      throw new SecurityError(413, "PROMPT_TOO_LARGE", "生图提示词不能超过 1200 个字符");
    }
    const size = typeof body.size === "string" && ALLOWED_SIZES.has(body.size) ? body.size : "1024x1024";

    const apiKey = Deno.env.get("OPENAI_IMAGE_API_KEY");
    const baseUrl = Deno.env.get("OPENAI_IMAGE_BASE_URL") || "https://api.iotwq.top";
    const model = Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-2";
    if (!apiKey) throw new SecurityError(503, "IMAGE_KEY_MISSING", "生图服务密钥未配置");

    console.log("[generate-image] request", {
      wallet: session.wallet,
      clientIp,
      model,
      size,
      promptCharacters: prompt.length,
    });

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size,
          response_format: "b64_json",
        }),
        signal: AbortSignal.timeout(IMAGE_UPSTREAM_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const isTimeout =
        error instanceof DOMException &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      console.error("[generate-image] upstream fetch failed", {
        wallet: session.wallet,
        isTimeout,
        reason: reason.slice(0, 300),
      });
      if (isTimeout) {
        throw new SecurityError(504, "IMAGE_UPSTREAM_TIMEOUT", "生图时间超过 5 分钟，请稍后重试");
      }
      throw new SecurityError(502, "IMAGE_UPSTREAM_UNAVAILABLE", "暂时无法连接生图服务，请稍后重试");
    }

    const contentLength = Number(response.headers.get("content-length") || "0");
    if (contentLength > 20_000_000) {
      return jsonResponse(req, { error: "生图服务返回内容过大", code: "UPSTREAM_TOO_LARGE" }, 502);
    }
    const rawText = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
    console.log("[generate-image] response", { wallet: session.wallet, status: response.status });

    if (!response.ok) {
      return jsonResponse(req, { error: readUpstreamMessage(data, response.status), code: "UPSTREAM_ERROR" }, 502);
    }
    if (!data || typeof data !== "object") {
      return jsonResponse(req, { error: "生图服务返回格式无效", code: "UPSTREAM_INVALID" }, 502);
    }
    return jsonResponse(req, data as Record<string, unknown>);
  } catch (error) {
    return securityErrorResponse(req, error);
  }
});
