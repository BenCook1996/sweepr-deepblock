#!/bin/bash
# SWEEPR Deepblock — 1-Click macOS Browser Auto-Installer (Chrome, Brave, Edge)
set -e

INSTALL_DIR="$HOME/Library/Application Support/SWEEPR/Deepblock/Extension"
ZIP_URL="https://sweeprdeepblock.com/download/sweepr-deepblock-extension.zip"
TMP_ZIP="/tmp/sweepr-deepblock-extension.zip"

echo "========================================================"
echo "  SWEEPR Deepblock — 1-Click macOS Browser Auto-Setup"
echo "========================================================"
echo "-> Downloading latest SWEEPR Deepblock extension..."
curl -fsSL "$ZIP_URL" -o "$TMP_ZIP"

echo "-> Unpacking extension to $INSTALL_DIR..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
unzip -qo "$TMP_ZIP" -d "$INSTALL_DIR"
rm -f "$TMP_ZIP"

# Copy path to clipboard as convenience fallback
echo -n "$INSTALL_DIR" | pbcopy 2>/dev/null || true

if [ -d "/Applications/Google Chrome.app" ]; then
  echo "-> Activating SWEEPR Deepblock in Google Chrome (restoring open tabs)..."
  osascript -e 'tell application "Google Chrome" to quit' 2>/dev/null || true
  sleep 1
  open -a "Google Chrome" --args --restore-last-session --disable-features=DisableLoadExtensionCommandLineSwitch --load-extension="$INSTALL_DIR" "https://sweeprdeepblock.com/login"
elif [ -d "/Applications/Brave Browser.app" ]; then
  echo "-> Activating SWEEPR Deepblock in Brave Browser (restoring open tabs)..."
  osascript -e 'tell application "Brave Browser" to quit' 2>/dev/null || true
  sleep 1
  open -a "Brave Browser" --args --restore-last-session --disable-features=DisableLoadExtensionCommandLineSwitch --load-extension="$INSTALL_DIR" "https://sweeprdeepblock.com/login"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  echo "-> Activating SWEEPR Deepblock in Microsoft Edge (restoring open tabs)..."
  osascript -e 'tell application "Microsoft Edge" to quit' 2>/dev/null || true
  sleep 1
  open -a "Microsoft Edge" --args --restore-last-session --disable-features=DisableLoadExtensionCommandLineSwitch --load-extension="$INSTALL_DIR" "https://sweeprdeepblock.com/login"
fi

echo "✓ SWEEPR Deepblock is now installed and active!"
exit 0
