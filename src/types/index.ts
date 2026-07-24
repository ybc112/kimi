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
