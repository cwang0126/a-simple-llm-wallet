#!/usr/bin/env node
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { writeFileSync } from "fs";
import { table } from "table";

import * as wallet from "./wallet.js";
import * as chat from "./chat.js";
import { generateEnvContent, generateGenericEnvContent } from "./env-export.js";
import { getWalletPath } from "./storage.js";
import type { Modality, ChatMessage, Provider } from "./types.js";
import { daysUntilExpiry, getGroup } from "./types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname === "/" || parsed.pathname === "") {
      const fixed = trimmed + "/v1";
      console.log(chalk.yellow(`  ⚠ Base URL had no path — automatically set to ${fixed}`));
      return fixed;
    }
  } catch { /* pass through */ }
  return trimmed;
}

/** Compute expiry ISO date from a human duration string like "30d", "3m", "1y", "2w" */
function parseExpiry(input: string): string | undefined {
  const match = input.trim().match(/^(\d+)\s*(d|w|m|y)$/i);
  if (!match) return undefined;
  const n = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const date = new Date();
  if (unit === "d") date.setDate(date.getDate() + n);
  else if (unit === "w") date.setDate(date.getDate() + n * 7);
  else if (unit === "m") date.setMonth(date.getMonth() + n);
  else if (unit === "y") date.setFullYear(date.getFullYear() + n);
  return date.toISOString();
}

function formatExpiry(p: Provider): string {
  const days = daysUntilExpiry(p);
  if (days === null) return "-";
  if (days < 0) return chalk.red(`Expired ${Math.abs(days)}d ago`);
  if (days === 0) return chalk.red("Expires today");
  if (days <= 7) return chalk.yellow(`${days}d left`);
  if (days <= 30) return chalk.yellow(`${days}d left`);
  return chalk.green(`${days}d left`);
}

/**
 * Resolve a provider for commands that target a single model.
 * Usage: `cmd <provider> [model]`
 * If the provider group has multiple models and no model arg is given,
 * prompts the user to pick one interactively.
 */
async function resolveOrPrompt(
  nameOrGroup: string,
  modelArg?: string
): Promise<Provider | null> {
  const { provider, candidates } = wallet.resolveProvider(nameOrGroup, modelArg);

  if (provider) return provider;

  if (candidates.length === 0) {
    console.log(chalk.red(`Provider "${nameOrGroup}" not found.`));
    return null;
  }

  // Multiple candidates — prompt user to pick
  const { chosen } = await inquirer.prompt([
    {
      type: "list",
      name: "chosen",
      message: `"${nameOrGroup}" has multiple models. Pick one:`,
      choices: candidates.map((p) => ({
        name: `${p.modelName}  ${chalk.dim(p.name)}`,
        value: p.id,
      })),
    },
  ]);
  return candidates.find((p) => p.id === chosen) ?? null;
}

const ALL_MODALITIES: Modality[] = ["text", "vision", "audio", "embedding", "image-gen"];

const program = new Command();

program
  .name("llm-wallet")
  .description("A local-first wallet for LLM inference provider credentials")
  .version("0.1.1");

// ─── LIST ────────────────────────────────────────────────────────────────────

program
  .command("list")
  .alias("ls")
  .description("List all saved providers")
  .action(() => {
    const providers = wallet.listProviders();
    if (providers.length === 0) {
      console.log(chalk.yellow("No providers saved yet. Use `add` to create one."));
      return;
    }

    const rows = [
      [
        chalk.bold("ID"),
        chalk.bold("Group"),
        chalk.bold("Label"),
        chalk.bold("Model"),
        chalk.bold("Context"),
        chalk.bold("Expires"),
        chalk.bold("Modalities"),
      ],
      ...providers.map((p) => [
        p.id.slice(0, 8),
        chalk.cyan(getGroup(p)),
        p.name,
        p.modelName,
        p.contextWindow ? String(p.contextWindow) : "-",
        formatExpiry(p),
        p.modalities.join(", "),
      ]),
    ];

    console.log(table(rows));
    console.log(chalk.dim(`Wallet: ${getWalletPath()}`));
  });

// ─── ADD ─────────────────────────────────────────────────────────────────────

