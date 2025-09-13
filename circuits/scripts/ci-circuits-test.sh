#!/usr/bin/env bash
set -euo pipefail

docker run --rm -v "$GITHUB_WORKSPACE":/work -w /work lvp-circuits \
  sh -c "cd circuits && yarn test --silent"
