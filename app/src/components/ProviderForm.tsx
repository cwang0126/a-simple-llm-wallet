import { useState, useEffect, useRef } from "react";
import { X, Eye, EyeOff, ChevronDown, ChevronUp, Loader, Search } from "lucide-react";
import { randomUUID } from "../utils/uuid";
import type { Provider, Modality } from "../types";
import { getGroup } from "../types";
import { getKnownProviders, fetchModelsFromUrl, type KnownProvider, type ModelInfo } from "../hooks/useProviders";
import styles from "./ProviderForm.module.css";

const ALL_MODALITIES: Modality[] = ["text", "vision", "audio", "embedding", "image-gen"];

const EXPIRY_PRESETS = [
  { label: "Never", value: "" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "3 months", value: "3m" },
  { label: "6 months", value: "6m" },
  { label: "1 year", value: "1y" },
  { label: "Custom…", value: "custom" },
];

const CTX_PRESETS = [
  { label: "4K (4,096)", value: "4096" },
  { label: "8K (8,192)", value: "8192" },
  { label: "16K (16,384)", value: "16384" },
  { label: "32K (32,768)", value: "32768" },
  { label: "64K (65,536)", value: "65536" },
  { label: "128K (131,072)", value: "131072" },
  { label: "200K (204,800)", value: "204800" },
  { label: "1M (1,048,576)", value: "1048576" },
  { label: "Custom…", value: "custom" },
];

interface Props {
  initial?: Provider;
  onSave: (p: Provider) => void;
  onCancel: () => void;
}

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
  return iso.slice(0, 10);
}

function getCtxPreset(val: string): string {
  if (!val) return "8192";
  const found = CTX_PRESETS.find((p) => p.value === val);
  return found ? val : "custom";
}

