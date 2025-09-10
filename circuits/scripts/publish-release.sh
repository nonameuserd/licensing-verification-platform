#!/usr/bin/env bash
set -euo pipefail

# Publish the latest draft release with a semver-ish tag (vX.Y.Z)
# Uses the gh CLI and expects GITHUB_TOKEN and GITHUB_REPOSITORY to be available.

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required but not found"
  exit 2
fi

REPO=${GITHUB_REPOSITORY:-}
if [ -z "$REPO" ]; then
  echo "GITHUB_REPOSITORY not set"
  exit 2
fi

echo "Looking for draft releases in $REPO"

# List draft releases and pick the first tag matching vN.N.N
DRAFT_TAG=$(gh release list --repo "$REPO" --limit 100 --json tagName,draft --jq '.[] | select(.draft) | .tagName' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -n1 || true)

if [ -z "$DRAFT_TAG" ]; then
  echo "No draft circuits release found"
  exit 2
fi

echo "Publishing draft release $DRAFT_TAG"
gh release edit "$DRAFT_TAG" --repo "$REPO" --draft=false

echo "Published release $DRAFT_TAG"
