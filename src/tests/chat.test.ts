import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendMessage, quickTest } from "../chat.js";
import type { Provider } from "../types.js";

// Mock the openai module
vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
    __mockCreate: mockCreate,
  };
});

const provider: Provider = {
  id: "abc-123",
  name: "TestProvider",
  baseUrl: "https://api.example.com/v1",
  apiKey: "test-key",
  modelName: "test-model",
  modalities: ["text"],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

async function getMockCreate() {
  const openai = await import("openai");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (openai as any).__mockCreate as ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendMessage", () => {
  it("returns the assistant reply", async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Hello there!" } }],
    });

    const result = await sendMessage(provider, [
      { role: "user", content: "Hi" },
    ]);

    expect(result).toBe("Hello there!");
  });

  it("returns fallback when content is null", async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const result = await sendMessage(provider, [
      { role: "user", content: "Hi" },
    ]);

    expect(result).toBe("(no response)");
  });

  it("returns fallback when choices is empty", async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValue({ choices: [] });

    const result = await sendMessage(provider, [
      { role: "user", content: "Hi" },
    ]);

    expect(result).toBe("(no response)");
  });

  it("propagates errors from the API", async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockRejectedValue(new Error("401 Unauthorized"));

    await expect(
      sendMessage(provider, [{ role: "user", content: "Hi" }])
    ).rejects.toThrow("401 Unauthorized");
  });
});

describe("quickTest", () => {
  it("sends a fixed ping message and returns the reply", async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "OK" } }],
    });

    const result = await quickTest(provider);

    expect(result).toBe("OK");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-model",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "user" }),
        ]),
      })
    );
  });
});
