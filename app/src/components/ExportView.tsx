import { useState } from "react";
import { ArrowLeft, Copy, Check, Download } from "lucide-react";
import type { Provider } from "../types";
import { getGroup } from "../types";
import styles from "./ExportView.module.css";

interface Props {
  provider: Provider;
  onBack: () => void;
}

type Mode = "prefixed" | "generic";

export function ExportView({ provider, onBack }: Props) {
  const [mode, setMode] = useState<Mode>("prefixed");
  const [copied, setCopied] = useState(false);
  const group = getGroup(provider);

  const content = mode === "prefixed" ? generatePrefixed(provider) : generateGeneric(provider);

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `.env.${group.toLowerCase().replace(/\s+/g, "-")}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={16} />
        </button>
        <div className={styles.headerInfo}>
          <span className={styles.headerName}>Export — {group} / {provider.modelName}</span>
          <span className={styles.headerSub}>Generate .env variables</span>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.modeRow}>
          <button
            className={`${styles.modeBtn} ${mode === "prefixed" ? styles.active : ""}`}
            onClick={() => setMode("prefixed")}
          >
            Prefixed ({group.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_*)
          </button>
          <button
            className={`${styles.modeBtn} ${mode === "generic" ? styles.active : ""}`}
            onClick={() => setMode("generic")}
          >
            Generic (OPENAI_*)
          </button>
        </div>

        <div className={styles.codeBlock}>
          <div className={styles.codeActions}>
            <button className={styles.codeBtn} onClick={copy}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button className={styles.codeBtn} onClick={download}>
              <Download size={13} />
              Download .env
            </button>
          </div>
          <pre className={styles.code}>{content}</pre>
        </div>

        <p className={styles.hint}>
          Paste this into your project's <code>.env</code> file. Keep it out of version control.
        </p>
      </div>
    </div>
  );
}

function generatePrefixed(p: Provider): string {
  const group = getGroup(p);
  const prefix = group.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const lines = [
    `# LLM Wallet export — ${group} / ${p.modelName}`,
    `# Generated at ${new Date().toISOString()}`,
    ``,
    `${prefix}_BASE_URL=${p.baseUrl}`,
    `${prefix}_API_KEY=${p.apiKey}`,
    `${prefix}_MODEL=${p.modelName}`,
  ];
  if (p.contextWindow) lines.push(`${prefix}_CONTEXT_WINDOW=${p.contextWindow}`);
  if (p.modalities.length) lines.push(`${prefix}_MODALITIES=${p.modalities.join(",")}`);
  return lines.join("\n") + "\n";
}

function generateGeneric(p: Provider): string {
  const group = getGroup(p);
  const lines = [
    `# LLM Wallet export — ${group} / ${p.modelName} (generic)`,
    `# Generated at ${new Date().toISOString()}`,
    ``,
    `OPENAI_BASE_URL=${p.baseUrl}`,
    `OPENAI_API_KEY=${p.apiKey}`,
    `OPENAI_MODEL=${p.modelName}`,
  ];
  if (p.contextWindow) lines.push(`OPENAI_CONTEXT_WINDOW=${p.contextWindow}`);
  return lines.join("\n") + "\n";
}
