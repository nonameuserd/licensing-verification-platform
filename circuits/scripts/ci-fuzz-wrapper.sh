#!/usr/bin/env bash
set -euo pipefail

# Run fuzz tests and capture output to a log file. Exit code is preserved.
JEST_LOG=circuits/fuzz-jest.log
rm -f "$JEST_LOG"

# Run jest and tee output
yarn --cwd circuits test:fuzz 2>&1 | tee "$JEST_LOG"

EXIT_CODE=${PIPESTATUS[0]:-0}
if [ "$EXIT_CODE" -ne 0 ]; then
  node circuits/scripts/emit-fuzz-failure.js "$JEST_LOG" artifacts/fuzz-failure.json
  exit $EXIT_CODE
fi

echo "Fuzz tests passed"
exit 0
