import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { WalletData } from "./types.js";

const WALLET_DIR = join(homedir(), ".llm-wallet");
const WALLET_FILE = join(WALLET_DIR, "wallet.json");
const LOG_DIR = join(WALLET_DIR, "log");
const LOG_FILE = join(LOG_DIR, "connectivity.log");

const DEFAULT_DATA: WalletData = {
  version: "1.0.0",
  providers: [],
};

export function getWalletPath(): string {
  return WALLET_FILE;
}

export function getLogPath(): string {
  return LOG_FILE;
}

/** Migrate legacy wallet data — renames providerGroup → provider, fills missing optional fields */
function migrate(data: WalletData): WalletData {
  return {
    ...data,
    providers: data.providers.map((p) => {
      const raw = p as unknown as Record<string, unknown>;
      // Rename legacy providerGroup → provider
      if ("providerGroup" in raw && !("provider" in raw)) {
        raw["provider"] = raw["providerGroup"];
        delete raw["providerGroup"];
      }
      return { usage: undefined, ...raw } as typeof p;
    }),
  };
}

export function load(): WalletData {
  if (!existsSync(WALLET_FILE)) {
    return { ...DEFAULT_DATA };
  }
  try {
    const raw = readFileSync(WALLET_FILE, "utf-8");
    const parsed = JSON.parse(raw) as WalletData;
    return migrate(parsed);
  } catch {
    console.error("Failed to parse wallet file. Starting fresh.");
    return { ...DEFAULT_DATA };
  }
}

export function save(data: WalletData): void {
  if (!existsSync(WALLET_DIR)) {
    mkdirSync(WALLET_DIR, { recursive: true });
  }
  writeFileSync(WALLET_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/** Append a connectivity test log entry */
export function appendLog(entry: string): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
  const timestamp = new Date().toISOString();
  appendFileSync(LOG_FILE, `[${timestamp}] ${entry}\n`, "utf-8");
}
