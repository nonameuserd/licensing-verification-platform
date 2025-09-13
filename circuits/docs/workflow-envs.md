# Workflow environment variables (summary)

This document lists the environment variables referenced in the repository workflows and where each is set/used. It covers the workflows:

- `.github/workflows/compile-circuits.yml`
- `.github/workflows/circuits-smoke.yml`
- `.github/workflows/publish-release.yml`

For each variable below we indicate where it appears, how it's provided, and a short purpose.

---

## 1 compile-circuits.yml

Job-level env:

- PERF_THRESHOLD_PERCENT
  - Where set: job `env:` at the top of the `compile` job (default `''`)
  - Used by: "Run perf snapshot check (inside container)" step; forwarded into the docker run command
  - Purpose: optional override to control allowed perf regression percentage for perf snapshot checks
  - Provided by: optional repository env, workflow_dispatch input or left empty by default

Step-level envs / secrets referenced:

- COSIGN_KEY_B64

  - Where set: step `Generate and sign artifact metadata (inside container)` sets `env:` to `${{ secrets.COSIGN_KEY_B64 }}`
  - Used by: `circuits/scripts/ci-sign-artifacts.sh` (run inside the container)
  - Purpose: base64-encoded private key used by `cosign` inside CI to sign artifacts
  - Provided by: repository secret `COSIGN_KEY_B64`

- COSIGN_PASSWORD

  - Where set: same step sets `env:` to `${{ secrets.COSIGN_PASSWORD }}`
  - Used by: `circuits/scripts/ci-sign-artifacts.sh` when private key is passphrase-protected
  - Provided by: repository secret `COSIGN_PASSWORD` (optional)

- COSIGN_PUB_B64

  - Where set: step `Verify artifact signature` sets `env:` to `${{ secrets.COSIGN_PUB_B64 }}`
  - Used by: `circuits/scripts/ci-verify-signature.sh` (to verify signatures)
  - Purpose: base64-encoded public key used to verify signatures produced in CI
  - Provided by: repository secret `COSIGN_PUB_B64`

- GITHUB_TOKEN

  - Where set: used as a secret in several actions (for example `bump tag for main` step sets it via `env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`)
  - Used by: steps that interact with the GitHub API (creating tags, releases, creating issues)
  - Provided by: automatically available repository secret `GITHUB_TOKEN` in Actions

- GITHUB_REPOSITORY
  - Where set: `bump tag for main` step sets `env: GITHUB_REPOSITORY: ${{ github.repository }}`
  - Used by: scripts that need the repository name/owner
  - Provided by: runtime `github` context or explicitly passed into the step

Notes:

- The workflow also passes `PERF_THRESHOLD_PERCENT` into the docker container for the perf-runner script.
- Other values (such as `github.sha`, `github.run_id`) are GitHub-provided contexts and not secrets; they appear in templates but are not environment variables that require secrets.

---

## 2) circuits-smoke.yml

This workflow defines several environment variables for a smoke test step (set in the `Run generate-proof in INPUT_ONLY mode` step):

- INPUT_ONLY
- HOLDER_NAME
- LICENSE_NUMBER
- EXAM_ID
- ACHIEVEMENT_LEVEL
- ISSUED_DATE
- EXPIRY_DATE
- ISSUER
- HOLDER_DOB
- NULLIFIER
- PRIVATE_KEY

For each:

- Where set: step `env:` block in the `Run generate-proof in INPUT_ONLY mode` step (values are hard-coded in the workflow for CI smoke tests)
- Used by: `scripts/generate-proof.ts` (invoked via `ts-node`) to build/generate a proof in INPUT_ONLY mode
- Purpose: test inputs used to produce a predictable proof in CI smoke tests
- Provided by: the workflow itself (hard-coded for the smoke run). In other contexts these may be supplied by secrets or dispatch inputs.

Notes:

- `PRIVATE_KEY` appears to be a sensitive value in principle — in the smoke workflow it's a placeholder test value. Replace with a secret or fixture if sensitive.

---

## 3) publish-release.yml

Step-level envs used in the publish job:

- GITHUB_TOKEN

  - Where set: the `run` step sets `env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`
  - Used by: `circuits/scripts/publish-release.sh` which likely uses the token to publish a draft release
  - Provided by: repository secret `GITHUB_TOKEN` (Actions-provided secret)

