import { useState } from "react";
import { useTheme } from "./hooks/useTheme";
import { useProviders } from "./hooks/useProviders";
import { Sidebar } from "./components/Sidebar";
import { ProviderDetail } from "./components/ProviderDetail";
import { ProviderForm } from "./components/ProviderForm";
import { ChatView } from "./components/ChatView";
import { ExportView } from "./components/ExportView";
import { EmptyState } from "./components/EmptyState";
import { DeleteConfirm } from "./components/DeleteConfirm";
import type { Provider, ViewMode } from "./types";
import styles from "./App.module.css";

export default function App() {
  const { theme, toggle } = useTheme();
  const { providers, loading, addProvider, updateProvider, deleteProvider } = useProviders();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null);

  const selected = providers.find((p) => p.id === selectedId) ?? null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setView("list");
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
    } else {
      await updateProvider(p);
    }
    setView("list");
  };

  const handleDeleteRequest = () => {
    if (selected) setDeleteTarget(selected);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteProvider(deleteTarget.id);
    setDeleteTarget(null);
    setSelectedId(null);
    setView("list");
  };

  const renderMain = () => {
    if (loading) {
      return <div className={styles.loading}>Loading wallet...</div>;
    }

    if (view === "add") {
      return <ProviderForm onSave={handleSave} onCancel={() => setView("list")} />;
    }

    if (view === "edit" && selected) {
      return <ProviderForm initial={selected} onSave={handleSave} onCancel={() => setView("list")} />;
    }

    if (view === "chat" && selected) {
      return <ChatView provider={selected} onBack={() => setView("list")} />;
    }

    if (view === "export" && selected) {
      return <ExportView provider={selected} onBack={() => setView("list")} />;
    }

    if (selected) {
      return (
        <ProviderDetail
          provider={selected}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
          onChat={handleChat}
          onExport={handleExport}
        />
      );
    }

    return <EmptyState onAdd={handleAdd} />;
  };

  return (
    <div className={styles.app}>
      <Sidebar
        providers={providers}
        selectedId={selectedId}
        onSelect={handleSelect}
        onAdd={handleAdd}
        theme={theme}
        onToggleTheme={toggle}
        activeView={view}
      />
      <main className={styles.main}>
        {renderMain()}
      </main>

      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
