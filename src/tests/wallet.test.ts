import { describe, it, expect, vi, beforeEach } from "vitest";
import * as storage from "../storage.js";
import {
  listProviders,
  getProvider,
  findProvidersByGroup,
  resolveProvider,
  addProvider,
  updateProvider,
  deleteProvider,
} from "../wallet.js";
import type { WalletData } from "../types.js";

vi.mock("../storage.js");

const mockStorage = vi.mocked(storage);

function makeWalletData(overrides: Partial<WalletData> = {}): WalletData {
  return { version: "1.0.0", providers: [], ...overrides };
}

const sampleProvider = {
  id: "abc-123",
  name: "llama3-8b-8192",
  provider: "Groq",
  baseUrl: "https://api.groq.com/openai/v1",
  apiKey: "gsk_test",
  modelName: "llama3-8b-8192",
  contextWindow: 8192,
  modalities: ["text" as const],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const sampleProvider2 = {
  id: "abc-456",
  name: "llama3-70b-8192",
  provider: "Groq",
  baseUrl: "https://api.groq.com/openai/v1",
  apiKey: "gsk_test",
  modelName: "llama3-70b-8192",
  contextWindow: 8192,
  modalities: ["text" as const],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

beforeEach(() => { vi.clearAllMocks(); });

describe("listProviders", () => {
  it("returns empty array when no providers", () => {
    mockStorage.load.mockReturnValue(makeWalletData());
    expect(listProviders()).toEqual([]);
  });

  it("returns all providers", () => {
    mockStorage.load.mockReturnValue(makeWalletData({ providers: [sampleProvider] }));
    expect(listProviders()).toHaveLength(1);
    expect(listProviders()[0].provider).toBe("Groq");
  });
});

describe("getProvider", () => {
  it("finds provider by exact id", () => {
    mockStorage.load.mockReturnValue(makeWalletData({ providers: [sampleProvider] }));
    expect(getProvider("abc-123")?.modelName).toBe("llama3-8b-8192");
  });

  it("returns undefined for unknown id", () => {
    mockStorage.load.mockReturnValue(makeWalletData());
    expect(getProvider("nope")).toBeUndefined();
  });
});

describe("findProvidersByGroup", () => {
  it("finds all providers in a group case-insensitively", () => {
    mockStorage.load.mockReturnValue(makeWalletData({ providers: [sampleProvider, sampleProvider2] }));
    expect(findProvidersByGroup("groq")).toHaveLength(2);
    expect(findProvidersByGroup("GROQ")).toHaveLength(2);
  });

  it("returns empty array for unknown group", () => {
    mockStorage.load.mockReturnValue(makeWalletData());
    expect(findProvidersByGroup("OpenAI")).toHaveLength(0);
  });
});

describe("resolveProvider", () => {
  it("resolves by exact id", () => {
    mockStorage.load.mockReturnValue(makeWalletData({ providers: [sampleProvider] }));
    const { provider } = resolveProvider("abc-123");
    expect(provider?.id).toBe("abc-123");
  });

  it("auto-resolves when group has exactly one model", () => {
    mockStorage.load.mockReturnValue(makeWalletData({ providers: [sampleProvider] }));
    const { provider } = resolveProvider("Groq");
    expect(provider?.modelName).toBe("llama3-8b-8192");
  });

  it("returns null when group has multiple models and no modelName given", () => {
    mockStorage.load.mockReturnValue(makeWalletData({ providers: [sampleProvider, sampleProvider2] }));
    const { provider, candidates } = resolveProvider("Groq");
    expect(provider).toBeNull();
    expect(candidates).toHaveLength(2);
  });

  it("resolves by modelName when group has multiple models", () => {
    mockStorage.load.mockReturnValue(makeWalletData({ providers: [sampleProvider, sampleProvider2] }));
    const { provider } = resolveProvider("Groq", "llama3-70b-8192");
    expect(provider?.id).toBe("abc-456");
  });

  it("returns null for unknown group", () => {
    mockStorage.load.mockReturnValue(makeWalletData());
    const { provider, candidates } = resolveProvider("Unknown");
    expect(provider).toBeNull();
    expect(candidates).toHaveLength(0);
  });
});

describe("addProvider", () => {
  it("adds a provider and saves", () => {
    mockStorage.load.mockReturnValue(makeWalletData());

    const result = addProvider({
      provider: "OpenAI",
      name: "gpt-4o",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      modelName: "gpt-4o",
      modalities: ["text", "vision"],
    });

    expect(result.provider).toBe("OpenAI");
    expect(result.id).toBeDefined();
    expect(mockStorage.save).toHaveBeenCalledOnce();
    expect(mockStorage.save.mock.calls[0][0].providers[0].modelName).toBe("gpt-4o");
  });
});

describe("updateProvider", () => {
  it("updates fields and saves", () => {
    mockStorage.load.mockReturnValue(makeWalletData({ providers: [{ ...sampleProvider }] }));
    const result = updateProvider("abc-123", { modelName: "llama3-70b-8192" });
    expect(result?.modelName).toBe("llama3-70b-8192");
    expect(result?.provider).toBe("Groq");
    expect(mockStorage.save).toHaveBeenCalledOnce();
  });

  it("returns null for unknown id", () => {
    mockStorage.load.mockReturnValue(makeWalletData());
    expect(updateProvider("ghost", { modelName: "x" })).toBeNull();
    expect(mockStorage.save).not.toHaveBeenCalled();
  });
});

describe("deleteProvider", () => {
  it("deletes existing provider and returns true", () => {
    mockStorage.load.mockReturnValue(makeWalletData({ providers: [{ ...sampleProvider }] }));
    expect(deleteProvider("abc-123")).toBe(true);
    expect(mockStorage.save.mock.calls[0][0].providers).toHaveLength(0);
  });

  it("returns false for unknown id", () => {
    mockStorage.load.mockReturnValue(makeWalletData());
    expect(deleteProvider("ghost")).toBe(false);
    expect(mockStorage.save).not.toHaveBeenCalled();
  });
});
