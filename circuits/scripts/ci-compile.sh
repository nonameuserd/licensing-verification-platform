#!/usr/bin/env bash
set -euo pipefail

# ci-compile.sh: run inside the docker container or locally to produce build outputs
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR/.."

echo "Installing circuits deps..."
cd circuits
npm ci --no-audit --no-fund

echo "Running circom compile..."
npm run compile

echo "Running setup script (generate zkey or other) if present..."
npm run setup || true

echo "Done. Build outputs are under circuits/build/"
