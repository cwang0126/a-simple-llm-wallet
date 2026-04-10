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
import type { Modality, ChatMessage } from "./types.js";

/**
 * Ensures the base URL ends with a path segment (e.g. /v1).
 * Ollama and many local servers expose the OpenAI-compatible API at /v1,
 * but users often save just the host. The OpenAI SDK appends /chat/completions
 * directly to baseURL, so a missing /v1 causes a 404.
 */
function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  // If the URL has no path beyond the origin, auto-append /v1
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname === "/" || parsed.pathname === "") {
      const fixed = trimmed + "/v1";
      console.log(
        chalk.yellow(`  ⚠ Base URL had no path — automatically set to ${fixed}`)
      );
      return fixed;
    }
  } catch {
    // not a valid URL, let it through and fail at request time
  }
  return trimmed;
}

const ALL_MODALITIES: Modality[] = [
  "text",
  "vision",
  "audio",
  "embedding",
  "image-gen",
];

const program = new Command();

program
  .name("llm-wallet")
  .description("A local-first wallet for LLM inference provider credentials")
  .version("0.1.0");

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
        chalk.bold("ID (short)"),
        chalk.bold("Name"),
        chalk.bold("Model"),
        chalk.bold("Base URL"),
        chalk.bold("Context"),
        chalk.bold("Modalities"),
      ],
      ...providers.map((p) => [
        p.id.slice(0, 8),
        chalk.cyan(p.name),
        p.modelName,
        p.baseUrl,
        p.contextWindow ? String(p.contextWindow) : "-",
        p.modalities.join(", "),
      ]),
    ];

    console.log(table(rows));
    console.log(chalk.dim(`Wallet: ${getWalletPath()}`));
  });

// ─── ADD ─────────────────────────────────────────────────────────────────────

program
  .command("add")
  .description("Add a new provider")
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Provider name (e.g. OpenAI, Groq, local-ollama):",
        validate: (v) => v.trim().length > 0 || "Name is required",
      },
      {
        type: "input",
        name: "baseUrl",
        message: "Base URL:",
        default: "https://api.openai.com/v1",
        validate: (v) => v.trim().length > 0 || "Base URL is required",
      },
      {
        type: "password",
        name: "apiKey",
        message: "API Key:",
        mask: "*",
        validate: (v) => v.trim().length > 0 || "API key is required",
      },
      {
        type: "input",
        name: "modelName",
        message: "Model name (e.g. gpt-4o, llama3):",
        validate: (v) => v.trim().length > 0 || "Model name is required",
      },
      {
        type: "number",
        name: "contextWindow",
        message: "Context window size (tokens, leave blank to skip):",
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
        name: "notes",
        message: "Notes (optional):",
      },
    ]);

    const provider = wallet.addProvider({
      name: answers.name.trim(),
      baseUrl: normalizeBaseUrl(answers.baseUrl),
      apiKey: answers.apiKey.trim(),
      modelName: answers.modelName.trim(),
      contextWindow: answers.contextWindow || undefined,
      modalities: answers.modalities,
      notes: answers.notes?.trim() || undefined,
    });

    console.log(chalk.green(`\n✓ Provider "${provider.name}" added (id: ${provider.id.slice(0, 8)})`));
  });

// ─── EDIT ─────────────────────────────────────────────────────────────────────

program
  .command("edit <name-or-id>")
  .description("Edit an existing provider")
  .action(async (nameOrId: string) => {
    const existing =
      wallet.getProvider(nameOrId) ?? wallet.findProviderByName(nameOrId);

    if (!existing) {
      console.log(chalk.red(`Provider "${nameOrId}" not found.`));
      process.exit(1);
    }

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Provider name:",
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
        name: "notes",
        message: "Notes:",
        default: existing.notes ?? "",
      },
    ]);

    const updated = wallet.updateProvider(existing.id, {
      name: answers.name.trim(),
      baseUrl: normalizeBaseUrl(answers.baseUrl),
      apiKey: answers.apiKey?.trim() || existing.apiKey,
      modelName: answers.modelName.trim(),
      contextWindow: answers.contextWindow || undefined,
      modalities: answers.modalities,
      notes: answers.notes?.trim() || undefined,
    });

    if (updated) {
      console.log(chalk.green(`\n✓ Provider "${updated.name}" updated.`));
    }
  });

// ─── DELETE ───────────────────────────────────────────────────────────────────

