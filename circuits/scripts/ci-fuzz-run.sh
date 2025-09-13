#!/usr/bin/env bash
set -euo pipefail

# Install dependencies and run the ci-fuzz-wrapper inside the container
docker run --rm -v "$GITHUB_WORKSPACE":/work -w /work lvp-circuits \
  sh -c "cd /work && yarn --cwd circuits install --frozen-lockfile && chmod +x circuits/scripts/ci-fuzz-wrapper.sh && circuits/scripts/ci-fuzz-wrapper.sh"
