import { useState } from "react";
import { useTheme } from "./hooks/useTheme";
import { useProviders } from "./hooks/useProviders";
import { Sidebar } from "./components/Sidebar";
import { HomeView } from "./components/HomeView";
import { ProviderDetail } from "./components/ProviderDetail";
import { ProviderForm } from "./components/ProviderForm";
import { ChatView } from "./components/ChatView";
import { ExportView } from "./components/ExportView";
import { EmptyState } from "./components/EmptyState";
import { DeleteConfirm } from "./components/DeleteConfirm";
import type { Provider, ViewMode } from "./types";
import { getGroup } from "./types";
import styles from "./App.module.css";

export default function App() {
  const { theme, toggle } = useTheme();
  const { providers, loading, addProvider, updateProvider, deleteProvider } = useProviders();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("home");
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null);

  // Shared group order — drives both Sidebar and HomeView (#3)
  const [groupOrder, setGroupOrder] = useState<string[]>([]);

  const selected = providers.find((p) => p.id === selectedId) ?? null;

  // Compute the canonical ordered group list from providers + saved order
  const allGroupNames = Array.from(new Set(providers.map(getGroup)));
  const orderedGroupNames = [
    ...groupOrder.filter((g) => allGroupNames.includes(g)),
    ...allGroupNames.filter((g) => !groupOrder.includes(g)),
  ];

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setView("detail");
  };

  const handleHome = () => {
    setSelectedId(null);
    setView("home");
  };

  const handleAdd = () => {
    setSelectedId(null);
    setView("add");
  };

  const handleEdit = () => setView("edit");
  const handleChat = () => setView("chat");
  const handleExport = () => setView("export");

  const handleSave = async (p: Provider) => {
    if (view === "add") {
      await addProvider(p);
      setSelectedId(p.id);
      setView("detail");
    } else {
      await updateProvider(p);
      setView("detail");
    }
  };

  const handleCancel = () => {
    if (selectedId) {
      setView("detail");
    } else {
      setView("home");
    }
  };

  const handleDeleteRequest = () => {
    if (selected) setDeleteTarget(selected);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteProvider(deleteTarget.id);
    setDeleteTarget(null);
    setSelectedId(null);
    setView("home");
  };

  const handleDuplicate = (p: Provider) => {
    const now = new Date().toISOString();
    const copy: Provider = {
      ...p,
      id: crypto.randomUUID(),
      modelName: `${p.modelName} (copy)`,
      createdAt: now,
      updatedAt: now,
    };
    addProvider(copy).then(() => {
      setSelectedId(copy.id);
      setView("detail");
    });
  };

  const renderMain = () => {
    if (loading) return <div className={styles.loading}>Loading wallet…</div>;

    if (view === "add") {
      return <ProviderForm key="add" onSave={handleSave} onCancel={handleCancel} />;
    }

    if (view === "edit" && selected) {
      return <ProviderForm key={`edit-${selected.id}`} initial={selected} onSave={handleSave} onCancel={handleCancel} />;
    }

    if (view === "chat" && selected) {
      return <ChatView provider={selected} onBack={() => setView("detail")} />;
    }

    if (view === "export" && selected) {
      return <ExportView provider={selected} onBack={() => setView("detail")} />;
    }

    if (view === "detail" && selected) {
      return (
        <ProviderDetail
          provider={selected}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
          onChat={handleChat}
          onExport={handleExport}
          onDuplicate={() => handleDuplicate(selected)}
        />
      );
    }

    // home view — grouped cards
    if (providers.length === 0) return <EmptyState onAdd={handleAdd} />;
    return (
      <HomeView
        providers={providers}
        orderedGroupNames={orderedGroupNames}
        onSelect={handleSelect}
        onAdd={handleAdd}
        onChat={(id) => { setSelectedId(id); setView("chat"); }}
      />
    );
  };

  return (
    <div className={styles.app}>
      <Sidebar
        providers={providers}
        selectedId={selectedId}
        onSelect={handleSelect}
        onAdd={handleAdd}
        onHome={handleHome}
        theme={theme}
        onToggleTheme={toggle}
        activeView={view}
        groupOrder={orderedGroupNames}
        onGroupOrderChange={setGroupOrder}
      />
      <main className={styles.main}>
        {renderMain()}
      </main>

      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.modelName}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
