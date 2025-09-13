#!/usr/bin/env bash
set -euo pipefail

# Downloads circom v2.2.2 binary for host platform to .bin/circom and marks executable.
VERSION=2.2.2
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/.bin"
mkdir -p "$OUT_DIR"

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

if [ "$OS" = "darwin" ]; then
  CIRCOM_URL="https://github.com/iden3/circom/releases/download/v${VERSION}/circom-macos-amd64"
elif [ "$OS" = "linux" ]; then
  CIRCOM_URL="https://github.com/iden3/circom/releases/download/v${VERSION}/circom-linux-amd64"
else
  echo "Unsupported OS: $OS" >&2
  exit 1
fi

OUT_PATH="$OUT_DIR/circom"
echo "Downloading circom ${VERSION} -> ${OUT_PATH}"
curl -fsSL -o "$OUT_PATH" "$CIRCOM_URL"
chmod +x "$OUT_PATH"
echo "Downloaded circom to $OUT_PATH"
echo "$OUT_PATH"
