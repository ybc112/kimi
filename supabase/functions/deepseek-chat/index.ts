// Supabase Edge Function: proxy DeepSeek chat requests
// Deploy: supabase functions deploy deepseek-chat
// Env: DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL (default https://api.deepseek.com)
// Optional: ALLOWED_ORIGINS=comma-separated list (e.g. https://kimi.example.com,http://localhost:5173)
// Optional: RATE_LIMIT_PER_MINUTE=10
// Optional: BLOCKED_IPS=comma-separated list (e.g. 1.2.3.4,5.6.7.8)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const allowedOrigins = Deno.env.get("ALLOWED_ORIGINS")
  ? Deno.env.get("ALLOWED_ORIGINS")!.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  : [];

const rateLimitPerMinute = Number(Deno.env.get("RATE_LIMIT_PER_MINUTE") || "10");

const blockedIps = Deno.env.get("BLOCKED_IPS")
  ? Deno.env.get("BLOCKED_IPS")!.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

const ipBuckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xForwarded = req.headers.get("x-forwarded-for");
  if (xForwarded) return xForwarded.split(",")[0].trim();
  return "unknown";
}

function isBlocked(ip: string): boolean {
  return blockedIps.includes(ip);
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    ipBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  bucket.count++;
  return bucket.count > rateLimitPerMinute;
}

function isAllowedOrigin(req: Request): boolean {
  if (allowedOrigins.length === 0) return true;
  const origin = req.headers.get("origin")?.toLowerCase() || "";
  const referer = req.headers.get("referer")?.toLowerCase() || "";
  return allowedOrigins.some((allowed) => origin === allowed || referer.startsWith(allowed + "/"));
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = origin || allowedOrigins[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "apikey, x-client-info, authorization, content-type",
  };
}

serve(async (req) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  if (!isAllowedOrigin(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const clientIp = getClientIp(req);
  if (isBlocked(clientIp)) {
    return new Response(JSON.stringify({ error: "Blocked" }), {
      status: 403,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  if (isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  const baseUrl = Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com";

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY not configured" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { messages, model = "deepseek-v4-flash", stream = false, ...rest } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages is required" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    console.log("[deepseek-chat] upstream request:", { model, messagesCount: messages.length, stream, clientIp });

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream, ...rest }),
    });

    const rawText = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { raw: rawText };
    }

    console.log("[deepseek-chat] upstream response:", { status: response.status, data });

    if (!response.ok) {
      const message = data?.error?.message || data?.raw || `Upstream returned ${response.status}`;
      return new Response(JSON.stringify({ error: message, upstreamStatus: response.status, upstreamData: data }), {
        status: 502,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
