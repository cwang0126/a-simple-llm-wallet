#!/usr/bin/env bash
set -e

echo "Installing a-simple-llm-wallet..."

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is not installed. Please install Node.js 18+ first."
  echo "  https://nodejs.org"
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Error: Node.js 18+ is required (found v$(node -v))."
  exit 1
fi

# Check npm
if ! command -v npm &>/dev/null; then
  echo "Error: npm is not found. Please install npm."
  exit 1
fi

echo "Node.js $(node -v) detected."

# Install dependencies
echo "Installing dependencies..."
npm install --silent

# Build
echo "Building..."
npm run build --silent

# Link globally
echo "Linking llm-wallet globally..."
npm link --silent

echo ""
echo "Done! Run 'llm-wallet --help' to get started."
