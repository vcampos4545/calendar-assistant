"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { UserPreferences } from "@/lib/preferences";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatHandle {
  sendMessage: (text: string) => void;
}

interface ChatProps {
  onCalendarChange?: () => void;
  preferences?: UserPreferences;
}

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z" />
    </svg>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex gap-1 items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export const Chat = forwardRef<ChatHandle, ChatProps>(function Chat(
  { onCalendarChange, preferences },
  ref,
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function sendText(text: string) {
    if (!text.trim() || streaming) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const history = [...messages, userMsg];

    setMessages(history);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, preferences }),
      });

      if (!res.ok || !res.body) {
        setMessages([
          ...history,
          { role: "assistant", content: "Something went wrong. Please try again." },
        ]);
        return;
      }

      const calendarModified = res.headers.get("X-Calendar-Modified") === "true";
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      setMessages([...history, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: accumulated }]);
      }

      if (calendarModified) onCalendarChange?.();
    } finally {
      setStreaming(false);
    }
  }

  useImperativeHandle(ref, () => ({
    sendMessage(text: string) {
      setTimeout(() => sendText(text), 50);
    },
  }));

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText(input);
    }
  }

  const showTypingIndicator =
    streaming && messages.length > 0 && messages[messages.length - 1].content === "";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8 text-center">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Ask me anything about your schedule
            </p>
            <div className="flex flex-col gap-1.5 w-full mt-1">
              {[
                "What does my week look like?",
                "Find me a free hour tomorrow",
                "Schedule gym 3× this week",
              ].map((hint) => (
                <button
                  key={hint}
                  onClick={() => sendText(hint)}
                  className="text-left text-xs text-zinc-500 dark:text-zinc-400 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === "user"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-br-sm"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {showTypingIndicator && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 px-2 py-2 flex gap-1.5 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Message…"
          disabled={streaming}
          className="flex-1 resize-none text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 rounded-xl px-3 py-2 outline-none disabled:opacity-60 leading-relaxed"
          style={{ minHeight: "34px" }}
        />
        <button
          onClick={() => sendText(input)}
          disabled={!input.trim() || streaming}
          className="shrink-0 w-8 h-8 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center disabled:opacity-30 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
});
