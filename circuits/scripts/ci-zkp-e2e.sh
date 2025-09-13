#!/usr/bin/env bash
set -euo pipefail

# CI ZKP End-to-End Test Script
# This script runs the complete ZKP workflow for CI testing
# Usage: ./circuits/scripts/ci-zkp-e2e.sh

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR/.."

echo "🚀 Starting ZKP End-to-End CI Test"
echo "=================================="

# Install workspace dependencies
echo "📦 Installing workspace dependencies..."
yarn install --frozen-lockfile

# Build shared package
echo "🔨 Building shared package..."
npx nx build shared

cd circuits

# Install circuits dependencies
echo "📦 Installing circuits dependencies..."
yarn install --frozen-lockfile

# Build TypeScript
echo "🔨 Building TypeScript..."
yarn build:ts

# Compile circuits
echo "⚡ Compiling circuits..."
yarn compile

# Run setup (generate zkeys)
echo "🔑 Running setup (generating zkeys)..."
yarn setup

# Generate proof
echo "🔐 Generating proof..."
yarn ci-local:gen-proof

# Verify proof
echo "✅ Verifying proof..."
yarn verify-proof

# Deploy verifier and run on-chain verification
echo "🌐 Running on-chain verification..."
yarn deploy-verifier
yarn call-onchain-verify

# Verify artifacts were created
echo "🔍 Verifying generated artifacts..."
if [ -f .last-canonical ]; then
  PROOFS_DIR=$(cat .last-canonical)
  echo "📁 Proof directory: $PROOFS_DIR"
  
  if [ -d "$PROOFS_DIR" ]; then
    echo "📋 Checking proof files..."
    ls -la "$PROOFS_DIR"
    
    # Check for required files
    REQUIRED_FILES=(
      "canonical-input.json"
      "canonical-input.signed.json"
      "witness.wtns"
      "proof.json"
      "public.json"
    )
    
    for file in "${REQUIRED_FILES[@]}"; do
      if [ -f "$PROOFS_DIR/$file" ]; then
        echo "✅ $file exists"
      else
        echo "❌ $file missing"
        exit 1
      fi
    done
    
    echo "🎉 All ZKP artifacts generated successfully!"
  else
    echo "❌ Proof directory not found: $PROOFS_DIR"
    exit 1
  fi
else
  echo "❌ No canonical proof marker found"
  exit 1
fi

echo "=================================="
echo "✅ ZKP End-to-End CI Test Complete!"
echo "=================================="
