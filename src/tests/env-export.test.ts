import { describe, it, expect } from "vitest";
import { generateEnvContent, generateGenericEnvContent } from "../env-export.js";
import type { Provider } from "../types.js";

const provider: Provider = {
  id: "abc-123",
  name: "Groq",
  baseUrl: "https://api.groq.com/openai/v1",
  apiKey: "gsk_test_key",
  modelName: "llama3-8b-8192",
  contextWindow: 8192,
  modalities: ["text"],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("generateEnvContent", () => {
  it("uses uppercased provider name as prefix", () => {
    const output = generateEnvContent(provider);
    expect(output).toContain("GROQ_BASE_URL=https://api.groq.com/openai/v1");
    expect(output).toContain("GROQ_API_KEY=gsk_test_key");
    expect(output).toContain("GROQ_MODEL=llama3-8b-8192");
  });

  it("includes context window when set", () => {
    const output = generateEnvContent(provider);
    expect(output).toContain("GROQ_CONTEXT_WINDOW=8192");
  });

  it("omits context window when not set", () => {
    const output = generateEnvContent({ ...provider, contextWindow: undefined });
    expect(output).not.toContain("CONTEXT_WINDOW");
  });

  it("includes modalities", () => {
    const output = generateEnvContent({ ...provider, modalities: ["text", "vision"] });
    expect(output).toContain("GROQ_MODALITIES=text,vision");
  });

  it("sanitizes special characters in provider name", () => {
    const output = generateEnvContent({ ...provider, name: "My Provider 2.0" });
    expect(output).toContain("MY_PROVIDER_2_0_BASE_URL=");
  });

  it("ends with a newline", () => {
    expect(generateEnvContent(provider).endsWith("\n")).toBe(true);
  });
});

describe("generateGenericEnvContent", () => {
  it("uses OPENAI_* variable names", () => {
    const output = generateGenericEnvContent(provider);
    expect(output).toContain("OPENAI_BASE_URL=https://api.groq.com/openai/v1");
    expect(output).toContain("OPENAI_API_KEY=gsk_test_key");
    expect(output).toContain("OPENAI_MODEL=llama3-8b-8192");
  });

  it("includes context window when set", () => {
    const output = generateGenericEnvContent(provider);
    expect(output).toContain("OPENAI_CONTEXT_WINDOW=8192");
  });

  it("omits context window when not set", () => {
    const output = generateGenericEnvContent({ ...provider, contextWindow: undefined });
    expect(output).not.toContain("CONTEXT_WINDOW");
  });

  it("ends with a newline", () => {
    expect(generateGenericEnvContent(provider).endsWith("\n")).toBe(true);
  });
});
