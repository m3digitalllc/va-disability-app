"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Bot, User } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface Props {
  caseId: string;
}

export default function StreamingChat({ caseId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load existing history
  useEffect(() => {
    api
      .getChatHistory(caseId)
      .then((history) => {
        setMessages(history.map((m: any) => ({ role: m.role, content: m.content })));
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoadingHistory(false));
  }, [caseId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);

    // Optimistic user message
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    // Placeholder for streaming assistant response
    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

    try {
      await api.sendMessageStream(
        caseId,
        text,
        (chunk) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last.role === "assistant") {
              next[next.length - 1] = { ...last, content: last.content + chunk };
            }
            return next;
          });
        },
        () => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last.role === "assistant") {
              next[next.length - 1] = { ...last, streaming: false };
            }
            return next;
          });
          setSending(false);
        }
      );
    } catch (err: any) {
      toast.error(err.message);
      // Remove the empty assistant bubble on error
      setMessages((prev) => prev.filter((m) => !(m.role === "assistant" && m.content === "")));
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loadingHistory) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading conversation…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">
            <Bot className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p>Your VA claims interview will begin here.</p>
            <p className="mt-1">Say hello or click below to get started.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === "user" ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-600"
              }`}
            >
              {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-brand-600 text-white rounded-tr-sm"
                  : "bg-gray-50 text-gray-800 rounded-tl-sm border border-gray-100"
              }`}
            >
              {msg.role === "assistant" ? (
                <>
                  <ReactMarkdown className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
                    {msg.content}
                  </ReactMarkdown>
                  {msg.streaming && (
                    <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5" />
                  )}
                </>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-4 flex gap-3 items-end bg-white">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          rows={1}
          placeholder="Type your response… (Enter to send, Shift+Enter for new line)"
          className="flex-1 resize-none px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-50 min-h-[44px] max-h-32 overflow-y-auto"
          style={{ height: "auto" }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 128) + "px";
          }}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          className="p-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition disabled:opacity-50 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
