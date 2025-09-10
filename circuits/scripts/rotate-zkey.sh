#!/usr/bin/env bash
# Simple helper to rotate/regen a zkey for ExamProof.
# Usage: ./rotate-zkey.sh [archive-dir]
# Requires: snarkjs installed (npx --yes snarkjs ...), bash/zsh
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
BUILD_DIR="$ROOT_DIR/build"
SETUP_DIR="$ROOT_DIR/zkey"
ARCHIVE_DIR=${1:-"$ROOT_DIR/zkey-archive"}
CIRCUIT_NAME="ExamProof"
# Use 16 by default to support larger circuits (matches scripts/setup.ts behavior)
PTAU_POWER=16
mkdir -p "$ARCHIVE_DIR"
mkdir -p "$SETUP_DIR"

# Archive existing zkeys
if [ -f "$SETUP_DIR/${CIRCUIT_NAME}_0001.zkey" ]; then
  TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
  mv "$SETUP_DIR/${CIRCUIT_NAME}_0001.zkey" "$ARCHIVE_DIR/${CIRCUIT_NAME}_0001.zkey.$TIMESTAMP"
  echo "Archived existing zkey to $ARCHIVE_DIR/${CIRCUIT_NAME}_0001.zkey.$TIMESTAMP"
fi

cd "$ROOT_DIR"

# 1) generate ptau
npx --yes snarkjs powersoftau new bn128 $PTAU_POWER "$SETUP_DIR/pot${PTAU_POWER}_0000.ptau" -v
npx --yes snarkjs powersoftau contribute "$SETUP_DIR/pot${PTAU_POWER}_0000.ptau" "$SETUP_DIR/pot${PTAU_POWER}_0001.ptau" --name="rotate-$(whoami)-$(date -u +%s)" -v

# Prepare phase2 final ptau that groth16 setup expects
npx --yes snarkjs powersoftau prepare phase2 "$SETUP_DIR/pot${PTAU_POWER}_0001.ptau" "$SETUP_DIR/pot${PTAU_POWER}_final.ptau" -v

# 2) groth16 setup
npx --yes snarkjs groth16 setup "$BUILD_DIR/${CIRCUIT_NAME}.r1cs" "$SETUP_DIR/pot${PTAU_POWER}_final.ptau" "$SETUP_DIR/${CIRCUIT_NAME}_0001.zkey"

# 3) optionally contribute to make it unique
npx --yes snarkjs zkey contribute "$SETUP_DIR/${CIRCUIT_NAME}_0001.zkey" "$SETUP_DIR/${CIRCUIT_NAME}_0001.zkey" --name="dev-rotate-$(whoami)" -v

# 4) export verification key
npx --yes snarkjs zkey export verificationkey "$SETUP_DIR/${CIRCUIT_NAME}_0001.zkey" "$SETUP_DIR/verification_key.json"

echo "New zkey and verification key generated in $SETUP_DIR"