- GITHUB_REPOSITORY
  - Where set: the `run` step sets `env: GITHUB_REPOSITORY: ${{ github.repository }}`
  - Used by: scripts that need the repository identifier when calling GH API
  - Provided by: runtime `github` context or passed in as an env to the script

---

## Where to place variables and secrets in GitHub (secrets vs variables vs GITHUB_TOKEN)

Short guidance on where each kind of value should live in GitHub and how to provide/obtain `GITHUB_TOKEN`.

1. Sensitive values -> use GitHub Secrets

- Use repository or organization secrets for private keys, passphrases, and any secret material.
  - Examples from our workflows: `COSIGN_KEY_B64`, `COSIGN_PASSWORD`, `COSIGN_PUB_B64` (private/public keys and passphrase). These should be stored as repository secrets unless multiple repositories must share them (then use organization secrets).
- How to add via web UI (repo-level):
  - Repo → Settings → Secrets & variables → Actions → New repository secret
  - Name: `COSIGN_KEY_B64` Value: paste the single-line base64 content
- How to add via GitHub CLI (scriptable):
  ```bash
  gh auth login
  gh secret set COSIGN_KEY_B64 --body "$(cat cosign.key.b64)"
  gh secret set COSIGN_PUB_B64 --body "$(cat cosign.pub.b64)"
  gh secret set COSIGN_PASSWORD --body "$COSIGN_PASSWORD"
  ```

2. Non-sensitive configuration -> use Repository Variables (or environment variables in workflow)

- Use repository "Variables" (Settings → Secrets & variables → Actions → Variables) for non-secret config values you want to manage centrally (e.g., non-sensitive numeric thresholds, feature flags). These values are visible to users who can view repo settings and are not encrypted like secrets.
- Example: `PERF_THRESHOLD_PERCENT` might be provided as a repository variable or left as an empty workflow-level env so the workflow_dispatch or repo env can override it.

3. Environment-scoped secrets (protected deployments)

- If you require approval gates or restricted access for certain environments (e.g., `release`), create environment-scoped secrets under: Repo → Settings → Environments → <env name> → Secrets and variables.
- Workflows that target that `environment:` will require environment approval and will have access to those environment secrets.
- Example: The `publish` job in `publish-release.yml` uses `environment: release` — consider storing high-impact secrets or release-only secrets at the environment level.

4. GITHUB_TOKEN — what it is and when to use a PAT instead

- `GITHUB_TOKEN` is automatically provided to each workflow run by GitHub Actions. It is not a repo secret you add manually. It appears in workflows as `${{ secrets.GITHUB_TOKEN }}` and is scoped to the repository, with time-limited credentials.
- Where to configure permissions for `GITHUB_TOKEN`:
  - Repo → Settings → Actions → General → Workflow permissions
  - Choose "Read repository contents and metadata" or "Read and write permissions" depending on whether your scripts need to push tags, create releases, or write comments. Some operations (like creating releases or tags) require write permissions.
- If you need broader permissions than `GITHUB_TOKEN` or want an account-specific token, create a Personal Access Token (PAT) and store it as a repository secret (example name: `RELEASE_PAT` or `GH_PAT`). Use that secret in steps instead of `secrets.GITHUB_TOKEN`.
  - Create PAT: https://github.com/settings/tokens (generate with required scopes: repo, workflow, etc.)
  - Store PAT as repo secret (via web UI or `gh secret set RELEASE_PAT --body "$PAT"`).
- Important: Do NOT override or create a secret named `GITHUB_TOKEN` — GitHub reserves that name for the built-in token. Use a different secret name for a PAT.

5. Example: mapping from workflow vars -> where to store

- `COSIGN_KEY_B64` -> Repository secret (or organization secret)
- `COSIGN_PASSWORD` -> Repository secret
- `COSIGN_PUB_B64` -> Repository secret
- `PERF_THRESHOLD_PERCENT` -> Repository variable (or workflow/job env)
- Smoke test values like `PRIVATE_KEY` -> Repository secret if they are real secrets; otherwise keep them as hard-coded placeholders in the smoke workflow for CI test data
- `GITHUB_TOKEN` (used in workflows) -> provided automatically; adjust workflow permissions as needed or provide `RELEASE_PAT` secret for elevated perms

6. Recommended checks before enabling workflows

