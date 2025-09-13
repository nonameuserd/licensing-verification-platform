#!/usr/bin/env bash
set -euo pipefail

# Bump the patch version in circuits/package.json, commit, tag and push.
# Expects GITHUB_TOKEN and optionally GITHUB_REPOSITORY in the environment.

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

NEW_VER=$(node -e 'const fs=require("fs"); const p=require("./circuits/package.json"); const s=p.version.split(".").map(Number); s[2]=s[2]+1; p.version=s.join("."); fs.writeFileSync("./circuits/package.json", JSON.stringify(p,null,2)); console.log(p.version)')

echo "Bumped circuits package.json to ${NEW_VER}"

git add circuits/package.json
git commit -m "chore(circuits): bump version to ${NEW_VER} [ci skip]" || echo "no changes to commit"
git tag -a "v${NEW_VER}" -m "circuits v${NEW_VER}"

# Push using token if provided; expect GITHUB_REPOSITORY in format owner/repo
if [ -n "${GITHUB_TOKEN:-}" ]; then
  REPO=${GITHUB_REPOSITORY:-${GITHUB_REPOSITORY}}
  if [ -z "$REPO" ]; then
    echo "GITHUB_REPOSITORY not set; defaulting to origin push"
    git push --follow-tags
  else
    git push "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}" --follow-tags
  fi
else
  echo "GITHUB_TOKEN not set; performing git push without auth (may fail)"
  git push --follow-tags
fi

# Export output for GitHub Actions
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "new_ver=${NEW_VER}" >> "$GITHUB_OUTPUT"
else
  echo "new_ver=${NEW_VER}"
fi
