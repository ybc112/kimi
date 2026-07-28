// Supabase Edge Function: authenticated proxy for DeepSeek chat requests.
// The upstream key is only read from Supabase Secrets and is never returned.

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
import { handleAiSessionRequest } from "../_shared/ai-session-handler.ts";

type ChatMessageInput = { role?: unknown; content?: unknown };
type ChatRequestBody = {
  messages?: unknown;
  temperature?: unknown;
};

const ALLOWED_ROLES = new Set(["system", "user", "assistant"]);
const CHAT_RATE_PER_MINUTE = readPositiveInt("AI_CHAT_RATE_LIMIT_PER_MINUTE", 6, 60);
const CHAT_IP_RATE_PER_MINUTE = readPositiveInt("AI_CHAT_IP_RATE_LIMIT_PER_MINUTE", 20, 200);
const MAX_TOKENS = readPositiveInt("DEEPSEEK_MAX_TOKENS", 4_096, 8_192);

function normalizeMessages(value: unknown): Array<{ role: string; content: string }> {
  if (!Array.isArray(value) || value.length === 0 || value.length > 24) {
    throw new SecurityError(400, "MESSAGES_INVALID", "对话消息数量必须为 1 到 24 条");
  }

  let totalCharacters = 0;
  const messages = value.map((item, index) => {
    const message = item as ChatMessageInput;
    if (!message || typeof message !== "object" || typeof message.role !== "string" || !ALLOWED_ROLES.has(message.role)) {
      throw new SecurityError(400, "MESSAGE_ROLE_INVALID", `第 ${index + 1} 条消息角色无效`);
    }
    if (typeof message.content !== "string" || !message.content.trim()) {
      throw new SecurityError(400, "MESSAGE_CONTENT_INVALID", `第 ${index + 1} 条消息内容为空`);
    }
    if (message.content.length > 20_000) {
      throw new SecurityError(413, "MESSAGE_TOO_LARGE", `第 ${index + 1} 条消息过长`);
    }
    totalCharacters += message.content.length;
    return { role: message.role, content: message.content };
  });

  if (totalCharacters > 80_000) {
    throw new SecurityError(413, "CONVERSATION_TOO_LARGE", "对话总长度超过限制");
  }
  return messages;
}

function readUpstreamMessage(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const error = (data as { error?: unknown }).error;
    if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message.slice(0, 500);
    }
  }
  return `AI 服务返回状态 ${status}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.headers.get("x-kimi-ai-action") === "create-session") {
    return handleAiSessionRequest(req);
  }
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  try {
    const clientIp = assertClientIpAllowed(req);
    const session = await verifyAiSession(req);
    enforceRateLimit(`deepseek:wallet:${session.wallet}`, CHAT_RATE_PER_MINUTE, 60_000);
    enforceRateLimit(`deepseek:ip:${clientIp}`, CHAT_IP_RATE_PER_MINUTE, 60_000);

    const body = await readJsonBody<ChatRequestBody>(req, 128_000);
    const messages = normalizeMessages(body.messages);
    const temperature = typeof body.temperature === "number" && Number.isFinite(body.temperature)
      ? Math.min(1, Math.max(0, body.temperature))
      : 0.3;

    const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
    const baseUrl = Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com";
    const model = Deno.env.get("DEEPSEEK_MODEL") || "deepseek-v4-flash";
    if (!apiKey) throw new SecurityError(503, "DEEPSEEK_KEY_MISSING", "AI 服务密钥未配置");

    console.log("[deepseek-chat] request", {
      wallet: session.wallet,
      clientIp,
      model,
      messagesCount: messages.length,
      characters: messages.reduce((sum, item) => sum + item.content.length, 0),
    });

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature,
        max_tokens: MAX_TOKENS,
      }),
      signal: AbortSignal.timeout(90_000),
    });

    const rawText = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
    console.log("[deepseek-chat] response", { wallet: session.wallet, status: response.status });

    if (!response.ok) {
      return jsonResponse(req, { error: readUpstreamMessage(data, response.status), code: "UPSTREAM_ERROR" }, 502);
    }
    if (!data || typeof data !== "object") {
      return jsonResponse(req, { error: "AI 服务返回格式无效", code: "UPSTREAM_INVALID" }, 502);
    }
    return jsonResponse(req, data as Record<string, unknown>);
  } catch (error) {
    return securityErrorResponse(req, error);
  }
});
