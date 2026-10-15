#!/usr/bin/env bash
# Builds the signed release APK into firetv/dist/flipsign-firetv-<version>.apk, ready to attach to a GitHub release.
# Needs JDK 17, the Android SDK (ANDROID_HOME or local.properties) and the signing key described in firetv/README.md.
set -euo pipefail
cd "$(dirname "$0")"

PROPS="${FLIPSIGN_KEYSTORE_PROPERTIES:-$HOME/.config/flipsign/keystore.properties}"
if [ ! -f "$PROPS" ]; then
  echo "No signing key config at $PROPS. See firetv/README.md (Release signing)." >&2
  exit 1
fi

VERSION="$(node -p "require('../package.json').version")"
./gradlew --no-daemon clean lint assembleRelease

mkdir -p dist
OUT="dist/flipsign-firetv-$VERSION.apk"
cp app/build/outputs/apk/release/app-release.apk "$OUT"
cp "$OUT" dist/flipsign-firetv.apk # stable name, so releases/latest/download/flipsign-firetv.apk always works

SDK="${ANDROID_HOME:-$(sed -n 's/^sdk.dir=//p' local.properties 2>/dev/null)}"
APKSIGNER="$(ls -d "$SDK"/build-tools/*/apksigner 2>/dev/null | tail -1 || true)"
if [ -n "$APKSIGNER" ]; then
  "$APKSIGNER" verify --print-certs "$OUT" | grep -E "Signer #1 certificate (DN|SHA-256)"
fi
shasum -a 256 "$OUT"
echo "Built $OUT"
