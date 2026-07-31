import { ChatRequest } from "@/types";
import { invokeProtectedAiFunction } from "./aiSession";

// DeepSeek's current API only accepts the v4 model identifiers below.
// Keep the model in one place so every feature uses the same supported value.
export const DEFAULT_MODEL = "deepseek-v4-flash";

export async function sendChatMessage(request: ChatRequest): Promise<string> {
  const data = await invokeProtectedAiFunction<{ choices?: Array<{ message?: { content?: unknown } }> }>(
    "deepseek-chat",
    {
      model: request.model || DEFAULT_MODEL,
      messages: request.messages,
      stream: false,
      temperature: request.temperature ?? 0.3,
    }
  );

  const content = data?.choices?.[0]?.message?.content;

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
  const data = await invokeProtectedAiFunction<{ data?: Array<{ b64_json?: unknown; url?: unknown }> }>(
    "generate-image",
    {
      model: request.model || "gpt-image-2",
      prompt: request.prompt,
      n: request.n ?? 1,
      size: request.size || "1024x1024",
      response_format: "b64_json",
    }
  );

  const item = data?.data?.[0];
  const b64 = item?.b64_json;
  const url = item?.url;

  if (typeof b64 === "string") {
    return `data:image/png;base64,${b64}`;
  }

  if (typeof url === "string") {
    return url;
  }

  throw new Error("Invalid image API response format");
}
