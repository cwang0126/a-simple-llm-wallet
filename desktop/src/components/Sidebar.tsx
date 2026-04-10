import { Sun, Moon, Plus, Wallet } from "lucide-react";
import type { Provider, Theme, ViewMode } from "../types";
import styles from "./Sidebar.module.css";

interface Props {
  providers: Provider[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  activeView: ViewMode;
}

export function Sidebar({ providers, selectedId, onSelect, onAdd, theme, onToggleTheme }: Props) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <Wallet size={18} className={styles.logoIcon} />
          <span className={styles.logoText}>LLM Wallet</span>
        </div>
        <button className={styles.themeBtn} onClick={onToggleTheme} title="Toggle theme">
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Providers</div>
        <button className={styles.addBtn} onClick={onAdd}>
          <Plus size={14} />
          Add Provider
        </button>
      </div>

      <nav className={styles.nav}>
        {providers.length === 0 ? (
          <div className={styles.empty}>No providers yet</div>
        ) : (
          providers.map((p) => (
            <button
              key={p.id}
              className={`${styles.navItem} ${selectedId === p.id ? styles.active : ""}`}
              onClick={() => onSelect(p.id)}
            >
              <div className={styles.providerDot} />
              <div className={styles.providerInfo}>
                <span className={styles.providerName}>{p.name}</span>
                <span className={styles.providerModel}>{p.modelName}</span>
              </div>
            </button>
          ))
        )}
      </nav>

      <div className={styles.footer}>
        <span className={styles.footerText}>{providers.length} provider{providers.length !== 1 ? "s" : ""}</span>
      </div>
    </aside>
  );
}
