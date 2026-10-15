#!/usr/bin/env bash
# Installs and (re)starts the FlipSign server as a launchd agent. Run on the Mac mini.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
LOGS="$HOME/Library/Logs/flipsign"
PLIST="$HOME/Library/LaunchAgents/local.flipsign.plist"

cd "$DIR"
npm ci
npm run build

mkdir -p "$LOGS" "$(dirname "$PLIST")"
sed -e "s|__NODE__|$NODE|g" -e "s|__DIR__|$DIR|g" -e "s|__LOGS__|$LOGS|g" \
  deploy/local.flipsign.plist.template > "$PLIST"
plutil -lint "$PLIST"

launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/local.flipsign"

echo "FlipSign is running on port 3000. Logs: $LOGS"