- Confirm repository secrets exist and are populated: `COSIGN_KEY_B64`, `COSIGN_PUB_B64`, `COSIGN_PASSWORD` (if used)
- Check Actions > General > Workflow permissions to ensure the `GITHUB_TOKEN` has write permission if the workflow performs releases/tags
- For release jobs using `environment: release`, ensure environment protections, and add environment-level secrets if you want stricter control

---

## Secret -> consuming steps (map)

The table below maps repository/organization secrets (and sensitive workflow values) to the workflow steps that consume them, where they are set in the workflow, and a short recommendation for storage scope.

| Secret / Sensitive value                           | Where it's set in workflow                                                                                                     | Consuming step(s) / script                                                                                                             | Purpose                                                                                     | Recommended storage scope                                                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `COSIGN_KEY_B64`                                   | `compile-circuits.yml` — step: "Generate and sign artifact metadata (inside container)" (`env: ${{ secrets.COSIGN_KEY_B64 }}`) | `circuits/scripts/ci-sign-artifacts.sh` (inside container)                                                                             | Base64-encoded cosign private key used to sign artifacts                                    | Repository secret (or org secret if shared across repos)                                                                                                                           |
| `COSIGN_PASSWORD`                                  | `compile-circuits.yml` — same step as above (`env: ${{ secrets.COSIGN_PASSWORD }}`)                                            | `circuits/scripts/ci-sign-artifacts.sh`                                                                                                | Passphrase for the private key (optional)                                                   | Repository secret                                                                                                                                                                  |
| `COSIGN_PUB_B64`                                   | `compile-circuits.yml` — step: "Verify artifact signature" (`env: ${{ secrets.COSIGN_PUB_B64 }}`)                              | `circuits/scripts/ci-verify-signature.sh`                                                                                              | Base64-encoded public key used to verify signatures                                         | Repository secret (or org secret)                                                                                                                                                  |
| `GITHUB_TOKEN` (Actions-provided)                  | Not user-set; referenced as `${{ secrets.GITHUB_TOKEN }}` in workflows (e.g., bump/tag, create release, create issue)          | `circuits/scripts/bump-version.sh`, `actions/create-release`, `circuits/scripts/publish-release.sh`, github-script issue creation step | Token used to call GitHub API for tags, releases, issues                                    | Provided automatically by Actions; ensure workflow permissions are set appropriately. Use a PAT (stored as a different secret) if elevated or cross-repo permissions are required. |
| `PRIVATE_KEY` (smoke placeholder)                  | `circuits-smoke.yml` — step `env:` block (hard-coded for smoke test)                                                           | `scripts/generate-proof.ts` (ts-node)                                                                                                  | Test input for smoke proof generation (sensitive if real)                                   | If real, store as repository secret and reference `${{ secrets.PRIVATE_KEY }}`; otherwise keep as a test fixture                                                                   |
| `RELEASE_PAT` (recommended name for a PAT if used) | N/A in current workflows — example using: `env: RELEASE_PAT: ${{ secrets.RELEASE_PAT }}`                                       | `circuits/scripts/publish-release.sh` (if needing elevated perms)                                                                      | Personal Access Token with broader scopes than `GITHUB_TOKEN` (e.g., cross-repo, org-level) | Repository secret (create PAT in GitHub settings and add via web UI or `gh secret set`)                                                                                            |

Notes

- If multiple repositories need the same cosign keys, use Organization secrets for central management. Otherwise, keep them at the repository level for least privilege.
- Do not create a secret named `GITHUB_TOKEN`; GitHub injects that value automatically for each run. Use a different name for a PAT (for example `RELEASE_PAT`).
- Keep this table updated when workflows change or new secrets are introduced.

---

## Quick actions / recommended checks

- Confirm the following repository secrets exist (used by `compile-circuits.yml`):

  - `COSIGN_KEY_B64` (base64-encoded private key)
  - `COSIGN_PASSWORD` (passphrase for the private key, optional)
  - `COSIGN_PUB_B64` (base64-encoded public key)
  - `GITHUB_TOKEN` is automatically available in Actions but check permissions are appropriate for release/tag operations

- If you intend to run `circuits-smoke.yml` with non-placeholder values, move `PRIVATE_KEY` and other sensitive values into repository secrets (and reference them via `${{ secrets.NAME }}`) or use environment-specific secret storage.
