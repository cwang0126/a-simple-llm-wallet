import { useState } from "react";
import { Edit2, Trash2, MessageSquare, Download, Eye, EyeOff, Copy, Check } from "lucide-react";
import type { Provider } from "../types";
import styles from "./ProviderDetail.module.css";

interface Props {
  provider: Provider;
  onEdit: () => void;
  onDelete: () => void;
  onChat: () => void;
  onExport: () => void;
}

export function ProviderDetail({ provider, onEdit, onDelete, onChat, onExport }: Props) {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const maskedKey = "••••••••" + provider.apiKey.slice(-4);

  const copyKey = async () => {
    await navigator.clipboard.writeText(provider.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.titleBlock}>
          <h1 className={styles.name}>{provider.name}</h1>
          <span className={styles.model}>{provider.modelName}</span>
        </div>
        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={onChat} title="Chat">
            <MessageSquare size={15} />
            Chat
          </button>
          <button className={styles.actionBtn} onClick={onExport} title="Export .env">
            <Download size={15} />
            Export
          </button>
          <button className={styles.actionBtn} onClick={onEdit} title="Edit">
            <Edit2 size={15} />
            Edit
          </button>
          <button className={`${styles.actionBtn} ${styles.danger}`} onClick={onDelete} title="Delete">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        <Field label="Base URL" value={provider.baseUrl} mono />
        <div className={styles.field}>
          <div className={styles.fieldLabel}>API Key</div>
          <div className={styles.keyRow}>
            <span className={`${styles.fieldValue} ${styles.mono}`}>
              {showKey ? provider.apiKey : maskedKey}
            </span>
            <button className={styles.iconBtn} onClick={() => setShowKey((v) => !v)} title={showKey ? "Hide" : "Show"}>
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button className={styles.iconBtn} onClick={copyKey} title="Copy">
              {copied ? <Check size={13} style={{ color: "var(--color-success)" }} /> : <Copy size={13} />}
            </button>
          </div>
        </div>
        <Field label="Context Window" value={provider.contextWindow ? `${provider.contextWindow.toLocaleString()} tokens` : "—"} />
        <div className={styles.field}>
          <div className={styles.fieldLabel}>Modalities</div>
          <div className={styles.tags}>
            {provider.modalities.map((m) => (
              <span key={m} className={styles.tag}>{m}</span>
            ))}
          </div>
        </div>
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
