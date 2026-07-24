import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Plus, MessageSquare, Trash2, Bot } from "lucide-react";
import { useAppStore } from "@/store";
import { MessageItem } from "@/components/MessageItem";
import { sendChatMessage } from "@/lib/kimi";
import { FLAP_SYSTEM_PROMPT } from "@/lib/flapContext";
import { cn } from "@/lib/utils";

export default function Chat() {
  const {
    sessions,
    currentSessionId,
    addSession,
    setCurrentSession,
    deleteSession,
    addMessage,
    addLog,
  } = useAppStore();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentSession = sessions.find((s) => s.id === currentSessionId);

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  useEffect(() => {
    if (currentSession && currentSession.messages.length === 0) {
      addMessage(currentSession.id, {
        role: "assistant",
        content:
          "你好！我是 Kimi。请描述你想要的 Vault 机制，例如：\n\n- 我想做一个自动回购代币并销毁的 Vault\n- 我想把税收收入的 50% 分给持有者，50% 加 LP\n- 我想实现一个阶梯式解锁的 Treasury Vault\n\n我会根据 Flap Tax Vault V2 规范生成合规的 Solidity 代码。",
        timestamp: Date.now(),
      });
    }
  }, [currentSession?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentSession?.messages, loading]);

  const createSession = () => {
    const newSession = {
      id: crypto.randomUUID(),
      title: "新对话",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    addSession(newSession);
    return newSession.id;
  };

  const sendMessage = async (sessionId: string, userContent: string) => {
    addMessage(sessionId, {
      role: "user",
      content: userContent,
      timestamp: Date.now(),
    });

    setLoading(true);
    addLog({ type: "info", message: "正在请求 Kimi 生成合约" });

    const session = useAppStore.getState().sessions.find((s) => s.id === sessionId);
    if (!session) {
      setLoading(false);
      return;
    }

    try {
      const history = session.messages
        .filter((m) => m.role !== "system")
        .slice(-20)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const content = await sendChatMessage({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: FLAP_SYSTEM_PROMPT },
          ...history,
          { role: "user", content: userContent },
        ],
        stream: false,
        temperature: 0.3,
      });

      addMessage(sessionId, {
        role: "assistant",
        content,
        timestamp: Date.now(),
      });
      addLog({ type: "success", message: "Kimi 响应成功", detail: `会话：${session.title}` });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      addLog({ type: "error", message: "Kimi 请求失败", detail });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userContent = input.trim();
    setInput("");

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createSession();
    }

    await sendMessage(sessionId, userContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-6">
      <aside className="flex w-64 flex-col rounded-xl border border-[#23262A] bg-[#15171A]">
        <div className="border-b border-[#23262A] p-4">
          <button
            onClick={createSession}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D0FF00] py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            新建会话
          </button>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {sessions.length === 0 ? (
            <div className="px-2 py-8 text-center text-xs text-[#5F656D]">暂无会话</div>
          ) : (
            <ul className="space-y-1">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  onClick={() => setCurrentSession(session.id)}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors",
                    currentSessionId === session.id
                      ? "bg-[#1A1D21] text-[#D0FF00]"
                      : "text-[#9CA3AF] hover:bg-[#1A1D21] hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="truncate">{session.title}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-[#5F656D] hover:text-red-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="flex flex-1 flex-col rounded-xl border border-[#23262A] bg-[#15171A]">
        {!currentSession ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D0FF00]/10">
              <Bot className="h-8 w-8 text-[#D0FF00]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">开始新的金库设计</h3>
              <p className="mt-1 text-sm text-[#84888C]">在下方输入框描述需求，或点击左侧「新建会话」</p>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-[#23262A] px-5 py-3">
              <h3 className="font-medium text-white">{currentSession.title}</h3>
              <p className="text-xs text-[#84888C]">{currentSession.messages.length} 条消息 · Kimi</p>
            </div>

            <div className="flex-1 space-y-5 overflow-auto p-5">
              {currentSession.messages.map((message, index) => (
                <MessageItem key={index} role={message.role} content={message.content} />
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-[#23262A] bg-[#1A1D21] px-5 py-3">
                    <div className="flex items-center gap-2 text-sm text-[#84888C]">
                      <Bot className="h-4 w-4 text-[#2EDEDB]" />
                      <span>Kimi 正在生成合约代码</span>
                      <span className="inline-flex gap-1">
                        <span className="animate-bounce">.</span>
                        <span className="animate-bounce [animation-delay:0.2s]">.</span>
                        <span className="animate-bounce [animation-delay:0.4s]">.</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-[#23262A] p-4">
              <div className="flex items-end gap-3 rounded-xl border border-[#303236] bg-[#0B0D0E] p-3">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="描述你的 Vault 需求，按 Enter 发送，Shift+Enter 换行..."
                  rows={1}
                  disabled={loading}
                  className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-white outline-none placeholder:text-[#5F656D]"
                  style={{ height: "auto" }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#D0FF00] text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
