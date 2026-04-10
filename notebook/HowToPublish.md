# How to Publish the Desktop App as a DMG on GitHub

This guide walks through building a signed/unsigned `.dmg` for macOS and publishing it as a GitHub Release asset.

---

## Prerequisites

- Rust installed (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- Tauri CLI v2 installed (`cargo install tauri-cli --version "^2.0" --locked`)
- Node.js 18+
- Xcode Command Line Tools (`xcode-select --install`)
- A GitHub account with push access to the repo

---

## 1. Build the Release Bundle

From the `desktop/` directory:

```bash
cd desktop
npm install
npm run tauri build
```

Tauri will compile the Rust backend in release mode and bundle the frontend. Output artifacts:

```
desktop/src-tauri/target/release/bundle/
├── dmg/
│   └── LLM Wallet_0.1.0_aarch64.dmg   ← the distributable
└── macos/
    └── LLM Wallet.app                  ← raw .app bundle
```

The `.dmg` is what you distribute. The `.app` can be zipped and distributed separately if needed.

---

## 2. (Optional) Code Signing

Without signing, macOS will show a Gatekeeper warning on first launch. Users can bypass it via **System Settings → Privacy & Security → Open Anyway**, but signing gives a better experience.

### Ad-hoc signing (free, no Apple Developer account)

```bash
codesign --force --deep --sign - "desktop/src-tauri/target/release/bundle/macos/LLM Wallet.app"
```

This suppresses some warnings but does not pass Gatekeeper notarization.

### Full signing + notarization (requires Apple Developer Program — $99/year)

1. Export your Developer ID certificate from Keychain Access.
2. Set environment variables before building:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="your@apple.id"
export APPLE_PASSWORD="app-specific-password"   # from appleid.apple.com
export APPLE_TEAM_ID="YOURTEAMID"
```

3. Run `npm run tauri build` — Tauri will sign and notarize automatically.

---

## 3. Create a GitHub Release

### Option A — GitHub Web UI

1. Go to `https://github.com/cwang0126/a-simple-llm-wallet/releases`
2. Click **Draft a new release**
3. Set the tag: `desktop-v0.1.0` (use a prefix to distinguish from CLI releases)
4. Set the title: `Desktop v0.1.0`
5. Write release notes (see template below)
6. Drag and drop the `.dmg` file into the **Attach binaries** area
7. Click **Publish release**

### Option B — GitHub CLI

```bash
# Install gh CLI if needed: brew install gh
gh release create desktop-v0.1.0 \
  "desktop/src-tauri/target/release/bundle/dmg/LLM Wallet_0.1.0_aarch64.dmg" \
  --title "Desktop v0.1.0" \
  --notes "Initial macOS desktop release. See release notes below."
```

---

## 4. Release Notes Template

```markdown
## LLM Wallet Desktop v0.1.0

First macOS desktop release built with Tauri 2 + React.

### Download
- **macOS (Apple Silicon):** `LLM Wallet_0.1.0_aarch64.dmg`
- **macOS (Intel):** *(cross-compile instructions below)*

### Installation
1. Download the `.dmg`
2. Open it and drag **LLM Wallet.app** to your Applications folder
3. On first launch, if macOS blocks it: System Settings → Privacy & Security → Open Anyway

### Features
- Manage LLM provider credentials locally
- Group multiple models under one provider (e.g. Ollama gemma4, Ollama OSS:20B)
- Set expiry dates on API keys — see days remaining at a glance
- Quick connectivity test and interactive chat
- .env export with prefixed or generic OPENAI_* naming
- Light / dark theme toggle
- Shares wallet data with the CLI tool (`~/.llm-wallet/wallet.json`)

### Notes
- Wallet data is stored at `~/.llm-wallet/wallet.json` — same file used by the CLI
- No telemetry, no cloud sync
```

---

## 5. Building for Intel Macs (x86_64)

By default, `tauri build` targets your current architecture. To build a universal binary:

```bash
# Install the Intel target
rustup target add x86_64-apple-darwin

# Build universal binary (runs on both Apple Silicon and Intel)
npm run tauri build -- --target universal-apple-darwin
```

Output: `bundle/dmg/LLM Wallet_0.1.0_universal.dmg`

Upload both the `aarch64` and `universal` DMGs as release assets.

---

## 6. Automating with GitHub Actions (optional)

Create `.github/workflows/desktop-release.yml`:

```yaml
name: Desktop Release

on:
  push:
    tags:
      - 'desktop-v*'

jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-darwin,x86_64-apple-darwin

      - name: Install dependencies
        run: npm install
        working-directory: desktop

      - name: Build Tauri app
        run: npm run tauri build -- --target universal-apple-darwin
        working-directory: desktop

      - name: Upload DMG to release
        uses: softprops/action-gh-release@v2
        with:
          files: desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg
```

Push a tag to trigger it:

```bash
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

---

## Quick Reference

| Step | Command |
|------|---------|
| Build | `cd desktop && npm run tauri build` |
| Ad-hoc sign | `codesign --force --deep --sign - "...LLM Wallet.app"` |
| Create release (CLI) | `gh release create desktop-v0.1.0 *.dmg --title "Desktop v0.1.0"` |
| Universal build | `npm run tauri build -- --target universal-apple-darwin` |
