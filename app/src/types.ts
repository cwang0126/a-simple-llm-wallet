export type Modality = "text" | "vision" | "audio" | "embedding" | "image-gen";

export interface Provider {
  id: string;
  /** Model-specific label, e.g. "gemma4:e4b" */
  name: string;
  /** Shared provider group, e.g. "Ollama". Falls back to name if absent. */
  providerGroup?: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  contextWindow?: number;
  modalities: Modality[];
  notes?: string;
  /** ISO date string — when this credential/key expires */
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type Theme = "light" | "dark";

export type ViewMode = "list" | "detail" | "add" | "edit" | "chat" | "export";

export function getGroup(p: Provider): string {
  return p.providerGroup ?? p.name;
}

/** Returns days remaining. null = no expiry. negative = expired. */
export function daysUntilExpiry(p: Provider): number | null {
  if (!p.expiresAt) return null;
  const diff = new Date(p.expiresAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