program
  .command("add")
  .description("Add a new provider / model entry")
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "providerGroup",
        message: "Provider group name (e.g. Ollama, OpenAI, Groq):",
        validate: (v) => v.trim().length > 0 || "Required",
      },
      {
        type: "input",
        name: "name",
        message: "Entry label (e.g. gemma4:e4b, gpt-4o — defaults to model name):",
      },
      {
        type: "input",
        name: "baseUrl",
        message: "Base URL:",
        default: "https://api.openai.com/v1",
        validate: (v) => v.trim().length > 0 || "Required",
      },
      {
        type: "password",
        name: "apiKey",
        message: "API Key:",
        mask: "*",
        validate: (v) => v.trim().length > 0 || "Required",
      },
      {
        type: "input",
        name: "modelName",
        message: "Model name (e.g. gpt-4o, gemma4:e4b):",
        validate: (v) => v.trim().length > 0 || "Required",
      },
      {
        type: "number",
        name: "contextWindow",
        message: "Context window (tokens, leave blank to skip):",
        default: undefined,
      },
      {
        type: "checkbox",
        name: "modalities",
        message: "Supported modalities:",
        choices: ALL_MODALITIES,
        default: ["text"],
      },
      {
        type: "input",
        name: "expiryInput",
        message: "Expiry (e.g. 30d, 3m, 1y — leave blank for none):",
      },
      {
        type: "input",
        name: "notes",
        message: "Notes (optional):",
      },
    ]);

    const modelName = answers.modelName.trim();
    const label = answers.name.trim() || modelName;
    const expiresAt = answers.expiryInput?.trim() ? parseExpiry(answers.expiryInput.trim()) : undefined;

    if (answers.expiryInput?.trim() && !expiresAt) {
      console.log(chalk.yellow("  ⚠ Could not parse expiry — use format like 30d, 3m, 1y. Skipping."));
    }

    const provider = wallet.addProvider({
      providerGroup: answers.providerGroup.trim(),
      name: label,
      baseUrl: normalizeBaseUrl(answers.baseUrl),
      apiKey: answers.apiKey.trim(),
      modelName,
      contextWindow: answers.contextWindow || undefined,
      modalities: answers.modalities,
      expiresAt,
      notes: answers.notes?.trim() || undefined,
    });

    console.log(chalk.green(`\n✓ Added "${getGroup(provider)} / ${provider.modelName}" (id: ${provider.id.slice(0, 8)})`));
    if (expiresAt) {
      console.log(chalk.dim(`  Expires: ${new Date(expiresAt).toLocaleDateString()} (${formatExpiry(provider)})`));
    }
  });

// ─── EDIT ─────────────────────────────────────────────────────────────────────

program
  .command("edit <provider> [model]")
  .description("Edit a provider entry")
  .action(async (providerArg: string, modelArg?: string) => {
    const existing = await resolveOrPrompt(providerArg, modelArg);
    if (!existing) process.exit(1);

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "providerGroup",
        message: "Provider group name:",
        default: getGroup(existing),
      },
      {
        type: "input",
        name: "name",
        message: "Entry label:",
        default: existing.name,
      },
      {
        type: "input",
        name: "baseUrl",
        message: "Base URL:",
        default: existing.baseUrl,
      },
      {
        type: "password",
        name: "apiKey",
        message: "API Key (leave blank to keep current):",
        mask: "*",
      },
      {
        type: "input",
        name: "modelName",
        message: "Model name:",
        default: existing.modelName,
      },
      {
        type: "number",
        name: "contextWindow",
        message: "Context window size:",
        default: existing.contextWindow,
      },
      {
        type: "checkbox",
        name: "modalities",
        message: "Supported modalities:",
        choices: ALL_MODALITIES,
        default: existing.modalities,
      },
      {
        type: "input",
        name: "expiryInput",
        message: `Expiry (current: ${existing.expiresAt ? new Date(existing.expiresAt).toLocaleDateString() : "none"}, enter new or leave blank to keep):`,
      },
      {
        type: "input",
        name: "notes",
        message: "Notes:",
        default: existing.notes ?? "",
      },
    ]);

    let expiresAt = existing.expiresAt;
    if (answers.expiryInput?.trim()) {
      const parsed = parseExpiry(answers.expiryInput.trim());
      if (parsed) expiresAt = parsed;
      else console.log(chalk.yellow("  ⚠ Could not parse expiry — keeping existing value."));
    }

    const updated = wallet.updateProvider(existing.id, {
      providerGroup: answers.providerGroup.trim(),
      name: answers.name.trim(),
      baseUrl: normalizeBaseUrl(answers.baseUrl),
      apiKey: answers.apiKey?.trim() || existing.apiKey,
      modelName: answers.modelName.trim(),
      contextWindow: answers.contextWindow || undefined,
      modalities: answers.modalities,
      expiresAt,
      notes: answers.notes?.trim() || undefined,
    });

    if (updated) {
      console.log(chalk.green(`\n✓ Updated "${getGroup(updated)} / ${updated.modelName}".`));
    }
  });

// ─── DELETE ───────────────────────────────────────────────────────────────────

