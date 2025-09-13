#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR/.."

# Install circuits deps first so a local hardhat binary is available
echo "Installing circuits deps (so local hardhat will be available)..."
# Ensure workspace deps are installed at repo root so workspace packages can be resolved
echo "Installing workspace deps at repo root..."
yarn install --non-interactive || true

# Rely on Yarn workspaces; root `yarn install` will create workspace links.

echo "Building workspace 'shared' package so workspace imports resolve"
# Build only the shared package to produce the dist files ts-node will import
npx nx build shared || true

cd circuits
yarn install --non-interactive || true

# Install hardhat in hardhat-config directory for ESM support
cd hardhat-config
yarn install --non-interactive || true

echo "Starting local hardhat node in background (using hardhat-config/hardhat.config.ts)..."
# Start hardhat node from the hardhat-config folder with ESM support
npx hardhat node --config hardhat.config.ts --hostname 127.0.0.1 &
HARDHAT_PID=$!
# return to repo root to continue orchestration
cd ..

# ensure we always attempt to clean up the background process
function cleanup() {
	echo "Cleaning up. Killing Hardhat (pid: ${HARDHAT_PID})"
	kill ${HARDHAT_PID} >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# wait for RPC port to be ready with retries and exponential backoff
echo "Waiting for Hardhat RPC to be available on http://127.0.0.1:8545..."
MAX_WAIT=60  # seconds total max
INTERVAL=1
ELAPSED=0
while ! nc -z 127.0.0.1 8545 >/dev/null 2>&1; do
	if [ ${ELAPSED} -ge ${MAX_WAIT} ]; then
		echo "Hardhat RPC did not become ready after ${MAX_WAIT}s" >&2
		exit 1
	fi
	echo "Hardhat not ready yet; sleeping ${INTERVAL}s... (elapsed ${ELAPSED}s)"
	sleep ${INTERVAL}
	ELAPSED=$((ELAPSED + INTERVAL))
	# exponential backoff up to 5s
	if [ ${INTERVAL} -lt 5 ]; then
		INTERVAL=$((INTERVAL * 2))
	fi
done
echo "Hardhat RPC is ready"

echo "Installing circuits deps and building TS helpers"
cd circuits
yarn install --frozen-lockfile
yarn build:ts

echo "Generating proof (using compiled JS)"
export HOLDER_NAME="John Doe"
export LICENSE_NUMBER="MD123456"
export EXAM_ID="USMLE_STEP_1"
export ACHIEVEMENT_LEVEL="Passed"
export ISSUED_DATE="2024-01-15"
export EXPIRY_DATE="2025-01-15"
export ISSUER="FSMB"
export HOLDER_DOB="1990-05-20"
export NULLIFIER="0x1234567890abcdef"
# Use the same private key that was used to build the Merkle trees
export PRIVATE_KEY="0xabcdef1234567890"

# Run the proof generator via ts-node (avoids relying on compiled artifact)
# Ensure the built shared package is resolvable by circuits when running inside container
# Use absolute paths derived from $ROOT_DIR (which points at the `circuits` dir) so the
# check and copy succeed regardless of the current working directory.
echo "Using Yarn workspaces at repo root to resolve workspace packages (no manual symlink needed)"

# Run the proof generator via ts-node using tsconfig-paths so workspace
# imports (e.g. @licensing-verification-platform/shared) resolve to source
# according to the repo's tsconfig path mappings. This avoids needing to
# rely on package "main" pointing at built artifacts during CI/dev runs.
yarn run generate-proof:tsnode

# Quick sanity checks: ensure canonical path marker and witness exist and are readable
LAST_CANONICAL="$ROOT_DIR/.last-canonical"
if [[ ! -f "${LAST_CANONICAL}" ]]; then
	echo "No canonical path marker: ${LAST_CANONICAL}" >&2
	exit 1
fi

# Derive witness path from canonical path's directory
WPATH="$(dirname "$(cat "${LAST_CANONICAL}")")/witness.wtns"
if [[ ! -s "${WPATH}" ]]; then
	echo "Witness missing or empty: ${WPATH}" >&2
	exit 1
fi

# If snarkjs is available, verify the witness format is parseable before proceeding
if command -v snarkjs >/dev/null 2>&1; then
	if ! snarkjs fi "${WPATH}" >/dev/null 2>&1; then
		echo "snarkjs cannot read witness (invalid format): ${WPATH}" >&2
		exit 1
	fi
else
	echo "snarkjs not found in PATH; skipping witness format check"
fi

echo "Deploying verifier (compiled)"
echo "Current directory: $(pwd)"
echo "Looking for: dist/circuits/scripts/deploy-verifier.js"
ls -la dist/circuits/scripts/ || echo "Directory not found"
# Ensure we're in the circuits directory
cd "$ROOT_DIR"
echo "Changed to circuits directory: $(pwd)"
node dist/circuits/scripts/deploy-verifier.js

echo "Calling on-chain verify (compiled)"
node dist/circuits/scripts/call-onchain-verify.js

# Clean shutdown
echo "Shutting down hardhat node"
kill $HARDHAT_PID || true

# Clean up temp directory
echo "Cleaning up hardhat temp directory"
rm -rf hardhat-config
