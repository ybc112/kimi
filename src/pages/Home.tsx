import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, Sparkles } from "lucide-react";
import { useAppStore } from "@/store";
import { MessageItem } from "@/components/MessageItem";
import { sendChatMessage } from "@/lib/kimi";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const WELCOME_MESSAGE = `你好！我是 Kimi。

可以问我任何问题，比如：
- 帮我解释一段 Solidity 代码
- 怎么部署 Flap Tax Vault V2？
- 写一个简单的 ERC20 合约
- 区块链、Web3、编程相关的问题都可以问`;

export default function Home() {
  const { addLog } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: WELCOME_MESSAGE, timestamp: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || loading) return;

    const userMessage: Message = { role: "user", content, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    addLog({ type: "info", message: "Kimi 对话请求" });

    try {
      const history = messages.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const reply = await sendChatMessage({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You are Kimi, a helpful AI assistant. Answer user questions concisely and accurately. When discussing code, prefer Solidity and blockchain context when relevant.",
          },
          ...history,
          { role: "user", content },
        ],
        stream: false,
        temperature: 0.7,
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, timestamp: Date.now() },
      ]);
      addLog({ type: "success", message: "Kimi 响应成功" });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `请求失败：${detail}`, timestamp: Date.now() },
      ]);
      addLog({ type: "error", message: "Kimi 请求失败", detail });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4 lg:h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Kimi 对话</h2>
          <p className="text-xs text-[#84888C]">普通对话，啥都能问</p>
        </div>
        <button
          onClick={() =>
            setMessages([
              { role: "assistant", content: WELCOME_MESSAGE, timestamp: Date.now() },
            ])
          }
          className="flex items-center gap-2 rounded-lg border border-[#23262A] bg-[#15171A] px-4 py-2 text-sm text-[#9CA3AF] transition-colors hover:border-[#D0FF00]/30 hover:text-white"
        >
          <Sparkles className="h-4 w-4" />
          新对话
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[#23262A] bg-[#15171A]">
        <div className="border-b border-[#23262A] px-5 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-[#D0FF00]" />
            <span className="text-sm font-medium text-white">Kimi</span>
            <span className="rounded-full bg-[#D0FF00]/10 px-2 py-0.5 text-[10px] text-[#D0FF00]">在线</span>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-auto p-4 lg:p-5">
          {messages.map((message, index) => (
            <MessageItem key={index} role={message.role} content={message.content} />
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-[#23262A] bg-[#1A1D21] px-5 py-3">
                <div className="flex items-center gap-2 text-sm text-[#84888C]">
                  <Bot className="h-4 w-4 text-[#2EDEDB]" />
                  <span>Kimi 正在思考</span>
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
              placeholder="问 Kimi 任何问题，按 Enter 发送，Shift+Enter 换行..."
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
      </div>
    </div>
  );
}
