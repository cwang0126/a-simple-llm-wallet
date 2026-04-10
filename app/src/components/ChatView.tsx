import { useState, useRef, useEffect } from "react";
import { Send, ArrowLeft, Bot, User } from "lucide-react";
import type { Provider } from "../types";
import styles from "./ChatView.module.css";

interface Message {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

interface Props {
  provider: Provider;
  onBack: () => void;
}

export function ChatView({ provider, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const reply = await callLLM(provider, history);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: String(e), error: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={16} />
        </button>
        <div className={styles.headerInfo}>
          <span className={styles.headerName}>{provider.name}</span>
          <span className={styles.headerModel}>{provider.modelName}</span>
        </div>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <Bot size={32} className={styles.emptyIcon} />
            <p>Start a conversation with <strong>{provider.name}</strong></p>
            <p className={styles.emptyHint}>Press Enter to send · Shift+Enter for new line</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`${styles.message} ${styles[m.role]} ${m.error ? styles.errorMsg : ""}`}>
            <div className={styles.avatar}>
              {m.role === "user" ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className={styles.bubble}>
              <pre className={styles.content}>{m.content}</pre>
            </div>
          </div>
        ))}
        {loading && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.avatar}><Bot size={14} /></div>
            <div className={styles.bubble}>
              <div className={styles.typing}>
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputArea}>
        <textarea
          className={styles.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message..."
          rows={1}
          disabled={loading}
        />
        <button className={styles.sendBtn} onClick={send} disabled={!input.trim() || loading}>
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

async function callLLM(provider: Provider, messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({ model: provider.modelName, messages }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "(no response)";
}
