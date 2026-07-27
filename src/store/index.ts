import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatSession, LogEntry, IssuedToken, ToastState } from "@/types";

interface AppState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  logs: LogEntry[];
  issuedTokens: IssuedToken[];
  toast: ToastState | null;

  addSession: (session: ChatSession) => void;
  updateSession: (id: string, updates: Partial<ChatSession>) => void;
  deleteSession: (id: string) => void;
  setCurrentSession: (id: string | null) => void;
  addMessage: (sessionId: string, message: ChatSession["messages"][number]) => void;

  addLog: (log: Omit<LogEntry, "id" | "timestamp">) => void;
  clearLogs: () => void;

  addIssuedToken: (token: Omit<IssuedToken, "id" | "createdAt">) => void;
  updateIssuedToken: (id: string, updates: Partial<IssuedToken>) => void;
  removeIssuedToken: (id: string) => void;
  clearIssuedTokens: () => void;

  showToast: (toast: Omit<ToastState, "id">) => void;
  hideToast: () => void;
}

const STORAGE_KEY = "flap-vault-ai-coder";

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sessions: [],
      currentSessionId: null,
      logs: [],
      issuedTokens: [],
      toast: null,

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

      addIssuedToken: (token) =>
        set((state) => ({
          issuedTokens: [
            {
              ...token,
              id: crypto.randomUUID(),
              createdAt: Date.now(),
            },
            ...state.issuedTokens,
          ],
        })),

      updateIssuedToken: (id, updates) =>
        set((state) => ({
          issuedTokens: state.issuedTokens.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),

      removeIssuedToken: (id) =>
        set((state) => ({
          issuedTokens: state.issuedTokens.filter((t) => t.id !== id),
        })),

      clearIssuedTokens: () => set({ issuedTokens: [] }),

      showToast: (toast) =>
        set(() => ({
          toast: { ...toast, id: crypto.randomUUID() },
        })),

      hideToast: () => set({ toast: null }),
    }),
    {
      name: STORAGE_KEY,
    }
  )
);