program
  .command("delete <name-or-id>")
  .alias("rm")
  .description("Delete a provider")
  .action(async (nameOrId: string) => {
    const existing =
      wallet.getProvider(nameOrId) ?? wallet.findProviderByName(nameOrId);

    if (!existing) {
      console.log(chalk.red(`Provider "${nameOrId}" not found.`));
      process.exit(1);
    }

    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `Delete provider "${existing.name}"?`,
        default: false,
      },
    ]);

    if (!confirm) {
      console.log("Cancelled.");
      return;
    }

    wallet.deleteProvider(existing.id);
    console.log(chalk.green(`✓ Provider "${existing.name}" deleted.`));
  });

// ─── SHOW ─────────────────────────────────────────────────────────────────────

program
  .command("show <name-or-id>")
  .description("Show full details of a provider")
  .action((nameOrId: string) => {
    const provider =
      wallet.getProvider(nameOrId) ?? wallet.findProviderByName(nameOrId);

    if (!provider) {
      console.log(chalk.red(`Provider "${nameOrId}" not found.`));
      process.exit(1);
    }

    console.log(`
${chalk.bold("Name:")}          ${chalk.cyan(provider.name)}
${chalk.bold("ID:")}            ${provider.id}
${chalk.bold("Base URL:")}      ${provider.baseUrl}
${chalk.bold("API Key:")}       ${"*".repeat(8)}${provider.apiKey.slice(-4)}
${chalk.bold("Model:")}         ${provider.modelName}
${chalk.bold("Context:")}       ${provider.contextWindow ?? "-"}
${chalk.bold("Modalities:")}    ${provider.modalities.join(", ")}
${chalk.bold("Notes:")}         ${provider.notes ?? "-"}
${chalk.bold("Created:")}       ${provider.createdAt}
${chalk.bold("Updated:")}       ${provider.updatedAt}
`);
  });

// ─── TEST ─────────────────────────────────────────────────────────────────────

program
  .command("test <name-or-id>")
  .description("Quick connectivity test for a provider")
  .action(async (nameOrId: string) => {
    const provider =
      wallet.getProvider(nameOrId) ?? wallet.findProviderByName(nameOrId);

    if (!provider) {
      console.log(chalk.red(`Provider "${nameOrId}" not found.`));
      process.exit(1);
    }

    const spinner = ora(`Testing ${provider.name} (${provider.modelName})...`).start();
    try {
      const reply = await chat.quickTest(provider);
      spinner.succeed(chalk.green("Connection successful!"));
      console.log(chalk.dim(`Response: ${reply}`));
    } catch (err: unknown) {
      spinner.fail(chalk.red("Connection failed."));
      const message = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(message));
    }
  });

// ─── CHAT ─────────────────────────────────────────────────────────────────────

program
  .command("chat <name-or-id>")
  .description("Start an interactive chat session with a provider")
  .action(async (nameOrId: string) => {
    const provider =
      wallet.getProvider(nameOrId) ?? wallet.findProviderByName(nameOrId);

    if (!provider) {
      console.log(chalk.red(`Provider "${nameOrId}" not found.`));
      process.exit(1);
    }

    console.log(chalk.cyan(`\nChatting with ${provider.name} / ${provider.modelName}`));
    console.log(chalk.dim('Type "exit" or press Ctrl+C to quit.\n'));

    const history: ChatMessage[] = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { userInput } = await inquirer.prompt([
        {
          type: "input",
          name: "userInput",
          message: chalk.green("You:"),
        },
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
        const message = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(message));
        history.pop(); // remove the failed user message
      }
    }
  });

// ─── ENV EXPORT ───────────────────────────────────────────────────────────────

program
  .command("export <name-or-id>")
  .description("Export provider credentials as .env variables")
  .option("-o, --output <file>", "Write to a file instead of stdout")
  .option("-g, --generic", "Use generic variable names (OPENAI_*)")
  .action(async (nameOrId: string, options: { output?: string; generic?: boolean }) => {
    const provider =
      wallet.getProvider(nameOrId) ?? wallet.findProviderByName(nameOrId);

    if (!provider) {
      console.log(chalk.red(`Provider "${nameOrId}" not found.`));
      process.exit(1);
    }

    const content = options.generic
      ? generateGenericEnvContent(provider)
      : generateEnvContent(provider);

    if (options.output) {
      writeFileSync(options.output, content, "utf-8");
      console.log(chalk.green(`✓ Exported to ${options.output}`));
    } else {
      console.log(content);
    }
  });

program.parse();
