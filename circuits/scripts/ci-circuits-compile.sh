#!/usr/bin/env bash
set -euo pipefail

# Build and run the circuits compile inside the prebuilt lvp-circuits container
docker run --rm -v "$GITHUB_WORKSPACE":/work -w /work lvp-circuits \
  sh -c "cd circuits && yarn compile && yarn setup || true"
