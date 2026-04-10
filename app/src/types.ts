export type Modality = "text" | "vision" | "audio" | "embedding" | "image-gen";

export interface Provider {
  id: string;
  providerGroup?: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  contextWindow?: number;
  modalities: Modality[];
  notes?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletData {
  version: string;
  providers: Provider[];
}

export type Theme = "light" | "dark";

export type ViewMode = "list" | "detail" | "add" | "edit" | "chat" | "export" | "home";

export function getGroup(p: Provider): string {
  return p.providerGroup ?? p.modelName;
}

export function daysUntilExpiry(p: Provider): number | null {
  if (!p.expiresAt) return null;
  const diff = new Date(p.expiresAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
