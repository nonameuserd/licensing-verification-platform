#!/usr/bin/env bash
set -euo pipefail

# Local test harness for checksum verification and Docker build.
# Usage: ./verify-binaries-local.sh
# Requires: curl, sha256sum, docker (for build step), bash

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CHECKSUM_DIR="$ROOT_DIR/scripts/expected-checksums"

CIRCOM_VERSION=2.2.2
CIRCOM_URL="https://github.com/iden3/circom/releases/download/v${CIRCOM_VERSION}/circom-linux-amd64"
CIRCOM_EXPECTED_FILE="$CHECKSUM_DIR/circom_v${CIRCOM_VERSION}.sha256"

COSIGN_VERSION=2.5.3
COSIGN_URL="https://github.com/sigstore/cosign/releases/download/v${COSIGN_VERSION}/cosign-linux-amd64"
COSIGN_EXPECTED_FILE="$CHECKSUM_DIR/cosign_v${COSIGN_VERSION}.sha256"

TMPDIR=$(mktemp -d)
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

echo "Downloading circom ${CIRCOM_VERSION}..."
curl -fsSL -o "$TMPDIR/circom" "$CIRCOM_URL"
if [ ! -s "$TMPDIR/circom" ]; then
  echo "ERROR: circom download empty" >&2
  exit 1
fi
ACTUAL_CIRCOM=$(sha256sum "$TMPDIR/circom" | cut -d' ' -f1)
EXPECTED_CIRCOM=$(tr -d '\n' < "$CIRCOM_EXPECTED_FILE")
echo "circom actual:   $ACTUAL_CIRCOM"
echo "circom expected: $EXPECTED_CIRCOM"
if [ "$ACTUAL_CIRCOM" != "$EXPECTED_CIRCOM" ]; then
  echo "ERROR: circom checksum mismatch" >&2
  exit 2
fi

echo "Downloading cosign ${COSIGN_VERSION}..."
curl -fsSL -o "$TMPDIR/cosign" "$COSIGN_URL"
if [ ! -s "$TMPDIR/cosign" ]; then
  echo "ERROR: cosign download empty" >&2
  exit 1
fi
ACTUAL_COSIGN=$(sha256sum "$TMPDIR/cosign" | cut -d' ' -f1)
EXPECTED_COSIGN=$(tr -d '\n' < "$COSIGN_EXPECTED_FILE")
echo "cosign actual:   $ACTUAL_COSIGN"
echo "cosign expected: $EXPECTED_COSIGN"
if [ "$ACTUAL_COSIGN" != "$EXPECTED_COSIGN" ]; then
  echo "ERROR: cosign checksum mismatch" >&2
  exit 2
fi

# Checks passed: complete verification. This script now only performs checksum
# verification for the pinned binaries and exits successfully. Any Docker-based
# smoke tests or nested builds have been removed to keep the script simple and
# safe to run in containerized environments.
echo "Checksums OK — verification complete."
exit 0