/** Like JSON.stringify with indent=2 but keeps arrays on a single line. */
function compactJson(value: unknown, indent = 0): string {
  if (Array.isArray(value)) {
    const items = value.map((v) => JSON.stringify(v));
    return "[" + items.join(", ") + "]";
  }
  if (value !== null && typeof value === "object") {
    const pad = "  ".repeat(indent);
    const inner = "  ".repeat(indent + 1);
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${inner}${JSON.stringify(k)}: ${compactJson(v, indent + 1)}`);
    return "{\n" + entries.join(",\n") + "\n" + pad + "}";
  }
  return JSON.stringify(value);
}

export function ProviderForm({ initial, onSave, onCancel }: Props) {
  const isEdit = !!initial;

  // Known providers
  const [knownProviders, setKnownProviders] = useState<KnownProvider[]>([]);
  const [providerSearch, setProviderSearch] = useState("");
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);

  // Core fields
  const [providerGroup, setProviderGroup] = useState(initial ? getGroup(initial) : "");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [modelName, setModelName] = useState(initial?.modelName ?? "");
  const [usage, setUsage] = useState(initial?.usage ?? "");

  // Model picker
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelsEndpoint, setModelsEndpoint] = useState(initial?.modelsEndpoint ?? "");
  const [authStyle, setAuthStyle] = useState<KnownProvider["authStyle"]>(
    (initial?.modelsAuthStyle as KnownProvider["authStyle"]) ?? "bearer"
  );
  const [hoveredModel, setHoveredModel] = useState<ModelInfo | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);
  const [copiedModelId, setCopiedModelId] = useState<string | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Context window
  const initCtxVal = initial?.contextWindow?.toString() ?? "8192";
  const [ctxPreset, setCtxPreset] = useState(getCtxPreset(initCtxVal));
  const [ctxCustom, setCtxCustom] = useState(ctxPreset === "custom" ? initCtxVal : "");

  const [modalities, setModalities] = useState<Modality[]>(initial?.modalities ?? ["text"]);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [showKey, setShowKey] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [expiryPreset, setExpiryPreset] = useState<string>(() => {
    if (!initial?.expiresAt) return "";
    return "custom";
  });
  const [expiryDate, setExpiryDate] = useState(toDateInputValue(initial?.expiresAt));
  const [customExpiry, setCustomExpiry] = useState("");

  useEffect(() => {
    getKnownProviders().then(setKnownProviders);
  }, []);

  const filteredKnown = knownProviders.filter((kp) =>
    kp.name.toLowerCase().includes(providerSearch.toLowerCase())
  );

  const filteredModels = models.filter((m) =>
    m.id.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const selectKnownProvider = (kp: KnownProvider) => {
    setProviderGroup(kp.name);
    setBaseUrl(kp.baseUrl);
    setProviderSearch(kp.name);
    setShowProviderDropdown(false);
    setModelsEndpoint(kp.modelsEndpoint ?? "");
    setAuthStyle(kp.authStyle ?? "bearer");
    // Reset model state when provider changes
    setModels([]);
    setModelName("");
    setModelSearch("");
  };

  const handleFetchModels = async () => {
    if (!apiKey.trim()) {
      setModelError("API Key is required to fetch models.");
      return;
    }
    setModelLoading(true);
    setModelError(null);
    // Don't clear models here — keep the old list visible until new results arrive
    try {
      let resolvedUrl: string;
      const endpoint = modelsEndpoint.trim();
      if (endpoint) {
        if (endpoint.startsWith("http")) {
          resolvedUrl = endpoint;
        } else {
          const base = baseUrl.trim().replace(/\/$/, "");
          resolvedUrl = base + (endpoint.startsWith("/") ? endpoint : "/" + endpoint);
        }
      } else {
        resolvedUrl = baseUrl.trim().replace(/\/$/, "") + "/models";
      }
      const result = await fetchModelsFromUrl(resolvedUrl, apiKey.trim(), authStyle);
      if (result.length === 0) {
        setModelError("No models found at this endpoint.");
      } else {
        setModels(result);
        setModelSearch("");
        setShowModelDropdown(true);
        setModelError(null);
      }
    } catch (err) {
      setModelError(err instanceof Error ? err.message : String(err));
    } finally {
      setModelLoading(false);
    }
  };

  const selectModel = (m: ModelInfo) => {
    setModelName(m.id);
    setModelSearch(m.id);
    setShowModelDropdown(false);
    // Clear tooltip immediately on selection
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setHoveredModel(null);
    setExpandedModelId(null);
  };

  const toggleModality = (m: Modality) => {
    setModalities((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
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

  const getContextWindowValue = (): number | undefined => {
    const raw = ctxPreset === "custom" ? ctxCustom : ctxPreset;
    const n = parseInt(raw);
    return isNaN(n) ? undefined : n;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!providerGroup.trim()) e.provider = "Required";
    if (!baseUrl.trim()) e.baseUrl = "Required";
    if (!apiKey.trim()) e.apiKey = "Required";
    if (!modelName.trim()) e.modelName = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const now = new Date().toISOString();
    const provider: Provider = {
      id: initial?.id ?? randomUUID(),
      provider: providerGroup.trim(),
      baseUrl: normalizeUrl(baseUrl),
      apiKey: apiKey.trim(),
      modelName: modelName.trim(),
      contextWindow: getContextWindowValue(),
      modalities,
      notes: notes.trim() || undefined,
      usage: usage.trim() || undefined,
      modelsEndpoint: modelsEndpoint.trim() || undefined,
      modelsAuthStyle: modelsEndpoint.trim() ? (authStyle ?? "bearer") : undefined,
      expiresAt: computeExpiresAt(),
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(provider);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{isEdit ? "Edit Entry" : "Add Provider"}</h2>
        <button className={styles.closeBtn} onClick={onCancel}><X size={18} /></button>
      </div>

      <div className={styles.form}>
        {/* Provider with known provider picker */}
        <FormField label="Provider" error={errors.provider} required>
          <div className={styles.pickerWrapper}>
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                value={providerGroup}
                onChange={(e) => {
                  setProviderGroup(e.target.value);
                  setProviderSearch(e.target.value);
                }}
                placeholder="e.g. OpenAI, Google AI Studio, OpenRouter, Ollama, ..."
              />
              <button
                type="button"
                className={styles.pickerBtn}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setProviderSearch(""); // clear filter so full list shows
                  setShowProviderDropdown((v) => !v);
                }}
                title="Select from known providers"
              >
                <ChevronDown size={14} />
              </button>
            </div>
            {showProviderDropdown && (
              <div className={styles.dropdown}>
                <div className={styles.dropdownSearch}>
                  <Search size={12} />
                  <input
                    className={styles.dropdownSearchInput}
                    value={providerSearch}
                    onChange={(e) => setProviderSearch(e.target.value)}
                    placeholder="Filter providers…"
                    autoFocus
                    onBlur={() => setTimeout(() => setShowProviderDropdown(false), 150)}
                  />
                </div>
                <div className={styles.dropdownList}>
                  {filteredKnown.map((kp) => (
                    <button
                      key={kp.name}
                      type="button"
                      className={styles.dropdownItem}
                      onMouseDown={() => selectKnownProvider(kp)}
                    >
                      <span className={styles.dropdownItemName}>{kp.name}</span>
                      <span className={styles.dropdownItemSub}>{kp.baseUrl}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </FormField>

        <FormField label="Base URL" error={errors.baseUrl} required>
          <input
            className={styles.input}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="e.g. https://api.openai.com/v1"
          />
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

        {/* Model Name with fetch from endpoint */}
        <FormField label="Model Name" error={errors.modelName} required>
          {/* Model name input — shows fetched list on focus if available */}
          <div className={styles.pickerWrapper}>
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                value={modelName}
                onChange={(e) => { setModelName(e.target.value); setModelSearch(e.target.value); }}
                onFocus={() => models.length > 0 && setShowModelDropdown(true)}
                onBlur={() => setTimeout(() => setShowModelDropdown(false), 150)}
                placeholder="e.g. gpt-4o, gemma3:4b"
              />
              {models.length > 0 && (
                <button
                  type="button"
                  className={styles.pickerBtn}
                  onMouseDown={(e) => { e.preventDefault(); setShowModelDropdown((v) => !v); }}
                  title="Show fetched models"
                >
                  <ChevronDown size={14} />
                </button>
              )}
            </div>
            {showModelDropdown && filteredModels.length > 0 && (
              <div className={styles.dropdown}>
                <div className={styles.dropdownSearch}>
                  <Search size={12} />
                  <input
                    className={styles.dropdownSearchInput}
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder="Filter models…"
                    autoFocus
                    onBlur={() => setTimeout(() => {
                      // Keep open if a properties panel is expanded (user may be selecting text)
                      if (!expandedModelId) setShowModelDropdown(false);
                    }, 200)}
                  />
                </div>
                <div className={styles.dropdownListWrap}>
                  <div className={styles.dropdownList}>
                    {filteredModels.map((m) => (
                      <div key={m.id} className={styles.dropdownItemWrap}>
                        <div
                          className={styles.dropdownItem}
                          onMouseEnter={(e) => {
                            setTooltipPos({ x: e.clientX, y: e.clientY });
                            tooltipTimerRef.current = setTimeout(() => setHoveredModel(m), 600);
                          }}
                          onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => {
                            if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
                            setHoveredModel(null);
                          }}
                        >
                          <button
                            type="button"
                            className={styles.dropdownItemSelect}
                            onMouseDown={() => selectModel(m)}
                          >
                            <span className={styles.dropdownItemName}>{m.id}</span>
                          </button>
                          <button
                            type="button"
                            className={styles.expandBtn}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setExpandedModelId((prev) => prev === m.id ? null : m.id);
                            }}
                            title="Show Model Properties"
                          >
                            {expandedModelId === m.id
                              ? <ChevronUp size={13} />
                              : <ChevronDown size={13} />}
                          </button>
                        </div>
                        {expandedModelId === m.id && (
                          <div className={styles.modelPropsPanel}>
                            {/* Header: prevent blur so dropdown stays open */}
                            <div
                              className={styles.modelPropsPanelHeader}
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              <span className={styles.modelPropsPanelTitle}>Model Properties</span>
                              <button
                                type="button"
                                className={`${styles.modelPropsCopyBtn} ${copiedModelId === m.id ? styles.modelPropsCopied : ""}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  navigator.clipboard.writeText(compactJson(m.raw));
                                  setCopiedModelId(m.id);
                                  if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
                                  copyTimerRef.current = setTimeout(() => setCopiedModelId(null), 2000);
                                }}
                                title="Copy JSON"
                              >
                                {copiedModelId === m.id ? "Copied" : "Copy"}
                              </button>
                            </div>
                            {/* Pre: fully selectable — no preventDefault here */}
                            <pre className={styles.modelPropsText}>
                              {compactJson(m.raw)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Detect models sub-row */}
          <div className={styles.detectRow}>
            <input
              className={`${styles.input} ${styles.endpointInput}`}
              value={modelsEndpoint}
              onChange={(e) => setModelsEndpoint(e.target.value)}
              placeholder="Models endpoint (default: /models)"
            />
            <select
              className={`${styles.select} ${styles.authSelect}`}
              value={authStyle ?? "bearer"}
              onChange={(e) => setAuthStyle(e.target.value as KnownProvider["authStyle"])}
              title="Auth method for models endpoint"
            >
              <option value="bearer">Bearer</option>
              <option value="query_key">?key=</option>
              <option value="github">GitHub</option>
              <option value="none">None</option>
            </select>
            <button
              type="button"
              className={`${styles.detectBtn} ${modelLoading ? styles.detectBtnLoading : ""}`}
              onClick={handleFetchModels}
              disabled={modelLoading}
              title={modelLoading ? "Detecting…" : "Detect available models from endpoint"}
            >
              {modelLoading ? <Loader size={13} className={styles.spin} /> : <Search size={13} />}
              Detect
            </button>
          </div>
          {modelError && <div className={styles.error}>{modelError}</div>}
        </FormField>

        {/* Context window */}
        <FormField label="Context Window">
          <div className={styles.expiryRow}>
            <select
              className={styles.select}
              value={ctxPreset}
              onChange={(e) => { setCtxPreset(e.target.value); if (e.target.value !== "custom") setCtxCustom(""); }}
            >
              {CTX_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {ctxPreset === "custom" && (
              <input
                className={styles.input}
                type="number"
                value={ctxCustom}
                onChange={(e) => setCtxCustom(e.target.value)}
                placeholder="e.g. 200000"
              />
            )}
          </div>
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
            {expiryPreset === "custom" && (
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

        <FormField label="Usage Dashboard URL" hint="e.g. Link to the provider's usage/billing page (optional)">
          <input
            className={styles.input}
            value={usage}
            onChange={(e) => setUsage(e.target.value)}
            placeholder="https://platform.openai.com/usage"
          />
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

      {/* Cursor-following JSON tooltip for model items */}
      {hoveredModel && (
        <div
          className={styles.modelTooltip}
          style={{
            left: tooltipPos.x + 16,
            top: tooltipPos.y + 12,
          }}
        >
          <pre className={styles.modelTooltipPre}>
            {compactJson(hoveredModel.raw)}
          </pre>
        </div>
      )}
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
