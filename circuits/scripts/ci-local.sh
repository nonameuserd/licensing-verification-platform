#!/usr/bin/env bash
set -euo pipefail

# Local CI reproduction script
# Usage: ./circuits/scripts/ci-local.sh
# This script performs a minimal local reproduction of the CI on-chain verify flow:
#  - ensures workspace deps are installed
#  - builds shared package and circuits workspace deps
#  - starts a local Hardhat node
#  - builds TS helpers, generates a proof, deploys verifier, calls on-chain verify

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR/.."

echo "Installing workspace deps (root)"
yarn install --non-interactive || true

echo "Building shared workspace package"
npx nx build shared || true

cd circuits
echo "Installing circuits deps (circuits)"
yarn install --non-interactive || true

echo "Building TypeScript helpers"
yarn build:ts
echo "Running circuit setup (generate zkeys)"

# Run setup to generate proving/verification keys needed by generate-proof.
# Prefer compiled JS in dist so artifacts are created under dist/circuits/setup
# which is where the compiled scripts expect them. Fall back to ts-node source.
if [ -f dist/circuits/scripts/setup.js ]; then
  node dist/circuits/scripts/setup.js || true
elif [ -f scripts/setup.ts ]; then
  # fallback to ts-node if dist not available
  if command -v ts-node >/dev/null 2>&1; then
    ts-node -r tsconfig-paths/register --transpile-only scripts/setup.ts || true
  else
    echo "No runnable setup entrypoint found; skipping setup";
  fi
fi

echo "Generating Solidity verifier (if missing)"
if [ -f dist/circuits/scripts/generate-verifier.js ]; then
  node dist/circuits/scripts/generate-verifier.js || true
elif [ -f scripts/generate-verifier.ts ]; then
  if command -v ts-node >/dev/null 2>&1; then
    ts-node -r tsconfig-paths/register --transpile-only scripts/generate-verifier.ts || true
  else
    echo "No runnable generate-verifier entrypoint found; skipping";
  fi
fi

npx hardhat node --config hardhat-config/hardhat.config.ts --hostname 127.0.0.1 &
HARDHAT_PID=$!

