"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { UserPreferences } from "@/lib/preferences";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraftData {
  to?: string;
  subject: string;
  body: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  drafts?: DraftData[];
}

export interface ChatHandle {
  sendMessage: (text: string) => void;
}

interface ChatProps {
  onCalendarChange?: () => void;
  preferences?: UserPreferences;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

function DraftCard({ draft }: { draft: DraftData }) {
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (dismissed) return null;

  async function handleSave() {
    setStatus("saving");
    try {
      const res = await fetch("/api/gmail/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrorMsg(data.error ?? "Failed to save");
        setStatus("error");
        return;
      }
      setStatus("saved");
    } catch {
      setErrorMsg("Network error");
      setStatus("error");
    }
  }

  return (
    <div className="mt-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60">
        <div className="flex items-center gap-1.5">
          {/* Envelope icon */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-zinc-400">
            <path d="M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z" />
            <path d="m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z" />
          </svg>
          <span className="font-semibold text-zinc-600 dark:text-zinc-300">Email Draft</span>
        </div>
        {status !== "saved" && (
          <button
            onClick={() => setDismissed(true)}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors leading-none"
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>

      {/* Draft metadata */}
      <div className="px-3 py-2 space-y-0.5 text-zinc-500 dark:text-zinc-400">
        {draft.to && (
          <p>
            <span className="font-medium text-zinc-600 dark:text-zinc-300">To:</span>{" "}
            {draft.to}
          </p>
        )}
        <p>
          <span className="font-medium text-zinc-600 dark:text-zinc-300">Subject:</span>{" "}
          {draft.subject}
        </p>
      </div>

      {/* Action footer */}
      <div className="px-3 py-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
        {status === "saved" ? (
          <>
            <span className="text-green-600 dark:text-green-400 font-medium">Saved to Gmail Drafts</span>
            <a
              href="https://mail.google.com/mail/u/0/#drafts"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-blue-600 dark:text-blue-400 hover:underline"
            >
              Open →
            </a>
          </>
        ) : (
          <>
            {status === "error" && (
              <span className="text-red-500 dark:text-red-400 truncate">{errorMsg}</span>
            )}
            <button
              onClick={handleSave}
              disabled={status === "saving"}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {status === "saving" ? "Saving…" : "Save to Gmail Drafts"}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="ml-auto text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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
        body: JSON.stringify({ messages: history, preferences, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });

      if (!res.ok || !res.body) {
        setMessages([
          ...history,
          { role: "assistant", content: "Something went wrong. Please try again." },
        ]);
        return;
      }

      const calendarModified = res.headers.get("X-Calendar-Modified") === "true";
      const draftHeader = res.headers.get("X-Draft-Data");
      const drafts: DraftData[] = draftHeader
        ? (JSON.parse(decodeURIComponent(draftHeader)) as DraftData[])
        : [];

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

      // Attach draft cards to the final assistant message
      if (drafts.length > 0) {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { ...last, drafts };
          }
          return copy;
        });
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

  const lastMsg = messages[messages.length - 1];
  const showTypingIndicator =
    streaming &&
    messages.length > 0 &&
    (lastMsg.role === "user" || lastMsg.content === "");

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
            <div className="max-w-[88%] flex flex-col">
              <div
                className={`rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                  msg.role === "user"
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-br-sm"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
              {msg.drafts?.map((draft, j) => (
                <DraftCard key={j} draft={draft} />
              ))}
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
