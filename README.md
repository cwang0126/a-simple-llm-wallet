# a-simple-llm-wallet

[![GitHub Stars](https://img.shields.io/github/stars/cwang0126/a-simple-llm-wallet?style=flat&color=gold)](https://github.com/cwang0126/a-simple-llm-wallet/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/cwang0126/a-simple-llm-wallet?style=flat)](https://github.com/cwang0126/a-simple-llm-wallet/network/members)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-brightgreen)](https://github.com/cwang0126/a-simple-llm-wallet/releases)

A local-first CLI & App wallet for managing LLM inference provider credentials. Store API keys, model names, and endpoint URLs from any provider in one place — all on your machine, zero cloud sync, zero leakage risk.

---

## Why

Managing credentials across OpenAI, Groq, Ollama, Together, and other providers gets messy fast — scattered `.env` files, forgotten API keys, broken endpoints. `llm-wallet` gives you a single local store with instant connectivity testing and one-command `.env` export for any project.

---

## Features

- **Unified credential store** — manage any number of OpenAI-compatible providers in one place
- **Connectivity test** — verify a base URL and API key are working with a single command
- **Interactive chat** — multi-turn chat session in the terminal to test a model directly
- **`.env` export** — generate environment variable blocks for use in other projects, with prefixed or generic (`OPENAI_*`) naming
- **Fully local** — data lives at `~/.llm-wallet/wallet.json`, never leaves your machine
- **Portable credentials** — wallet data persists across reinstalls automatically

---

## Requirements

- Node.js 18+
- npm

---

## Installation

```bash
git clone https://github.com/cwang0126/a-simple-llm-wallet.git
cd a-simple-llm-wallet
./install.sh
```

`install.sh` verifies Node.js 18+, installs dependencies, compiles TypeScript, and links the `llm-wallet` command globally — all in one step.

## Uninstallation

```bash
./uninstall.sh
```

Removes the global `llm-wallet` command. You will be prompted whether to delete or keep your wallet data at `~/.llm-wallet` — keeping it means your credentials are automatically available on next install.

## Build from Source

```bash
# Clone and enter the repo
git clone https://github.com/cwang0126/a-simple-llm-wallet.git
cd a-simple-llm-wallet

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Link globally (optional)
npm link

# Or run directly without linking
node dist/cli.js <command>

# Development mode (no build step needed)
npm run dev -- <command>
```

---

## Usage

### Add a provider

```bash
llm-wallet add
```

Interactive prompt for name, base URL, API key, model name, context window, and modalities.

### List all providers

```bash
llm-wallet list
```

### Show provider details

```bash
llm-wallet show <name-or-id>
```

API key is partially masked in the output.

### Edit a provider

```bash
llm-wallet edit <name-or-id>
```

Leave the API key field blank to keep the existing value.

### Delete a provider

```bash
llm-wallet delete <name-or-id>
```

Asks for confirmation before deleting.

### Test connectivity

```bash
llm-wallet test <name-or-id>
```

Sends a minimal request to verify the endpoint and API key are working.

### Chat

```bash
llm-wallet chat <name-or-id>
```

Starts an interactive multi-turn chat session. Type `exit` or `Ctrl+C` to quit.

### Export as `.env`

```bash
# Print to stdout
llm-wallet export <name-or-id>

# Write directly to a file
llm-wallet export <name-or-id> -o .env

# Use generic OPENAI_* names (compatible with most tools and frameworks)
llm-wallet export <name-or-id> --generic -o .env
```

**Prefixed output** (default):

```env
# LLM Wallet export — Groq
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama3-8b-8192
GROQ_CONTEXT_WINDOW=8192
GROQ_MODALITIES=text
```

**Generic output** (`--generic`):

```env
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_API_KEY=gsk_...
OPENAI_MODEL=llama3-8b-8192
```

---

## Supported Providers

Any provider with an OpenAI-compatible API works out of the box, including:

| Provider | Base URL |
|----------|----------|
| OpenAI | `https://api.openai.com/v1` |
| Groq | `https://api.groq.com/openai/v1` |
| Together AI | `https://api.together.xyz/v1` |
| Ollama (local) | `http://127.0.0.1:11434/v1` |
| LM Studio (local) | `http://127.0.0.1:1234/v1` |
| Any OpenAI-compatible endpoint | `https://your-endpoint/v1` |

> **Note for local providers (Ollama, LM Studio, etc.):** the base URL must include `/v1`. The CLI will warn and auto-correct if you enter a bare host URL.

---

## Data Storage

All data is stored locally at:

```
~/.llm-wallet/wallet.json
```

No telemetry, no analytics, no remote sync. Back up this file to preserve your credentials across machines.

---

## Supported Modalities

`text` · `vision` · `audio` · `embedding` · `image-gen`

---

## Desktop App (macOS)

A native macOS desktop client built with [Tauri 2](https://tauri.app) + React. Final app bundle is ~8MB — no Electron, no bloat. Features a Kiro-inspired design with full light/dark theme support.

### Install from Release (recommended)

1. Go to [Releases](https://github.com/cwang0126/a-simple-llm-wallet/releases)
2. Download `LLM.Wallet.x.x.x.dmg` from the Assets section
3. Open the `.dmg` and drag **LLM Wallet.app** to your `/Applications` folder

#### Fix app crashing on first launch (macOS Gatekeeper)

Because the app is not notarized by Apple, macOS quarantines it and it will crash on first open. Run this once in Terminal to remove the quarantine flag:

```bash
sudo xattr -dr com.apple.quarantine /Applications/LLM\ Wallet.app
```

Then open the app normally from Launchpad or Finder.

> This is a standard workaround for unsigned macOS apps distributed outside the App Store. The command only removes the quarantine attribute — it does not modify the app itself.

### Build from source

#### Prerequisites

- Node.js 18+
- Rust (installed automatically by the setup script if missing)

#### Setup

```bash
cd app
./install-app.sh
```

#### Run in development

```bash
cd app
npm run tauri dev
```

#### Build release .app

```bash
cd app
npm run tauri build
```

The `.app` bundle will be at `app/src-tauri/target/release/bundle/macos/`.

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=cwang0126/a-simple-llm-wallet&type=Date)](https://star-history.com/#cwang0126/a-simple-llm-wallet&Date)

---

## Contributing

Contributions are welcome. Feel free to open issues for bugs or feature requests, and PRs for improvements.

---

## License

[MIT](LICENSE)