program
  .command("delete <provider> [model]")
  .alias("rm")
  .description("Delete a provider entry")
  .action(async (providerArg: string, modelArg?: string) => {
    const existing = await resolveOrPrompt(providerArg, modelArg);
    if (!existing) process.exit(1);

    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `Delete "${getGroup(existing)} / ${existing.modelName}"?`,
        default: false,
      },
    ]);

    if (!confirm) { console.log("Cancelled."); return; }

    wallet.deleteProvider(existing.id);
    console.log(chalk.green(`✓ Deleted "${getGroup(existing)} / ${existing.modelName}".`));
  });

// ─── SHOW ─────────────────────────────────────────────────────────────────────

program
  .command("show <provider> [model]")
  .description("Show full details of a provider entry")
  .action(async (providerArg: string, modelArg?: string) => {
    const provider = await resolveOrPrompt(providerArg, modelArg);
    if (!provider) process.exit(1);

    console.log(`
${chalk.bold("Group:")}         ${chalk.cyan(getGroup(provider))}
${chalk.bold("Label:")}         ${provider.name}
${chalk.bold("ID:")}            ${provider.id}
${chalk.bold("Base URL:")}      ${provider.baseUrl}
${chalk.bold("API Key:")}       ${"*".repeat(8)}${provider.apiKey.slice(-4)}
${chalk.bold("Model:")}         ${provider.modelName}
${chalk.bold("Context:")}       ${provider.contextWindow ?? "-"}
${chalk.bold("Modalities:")}    ${provider.modalities.join(", ")}
${chalk.bold("Expires:")}       ${provider.expiresAt ? `${new Date(provider.expiresAt).toLocaleDateString()} (${formatExpiry(provider)})` : "-"}
${chalk.bold("Notes:")}         ${provider.notes ?? "-"}
${chalk.bold("Created:")}       ${provider.createdAt}
${chalk.bold("Updated:")}       ${provider.updatedAt}
`);
  });

// ─── TEST ─────────────────────────────────────────────────────────────────────

program
  .command("test <provider> [model]")
  .description("Quick connectivity test for a provider")
  .action(async (providerArg: string, modelArg?: string) => {
    const provider = await resolveOrPrompt(providerArg, modelArg);
    if (!provider) process.exit(1);

    const spinner = ora(`Testing ${getGroup(provider)} / ${provider.modelName}...`).start();
    try {
      const reply = await chat.quickTest(provider);
      spinner.succeed(chalk.green("Connection successful!"));
      console.log(chalk.dim(`Response: ${reply}`));
    } catch (err: unknown) {
      spinner.fail(chalk.red("Connection failed."));
      console.log(chalk.red(err instanceof Error ? err.message : String(err)));
    }
  });

// ─── CHAT ─────────────────────────────────────────────────────────────────────

program
  .command("chat <provider> [model]")
  .description("Start an interactive chat session with a provider")
  .action(async (providerArg: string, modelArg?: string) => {
    const provider = await resolveOrPrompt(providerArg, modelArg);
    if (!provider) process.exit(1);

    console.log(chalk.cyan(`\nChatting with ${getGroup(provider)} / ${provider.modelName}`));
    console.log(chalk.dim('Type "exit" or press Ctrl+C to quit.\n'));

    const history: ChatMessage[] = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { userInput } = await inquirer.prompt([
        { type: "input", name: "userInput", message: chalk.green("You:") },
      ]);

      const input = userInput.trim();
      if (!input || input.toLowerCase() === "exit") {
        console.log(chalk.dim("Goodbye."));
        break;
      }

      history.push({ role: "user", content: input });
      const spinner = ora("Thinking...").start();
      try {
        const reply = await chat.sendMessage(provider, history);
        spinner.stop();
        console.log(chalk.blue(`\nAssistant: ${reply}\n`));
        history.push({ role: "assistant", content: reply });
      } catch (err: unknown) {
        spinner.fail("Request failed.");
        console.log(chalk.red(err instanceof Error ? err.message : String(err)));
        history.pop();
      }
    }
  });

// ─── ENV EXPORT ───────────────────────────────────────────────────────────────

program
  .command("export <provider> [model]")
  .description("Export provider credentials as .env variables")
  .option("-o, --output <file>", "Write to a file instead of stdout")
  .option("-g, --generic", "Use generic variable names (OPENAI_*)")
  .action(async (providerArg: string, modelArg?: string, options?: { output?: string; generic?: boolean }) => {
    const provider = await resolveOrPrompt(providerArg, modelArg);
    if (!provider) process.exit(1);

    const content = options?.generic
      ? generateGenericEnvContent(provider)
      : generateEnvContent(provider);

    if (options?.output) {
      writeFileSync(options.output, content, "utf-8");
      console.log(chalk.green(`✓ Exported to ${options.output}`));
    } else {
      console.log(content);
    }
  });

program.parse();
