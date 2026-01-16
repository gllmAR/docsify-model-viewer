#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="8.46.2"
OUT_DIR="$ROOT_DIR/vendor"
PKG_URL="https://registry.npmjs.org/@babylonjs/viewer/-/viewer-${VERSION}.tgz"
CORE_PKG_URL="https://registry.npmjs.org/@babylonjs/core/-/core-${VERSION}.tgz"
LOADERS_PKG_URL="https://registry.npmjs.org/@babylonjs/loaders/-/loaders-${VERSION}.tgz"
TMP_DIR="$(mktemp -d)"

mkdir -p "$OUT_DIR"

download() {
  local url="$1"
  local out="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -L "$url" -o "$out"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "$out" "$url"
  else
    echo "curl or wget required" >&2
    exit 1
  fi
}

download "$PKG_URL" "$TMP_DIR/viewer.tgz"
download "$CORE_PKG_URL" "$TMP_DIR/core.tgz"
download "$LOADERS_PKG_URL" "$TMP_DIR/loaders.tgz"

mkdir -p "$TMP_DIR/viewer" "$TMP_DIR/core" "$TMP_DIR/loaders"
tar -xzf "$TMP_DIR/viewer.tgz" -C "$TMP_DIR/viewer"
tar -xzf "$TMP_DIR/core.tgz" -C "$TMP_DIR/core"
tar -xzf "$TMP_DIR/loaders.tgz" -C "$TMP_DIR/loaders"
rm -rf "$OUT_DIR/chunks"
rm -rf "$OUT_DIR/babylonjs-core" "$OUT_DIR/babylonjs-loaders"
cp -R "$TMP_DIR/viewer/package/dist"/* "$OUT_DIR/"
cp -R "$TMP_DIR/core/package" "$OUT_DIR/babylonjs-core"
cp -R "$TMP_DIR/loaders/package" "$OUT_DIR/babylonjs-loaders"
rm -rf "$TMP_DIR"

echo "Saved $OUT_DIR/babylon-viewer.esm.min.js, chunks/, babylonjs-core/, and babylonjs-loaders/"
