#!/bin/bash
set -euo pipefail

CHROME_STORE_URL="https://chromewebstore.google.com/detail/bkdfhdgmglfancgpkcbdceinfdlccmpc"
FIREFOX_AMO_URL="https://addons.mozilla.org/en-US/firefox/addon/sweepr-deepblock/"

clear
echo "================================================================"
echo "  SWEEPR Deepblock — Official Store Installer (macOS)"
echo "================================================================"
echo ""
echo "Extension packages on macOS are installed through your browser's"
echo "official signed store listing for automatic updates & security."
echo ""
echo -n "Optional: Paste your SWEEPR-DB-XXXX-XXXX-XXXX license key (or press Enter for Free): "
read -r RAW_KEY

KEY="$(printf '%s' "$RAW_KEY" | tr '[:lower:]' '[:upper:]' | xargs)"
if [ -n "$KEY" ]; then
  if ! printf '%s' "$KEY" | grep -Eq '^SWEEPR-[A-Z0-9]{2,8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$'; then
    echo "[ERROR] Invalid key format. Enter a full SWEEPR-DB-XXXX-XXXX-XXXX license key."
    exit 1
  fi
  echo "Verifying license key with sweeprdeepblock.com..."
  VERIFY_RESP="$(curl -fsS --max-time 8 -X POST -H "Content-Type: application/json" -d "{\"key\":\"$KEY\",\"license_key\":\"$KEY\"}" https://sweeprdeepblock.com/api/license-verify 2>/dev/null || true)"
  if ! printf '%s' "$VERIFY_RESP" | grep -Eq '"valid"[[:space:]]*:[[:space:]]*true'; then
    echo "[ERROR] License key verification failed (key is invalid, expired, or server unreachable)."
    exit 1
  fi
  printf '%s' "$KEY" | pbcopy
  echo "[OK] License key verified live and copied to clipboard."
fi

if [ -d "/Applications/Firefox.app" ] && [ ! -d "/Applications/Google Chrome.app" ] && [ ! -d "/Applications/Brave Browser.app" ] && [ ! -d "/Applications/Microsoft Edge.app" ]; then
  echo "Opening Firefox Add-ons (AMO)..."
  open -a "Firefox" "$FIREFOX_AMO_URL"
elif [ -d "/Applications/Google Chrome.app" ]; then
  echo "Opening Chrome Web Store in Google Chrome..."
  open -a "Google Chrome" "$CHROME_STORE_URL"
elif [ -d "/Applications/Brave Browser.app" ]; then
  echo "Opening Chrome Web Store in Brave Browser..."
  open -a "Brave Browser" "$CHROME_STORE_URL"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  echo "Opening Chrome Web Store in Microsoft Edge..."
  open -a "Microsoft Edge" "$CHROME_STORE_URL"
else
  echo "Opening official Chrome Web Store listing in default browser..."
  open "$CHROME_STORE_URL"
fi

if [ -d "/Applications/Firefox.app" ] && [ -d "/Applications/Google Chrome.app" ]; then
  echo "Firefox detected too -> $FIREFOX_AMO_URL"
fi

echo ""
echo "Click 'Add to Chrome' / 'Add to Firefox', then paste your Pro key"
echo "from the clipboard (Cmd+V) in the SWEEPR Deepblock popup."
