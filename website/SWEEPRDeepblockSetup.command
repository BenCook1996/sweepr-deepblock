#!/bin/bash
# SWEEPR Deepblock — 1-Click macOS Browser Extension Auto-Installer
set -e

echo "============================================================"
echo "  SWEEPR Deepblock — 1-Click macOS Browser Setup"
echo "============================================================"

INSTALL_DIR="$HOME/Library/Application Support/SWEEPR/Deepblock/Extension"
ZIP_PATH="$HOME/Library/Application Support/SWEEPR/Deepblock/sweepr-deepblock-extension.zip"
mkdir -p "$INSTALL_DIR"

echo "-> Downloading latest SWEEPR Deepblock extension package..."
curl -fsSL "https://sweeprdeepblock.com/download/sweepr-deepblock-extension.zip" -o "$ZIP_PATH"

echo "-> Unpacking extension to $INSTALL_DIR..."
unzip -oq "$ZIP_PATH" -d "$INSTALL_DIR"

read -r -p "Enter your 6-Digit Activation Code or Pro License Key (or press Enter to skip): " USER_KEY
if [ -n "$USER_KEY" ]; then
  printf '{"licenseKey":"%s","activation_code":"%s"}\n' "$USER_KEY" "$USER_KEY" > "$INSTALL_DIR/preactivated-license.json"
  echo "-> Pre-activated Pro key saved!"
fi

if [ -d "/Applications/Google Chrome.app" ]; then
  echo "-> Launching Google Chrome with SWEEPR Deepblock enabled..."
  killall "Google Chrome" >/dev/null 2>&1 || true
  sleep 1
  open -a "Google Chrome" --args --restore-last-session --load-extension="$INSTALL_DIR" "https://sweeprdeepblock.com/download?installed=1"
elif [ -d "/Applications/Brave Browser.app" ]; then
  echo "-> Launching Brave Browser with SWEEPR Deepblock enabled..."
  killall "Brave Browser" >/dev/null 2>&1 || true
  sleep 1
  open -a "Brave Browser" --args --restore-last-session --load-extension="$INSTALL_DIR" "https://sweeprdeepblock.com/download?installed=1"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  echo "-> Launching Microsoft Edge with SWEEPR Deepblock enabled..."
  killall "Microsoft Edge" >/dev/null 2>&1 || true
  sleep 1
  open -a "Microsoft Edge" --args --restore-last-session --load-extension="$INSTALL_DIR" "https://sweeprdeepblock.com/download?installed=1"
else
  echo "-> Extension unpacked to: $INSTALL_DIR"
fi

echo "✓ SWEEPR Deepblock setup complete!"
