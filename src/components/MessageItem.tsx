import ReactMarkdown from "react-markdown";
import { Bot } from "lucide-react";
import { CodeBlock } from "./CodeBlock";

interface MessageItemProps {
  role: "user" | "assistant" | "system";
  content: string;
}

export function MessageItem({ role, content }: MessageItemProps) {
  const isUser = role === "user";

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-[#2A2D31] px-5 py-3 text-sm text-white"
            : "max-w-[90%] rounded-2xl rounded-tl-sm border border-[#23262A] bg-[#15171A] px-5 py-3 text-sm text-[#E8E8E8]"
        }
      >
        {!isUser && (
          <div className="mb-2 flex items-center gap-2">
            <Bot className="h-4 w-4 text-[#2EDEDB]" />
            <span className="text-xs font-medium text-[#2EDEDB]">Kimi</span>
          </div>
        )}

        <div className="prose prose-invert prose-sm max-w-none break-words">
          <ReactMarkdown
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const code = String(children).replace(/\n$/, "");
                if (match) {
                  return <CodeBlock code={code} language={match[1]} />;
                }
                return (
                  <code className="break-all rounded bg-[#23262A] px-1.5 py-0.5 text-[#D0FF00]" {...props}>
                    {children}
                  </code>
                );
              },
              pre({ children }) {
                return <div>{children}</div>;
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
