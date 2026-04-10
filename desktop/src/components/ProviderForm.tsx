import { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { randomUUID } from "../utils/uuid";
import type { Provider, Modality } from "../types";
import styles from "./ProviderForm.module.css";

const ALL_MODALITIES: Modality[] = ["text", "vision", "audio", "embedding", "image-gen"];

interface Props {
  initial?: Provider;
  onSave: (p: Provider) => void;
  onCancel: () => void;
}

export function ProviderForm({ initial, onSave, onCancel }: Props) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [modelName, setModelName] = useState(initial?.modelName ?? "");
  const [contextWindow, setContextWindow] = useState(initial?.contextWindow?.toString() ?? "");
  const [modalities, setModalities] = useState<Modality[]>(initial?.modalities ?? ["text"]);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [showKey, setShowKey] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleModality = (m: Modality) => {
    setModalities((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Required";
    if (!baseUrl.trim()) e.baseUrl = "Required";
    if (!apiKey.trim()) e.apiKey = "Required";
    if (!modelName.trim()) e.modelName = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Auto-append /v1 if bare host
  const normalizeUrl = (url: string) => {
    try {
      const parsed = new URL(url.trim());
      if (parsed.pathname === "/" || parsed.pathname === "") return url.trim() + "/v1";
    } catch { /* ignore */ }
    return url.trim();
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const now = new Date().toISOString();
    const provider: Provider = {
      id: initial?.id ?? randomUUID(),
      name: name.trim(),
      baseUrl: normalizeUrl(baseUrl),
      apiKey: apiKey.trim(),
      modelName: modelName.trim(),
      contextWindow: contextWindow ? parseInt(contextWindow) : undefined,
      modalities,
      notes: notes.trim() || undefined,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(provider);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{isEdit ? "Edit Provider" : "Add Provider"}</h2>
        <button className={styles.closeBtn} onClick={onCancel}><X size={18} /></button>
      </div>

      <div className={styles.form}>
        <FormField label="Provider Name" error={errors.name} required>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Groq, Ollama, OpenAI" />
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
            placeholder="e.g. gpt-4o, llama3-8b-8192" />
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

        <FormField label="Notes">
          <textarea className={styles.textarea} value={notes}
            onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="Optional notes about this provider..." />
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
