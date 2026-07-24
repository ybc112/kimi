import { ChatRequest } from "@/types";

const API_URL = "https://api.deepseek.com/chat/completions";
const API_KEY = "sk-745928dc711640af96f0bcab66202aba";

export async function sendChatMessage(request: ChatRequest): Promise<string> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: request.model || "deepseek-chat",
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
