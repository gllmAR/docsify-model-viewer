#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="8.46.2"
OUT_DIR="$ROOT_DIR/vendor"
OUT_FILE="$OUT_DIR/babylon-viewer.esm.min.js"
mkdir -p "$OUT_DIR"
URL="https://cdn.jsdelivr.net/npm/@babylonjs/viewer@${VERSION}/dist/babylon-viewer.esm.min.js"

if command -v curl >/dev/null 2>&1; then
  curl -L "$URL" -o "$OUT_FILE"
elif command -v wget >/dev/null 2>&1; then
  wget -O "$OUT_FILE" "$URL"
else
  echo "curl or wget required" >&2
  exit 1
fi

echo "Saved $OUT_FILE"
