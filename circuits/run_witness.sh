#!/usr/bin/env bash
# Small helper to compile ExamProof.circom and generate a witness using input.example.json
# Adjust paths and tools (circom, snarkjs, node) to your environment.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CIRCUIT_SRC="$ROOT_DIR/src/ExamProof.circom"
BUILD_DIR="$ROOT_DIR/build"
INPUT_JSON="$ROOT_DIR/input.example.json"

echo "Compiling circuit: $CIRCUIT_SRC -> $BUILD_DIR"
mkdir -p "$BUILD_DIR"
circom "$CIRCUIT_SRC" --r1cs --wasm --sym -o "$BUILD_DIR"

echo "R1CS info:"
snarkjs r1cs info "$BUILD_DIR/ExamProof.r1cs" || true

WASM_JS_DIR="$BUILD_DIR/ExamProof_js"
WASM="$WASM_JS_DIR/ExamProof.wasm"
GENERATE_WITNESS_JS="$WASM_JS_DIR/generate_witness.js"
WITNESS_OUT="$BUILD_DIR/witness.wtns"

if [ ! -f "$GENERATE_WITNESS_JS" ]; then
  echo "generate_witness.js not found in $WASM_JS_DIR. Ensure circom produced the JS witness generator."
  exit 1
fi

echo "Generating witness (input: $INPUT_JSON) -> $WITNESS_OUT"
node "$GENERATE_WITNESS_JS" "$WASM" "$INPUT_JSON" "$WITNESS_OUT"

echo "Witness generated: $WITNESS_OUT"
