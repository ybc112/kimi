import { ChatRequest } from "@/types";
import { supabase } from "./supabase";

const API_URL = "https://api.deepseek.com/chat/completions";
const API_KEY = "sk-b43fffc8ee0c4a2880dbf200423a68f2";

// DeepSeek's current API only accepts the v4 model identifiers below.
// Keep the model in one place so every feature uses the same supported value.
export const DEFAULT_MODEL = "deepseek-v4-flash";

export async function sendChatMessage(request: ChatRequest): Promise<string> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: request.model || DEFAULT_MODEL,
      messages: request.messages,
      stream: false,
      temperature: request.temperature ?? 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`AI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new Error("Invalid AI response format");
  }

  return content;
}

export interface GenerateImageRequest {
  prompt: string;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  model?: string;
  n?: number;
}

export async function generateImage(request: GenerateImageRequest): Promise<string> {
  const { data, error } = await supabase.functions.invoke("generate-image", {
    body: {
      model: request.model || "dall-e-3",
      prompt: request.prompt,
      n: request.n ?? 1,
      size: request.size || "1024x1024",
    },
  });

  if (error) {
    throw new Error(error.message || "Image API error");
  }

  const url = data?.data?.[0]?.url;

  if (typeof url !== "string") {
    throw new Error("Invalid image API response format");
  }

  return url;
}
