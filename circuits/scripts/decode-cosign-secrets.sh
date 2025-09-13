#!/usr/bin/env bash
# Decode COSIGN_KEY_B64 and COSIGN_PUB_B64 into temporary files and run a command with them
# Usage:
#   decode-cosign-secrets.sh [--keep] -- <command...>
# Examples:
#   COSIGN_KEY_B64=... COSIGN_PUB_B64=... ./decode-cosign-secrets.sh -- cosign verify-blob --key "$COSIGN_PUB_FILE" /tmp/file
#   ./decode-cosign-secrets.sh --keep -- /bin/ls -la "$TMPDIR"

set -euo pipefail

KEEP=0
if [[ "${1-}" == "--help" || "${1-}" == "-h" ]]; then
  sed -n '1,200p' "$0"
  exit 0
fi
if [[ "${1-}" == "--keep" ]]; then
  KEEP=1
  shift
fi

if [[ "${1-}" != "--" ]]; then
  echo "Usage: $0 [--keep] -- <command...>"
  echo "Runs the given command with COSIGN_KEY_FILE and COSIGN_PUB_FILE set to temporary decoded files." >&2
  exit 2
fi
shift # remove --

# Create a temp dir
TMPDIR=$(mktemp -d -t cosign-XXXXXX)
cleanup() {
  if [[ "$KEEP" -eq 1 ]]; then
    echo "Keeping temp dir: $TMPDIR"
  else
    # Safely remove only if TMPDIR looks like our created temp path
    if [[ -n "$TMPDIR" && "$TMPDIR" == /tmp/cosign-* ]] || [[ "$TMPDIR" == /var/tmp/cosign-* ]]; then
      rm -rf -- "$TMPDIR" || true
    else
      rm -rf -- "$TMPDIR" || true
    fi
  fi
}
trap cleanup EXIT

# Helper to decode base64 robustly across macOS (base64 -D) and Linux (base64 -d)
decode_base64() {
  local input="$1"; shift
  local out="$1"; shift

  if command -v base64 >/dev/null 2>&1; then
    if base64 --help >/dev/null 2>&1; then
      # prefer -d (linux) then -D (macos)
      if printf "" | base64 -d >/dev/null 2>&1; then
        printf "%s" "$input" | base64 -d > "$out"
        return 0
      fi
      if printf "" | base64 -D >/dev/null 2>&1; then
        printf "%s" "$input" | base64 -D > "$out"
        return 0
      fi
    fi
  fi
  if command -v openssl >/dev/null 2>&1; then
    printf "%s" "$input" | openssl base64 -d -out "$out"
    return 0
  fi
  echo "No suitable base64 decoder found (tried base64 and openssl)" >&2
  return 1
}

# Decode COSIGN_KEY_B64
if [[ -n "${COSIGN_KEY_B64-}" ]]; then
  COSIGN_KEY_FILE="$TMPDIR/cosign.key"
  decode_base64 "$COSIGN_KEY_B64" "$COSIGN_KEY_FILE"
  chmod 600 "$COSIGN_KEY_FILE"
  export COSIGN_KEY_FILE
  echo "Decoded COSIGN_KEY_B64 -> $COSIGN_KEY_FILE"
else
  echo "Warning: COSIGN_KEY_B64 not set. COSIGN_KEY_FILE will not be created." >&2
fi

# Decode COSIGN_PUB_B64
if [[ -n "${COSIGN_PUB_B64-}" ]]; then
  COSIGN_PUB_FILE="$TMPDIR/cosign.pub"
  decode_base64 "$COSIGN_PUB_B64" "$COSIGN_PUB_FILE"
  chmod 644 "$COSIGN_PUB_FILE"
  export COSIGN_PUB_FILE
  echo "Decoded COSIGN_PUB_B64 -> $COSIGN_PUB_FILE"
else
  echo "Warning: COSIGN_PUB_B64 not set. COSIGN_PUB_FILE will not be created." >&2
fi

# Export COSIGN_PASSWORD if present (so called commands can use it)
if [[ -n "${COSIGN_PASSWORD-}" ]]; then
  export COSIGN_PASSWORD
fi

# Run the provided command with the environment variables available
if [[ $# -gt 0 ]]; then
  echo "Running command: $*"
  exec "$@"
else
  echo "No command provided. Files are available at:"
  [[ -n "${COSIGN_KEY_FILE-}" ]] && echo "  COSIGN_KEY_FILE=$COSIGN_KEY_FILE"
  [[ -n "${COSIGN_PUB_FILE-}" ]] && echo "  COSIGN_PUB_FILE=$COSIGN_PUB_FILE"
  echo "Use --keep to preserve files after exit." 
fi
