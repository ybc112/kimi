import { ChatRequest } from "@/types";

const API_URL = "https://api.deepseek.com/chat/completions";
const API_KEY = "sk-09bdfd2c15a44b75b8a97aab3f21ac29";

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
