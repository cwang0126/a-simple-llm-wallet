import { useState, useRef, useEffect } from "react";
import { Send, ArrowLeft, Bot, User, Brain } from "lucide-react";
import type { Provider } from "../types";
import styles from "./ChatView.module.css";

interface TokenStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tps: number;
  elapsedMs: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  stats?: TokenStats;
  error?: boolean;
}

interface Props {
  provider: Provider;
  onBack: () => void;
}

function StatsBar({ stats }: { stats: TokenStats }) {
  const elapsed = (stats.elapsedMs / 1000).toFixed(1);
  return (
    <div className={styles.statsBar}>
      <span className={styles.statItem}>
        <span className={styles.statLabel}>Input:</span>
        <span className={styles.statValue}>{stats.promptTokens.toLocaleString()}</span>
      </span>
      <span className={styles.statSep}>·</span>
      <span className={styles.statItem}>
        <span className={styles.statLabel}>Output:</span>
        <span className={styles.statValue}>{stats.completionTokens.toLocaleString()}</span>
      </span>
      <span className={styles.statSep}>·</span>
      <span className={styles.statItem}>
        <span className={styles.statLabel}>Total:</span>
        <span className={styles.statValue}>{stats.totalTokens.toLocaleString()}</span>
      </span>
      <span className={styles.statSep}>·</span>
      <span className={styles.statItem}>
        <span className={styles.statLabel}>Speed:</span>
        <span className={styles.statValue}>{stats.tps.toFixed(1)} tok/s</span>
      </span>
      <span className={styles.statSep}>·</span>
      <span className={styles.statItem}>
        <span className={styles.statLabel}>Elapsed:</span>
        <span className={styles.statValue}>{elapsed}s</span>
      </span>
    </div>
  );
}

export function ChatView({ provider, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reasoning, setReasoning] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);
    setStreamingContent("");

    abortRef.current = new AbortController();
    const startTime = performance.now();

    try {
      const body: Record<string, unknown> = {
        model: provider.modelName,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        stream_options: { include_usage: true }, // request usage in stream
      };
      if (reasoning) {
        body.thinking = { type: "enabled", budget_tokens: 2048 };
      }

      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const txt = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${txt}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let accReasoning = "";
      let completionTokenCount = 0;
      let usageStats: TokenStats | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            if (delta?.reasoning_content) accReasoning += delta.reasoning_content;
            if (delta?.content) {
              accumulated += delta.content;
              completionTokenCount++;
              setStreamingContent(accumulated);
            }

            // usage chunk (sent as last SSE event by many providers)
            if (parsed.usage) {
              const elapsed = performance.now() - startTime;
              const outToks = parsed.usage.completion_tokens ?? completionTokenCount;
              usageStats = {
                promptTokens: parsed.usage.prompt_tokens ?? 0,
                completionTokens: outToks,
                totalTokens: parsed.usage.total_tokens ?? (parsed.usage.prompt_tokens ?? 0) + outToks,
                tps: elapsed > 0 ? outToks / (elapsed / 1000) : 0,
                elapsedMs: elapsed,
              };
            }
          } catch { /* skip malformed chunks */ }
        }
      }

      // Fallback stats if provider didn't send usage
      if (!usageStats && completionTokenCount > 0) {
        const elapsed = performance.now() - startTime;
        usageStats = {
          promptTokens: 0,
          completionTokens: completionTokenCount,
          totalTokens: completionTokenCount,
          tps: elapsed > 0 ? completionTokenCount / (elapsed / 1000) : 0,
          elapsedMs: elapsed,
        };
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: accumulated || "(no response)",
          reasoning: accReasoning || undefined,
          stats: usageStats,
        },
      ]);
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") return;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: String(e), error: true },
      ]);
    } finally {
      setLoading(false);
      setStreamingContent("");
      abortRef.current = null;
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const stop = () => abortRef.current?.abort();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={16} />
        </button>
        <div className={styles.headerInfo}>
          <span className={styles.headerName}>{provider.providerGroup ?? provider.modelName}</span>
          <span className={styles.headerModel}>{provider.modelName}</span>
        </div>
        <button
          className={`${styles.reasoningBtn} ${reasoning ? styles.reasoningOn : ""}`}
          onClick={() => setReasoning((v) => !v)}
          title="Toggle reasoning / thinking mode"
        >
          <Brain size={14} />
          Reasoning {reasoning ? "ON" : "OFF"}
        </button>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <Bot size={32} className={styles.emptyIcon} />
            <p>Start a conversation with <strong>{provider.providerGroup ?? provider.modelName}</strong></p>
            <p className={styles.emptyHint}>Enter to send · Shift+Enter for new line</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`${styles.message} ${styles[m.role]} ${m.error ? styles.errorMsg : ""}`}>
            <div className={styles.avatar}>
              {m.role === "user" ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className={styles.bubbleWrap}>
              {m.reasoning && (
                <details className={styles.reasoningBlock}>
                  <summary className={styles.reasoningSummary}>
                    <Brain size={11} /> Reasoning
                  </summary>
                  <pre className={styles.reasoningContent}>{m.reasoning}</pre>
                </details>
              )}
              <div className={styles.bubble}>
                <pre className={styles.content}>{m.content}</pre>
              </div>
              {/* Token stats below assistant messages */}
              {m.role === "assistant" && m.stats && !m.error && (
                <StatsBar stats={m.stats} />
              )}
            </div>
          </div>
        ))}

        {/* Streaming in-progress */}
        {loading && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.avatar}><Bot size={14} /></div>
            <div className={styles.bubbleWrap}>
              <div className={styles.bubble}>
                {streamingContent ? (
                  <pre className={styles.content}>
                    {streamingContent}<span className={styles.cursor} />
                  </pre>
                ) : (
                  <div className={styles.typing}><span /><span /><span /></div>
                )}
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
          placeholder="Type a message…"
          rows={1}
          disabled={loading}
        />
        {loading ? (
          <button className={`${styles.sendBtn} ${styles.stopBtn}`} onClick={stop} title="Stop">
            ■
          </button>
        ) : (
          <button className={styles.sendBtn} onClick={send} disabled={!input.trim()}>
            <Send size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
