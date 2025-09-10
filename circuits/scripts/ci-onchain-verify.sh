#!/usr/bin/env bash
set -euo pipefail

docker run --rm -v "$GITHUB_WORKSPACE":/work -w /work lvp-circuits \
  sh -c "chmod +x circuits/scripts/gen-proof-ci.sh && ./circuits/scripts/gen-proof-ci.sh"
