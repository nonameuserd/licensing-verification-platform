#!/usr/bin/env bash
set -euo pipefail

# Expect COSIGN_PUB_B64 in env (base64 of public key)
TMP_DIR="${GITHUB_WORKSPACE:-$(pwd)}/.tmp"
mkdir -p "$TMP_DIR"
PUB_FILE="$TMP_DIR/cosign.pub"

if [ -z "${COSIGN_PUB_B64:-}" ]; then
  echo "COSIGN_PUB_B64 not set — cannot verify signature"
  exit 2
fi

printf '%s' "$COSIGN_PUB_B64" | base64 -d > "$PUB_FILE"
chmod 644 "$PUB_FILE"

# Verify the artifact metadata signature
cosign verify-blob --key "$PUB_FILE" artifacts/artifact-metadata.json || exit 3

echo "Signature verification passed"

rm -f "$PUB_FILE"
