#!/usr/bin/env node
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { table } from "table";

import * as wallet from "./wallet.js";
import * as chat from "./chat.js";
import { generateEnvContent, generateGenericEnvContent, generateCustomPrefixEnvContent } from "./env-export.js";
import { getWalletPath } from "./storage.js";
import type { Modality, ChatMessage, Provider } from "./types.js";
import { daysUntilExpiry, getGroup } from "./types.js";
import { printBanner } from "./banner.js";

// ─── Known Providers ──────────────────────────────────────────────────────────

interface KnownProvider {
  name: string;
  baseUrl: string;
  modelsEndpoint: string;
}

function loadKnownProviders(): KnownProvider[] {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    // Try repo root (dev) then dist parent
    const candidates = [
      join(__dirname, "..", "providers.json"),
      join(__dirname, "providers.json"),
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        return JSON.parse(readFileSync(p, "utf-8")) as KnownProvider[];
      }
    }
  } catch { /* ignore */ }
  return [];
}

const KNOWN_PROVIDERS = loadKnownProviders();

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

function formatContextWindow(n: number): string {
  if (n >= 1_000_000) return `${n.toLocaleString()} (${Math.round(n / 1_048_576)}M)`;
  if (n >= 1_000) return `${n.toLocaleString()} (${Math.round(n / 1_024)}K)`;
  return String(n);
}

/**
 * Resolve a provider for commands that target a single model.
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
  .version("0.2.1");

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
        chalk.bold("Provider"),
        chalk.bold("Model"),
        chalk.bold("Context"),
        chalk.bold("Expires"),
        chalk.bold("Modalities"),
      ],
      ...providers.map((p) => [
        p.id.slice(0, 8),
        chalk.cyan(getGroup(p)),
        p.modelName,
        p.contextWindow ? formatContextWindow(p.contextWindow) : "-",
        formatExpiry(p),
        p.modalities.join(", "),
      ]),
    ];

    console.log(table(rows));
    console.log(chalk.dim(`Wallet: ${getWalletPath()}`));
  });

// ─── ADD ─────────────────────────────────────────────────────────────────────

/** Sentinel thrown when the user presses ESC to go back one step. */
class GoBack extends Error { constructor() { super("go-back"); } }

/**
 * Wrap an inquirer prompt so that pressing ESC throws GoBack.
 * Strategy: listen for raw keypress on stdin; if ESC arrives before the
 * prompt resolves, close the inquirer UI and reject with GoBack.
 */
async function promptWithEsc<T>(
  questions: Parameters<typeof inquirer.prompt>[0]
): Promise<T> {
  const rl = (inquirer.prompt as unknown as { ui?: { rl?: NodeJS.ReadStream } });
  let goBack = false;

  // Enable keypress events on stdin
  const { emitKeypressEvents } = await import("readline");
  emitKeypressEvents(process.stdin);
  if ((process.stdin as NodeJS.ReadStream).isTTY) {
    (process.stdin as NodeJS.ReadStream).setRawMode?.(true);
  }

  const onKeypress = (_: unknown, key: { name?: string; sequence?: string }) => {
    if (key?.name === "escape" || key?.sequence === "\x1b") {
      goBack = true;
      // Send Ctrl-C to abort the active inquirer prompt
      process.stdin.emit("keypress", "\x03", { name: "c", ctrl: true, meta: false, shift: false, sequence: "\x03" });
    }
  };

  process.stdin.on("keypress", onKeypress);

  try {
    const answers = await inquirer.prompt(questions as Parameters<typeof inquirer.prompt>[0]);
    if (goBack) throw new GoBack();
    return answers as T;
  } catch (err) {
    if (goBack || (err instanceof Error && (err.message === "go-back" || err.message.includes("force closed") || err.message.includes("readline was closed")))) {
      throw new GoBack();
    }
    throw err;
  } finally {
    process.stdin.removeListener("keypress", onKeypress);
    if ((process.stdin as NodeJS.ReadStream).isTTY) {
      (process.stdin as NodeJS.ReadStream).setRawMode?.(false);
    }
  }
}

