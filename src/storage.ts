import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import type { WalletData } from "./types.js";

const WALLET_DIR = join(homedir(), ".llm-wallet");
const WALLET_FILE = join(WALLET_DIR, "wallet.json");

const DEFAULT_DATA: WalletData = {
  version: "1.0.0",
  providers: [],
};

export function getWalletPath(): string {
  return WALLET_FILE;
}

export function load(): WalletData {
  if (!existsSync(WALLET_FILE)) {
    return { ...DEFAULT_DATA };
  }
  try {
    const raw = readFileSync(WALLET_FILE, "utf-8");
    return JSON.parse(raw) as WalletData;
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
