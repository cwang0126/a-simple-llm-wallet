#!/usr/bin/env bash
set -e

echo "Setting up LLM Wallet Desktop..."
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is not installed. Please install Node.js 18+."
  echo "  https://nodejs.org"
  exit 1
fi

# Check Rust
if ! command -v cargo &>/dev/null; then
  echo "Rust is not installed. Installing via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
  echo "✓ Rust installed."
fi

# Check Tauri CLI
if ! cargo tauri --version &>/dev/null 2>&1; then
  echo "Installing Tauri CLI..."
  cargo install tauri-cli --version "^2.0" --locked
  echo "✓ Tauri CLI installed."
fi

echo "Installing npm dependencies..."
npm install

echo ""
echo "Done! To start the desktop app in development mode, run:"
echo "  cd app && npm run tauri dev"
echo ""
echo "To build a release .app bundle:"
echo "  cd app && npm run tauri build"
