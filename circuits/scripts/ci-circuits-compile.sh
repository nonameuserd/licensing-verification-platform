#!/usr/bin/env bash
set -euo pipefail

# Build and run the circuits compile inside the prebuilt lvp-circuits container
# Allow running this script locally by defaulting GITHUB_WORKSPACE to the current
# working directory when the environment variable is not provided by CI.
WORKSPACE="${GITHUB_WORKSPACE:-}"

# If running in CI (GITHUB_WORKSPACE is set), run inside the prebuilt Docker image.
# Locally, avoid running the container because bind-mounting the host workspace into
# a Linux container can expose host-built native modules (esbuild) and cause
# platform mismatches. Instead run the compile and setup commands locally.
if [ -n "${GITHUB_WORKSPACE:-}" ]; then
  docker run --rm \
    -v "$GITHUB_WORKSPACE":/work \
    -w /work lvp-circuits \
    sh -c "cd circuits && yarn compile && yarn setup || true"
else
  echo "GITHUB_WORKSPACE not set — running compile and setup locally"
  (cd "$PWD/circuits" && yarn compile && yarn setup) || true
fi
