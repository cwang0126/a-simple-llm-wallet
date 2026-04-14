import { useState } from "react";
import {
  Edit2, Trash2, MessageSquare, Download, Eye, EyeOff,
  Copy, Check, Zap, Files, ExternalLink,
} from "lucide-react";
import type { Provider } from "../types";
import { getGroup, daysUntilExpiry } from "../types";
import { logConnectivity, openUrl } from "../hooks/useProviders";
import styles from "./ProviderDetail.module.css";

interface Props {
  provider: Provider;
  onEdit: () => void;
  onDelete: () => void;
  onChat: () => void;
  onExport: () => void;
  onDuplicate: () => void;
}

type TestStatus = "idle" | "testing" | "ok" | "fail";

function ExpiryValue({ provider }: { provider: Provider }) {
  const days = daysUntilExpiry(provider);
  if (days === null) return <span>—</span>;
  const date = new Date(provider.expiresAt!).toLocaleDateString();
  if (days < 0) return <span className={styles.expired}>{date} (expired {Math.abs(days)}d ago)</span>;
  if (days === 0) return <span className={styles.expiredSoon}>{date} (expires today)</span>;
  if (days <= 7) return <span className={styles.expiredSoon}>{date} ({days}d left)</span>;
  if (days <= 30) return <span className={styles.expiringSoon}>{date} ({days}d left)</span>;
  return <span>{date} ({days}d left)</span>;
}

function formatContextWindow(n: number): string {
  if (n >= 1_000_000) return `${n.toLocaleString()} (${Math.round(n / 1_048_576)}M)`;
  if (n >= 1_000) return `${n.toLocaleString()} (${Math.round(n / 1_024)}K)`;
  return String(n);
}

export function ProviderDetail({ provider, onEdit, onDelete, onChat, onExport, onDuplicate }: Props) {
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedModel, setCopiedModel] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");

  const maskedKey = "••••••••" + provider.apiKey.slice(-4);

  const copyKey = async () => {
    await navigator.clipboard.writeText(provider.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1500);
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(provider.baseUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1500);
  };

  const copyModel = async () => {
    await navigator.clipboard.writeText(provider.modelName);
    setCopiedModel(true);
    setTimeout(() => setCopiedModel(false), 1500);
  };

  const runTest = async () => {
    setTestStatus("testing");
    const label = `${getGroup(provider)} / ${provider.modelName}`;
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
      const status = res.ok ? "ok" : "fail";
      setTestStatus(status);
      await logConnectivity(`${status.toUpperCase().padEnd(4)} ${label} — HTTP ${res.status}`);
    } catch (err) {
      setTestStatus("fail");
      await logConnectivity(`FAIL  ${label} — ${err instanceof Error ? err.message : String(err)}`);
    }
    setTimeout(() => setTestStatus("idle"), 5000);
  };

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.titleBlock}>
          <div className={styles.breadcrumb}>
            <span className={styles.groupLabel}>{getGroup(provider)}</span>
            <span className={styles.breadcrumbSep}>/</span>
            <div className={styles.modelRow}>
              <span className={styles.modelLabel}>{provider.modelName}</span>
              <button className={styles.copyModelBtn} onClick={copyModel} title="Copy model name">
                {copiedModel ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            className={`${styles.actionBtn} ${styles.testBtn}`}
            onClick={runTest}
            disabled={testStatus === "testing"}
            title="Quick test"
          >
            <span className={`${styles.statusDot} ${styles[testStatus]}`} />
            <Zap size={14} />
            {testStatus === "testing" ? "Testing…" : "Test"}
          </button>

          <button className={styles.actionBtn} onClick={onChat} title="Chat">
            <MessageSquare size={15} /> Chat
          </button>
          <button className={styles.actionBtn} onClick={onExport} title="Export">
            <Download size={15} /> Export
          </button>
          <button className={styles.actionBtn} onClick={onEdit} title="Edit">
            <Edit2 size={15} />
          </button>
          <button className={styles.actionBtn} onClick={onDuplicate} title="Duplicate">
            <Files size={15} />
          </button>
          <button className={`${styles.actionBtn} ${styles.danger}`} onClick={onDelete} title="Delete">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Base URL */}
        <div className={styles.field}>
          <div className={styles.fieldLabel}>Base URL</div>
          <div className={styles.keyRow}>
            <span className={`${styles.fieldValue} ${styles.mono}`}>{provider.baseUrl}</span>
            <button className={styles.iconBtn} onClick={copyUrl} title="Copy URL">
              {copiedUrl ? <Check size={13} style={{ color: "var(--color-success)" }} /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {/* API Key */}
        <div className={styles.field}>
          <div className={styles.fieldLabel}>API Key</div>
          <div className={styles.keyRow}>
            <span className={`${styles.fieldValue} ${styles.mono}`}>
              {showKey ? provider.apiKey : maskedKey}
            </span>
            <button className={styles.iconBtn} onClick={() => setShowKey((v) => !v)}>
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button className={styles.iconBtn} onClick={copyKey}>
              {copiedKey ? <Check size={13} style={{ color: "var(--color-success)" }} /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        <Field
          label="Context Window"
          value={provider.contextWindow ? formatContextWindow(provider.contextWindow) : "—"}
        />

        <div className={styles.field}>
          <div className={styles.fieldLabel}>Expiry</div>
          <div className={styles.fieldValue}><ExpiryValue provider={provider} /></div>
        </div>

        <div className={styles.field}>
          <div className={styles.fieldLabel}>Modalities</div>
          <div className={styles.tags}>
            {provider.modalities.map((m) => (
              <span key={m} className={styles.tag}>{m}</span>
            ))}
          </div>
        </div>

        {provider.usage && (
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Usage Dashboard</div>
            <div className={styles.keyRow}>
              <span className={`${styles.fieldValue} ${styles.mono}`}>{provider.usage}</span>
              <button
                className={styles.iconBtn}
                onClick={() => openUrl(provider.usage!)}
                title="Open usage dashboard"
              >
                <ExternalLink size={13} />
              </button>
            </div>
          </div>
        )}

        {provider.notes && <Field label="Notes" value={provider.notes} />}
        <Field label="Created" value={new Date(provider.createdAt).toLocaleString()} />
        <Field label="Updated" value={new Date(provider.updatedAt).toLocaleString()} />
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={`${styles.fieldValue} ${mono ? styles.mono : ""}`}>{value}</div>
    </div>
  );
}
