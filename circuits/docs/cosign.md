# cosign key generation and adding to GitHub Secrets

This file documents a concise, macOS (zsh)-friendly, step-by-step workflow to:

- generate a cosign key pair (private + public)
- produce single-line Base64 values for the private and public keys
- create the required GitHub Actions secrets: `COSIGN_KEY_B64`, `COSIGN_PUB_B64`, and `COSIGN_PASSWORD`
- test signing and verification locally

Prerequisites

- macOS (or Linux) with a POSIX shell (zsh recommended)
- `cosign` installed (Homebrew or release binary)

Install cosign (macOS)

```bash
brew install sigstore/tap/cosign
```

1. Generate a cosign key pair

- Interactive (recommended):

```bash
# run interactively; will create cosign.key (private) and cosign.pub (public) in cwd
cosign generate-key-pair
```

- Non-interactive using an environment variable for the passphrase:

```bash
# set your passphrase in the environment, then generate keys
export COSIGN_PASSWORD="your-secure-passphrase-here"
cosign generate-key-pair
# files created: ./cosign.key  ./cosign.pub
```

- Generate an unencrypted key (not recommended):

```bash
# set empty passphrase (cosign may still prompt in some versions)
export COSIGN_PASSWORD=""
cosign generate-key-pair
```

Notes

- `cosign.key` is the private key and must be kept secret.
- `cosign.pub` is the public key and can be shared (we store it in `COSIGN_PUB_B64` for CI verification).

2. Create single-line Base64 files for safe storage in GitHub Secrets

On macOS use the following commands which produce single-line Base64 output safe to paste into GitHub Secrets.

```bash
# Private key -> single-line base64 (macOS / BSD-friendly)
# Preferred: use input redirection (works with macOS base64)
base64 < cosign.key | tr -d '\n' > cosign.key.b64

# Alternative: openssl (works on macOS & Linux)
openssl base64 -in cosign.key -A -out cosign.key.b64

# Alternative: python fallback (works if python3 is available)
python3 - <<'PY' > cosign.key.b64
import sys,base64
sys.stdout.write(base64.b64encode(open('cosign.key','rb').read()).decode())
PY

# Public key -> single-line base64 (same alternatives)
# macOS / BSD-friendly
base64 < cosign.pub | tr -d '\n' > cosign.pub.b64

# openssl
openssl base64 -in cosign.pub -A -out cosign.pub.b64

# python fallback
python3 - <<'PY' > cosign.pub.b64
import sys,base64
sys.stdout.write(base64.b64encode(open('cosign.pub','rb').read()).decode())
PY

# Quick checks
echo "Private key b64 (first 80 chars):" && cut -c1-80 cosign.key.b64
echo "Public key b64 (first 80 chars):" && cut -c1-80 cosign.pub.b64
```

Note: don't include a leading `%` when running commands in your shell; `% base64 ...` will be passed as an invalid argument. If you see the error `base64: invalid argument`, try one of the alternatives above (openssh/openssl or python) or use the input-redirection form (`base64 < file`).

Decode alternatives (robust):

```bash
# macOS (BSD base64)
base64 -D cosign.key.b64 > cosign.key

# Linux (GNU base64)
base64 -d cosign.key.b64 > cosign.key

# openssl (cross-platform)
openssl base64 -d -in cosign.key.b64 -out cosign.key
```

3. Add secrets to GitHub (two options)

- Option A — GitHub web UI (repo-level):

  1. Go to your repository → Settings → Secrets & variables → Actions → New repository secret
  2. Name: `COSIGN_KEY_B64` Value: paste contents of `cosign.key.b64` (single line)
  3. Name: `COSIGN_PUB_B64` Value: paste contents of `cosign.pub.b64` (single line)
  4. If you used a passphrase, add `COSIGN_PASSWORD` with the passphrase value

- Option B — GitHub CLI (faster / scriptable):

```bash
# requires GitHub CLI installed and authenticated (gh auth login)
gh secret set COSIGN_KEY_B64 --body "$(cat cosign.key.b64)"
gh secret set COSIGN_PUB_B64 --body "$(cat cosign.pub.b64)"
# only add password if you used one
gh secret set COSIGN_PASSWORD --body "$COSIGN_PASSWORD"
```

Notes about scope

- Repository secrets are scoped to a single repo. Use organization secrets if multiple repos need the same key.
- Prefer least privilege and rotate keys periodically.

4. Quick local decode + test (verify the encoded values are correct)

```bash
# Decode the private key locally for testing (macOS uses -D to decode)
base64 -D cosign.key.b64 > cosign.key && chmod 600 cosign.key
base64 -D cosign.pub.b64 > cosign.pub && chmod 644 cosign.pub

# Sign a file with the private key
echo hello > /tmp/test-file.txt
cosign sign-blob --key cosign.key /tmp/test-file.txt

# Verify signature with the public key
cosign verify-blob --key cosign.pub /tmp/test-file.txt

# Cleanup test keys if desired
shred -u cosign.key || rm -f cosign.key
```

If your version of `base64` uses `-d` (Linux), replace `-D` with `-d` in the decode commands.

5. Using the secrets in CI (how this repo expects them)

- This repository's GitHub Actions workflow expects these secrets (already referenced in `.github/workflows/compile-circuits.yml`):
  - `COSIGN_KEY_B64` (required to sign artifacts inside CI container)
  - `COSIGN_PASSWORD` (optional; passphrase used to protect the private key)
  - `COSIGN_PUB_B64` (used to verify signatures)

In CI the workflow decodes the base64 values to files and uses `cosign` inside a container to sign and verify artifacts. See the workflow for exact script calls.

Security best-practices

- Do NOT commit `cosign.key` or `cosign.key.b64` to the repo.
- Keep the private key in a secure vault or GitHub Secrets and restrict who can change secrets.
- Consider using KMS/HSM or keyless (OIDC) workflows with cosign for stronger security in CI.

Troubleshooting

- If `cosign generate-key-pair` still prompts, ensure `COSIGN_PASSWORD` is exported in the same shell where the command runs.
- If `base64 -D` fails, try `base64 -d` (Linux) or `openssl base64 -d` as alternatives.

References

- https://github.com/sigstore/cosign
