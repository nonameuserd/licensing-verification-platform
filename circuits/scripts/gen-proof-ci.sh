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

echo "Starting local hardhat node in background (using circuits/hardhat.config.js)..."
# Start hardhat node from the circuits folder so the locally-installed hardhat is used
npx hardhat node --config hardhat.config.js --hostname 127.0.0.1 &
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
export HOLDER_NAME="CI HOLDER"
export LICENSE_NUMBER="CI123"
export EXAM_ID="CI_TEST"
export ACHIEVEMENT_LEVEL="Passed"
export ISSUED_DATE="2025-01-01"
export EXPIRY_DATE="2026-01-01"
export ISSUER="CI_ISSUER"
export HOLDER_DOB="1990-01-01"
export NULLIFIER="0x1"
# Do NOT hard-code real private keys in CI scripts. Use repository secrets
# (e.g., PRIVATE_KEY) injected by CI. If not provided, use a non-sensitive placeholder.
if [[ -z "${PRIVATE_KEY:-}" ]]; then
	echo "PRIVATE_KEY not provided via env; using non-sensitive placeholder for smoke runs"
	export PRIVATE_KEY="0x1"
fi

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

echo "Deploying verifier (compiled)"
node dist/scripts/deploy-verifier.js

echo "Calling on-chain verify (compiled)"
node dist/scripts/call-onchain-verify.js

# Clean shutdown
echo "Shutting down hardhat node"
kill $HARDHAT_PID || true
