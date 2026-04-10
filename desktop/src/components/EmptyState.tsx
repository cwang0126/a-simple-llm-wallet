import { Wallet, Plus } from "lucide-react";
import styles from "./EmptyState.module.css";

interface Props {
  onAdd: () => void;
}

export function EmptyState({ onAdd }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.icon}>
        <Wallet size={40} />
      </div>
      <h2 className={styles.title}>No providers yet</h2>
      <p className={styles.desc}>
        Add your first LLM provider to get started. Store credentials for OpenAI,
        Groq, Ollama, or any OpenAI-compatible endpoint.
      </p>
      <button className={styles.btn} onClick={onAdd}>
        <Plus size={15} />
        Add your first provider
      </button>
    </div>
  );
}
