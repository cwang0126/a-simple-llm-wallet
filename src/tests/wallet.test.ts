import { describe, it, expect, vi, beforeEach } from "vitest";
import * as storage from "../storage.js";
import {
  listProviders,
  getProvider,
  findProviderByName,
  addProvider,
  updateProvider,
  deleteProvider,
} from "../wallet.js";
import type { WalletData } from "../types.js";

// Mock storage so tests never touch ~/.llm-wallet
vi.mock("../storage.js");

const mockStorage = vi.mocked(storage);

function makeWalletData(overrides: Partial<WalletData> = {}): WalletData {
  return {
    version: "1.0.0",
    providers: [],
    ...overrides,
  };
}

const sampleProvider = {
  id: "abc-123",
  name: "Groq",
  baseUrl: "https://api.groq.com/openai/v1",
  apiKey: "gsk_test",
  modelName: "llama3-8b-8192",
  contextWindow: 8192,
  modalities: ["text" as const],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listProviders", () => {
  it("returns empty array when no providers", () => {
    mockStorage.load.mockReturnValue(makeWalletData());
    expect(listProviders()).toEqual([]);
  });

  it("returns all providers", () => {
    mockStorage.load.mockReturnValue(makeWalletData({ providers: [sampleProvider] }));
    expect(listProviders()).toHaveLength(1);
    expect(listProviders()[0].name).toBe("Groq");
  });
});

describe("getProvider", () => {
  it("finds provider by exact id", () => {
    mockStorage.load.mockReturnValue(makeWalletData({ providers: [sampleProvider] }));
    expect(getProvider("abc-123")?.name).toBe("Groq");
  });

  it("returns undefined for unknown id", () => {
    mockStorage.load.mockReturnValue(makeWalletData());
    expect(getProvider("nope")).toBeUndefined();
  });
});

describe("findProviderByName", () => {
  it("finds provider case-insensitively", () => {
    mockStorage.load.mockReturnValue(makeWalletData({ providers: [sampleProvider] }));
    expect(findProviderByName("groq")?.id).toBe("abc-123");
    expect(findProviderByName("GROQ")?.id).toBe("abc-123");
  });

  it("returns undefined for unknown name", () => {
    mockStorage.load.mockReturnValue(makeWalletData());
    expect(findProviderByName("OpenAI")).toBeUndefined();
  });
});

describe("addProvider", () => {
  it("adds a provider and saves", () => {
    const data = makeWalletData();
    mockStorage.load.mockReturnValue(data);

    const result = addProvider({
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      modelName: "gpt-4o",
      modalities: ["text", "vision"],
    });

    expect(result.name).toBe("OpenAI");
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeDefined();
    expect(mockStorage.save).toHaveBeenCalledOnce();

    const saved = mockStorage.save.mock.calls[0][0];
    expect(saved.providers).toHaveLength(1);
    expect(saved.providers[0].modelName).toBe("gpt-4o");
  });
});

describe("updateProvider", () => {
  it("updates fields and saves", () => {
    const data = makeWalletData({ providers: [{ ...sampleProvider }] });
    mockStorage.load.mockReturnValue(data);

    const result = updateProvider("abc-123", { modelName: "llama3-70b-8192" });

    expect(result?.modelName).toBe("llama3-70b-8192");
    expect(result?.name).toBe("Groq"); // unchanged
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
    const data = makeWalletData({ providers: [{ ...sampleProvider }] });
    mockStorage.load.mockReturnValue(data);

    expect(deleteProvider("abc-123")).toBe(true);
    expect(mockStorage.save).toHaveBeenCalledOnce();

    const saved = mockStorage.save.mock.calls[0][0];
    expect(saved.providers).toHaveLength(0);
  });

  it("returns false for unknown id", () => {
    mockStorage.load.mockReturnValue(makeWalletData());
    expect(deleteProvider("ghost")).toBe(false);
    expect(mockStorage.save).not.toHaveBeenCalled();
  });
});
