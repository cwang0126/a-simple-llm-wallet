import chalk from "chalk";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

function getVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
    return `v${pkg.version}`;
  } catch {
    return "";
  }
}

// ─── Purple palette ───────────────────────────────────────────────────────────
const p1 = (s: string) => chalk.hex("#9B59B6")(s);  // mid purple
const p2 = (s: string) => chalk.hex("#C39BD3")(s);  // light lavender
const p3 = (s: string) => chalk.hex("#6C3483")(s);  // deep purple
const dm = (s: string) => chalk.hex("#7D6B8A")(s);  // muted purple-grey

// ─── "LLM" block lettering ────────────────────────────────────────────────────
const LLM = [
  `  ██╗     ██╗     ███╗   ███╗`,
  `  ██║     ██║     ████╗ ████║`,
  `  ██║     ██║     ██╔████╔██║`,
  `  ██║     ██║     ██║╚██╔╝██║`,
  `  ███████╗███████╗██║ ╚═╝ ██║`,
  `  ╚══════╝╚══════╝╚═╝     ╚═╝`,
];

// ─── "WALLET" block lettering ─────────────────────────────────────────────────
const WALLET = [
  `  ██╗    ██╗ █████╗ ██╗     ██╗     ███████╗████████╗`,
  `  ██║    ██║██╔══██╗██║     ██║     ██╔════╝╚══██╔══╝`,
  `  ██║ █╗ ██║███████║██║     ██║     █████╗     ██║   `,
  `  ██║███╗██║██╔══██║██║     ██║     ██╔══╝     ██║   `,
  `  ╚███╔███╔╝██║  ██║███████╗███████╗███████╗   ██║   `,
  `   ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝   ╚═╝  `,
];

// ─── Banner entry point ───────────────────────────────────────────────────────
export function printBanner(): void {
  const out: string[] = [""];

  // "LLM" — top 3 rows mid purple, bottom 3 rows lavender
  for (let i = 0; i < LLM.length; i++) {
    out.push(i < 3 ? p1(LLM[i]) : p2(LLM[i]));
  }

  // "WALLET" — top 3 rows lavender, bottom 3 rows muted
  for (let i = 0; i < WALLET.length; i++) {
    out.push(i < 3 ? p2(WALLET[i]) : dm(WALLET[i]));
  }

  out.push("");
  out.push(dm(`  local-first credential manager for LLM inference providers`) + `  ` + p3(getVersion()));
  out.push(`  ` + dm(`wallet: `) + p2(`~/.llm-wallet/wallet.json`));
  out.push("");

  console.log(out.join("\n"));
}
