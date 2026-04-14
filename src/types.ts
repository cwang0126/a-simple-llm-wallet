export type Modality = "text" | "vision" | "audio" | "embedding" | "image-gen";

export interface Provider {
  id: string;
  /** Human-readable label for this specific model entry — optional, falls back to modelName */
  name?: string;
  /** Groups multiple models under one provider, e.g. "Ollama". Falls back to name/modelName if absent. */
  provider?: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  contextWindow?: number;
  modalities: Modality[];
  notes?: string;
  /** URL to the provider's usage/billing dashboard */
  usage?: string;
  /** ISO date string — when this credential/key expires */
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletData {
  version: string;
  providers: Provider[];
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Returns the group name for display/grouping purposes */
export function getGroup(p: Provider): string {
  return p.provider ?? p.name ?? p.modelName;
}

/** Returns days remaining until expiry. null = no expiry set. negative = already expired. */
export function daysUntilExpiry(p: Provider): number | null {
  if (!p.expiresAt) return null;
  const diff = new Date(p.expiresAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
