# a-simple-llm-wallet

A local-first CLI wallet for managing LLM inference provider credentials. Store API keys, model info, and endpoint URLs in a single place — all on your machine, no cloud sync, no leaks.

## Features

- Store credentials from any OpenAI-compatible provider (OpenAI, Groq, Ollama, Together, etc.)
- Quick connectivity test — verify a URL and API key are working
- Interactive multi-turn chat session directly in the terminal
- One-command `.env` export for use in other projects
- Data lives at `~/.llm-wallet/wallet.json`, never leaves your machine

## Requirements

- Node.js 18+
- npm

## Installation

```bash
git clone https://github.com/cwang0126/a-simple-llm-wallet.git
cd a-simple-llm-wallet
./install.sh
```

`install.sh` checks for Node.js 18+, installs dependencies, builds the project, and links the `llm-wallet` command globally — all in one step.

## Uninstallation

```bash
./uninstall.sh
```

Removes the global `llm-wallet` command. You will be prompted whether to also delete your saved wallet data at `~/.llm-wallet`.

## Build from Source

If you prefer to build manually or want to contribute:

```bash
# 1. Clone the repo
git clone https://github.com/cwang0126/a-simple-llm-wallet.git
cd a-simple-llm-wallet

# 2. Install dependencies
npm install

# 3. Compile TypeScript
npm run build

# 4. (Optional) Link globally
npm link        # makes `llm-wallet` available system-wide

# 5. Or run directly without linking
node dist/cli.js <command>

# During development (no build step needed)
npm run dev -- <command>
```

### Ollama / local providers

When adding a local provider like Ollama, make sure the base URL includes the `/v1` path:

```
http://127.0.0.1:11434/v1   ✓
http://127.0.0.1:11434      ✗  (will cause 404)
```

The CLI will automatically append `/v1` if you enter a bare host URL.

## Usage

### Add a provider

```bash
llm-wallet add
```

Walks you through an interactive prompt for name, base URL, API key, model name, context window, and modalities.

### List all providers

```bash
llm-wallet list
```

### Show provider details

```bash
llm-wallet show <name-or-id>
```

The API key is partially masked in the output.

### Edit a provider

```bash
llm-wallet edit <name-or-id>
```

Leave the API key blank during edit to keep the existing value.

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

Starts an interactive multi-turn chat session. Type `exit` or press `Ctrl+C` to quit.

### Export as .env

```bash
# Print to stdout
llm-wallet export <name-or-id>

# Write to a file
llm-wallet export <name-or-id> -o .env

# Use generic OPENAI_* variable names (compatible with most tools)
llm-wallet export <name-or-id> --generic -o .env
```

Example output (prefixed mode):

```env
# LLM Wallet export — Groq
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama3-8b-8192
GROQ_CONTEXT_WINDOW=8192
GROQ_MODALITIES=text
```

Example output (generic mode):

```env
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_API_KEY=gsk_...
OPENAI_MODEL=llama3-8b-8192
```

## Data Storage

All data is stored locally at:

```
~/.llm-wallet/wallet.json
```

No telemetry, no remote sync. Back up this file if you want to preserve your credentials.

## Supported Modalities

`text`, `vision`, `audio`, `embedding`, `image-gen`

## License

MIT
