import { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { randomUUID } from "../utils/uuid";
import type { Provider, Modality } from "../types";
import { getGroup } from "../types";
import styles from "./ProviderForm.module.css";

const ALL_MODALITIES: Modality[] = ["text", "vision", "audio", "embedding", "image-gen"];

const EXPIRY_PRESETS = [
  { label: "None", value: "" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "3 months", value: "3m" },
  { label: "6 months", value: "6m" },
  { label: "1 year", value: "1y" },
  { label: "Custom…", value: "custom" },
];

interface Props {
  initial?: Provider;
  onSave: (p: Provider) => void;
  onCancel: () => void;
}

/** Parse a duration string like "30d", "3m", "1y", "2w" into an ISO date */
function parseExpiry(input: string): string | undefined {
  const match = input.trim().match(/^(\d+)\s*(d|w|m|y)$/i);
  if (!match) return undefined;
  const n = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const date = new Date();
  if (unit === "d") date.setDate(date.getDate() + n);
  else if (unit === "w") date.setDate(date.getDate() + n * 7);
  else if (unit === "m") date.setMonth(date.getMonth() + n);
  else if (unit === "y") date.setFullYear(date.getFullYear() + n);
  return date.toISOString();
}

function toDateInputValue(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

export function ProviderForm({ initial, onSave, onCancel }: Props) {
  const isEdit = !!initial;
  const [providerGroup, setProviderGroup] = useState(initial ? getGroup(initial) : "");
  const [name, setName] = useState(initial?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [modelName, setModelName] = useState(initial?.modelName ?? "");
  const [contextWindow, setContextWindow] = useState(initial?.contextWindow?.toString() ?? "");
  const [modalities, setModalities] = useState<Modality[]>(initial?.modalities ?? ["text"]);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [showKey, setShowKey] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Expiry state
  const [expiryPreset, setExpiryPreset] = useState<string>(() => {
    if (!initial?.expiresAt) return "";
    return "custom"; // show existing date in date picker
  });
  const [expiryDate, setExpiryDate] = useState(toDateInputValue(initial?.expiresAt));
  const [customExpiry, setCustomExpiry] = useState("");

  const toggleModality = (m: Modality) => {
    setModalities((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const normalizeUrl = (url: string) => {
    try {
      const parsed = new URL(url.trim());
      if (parsed.pathname === "/" || parsed.pathname === "") return url.trim() + "/v1";
    } catch { /* ignore */ }
    return url.trim();
  };

  const computeExpiresAt = (): string | undefined => {
    if (expiryPreset === "") return undefined;
    if (expiryPreset === "custom") {
      if (customExpiry.trim()) return parseExpiry(customExpiry.trim());
      if (expiryDate) return new Date(expiryDate).toISOString();
      return undefined;
    }
    return parseExpiry(expiryPreset);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!providerGroup.trim()) e.providerGroup = "Required";
    if (!baseUrl.trim()) e.baseUrl = "Required";
    if (!apiKey.trim()) e.apiKey = "Required";
    if (!modelName.trim()) e.modelName = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const now = new Date().toISOString();
    const resolvedModelName = modelName.trim();
    const resolvedName = name.trim() || resolvedModelName;
    const provider: Provider = {
      id: initial?.id ?? randomUUID(),
      providerGroup: providerGroup.trim(),
      name: resolvedName,
      baseUrl: normalizeUrl(baseUrl),
      apiKey: apiKey.trim(),
      modelName: resolvedModelName,
      contextWindow: contextWindow ? parseInt(contextWindow) : undefined,
      modalities,
      notes: notes.trim() || undefined,
      expiresAt: computeExpiresAt(),
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(provider);
  };

  const showDatePicker = expiryPreset === "custom";

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{isEdit ? "Edit Entry" : "Add Provider"}</h2>
        <button className={styles.closeBtn} onClick={onCancel}><X size={18} /></button>
      </div>

      <div className={styles.form}>
        <FormField label="Provider Group" error={errors.providerGroup} required hint="Groups multiple models together, e.g. Ollama, OpenAI">
          <input className={styles.input} value={providerGroup} onChange={(e) => setProviderGroup(e.target.value)}
            placeholder="e.g. Ollama, OpenAI, Groq" />
        </FormField>

        <FormField label="Entry Label" hint="Optional — defaults to model name if left blank">
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. gemma4:e4b (defaults to model name)" />
        </FormField>

        <FormField label="Base URL" error={errors.baseUrl} required hint="Must end with /v1 for OpenAI-compatible APIs">
          <input className={styles.input} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1" />
        </FormField>

        <FormField label="API Key" error={errors.apiKey} required>
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
            <button className={styles.eyeBtn} onClick={() => setShowKey((v) => !v)}>
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </FormField>

        <FormField label="Model Name" error={errors.modelName} required>
          <input className={styles.input} value={modelName} onChange={(e) => setModelName(e.target.value)}
            placeholder="e.g. gpt-4o, gemma4:e4b" />
        </FormField>

        <FormField label="Context Window (tokens)">
          <input className={styles.input} type="number" value={contextWindow}
            onChange={(e) => setContextWindow(e.target.value)} placeholder="e.g. 128000" />
        </FormField>

        <FormField label="Modalities">
          <div className={styles.checkboxGroup}>
            {ALL_MODALITIES.map((m) => (
              <label key={m} className={styles.checkboxLabel}>
                <input type="checkbox" checked={modalities.includes(m)}
                  onChange={() => toggleModality(m)} className={styles.checkbox} />
                {m}
              </label>
            ))}
          </div>
        </FormField>

        <FormField label="Expiry" hint="Set when this API key or access expires">
          <div className={styles.expiryRow}>
            <select className={styles.select} value={expiryPreset} onChange={(e) => setExpiryPreset(e.target.value)}>
              {EXPIRY_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {showDatePicker && (
              <>
                <input
                  className={styles.input}
                  type="date"
                  value={expiryDate}
                  onChange={(e) => { setExpiryDate(e.target.value); setCustomExpiry(""); }}
                />
                <span className={styles.orText}>or</span>
                <input
                  className={styles.input}
                  value={customExpiry}
                  onChange={(e) => { setCustomExpiry(e.target.value); setExpiryDate(""); }}
                  placeholder="e.g. 45d, 6m, 2y"
                />
              </>
            )}
          </div>
        </FormField>

        <FormField label="Notes">
          <textarea className={styles.textarea} value={notes}
            onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Optional notes..." />
        </FormField>
      </div>

      <div className={styles.footer}>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
        <button className={styles.saveBtn} onClick={handleSubmit}>
          {isEdit ? "Save Changes" : "Add Provider"}
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children, error, hint, required }: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>
      {children}
      {hint && <div className={styles.hint}>{hint}</div>}
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
