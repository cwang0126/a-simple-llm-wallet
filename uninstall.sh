#!/usr/bin/env bash
set -e

echo "Uninstalling a-simple-llm-wallet..."
echo ""

# Remove global npm link
if npm list -g a-simple-llm-wallet &>/dev/null; then
  echo "Removing global npm link..."
  npm unlink -g a-simple-llm-wallet
  echo "✓ Global command 'llm-wallet' removed."
else
  echo "No global npm link found, skipping."
fi

# Handle wallet data
echo ""
WALLET_DIR="$HOME/.llm-wallet"
WALLET_FILE="$WALLET_DIR/wallet.json"

if [ -f "$WALLET_FILE" ]; then
  echo "Your saved credentials are stored at: $WALLET_DIR"
  echo ""
  echo "What would you like to do with your wallet data?"
  echo "  [k] Keep it — data stays at ~/.llm-wallet and will be picked up automatically on next install (recommended)"
  echo "  [d] Delete it — permanently removes all saved provider credentials"
  echo ""
  read -r -p "Choice [K/d]: " choice

  case "$choice" in
    [Dd])
      rm -rf "$WALLET_DIR"
      echo "✓ Wallet data deleted."
      ;;
    *)
      echo "✓ Wallet data kept at $WALLET_DIR"
      echo "  Your credentials will be available automatically when you reinstall."
      ;;
  esac
else
  echo "No wallet data found at $WALLET_DIR, nothing to remove."
fi

echo ""
echo "Done. a-simple-llm-wallet has been uninstalled."
