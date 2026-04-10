import type { Provider } from "./types.js";

/**
 * Generates .env file content for a given provider.
 * Variable names are prefixed with the provider name (uppercased, sanitized).
 */
export function generateEnvContent(provider: Provider): string {
  const prefix = provider.name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_");

  const lines = [
    `# LLM Wallet export — ${provider.name}`,
    `# Generated at ${new Date().toISOString()}`,
    ``,
    `${prefix}_BASE_URL=${provider.baseUrl}`,
    `${prefix}_API_KEY=${provider.apiKey}`,
    `${prefix}_MODEL=${provider.modelName}`,
  ];

  if (provider.contextWindow) {
    lines.push(`${prefix}_CONTEXT_WINDOW=${provider.contextWindow}`);
  }

  if (provider.modalities.length > 0) {
    lines.push(`${prefix}_MODALITIES=${provider.modalities.join(",")}`);
  }

  return lines.join("\n") + "\n";
}

/**
 * Generates a generic .env block using common variable names (no prefix).
 * Useful for tools that expect standard names like OPENAI_API_KEY.
 */
export function generateGenericEnvContent(provider: Provider): string {
  const lines = [
    `# LLM Wallet export — ${provider.name} (generic)`,
    `# Generated at ${new Date().toISOString()}`,
    ``,
    `OPENAI_BASE_URL=${provider.baseUrl}`,
    `OPENAI_API_KEY=${provider.apiKey}`,
    `OPENAI_MODEL=${provider.modelName}`,
  ];

  if (provider.contextWindow) {
    lines.push(`OPENAI_CONTEXT_WINDOW=${provider.contextWindow}`);
  }

  return lines.join("\n") + "\n";
}
