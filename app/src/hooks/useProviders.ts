import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Provider } from "../types";

export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await invoke<Provider[]>("list_providers");
      setProviders(data);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addProvider = async (provider: Provider) => {
    await invoke("add_provider", { provider });
    await refresh();
  };

  const updateProvider = async (provider: Provider) => {
    await invoke("update_provider", { provider });
    await refresh();
  };

  const deleteProvider = async (id: string) => {
    await invoke("delete_provider", { id });
    await refresh();
  };

  return { providers, loading, error, refresh, addProvider, updateProvider, deleteProvider };
}