program
  .command("add")
  .description("Add a new provider / model entry  (press ESC on any prompt to go back)")
  .action(async () => {
    console.log(chalk.dim("  Tip: press ESC on any prompt to go back to the previous step.\n"));

    type StepResult = Record<string, unknown>;

    let selectedBaseUrl = "";
    let selectedGroupName = "";
    const stepAnswers: (StepResult | null)[] = Array(8).fill(null);
    let step = 0;
    const MAX_STEP = 7;

    while (step <= MAX_STEP) {
      try {
        // ── Step 0: pick known provider ──────────────────────────────────
        if (step === 0) {
          if (KNOWN_PROVIDERS.length > 0) {
            const ans = await promptWithEsc<{ providerChoice: string }>([{
              type: "list",
              name: "providerChoice",
              message: "Select a known provider or enter custom:",
              choices: [
                ...KNOWN_PROVIDERS.map((kp) => ({
                  name: `${kp.name}  ${chalk.dim(kp.baseUrl)}`,
                  value: kp.name,
                })),
                { name: chalk.italic("Custom…"), value: "__custom__" },
              ],
              default: stepAnswers[0]?.providerChoice as string | undefined,
            }]);
            stepAnswers[0] = ans;
            if (ans.providerChoice !== "__custom__") {
              const kp = KNOWN_PROVIDERS.find((p) => p.name === ans.providerChoice)!;
              selectedGroupName = kp.name;
              selectedBaseUrl = kp.baseUrl;
            } else {
              selectedGroupName = "";
              selectedBaseUrl = "";
            }
          }
          step++; continue;
        }

        // ── Step 1: provider group name ──────────────────────────────────
        if (step === 1) {
          const ans = await promptWithEsc<{ providerGroup: string }>([{
            type: "input",
            name: "providerGroup",
            message: "Provider group name:",
            default: ((stepAnswers[1]?.providerGroup as string) ?? selectedGroupName) || undefined,
            validate: (v: string) => v.trim().length > 0 || "Required",
          }]);
          stepAnswers[1] = ans;
          step++; continue;
        }

        // ── Step 2: base URL ─────────────────────────────────────────────
        if (step === 2) {
          const ans = await promptWithEsc<{ baseUrl: string }>([{
            type: "input",
            name: "baseUrl",
            message: "Base URL:",
            default: ((stepAnswers[2]?.baseUrl as string) ?? selectedBaseUrl) || undefined,
            validate: (v: string) => v.trim().length > 0 || "Required",
          }]);
          stepAnswers[2] = ans;
          step++; continue;
        }

        // ── Step 3: API key ──────────────────────────────────────────────
        if (step === 3) {
          const ans = await promptWithEsc<{ apiKey: string }>([{
            type: "password",
            name: "apiKey",
            message: "API Key:",
            mask: "*",
            validate: (v: string) => v.trim().length > 0 || "Required",
          }]);
          stepAnswers[3] = ans;
          step++; continue;
        }

        // ── Step 4: model ────────────────────────────────────────────────
        if (step === 4) {
          const baseUrl = (stepAnswers[2]?.baseUrl as string).trim();
          const apiKey = (stepAnswers[3]?.apiKey as string).trim();
          let modelName = (stepAnswers[4]?.modelName as string) ?? "";

          const { fetchModelsChoice } = await promptWithEsc<{ fetchModelsChoice: boolean }>([{
            type: "confirm",
            name: "fetchModelsChoice",
            message: "Fetch available models from the provider endpoint?",
            default: true,
          }]);

          if (fetchModelsChoice) {
            const spinner = ora("Fetching models…").start();
            try {
              const models = await chat.listModels(baseUrl, apiKey);
              spinner.stop();
              if (models.length === 0) {
                console.log(chalk.yellow("  No models returned. Enter model name manually."));
              } else {
                const { chosenModel } = await promptWithEsc<{ chosenModel: string }>([{
                  type: "list",
                  name: "chosenModel",
                  message: "Select a model:",
                  choices: models.map((m) => ({
                    name: m.info ? `${m.id}  ${chalk.dim(m.info.slice(0, 80))}` : m.id,
                    value: m.id,
                  })),
                  default: modelName || undefined,
                }]);
                modelName = chosenModel;
              }
            } catch (err) {
              if (err instanceof GoBack) throw err;
              spinner.fail(chalk.red("Failed: " + (err instanceof Error ? err.message : String(err))));
            }
          }

          if (!modelName) {
            const { manualModel } = await promptWithEsc<{ manualModel: string }>([{
              type: "input",
              name: "manualModel",
              message: "Model name (e.g. gpt-4o, gemma4:e4b):",
              validate: (v: string) => v.trim().length > 0 || "Required",
            }]);
            modelName = manualModel.trim();
          }

          stepAnswers[4] = { modelName };
          step++; continue;
        }

        // ── Step 5: context window ───────────────────────────────────────
        if (step === 5) {
          const ans = await promptWithEsc<{ contextWindow: number | undefined }>([{
            type: "number",
            name: "contextWindow",
            message: "Context window tokens (leave blank to skip):",
            default: stepAnswers[5]?.contextWindow as number | undefined,
          }]);
          stepAnswers[5] = ans;
          step++; continue;
        }

        // ── Step 6: modalities ───────────────────────────────────────────
        if (step === 6) {
          const ans = await promptWithEsc<{ modalities: Modality[] }>([{
            type: "checkbox",
            name: "modalities",
            message: "Supported modalities:",
            choices: ALL_MODALITIES,
            default: (stepAnswers[6]?.modalities as Modality[]) ?? ["text"],
          }]);
          stepAnswers[6] = ans;
          step++; continue;
        }

        // ── Step 7: expiry / usage / notes ───────────────────────────────
        if (step === 7) {
          const ans = await promptWithEsc<{ expiryInput: string; usage: string; notes: string }>([
            {
              type: "input",
              name: "expiryInput",
              message: "Expiry (e.g. 30d, 3m, 1y — blank for none):",
              default: stepAnswers[7]?.expiryInput as string | undefined,
            },
            {
              type: "input",
              name: "usage",
              message: "Usage dashboard URL (optional):",
              default: stepAnswers[7]?.usage as string | undefined,
            },
            {
              type: "input",
              name: "notes",
              message: "Notes (optional):",
              default: stepAnswers[7]?.notes as string | undefined,
            },
          ]);
          stepAnswers[7] = ans;
          step++; continue;
        }

        break;
      } catch (err) {
        if (err instanceof GoBack) {
          if (step === 0) { console.log(chalk.dim("\nCancelled.")); return; }
          step = Math.max(0, step - 1);
          console.log(chalk.dim("  ↩ Going back…\n"));
          continue;
        }
        throw err;
      }
    }

    // ── Assemble and save ────────────────────────────────────────────────────
    const s1 = stepAnswers[1] as { providerGroup: string };
    const s2 = stepAnswers[2] as { baseUrl: string };
    const s3 = stepAnswers[3] as { apiKey: string };
    const s4 = stepAnswers[4] as { modelName: string };
    const s5 = stepAnswers[5] as { contextWindow?: number };
    const s6 = stepAnswers[6] as { modalities: Modality[] };
    const s7 = stepAnswers[7] as { expiryInput: string; usage: string; notes: string };

    const expiresAt = s7.expiryInput?.trim() ? parseExpiry(s7.expiryInput.trim()) : undefined;
    if (s7.expiryInput?.trim() && !expiresAt) {
      console.log(chalk.yellow("  ⚠ Could not parse expiry — use format like 30d, 3m, 1y. Skipping."));
    }

    const provider = wallet.addProvider({
      provider: s1.providerGroup.trim(),
      name: s4.modelName,
      baseUrl: normalizeBaseUrl(s2.baseUrl),
      apiKey: s3.apiKey.trim(),
      modelName: s4.modelName,
      contextWindow: s5.contextWindow || undefined,
      modalities: s6.modalities,
      expiresAt,
      usage: s7.usage?.trim() || undefined,
      notes: s7.notes?.trim() || undefined,
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
        message: "Provider:",
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
        name: "usage",
        message: "Usage dashboard URL (leave blank to keep):",
        default: existing.usage ?? "",
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
      provider: answers.providerGroup.trim(),
      name: answers.name.trim(),
      baseUrl: normalizeBaseUrl(answers.baseUrl),
      apiKey: answers.apiKey?.trim() || existing.apiKey,
      modelName: answers.modelName.trim(),
      contextWindow: answers.contextWindow || undefined,
      modalities: answers.modalities,
      expiresAt,
      usage: answers.usage?.trim() || undefined,
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
${chalk.bold("Provider:")}      ${chalk.cyan(getGroup(provider))}
${chalk.bold("ID:")}            ${provider.id}
${chalk.bold("Base URL:")}      ${provider.baseUrl}
${chalk.bold("API Key:")}       ${"*".repeat(8)}${provider.apiKey.slice(-4)}
${chalk.bold("Model:")}         ${provider.modelName}
${chalk.bold("Context:")}       ${provider.contextWindow ? formatContextWindow(provider.contextWindow) : "-"}
${chalk.bold("Modalities:")}    ${provider.modalities.join(", ")}
${chalk.bold("Expires:")}       ${provider.expiresAt ? `${new Date(provider.expiresAt).toLocaleDateString()} (${formatExpiry(provider)})` : "-"}
${chalk.bold("Usage URL:")}     ${provider.usage ?? "-"}
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
  .option("-p, --prefix <prefix>", "Use a custom variable prefix")
  .action(async (providerArg: string, modelArg?: string, options?: { output?: string; generic?: boolean; prefix?: string }) => {
    const provider = await resolveOrPrompt(providerArg, modelArg);
    if (!provider) process.exit(1);

    let content: string;
    if (options?.prefix) {
      content = generateCustomPrefixEnvContent(provider, options.prefix);
    } else if (options?.generic) {
      content = generateGenericEnvContent(provider);
    } else {
      content = generateEnvContent(provider);
    }

    if (options?.output) {
      writeFileSync(options.output, content, "utf-8");
      console.log(chalk.green(`✓ Exported to ${options.output}`));
    } else {
      console.log(content);
    }
  });

// Print banner before parse when called with no arguments
if (process.argv.length <= 2) {
  printBanner();
}

program.parse();
