// Supabase Edge Function: proxy image generation requests to OpenAI-compatible API
// Deploy: supabase functions deploy generate-image
// Env: OPENAI_IMAGE_API_KEY, OPENAI_IMAGE_BASE_URL (default https://api.iotwq.top)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, x-client-info, authorization, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("OPENAI_IMAGE_API_KEY");
  const baseUrl = Deno.env.get("OPENAI_IMAGE_BASE_URL") || "https://api.iotwq.top";

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_IMAGE_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { prompt, size = "1024x1024", model = "gpt-image-2", n = 1, response_format = "b64_json" } = body;

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[generate-image] upstream request:", { model, prompt, size, n });

    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, prompt, n, size, response_format }),
    });

    const rawText = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { raw: rawText };
    }

    console.log("[generate-image] upstream response:", { status: response.status, data });

    if (!response.ok) {
      const message = data?.error?.message || data?.raw || `Upstream returned ${response.status}`;
      return new Response(JSON.stringify({ error: message, upstreamStatus: response.status, upstreamData: data }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
