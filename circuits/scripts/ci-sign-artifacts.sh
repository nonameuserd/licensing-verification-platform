#!/usr/bin/env bash
set -euo pipefail

# This script decodes COSIGN_KEY_B64 (if present) to a temporary file,
# runs the circuits metadata generation + signing inside the lvp-circuits
# container (which has cosign installed), and securely removes the key.

TMP_DIR="${GITHUB_WORKSPACE:-$(pwd)}/.tmp"
mkdir -p "$TMP_DIR"
COSIGN_KEY_FILE="$TMP_DIR/cosign.key"

if [ -n "${COSIGN_KEY_B64:-}" ]; then
  # Use a robust decoder; prefer base64 -d, then openssl
  if command -v base64 >/dev/null 2>&1; then
    printf '%s' "$COSIGN_KEY_B64" | base64 -d > "$COSIGN_KEY_FILE"
  elif command -v openssl >/dev/null 2>&1; then
    printf '%s' "$COSIGN_KEY_B64" | openssl base64 -d -out "$COSIGN_KEY_FILE"
  else
    echo "No base64 decoder available; cannot decode COSIGN_KEY_B64" >&2
    exit 1
  fi
  chmod 600 "$COSIGN_KEY_FILE"
  export COSIGN_KEY="$COSIGN_KEY_FILE"
else
  unset COSIGN_KEY || true
fi

# Run generation and signing inside the prebuilt circuits container.
docker run --rm -e COSIGN_PASSWORD -e COSIGN_KEY -v "$GITHUB_WORKSPACE":/work -w /work lvp-circuits \
  sh -c "cd circuits && yarn build:ts || true && node dist/scripts/generate-artifact-metadata.js && node dist/scripts/sign-artifacts.js"

# Clean up sensitive temporary files on the runner
if [ -f "$COSIGN_KEY_FILE" ]; then
  if command -v shred >/dev/null 2>&1; then
    shred -u "$COSIGN_KEY_FILE" || rm -f "$COSIGN_KEY_FILE"
  else
    # Best-effort: truncate and remove
    : > "$COSIGN_KEY_FILE" || true
    rm -f "$COSIGN_KEY_FILE" || true
  fi
fi
