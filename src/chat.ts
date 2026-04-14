import OpenAI from "openai";
import type { Provider, ChatMessage } from "./types.js";
import { appendLog } from "./storage.js";

export async function sendMessage(
  provider: Provider,
  messages: ChatMessage[]
): Promise<string> {
  const client = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseUrl,
  });

  const response = await client.chat.completions.create({
    model: provider.modelName,
    messages,
  });

  return response.choices[0]?.message?.content ?? "(no response)";
}

export async function quickTest(provider: Provider): Promise<string> {
  const client = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseUrl,
  });

  const label = `${provider.provider ?? provider.name ?? provider.modelName} / ${provider.modelName}`;
  try {
    const response = await client.chat.completions.create({
      model: provider.modelName,
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 10,
    });
    const reply = response.choices[0]?.message?.content ?? "(no response)";
    appendLog(`OK    ${label} — "${reply.slice(0, 80)}"`);
    return reply;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    appendLog(`FAIL  ${label} — ${msg}`);
    throw err;
  }
}

/** Fetch available models from a provider's list-models endpoint */
export async function listModels(
  baseUrl: string,
  apiKey: string
): Promise<Array<{ id: string; info: string }>> {
  const url = baseUrl.replace(/\/$/, "") + "/models";
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const json = await res.json() as Record<string, unknown>;

  // OpenAI-compatible: { data: [...] }
  const items: unknown[] = Array.isArray(json.data)
    ? (json.data as unknown[])
    : Array.isArray(json.models)
    ? (json.models as unknown[])
    : Array.isArray(json)
    ? (json as unknown[])
    : [];

  return items.map((item) => {
    const obj = item as Record<string, unknown>;
    const id = String(obj.id ?? obj.name ?? "unknown");
    // Concatenate all non-id fields as info string
    const info = Object.entries(obj)
      .filter(([k]) => k !== "id" && k !== "name")
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join(" | ");
    return { id, info };
  });
}
