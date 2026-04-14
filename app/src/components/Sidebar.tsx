import {
  Sun, Moon, Plus, Wallet, ChevronDown, ChevronRight,
  FolderOpen, Settings, X, ChevronsDownUp, ChevronsUpDown,
} from "lucide-react";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Provider, Theme, ViewMode } from "../types";
import { getGroup, daysUntilExpiry } from "../types";
import styles from "./Sidebar.module.css";

interface Props {
  providers: Provider[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onHome: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  activeView: ViewMode;
  groupOrder: string[];
  onGroupOrderChange: (order: string[]) => void;
}

function ExpiryBadge({ provider }: { provider: Provider }) {
  const days = daysUntilExpiry(provider);
  if (days === null) return null;
  if (days < 0) return <span className={`${styles.badge} ${styles.expired}`}>Expired</span>;
  if (days <= 7) return <span className={`${styles.badge} ${styles.warn}`}>{days}d</span>;
  if (days <= 30) return <span className={`${styles.badge} ${styles.soon}`}>{days}d</span>;
  return null;
}

export function Sidebar({
  providers, selectedId, onSelect, onAdd, onHome,
  theme, onToggleTheme, groupOrder, onGroupOrderChange,
}: Props) {
  const groups = providers.reduce<Record<string, Provider[]>>((acc, p) => {
    const g = getGroup(p);
    if (!acc[g]) acc[g] = [];
    acc[g].push(p);
    return acc;
  }, {});

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapse = (g: string) =>
    setCollapsed((prev) => ({ ...prev, [g]: !prev[g] }));

  const allCollapsed = groupOrder.length > 0 && groupOrder.every((g) => collapsed[g]);
  const toggleAll = () => {
    const next = !allCollapsed;
    setCollapsed(Object.fromEntries(groupOrder.map((g) => [g, next])));
  };

  const moveGroup = (name: string, dir: -1 | 1) => {
    const list = [...groupOrder];
    const idx = list.indexOf(name);
    const next = idx + dir;
    if (next < 0 || next >= list.length) return;
    [list[idx], list[next]] = [list[next], list[idx]];
    onGroupOrderChange(list);
  };

  const [showSettings, setShowSettings] = useState(false);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <button className={styles.logoBtn} onClick={onHome} title="Home">
          <Wallet size={18} className={styles.logoIcon} />
          <span className={styles.logoText}>LLM Wallet</span>
        </button>
        <button className={styles.themeBtn} onClick={onToggleTheme} title="Toggle theme">
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabelRow}>
          <div className={styles.sectionLabel}>Providers</div>
          {groupOrder.length > 0 && (
            <button
              className={styles.collapseAllBtn}
              onClick={toggleAll}
              title={allCollapsed ? "Expand all" : "Collapse all"}
            >
              {allCollapsed ? <ChevronsUpDown size={12} /> : <ChevronsDownUp size={12} />}
            </button>
          )}
        </div>
        <button className={styles.addBtn} onClick={onAdd}>
          <Plus size={14} /> Add
        </button>
      </div>

      <nav className={styles.nav}>
        {groupOrder.length === 0 ? (
          <div className={styles.empty}>No providers yet</div>
        ) : (
          groupOrder.map((groupName, idx) => {
            const models = groups[groupName];
            if (!models) return null;
            const isCollapsed = collapsed[groupName] ?? false;

            return (
              <div key={groupName} className={styles.group}>
                <div className={styles.groupRow}>
                  {/* Left: collapse toggle — always shown */}
                  <button
                    className={styles.groupHeader}
                    onClick={() => toggleCollapse(groupName)}
                  >
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    <span className={styles.groupName}>{groupName}</span>
                    <span className={styles.groupCount}>{models.length}</span>
                  </button>

                  {/* Right: ▲ ▼ reorder buttons, appear on hover */}
                  <div className={styles.reorderBtns}>
                    <button
                      className={styles.reorderBtn}
                      onClick={() => moveGroup(groupName, -1)}
                      disabled={idx === 0}
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      className={styles.reorderBtn}
                      onClick={() => moveGroup(groupName, 1)}
                      disabled={idx === groupOrder.length - 1}
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>
                </div>

                {!isCollapsed &&
                  models.map((p) => (
                    <button
                      key={p.id}
                      className={`${styles.navItem} ${selectedId === p.id ? styles.active : ""} ${styles.indented}`}
                      onClick={() => onSelect(p.id)}
                    >
                      <div className={styles.providerDot} />
                      <div className={styles.providerInfo}>
                        <span className={styles.providerName}>{p.modelName}</span>
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
        <span className={styles.footerText}>
          {providers.length} model{providers.length !== 1 ? "s" : ""}
        </span>
        <button
          className={styles.settingsBtn}
          onClick={() => setShowSettings((v) => !v)}
          title="Settings"
        >
          <Settings size={15} />
        </button>
      </div>

      {showSettings && (
        <div className={styles.settingsPanel}>
          <div className={styles.settingsPanelHeader}>
            <span>Settings</span>
            <button className={styles.settingsClose} onClick={() => setShowSettings(false)}>
              <X size={14} />
            </button>
          </div>
          <button
            className={styles.settingsItem}
            onClick={() => { invoke("open_wallet_file"); setShowSettings(false); }}
          >
            <FolderOpen size={13} />
            Open wallet.json
          </button>
        </div>
      )}
    </aside>
  );
}
