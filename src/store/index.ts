import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatSession, LogEntry } from "@/types";

interface AppState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  logs: LogEntry[];

  addSession: (session: ChatSession) => void;
  updateSession: (id: string, updates: Partial<ChatSession>) => void;
  deleteSession: (id: string) => void;
  setCurrentSession: (id: string | null) => void;
  addMessage: (sessionId: string, message: ChatSession["messages"][number]) => void;

  addLog: (log: Omit<LogEntry, "id" | "timestamp">) => void;
  clearLogs: () => void;
}

const STORAGE_KEY = "flap-vault-ai-coder";

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sessions: [],
      currentSessionId: null,
      logs: [],

      addSession: (session) =>
        set((state) => ({
          sessions: [session, ...state.sessions],
          currentSessionId: session.id,
        })),

      updateSession: (id, updates) =>
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        })),

      deleteSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
        })),

      setCurrentSession: (id) => set({ currentSessionId: id }),

      addMessage: (sessionId, message) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: [...s.messages, message],
                  updatedAt: Date.now(),
                  title: s.title === "新对话" && message.role === "user" ? message.content.slice(0, 20) : s.title,
                }
              : s
          ),
        })),

      addLog: (log) =>
        set((state) => ({
          logs: [
            {
              ...log,
              id: crypto.randomUUID(),
              timestamp: Date.now(),
            },
            ...state.logs,
          ].slice(0, 200),
        })),

      clearLogs: () => set({ logs: [] }),
    }),
    {
      name: STORAGE_KEY,
    }
  )
);
