import { Sun, Moon, Plus, Wallet, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Provider, Theme, ViewMode } from "../types";
import { getGroup, daysUntilExpiry } from "../types";
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

function ExpiryBadge({ provider }: { provider: Provider }) {
  const days = daysUntilExpiry(provider);
  if (days === null) return null;
  if (days < 0) return <span className={`${styles.badge} ${styles.expired}`}>Expired</span>;
  if (days <= 7) return <span className={`${styles.badge} ${styles.warn}`}>{days}d</span>;
  if (days <= 30) return <span className={`${styles.badge} ${styles.soon}`}>{days}d</span>;
  return null;
}

export function Sidebar({ providers, selectedId, onSelect, onAdd, theme, onToggleTheme }: Props) {
  // Group providers by providerGroup
  const groups = providers.reduce<Record<string, Provider[]>>((acc, p) => {
    const g = getGroup(p);
    if (!acc[g]) acc[g] = [];
    acc[g].push(p);
    return acc;
  }, {});

  const groupNames = Object.keys(groups).sort();

  // Collapsed state per group — default all expanded
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (g: string) => setCollapsed((prev) => ({ ...prev, [g]: !prev[g] }));

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
          Add
        </button>
      </div>

      <nav className={styles.nav}>
        {groupNames.length === 0 ? (
          <div className={styles.empty}>No providers yet</div>
        ) : (
          groupNames.map((groupName) => {
            const models = groups[groupName];
            const isCollapsed = collapsed[groupName] ?? false;
            const isSingle = models.length === 1;

            return (
              <div key={groupName} className={styles.group}>
                {/* Group header — only shown when multiple models */}
                {!isSingle && (
                  <button className={styles.groupHeader} onClick={() => toggle(groupName)}>
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    <span className={styles.groupName}>{groupName}</span>
                    <span className={styles.groupCount}>{models.length}</span>
                  </button>
                )}

                {/* Model entries */}
                {(!isCollapsed || isSingle) && models.map((p) => (
                  <button
                    key={p.id}
                    className={`${styles.navItem} ${selectedId === p.id ? styles.active : ""} ${!isSingle ? styles.indented : ""}`}
                    onClick={() => onSelect(p.id)}
                  >
                    <div className={styles.providerDot} />
                    <div className={styles.providerInfo}>
                      <span className={styles.providerName}>
                        {isSingle ? groupName : p.modelName}
                      </span>
                      <span className={styles.providerModel}>
                        {isSingle ? p.modelName : p.name}
                      </span>
                    </div>
                    <ExpiryBadge provider={p} />
                  </button>
                ))}
              </div>
            );
          })
        )}
      </nav>

      <div className={styles.footer}>
        <span className={styles.footerText}>{providers.length} model{providers.length !== 1 ? "s" : ""}</span>
      </div>
    </aside>
  );
}