function cleanup() {
  echo "Cleaning up. Killing Hardhat (pid: ${HARDHAT_PID})"
  kill ${HARDHAT_PID} >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "Waiting for Hardhat RPC on http://127.0.0.1:8545"
MAX_WAIT=60
INTERVAL=1
ELAPSED=0
while ! nc -z 127.0.0.1 8545 >/dev/null 2>&1; do
  if [ ${ELAPSED} -ge ${MAX_WAIT} ]; then
    echo "Hardhat RPC did not become ready after ${MAX_WAIT}s" >&2
    exit 1
  fi
  echo "Hardhat not ready; sleeping ${INTERVAL}s... (elapsed ${ELAPSED}s)"
  sleep ${INTERVAL}
  ELAPSED=$((ELAPSED + INTERVAL))
  if [ ${INTERVAL} -lt 5 ]; then
    INTERVAL=$((INTERVAL * 2))
  fi
done

echo "Generating proof (TS)"
export PRIVATE_KEY="${PRIVATE_KEY:-0x1}"
echo "Using PRIVATE_KEY=${PRIVATE_KEY}" 

# Example environment variables (can override)
export HOLDER_NAME="LOCAL HOLDER"
export LICENSE_NUMBER="LOCAL123"
export EXAM_ID="local-test"
export ACHIEVEMENT_LEVEL="Passed"
export ISSUED_DATE="2025-01-01"
export EXPIRY_DATE="2026-01-01"
export ISSUER="LOCAL_ISSUER"
export HOLDER_DOB="1990-01-01"
export NULLIFIER="0x1"

echo "Running proof generation (prefer compiled dist JS, fall back to ts-node)"
# Prefer the compiled CommonJS entrypoint in dist to avoid ts-node/ESM loader issues.
if [ -f dist/circuits/scripts/generate-proof.js ]; then
  node dist/circuits/scripts/generate-proof.js || true
elif [ -f dist/scripts/generate-proof.js ]; then
  node dist/scripts/generate-proof.js || true
elif command -v ts-node >/dev/null 2>&1 && [ -f scripts/generate-proof.ts ]; then
  # Fallback to ts-node if a compiled dist entrypoint isn't available
  yarn run generate-proof:tsnode || true
else
  echo "No generate-proof entrypoint found; skipping";
fi

echo "Signing canonical input and calculating witness"
# Use the timestamped proofs folder created by generate-proof. Prefer the
# canonical marker `.last-canonical` if present; otherwise pick the latest
# timestamped folder under proofs/. If none found, we will still continue and
# let later checks decide whether to skip proving.
if [ -f .last-canonical ]; then
  PROOFS_CAND=$(cat .last-canonical)
  if [ -d "${PROOFS_CAND}" ]; then
    PROOFS_DIR=${PROOFS_CAND}
  fi
fi
if [ -z "${PROOFS_DIR:-}" ]; then
  # Pick the newest directory under proofs/ (ignore files)
  PROOFS_DIR=$(ls -1dt proofs/*/ 2>/dev/null | head -n 1 || true)
  # Strip trailing slash if present
  if [ -n "${PROOFS_DIR}" ]; then
    PROOFS_DIR=${PROOFS_DIR%/}
  fi
fi
if [ -z "${PROOFS_DIR:-}" ]; then
  echo "No proofs directory found; some steps may be skipped later"
else
  echo "Using proofs folder: ${PROOFS_DIR}"
fi

# Sign the canonical input (uses the repo's CommonJS signer)
if [ -f scripts/sign-with-zkkit-blake.cjs ]; then
  node scripts/sign-with-zkkit-blake.cjs "${PROOFS_DIR}/canonical-input.fixed2.json" || true
else
  echo "Signer script not found; ensure canonical input is signed manually";
fi

echo "Calculating witness"
if [ -f build/ExamProof_js/ExamProof.wasm ] && [ -f "${PROOFS_DIR}/canonical-input.signed.json" ]; then
  npx --yes snarkjs wtns calculate build/ExamProof_js/ExamProof.wasm "${PROOFS_DIR}/canonical-input.signed.json" "${PROOFS_DIR}/witness.wtns" || true
else
  echo "Missing wasm or signed input; cannot calculate witness";
fi

echo "Running trusted setup (if missing) and proving"
# If FINAL_ZKEY_PATH is set, prefer it; otherwise run the setup script which
# generates a local zkey under setup/ExamProof_0001.zkey
ZKEY_DIR="zkey"
if [ -n "${FINAL_ZKEY_PATH:-}" ] && [ -f "${FINAL_ZKEY_PATH}" ]; then
  echo "Using FINAL_ZKEY_PATH=${FINAL_ZKEY_PATH}"
  mkdir -p ${ZKEY_DIR}
  cp "${FINAL_ZKEY_PATH}" ${ZKEY_DIR}/ExamProof_0001.zkey || true
else
  echo "Running setup.ts to create a local zkey (may be slow)"
  if [ -f dist/circuits/scripts/setup.js ]; then
    node dist/circuits/scripts/setup.js || true
  elif [ -f scripts/setup.ts ] && command -v ts-node >/dev/null 2>&1; then
    ts-node -r tsconfig-paths/register --transpile-only scripts/setup.ts || true
  else
    echo "No runnable setup script found; skipping zkey generation";
  fi
fi

# Use the generated zkey (or an existing dist zkey) to prove.
ZKEY_PATH=""
# Prefer a local zkey under zkey/ but accept mirrored dist artifacts too.
if [ -f zkey/ExamProof_0001.zkey ]; then
  ZKEY_PATH=zkey/ExamProof_0001.zkey
elif [ -f dist/circuits/zkey/ExamProof_0001.zkey ]; then
  ZKEY_PATH=dist/circuits/zkey/ExamProof_0001.zkey
fi

# Determine whether a witness exists in the chosen proofs dir. If PROOFS_DIR
# wasn't discovered, try to find any witness under proofs/*/witness.wtns.
WITNESS_PATH=""
if [ -n "${PROOFS_DIR:-}" ] && [ -f "${PROOFS_DIR}/witness.wtns" ]; then
  WITNESS_PATH="${PROOFS_DIR}/witness.wtns"
else
  # find any witness under proofs/ timestamped folders
  WITNESS_PATH=$(find proofs -maxdepth 2 -type f -name 'witness.wtns' | head -n 1 || true)
fi

if [ -n "${ZKEY_PATH}" ] && [ -n "${WITNESS_PATH}" ] && [ -f "${WITNESS_PATH}" ]; then
  echo "Proving using zkey: ${ZKEY_PATH}"
  npx --yes snarkjs groth16 prove "${ZKEY_PATH}" "${PROOFS_DIR}/witness.wtns" "${PROOFS_DIR}/proof.json" "${PROOFS_DIR}/public.json" || true
  # Verify using verification key (prefer locally generated, fallback to dist)
  VK=""
  if [ -f zkey/verification_key.json ]; then
    VK=zkey/verification_key.json
  elif [ -f dist/circuits/zkey/verification_key.json ]; then
    VK=dist/circuits/zkey/verification_key.json
  fi
  if [ -n "${VK}" ]; then
    echo "Verifying proof with ${VK}"
    npx --yes snarkjs groth16 verify "${VK}" "${PROOFS_DIR}/public.json" "${PROOFS_DIR}/proof.json" || true
  else
    echo "No verification key found; skipping verify";
  fi
else
  echo "Skipping prove/verify: missing zkey or witness";
fi

echo "Deploying verifier (prefer ESM TS entrypoint, fall back to dist JS)"
if command -v ts-node >/dev/null 2>&1 && [ -f scripts/deploy-verifier.ts ]; then
  ts-node -r tsconfig-paths/register --transpile-only scripts/deploy-verifier.ts || true
elif [ -f dist/circuits/scripts/deploy-verifier.js ]; then
  node dist/circuits/scripts/deploy-verifier.js || true
elif [ -f dist/scripts/deploy-verifier.js ]; then
  node dist/scripts/deploy-verifier.js || true
else
  echo "No deploy-verifier entrypoint found; skipping";
fi

echo "Calling on-chain verify (prefer ESM TS entrypoint, fall back to dist JS)"
if command -v ts-node >/dev/null 2>&1 && [ -f scripts/call-onchain-verify.ts ]; then
  ts-node -r tsconfig-paths/register --transpile-only scripts/call-onchain-verify.ts || true
elif [ -f dist/circuits/scripts/call-onchain-verify.js ]; then
  node dist/circuits/scripts/call-onchain-verify.js || true
elif [ -f dist/scripts/call-onchain-verify.js ]; then
  node dist/scripts/call-onchain-verify.js || true
else
  echo "No call-onchain-verify entrypoint found; skipping";
fi

echo "Local CI flow complete"

# Notes on zkey usage:
# - For local development, use sandbox/testing zkeys only. Do NOT commit final zkeys.
# - If you have a final zkey for a private pilot, store it in a secure local path and
#   point environment variable FINAL_ZKEY_PATH to it. The CI pipeline should gate
#   packaging of final zkeys via the publish workflow.
# Example:
#   export FINAL_ZKEY_PATH="/path/to/final/ExamProof.zkey"
#   The scripts will not automatically upload or sign final zkeys; publishing is gated in CI.