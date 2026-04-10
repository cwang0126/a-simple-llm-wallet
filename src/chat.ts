import OpenAI from "openai";
import type { Provider, ChatMessage } from "./types.js";

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
  return sendMessage(provider, [
    { role: "user", content: "Say 'OK' if you can read this." },
  ]);
}
