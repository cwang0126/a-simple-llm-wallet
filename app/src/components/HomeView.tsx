import { useState } from "react";
import { Plus, MessageSquare, Zap, Copy, Check } from "lucide-react";
import type { Provider } from "../types";
import { getGroup, daysUntilExpiry } from "../types";
import styles from "./HomeView.module.css";

interface Props {
  providers: Provider[];
  orderedGroupNames: string[];
  onSelect: (id: string) => void;
  onAdd: () => void;
  onChat: (id: string) => void;
  onTest: (id: string) => void;
}

interface TestState {
  status: "idle" | "testing" | "ok" | "fail";
}

function ProviderCard({ provider, onSelect, onChat }: {
  provider: Provider;
  onSelect: (id: string) => void;
  onChat: (id: string) => void;
}) {
  const [testState, setTestState] = useState<TestState>({ status: "idle" });
  const [copiedModel, setCopiedModel] = useState(false);
  const days = daysUntilExpiry(provider);

  const runTest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setTestState({ status: "testing" });
    try {
      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.modelName,
          messages: [{ role: "user", content: "Hello" }],
          max_tokens: 10,
        }),
      });
      setTestState({ status: res.ok ? "ok" : "fail" });
    } catch {
      setTestState({ status: "fail" });
    }
    setTimeout(() => setTestState({ status: "idle" }), 4000);
  };

  const copyModel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(provider.modelName);
    setCopiedModel(true);
    setTimeout(() => setCopiedModel(false), 1500);
  };

  return (
    <div className={styles.card} onClick={() => onSelect(provider.id)}>
      <div className={styles.cardHeader}>
        <div className={styles.modelRow}>
          <span className={styles.modelName}>{provider.modelName}</span>
          <button
            className={styles.copyModelBtn}
            onClick={copyModel}
            title="Copy model name"
          >
            {copiedModel ? <Check size={11} /> : <Copy size={11} />}
          </button>
        </div>
        {days !== null && (
          <span className={`${styles.expiryBadge} ${days < 0 ? styles.expired : days <= 7 ? styles.warn : styles.soon}`}>
            {days < 0 ? "Expired" : `${days}d`}
          </span>
        )}
      </div>

      <div className={styles.cardMeta}>
        <span className={styles.metaUrl}>{provider.baseUrl}</span>
        {provider.contextWindow && (
          <span className={styles.metaCtx}>{(provider.contextWindow / 1000).toFixed(0)}K ctx</span>
        )}
      </div>

      <div className={styles.cardTags}>
        {provider.modalities.map((m) => (
          <span key={m} className={styles.tag}>{m}</span>
        ))}
      </div>

      <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
        {/* Test button with status light */}
        <button
          className={`${styles.cardBtn} ${styles.testBtn}`}
          onClick={runTest}
          disabled={testState.status === "testing"}
          title="Quick test"
        >
          <span className={`${styles.statusDot} ${styles[testState.status]}`} />
          {testState.status === "testing" ? "Testing…" : "Test"}
        </button>

        <button
          className={`${styles.cardBtn} ${styles.chatBtn}`}
          onClick={(e) => { e.stopPropagation(); onChat(provider.id); }}
          title="Chat"
        >
          <MessageSquare size={12} />
          Chat
        </button>
      </div>
    </div>
  );
}

export function HomeView({ providers, orderedGroupNames, onSelect, onAdd, onChat }: Props) {
  const groups = providers.reduce<Record<string, Provider[]>>((acc, p) => {
    const g = getGroup(p);
    if (!acc[g]) acc[g] = [];
    acc[g].push(p);
    return acc;
  }, {});

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <h1 className={styles.title}>Providers</h1>
        <button className={styles.addBtn} onClick={onAdd}>
          <Plus size={14} /> Add Provider
        </button>
      </div>

      {orderedGroupNames.map((groupName) => {
        const models = groups[groupName];
        if (!models) return null;
        return (
          <div key={groupName} className={styles.group}>
            <div className={styles.groupHeader}>
              <Zap size={13} className={styles.groupIcon} />
              <span className={styles.groupName}>{groupName}</span>
              <span className={styles.groupCount}>{models.length}</span>
            </div>
            <div className={styles.cards}>
              {models.map((p) => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  onSelect={onSelect}
                  onChat={onChat}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
