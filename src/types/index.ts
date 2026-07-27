export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface LogEntry {
  id: string;
  type: "info" | "error" | "success";
  message: string;
  detail?: string;
  timestamp: number;
}

export interface ChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream: boolean;
  temperature?: number;
}

export interface ChatResponse {
  choices: Array<{ message: { content: string } }>;
}

export type TokenStatus = "active" | "pending" | "verified";

export interface IssuedToken {
  id: string;
  name: string;
  symbol: string;
  address: string;
  network: string;
  deployedAt: string;
  status: TokenStatus;
  txHash?: string;
  type?: "vault" | "token" | "meme";
  source?: string;
}

export interface ToastState {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  duration?: number;
}
