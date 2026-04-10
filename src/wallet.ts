import { randomUUID } from "crypto";
import * as storage from "./storage.js";
import type { Provider, Modality } from "./types.js";

export function listProviders(): Provider[] {
  return storage.load().providers;
}

export function getProvider(id: string): Provider | undefined {
  return storage.load().providers.find((p) => p.id === id);
}

/**
 * Find by name or providerGroup (case-insensitive).
 * If multiple models share the same group, returns all of them.
 */
export function findProvidersByGroup(nameOrGroup: string): Provider[] {
  const lower = nameOrGroup.toLowerCase();
  return storage.load().providers.filter(
    (p) =>
      p.name.toLowerCase() === lower ||
      (p.providerGroup ?? "").toLowerCase() === lower
  );
}

/**
 * Resolve a provider for single-target commands (test, chat, export, show, edit, delete).
 * - If nameOrGroup matches exactly one record → return it.
 * - If it matches a group with multiple records and modelName is provided → filter by modelName.
 * - If it matches a group with exactly one record → return it (modelName optional).
 * - Otherwise → return null and let the caller handle the ambiguity.
 */
export function resolveProvider(
  nameOrGroup: string,
  modelName?: string
): { provider: Provider | null; candidates: Provider[] } {
  // Try exact ID first
  const byId = getProvider(nameOrGroup);
  if (byId) return { provider: byId, candidates: [byId] };

  const candidates = findProvidersByGroup(nameOrGroup);
  if (candidates.length === 0) return { provider: null, candidates: [] };

  if (modelName) {
    const lower = modelName.toLowerCase();
    const match = candidates.find((p) => p.modelName.toLowerCase() === lower);
    return { provider: match ?? null, candidates };
  }

  // No model specified — only auto-resolve if there's exactly one
  if (candidates.length === 1) return { provider: candidates[0], candidates };
  return { provider: null, candidates };
}

export interface ProviderInput {
  name: string;
  providerGroup?: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  contextWindow?: number;
  modalities: Modality[];
  notes?: string;
  expiresAt?: string;
}

export function addProvider(input: ProviderInput): Provider {
  const data = storage.load();
  const now = new Date().toISOString();
  const provider: Provider = {
    id: randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  data.providers.push(provider);
  storage.save(data);
  return provider;
}

export function updateProvider(
  id: string,
  input: Partial<ProviderInput>
): Provider | null {
  const data = storage.load();
  const idx = data.providers.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  data.providers[idx] = {
    ...data.providers[idx],
    ...input,
    updatedAt: new Date().toISOString(),
  };
  storage.save(data);
  return data.providers[idx];
}

export function deleteProvider(id: string): boolean {
  const data = storage.load();
  const before = data.providers.length;
  data.providers = data.providers.filter((p) => p.id !== id);
  if (data.providers.length === before) return false;
  storage.save(data);
  return true;
}
