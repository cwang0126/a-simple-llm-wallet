import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Provider } from "../types";

export interface KnownProvider {
  name: string;
  baseUrl: string;
  modelsEndpoint: string | null;
  /**
   * How to authenticate when fetching models:
   * - "bearer"    — Authorization: Bearer <key>  (default, most providers)
   * - "query_key" — ?key=<key>                   (Google AI Studio)
   * - "github"    — Bearer + GitHub-specific headers
   * - "none"      — no auth header               (Ollama, LM Studio local)
   */
  authStyle?: "bearer" | "query_key" | "github" | "none";
}

export interface ModelInfo {
  id: string;
  info: string;
  raw: Record<string, unknown>;
}

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

export async function getKnownProviders(): Promise<KnownProvider[]> {
  try {
    return await invoke<KnownProvider[]>("get_known_providers");
  } catch {
    return [];
  }
}

export async function fetchModels(baseUrl: string, apiKey: string): Promise<ModelInfo[]> {
  const url = baseUrl.replace(/\/$/, "") + "/models";
  return fetchModelsFromUrl(url, apiKey, "bearer");
}

export async function fetchModelsFromUrl(
  url: string,
  apiKey: string,
  authStyle: KnownProvider["authStyle"] = "bearer",
): Promise<ModelInfo[]> {
  // Use Rust-side fetch to bypass webview CORS/CSP restrictions
  const items = await invoke<Record<string, unknown>[]>("fetch_models", {
    url,
    apiKey,
    authStyle: authStyle ?? "bearer",
  });

  return items.map((obj) => {
    const id = String(obj.id ?? obj.name ?? "unknown");
    const info = Object.entries(obj)
      .filter(([k]) => k !== "id" && k !== "name")
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join(" | ");
    return { id, info, raw: obj };
  });
}

export async function logConnectivity(entry: string): Promise<void> {
  try {
    await invoke("log_connectivity", { entry });
  } catch { /* non-critical */ }
}

export async function openUrl(url: string): Promise<void> {
  await invoke("open_url", { url });
}

export async function openProvidersFile(): Promise<void> {
  await invoke("open_providers_file");
}
