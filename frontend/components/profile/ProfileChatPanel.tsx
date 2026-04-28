"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  updatedFields?: boolean;
}

interface Props {
  section: string;
  currentData: Record<string, any>;
  onFieldUpdates: (updates: Record<string, any>) => void;
}

export function ProfileChatPanel({ section, currentData, onFieldUpdates }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load greeting when section mounts
  useEffect(() => {
    setMessages([]);
    setInitialized(false);
    api.profileChatGreeting(section)
      .then((data) => {
        setMessages([{ role: "assistant", content: data.greeting }]);
        setInitialized(true);
      })
      .catch(() => {
        setMessages([{ role: "assistant", content: "How can I help you with this section?" }]);
        setInitialized(true);
      });
  }, [section]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = history.map((m) => ({ role: m.role, content: m.content }));
      const data = await api.profileChatSend(section, apiMessages, currentData);

      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply,
        updatedFields: !!data.field_updates,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.field_updates) {
        onFieldUpdates(data.field_updates);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I'm having trouble responding right now. Please try again." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px] max-h-[680px] bg-white border border-gray-200 rounded-xl shadow-sm sticky top-6">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">VA Claims Assistant</p>
          <p className="text-xs text-gray-400">Ask questions or dictate your answers</p>
        </div>
        <div className="ml-auto w-2 h-2 rounded-full bg-green-400" title="Online" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
        {!initialized && (
          <div className="flex gap-2 items-start">
            <BotAvatar />
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2">
              <TypingDots />
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 items-start ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            {m.role === "assistant" ? <BotAvatar /> : <UserAvatar />}
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-brand-600 text-white rounded-tr-sm"
                  : "bg-gray-100 text-gray-800 rounded-tl-sm"
              }`}
            >
              {m.content}
              {m.updatedFields && (
                <div className="flex items-center gap-1 mt-1.5 text-xs text-green-600">
                  <CheckCircle2 className="w-3 h-3" />
                  Form updated
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 items-start">
            <BotAvatar />
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2">
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-gray-100 shrink-0">
        <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-400">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask a question or describe your situation…"
            className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none max-h-28 overflow-y-auto"
            style={{ fieldSizing: "content" } as any}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-gray-300 text-center mt-1.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0 mt-0.5">
      <Bot className="w-3.5 h-3.5 text-brand-600" />
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
      <User className="w-3.5 h-3.5 text-gray-500" />
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}
