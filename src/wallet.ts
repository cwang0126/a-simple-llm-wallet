import { randomUUID } from "crypto";
import * as storage from "./storage.js";
import type { Provider, Modality } from "./types.js";

export function listProviders(): Provider[] {
  return storage.load().providers;
}

export function getProvider(id: string): Provider | undefined {
  return storage.load().providers.find((p) => p.id === id);
}

export function findProviderByName(name: string): Provider | undefined {
  return storage.load().providers.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
}

export interface ProviderInput {
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  contextWindow?: number;
  modalities: Modality[];
  notes?: string;
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
