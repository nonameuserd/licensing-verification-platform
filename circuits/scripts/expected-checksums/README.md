# Binary Checksum Verification

This directory contains expected SHA256 checksums for external binaries used in the circuits Docker build process.

## Purpose

Checksum verification ensures the integrity and authenticity of downloaded binaries, protecting against:

- Tampered or malicious binaries
- Corrupted downloads
- Supply chain attacks

## Files

- `circom_v2.2.2.sha256` - Expected SHA256 checksum for circom binary
- `cosign_v2.5.3.sha256` - Expected SHA256 checksum for cosign binary

## How It Works

### Dockerfile Integration

The `circuits/Dockerfile` downloads binaries and verifies their checksums before installation:

```dockerfile
# Download and verify circom
RUN set -eux; \
    CIRCOM_URL="https://github.com/iden3/circom/releases/download/v${CIRCOM_VERSION}/circom_linux"; \
    CIRCOM_CHECKSUM="$(cat /work/circuits/scripts/expected-checksums/circom_v2.2.2.sha256)"; \
    wget -O /tmp/circom "$CIRCOM_URL"; \
    echo "$CIRCOM_CHECKSUM  /tmp/circom" | sha256sum --check; \
    mv /tmp/circom /usr/local/bin/circom; \
    chmod +x /usr/local/bin/circom;
```

### GitHub Workflow Verification

The `.github/workflows/verify-binaries.yml` workflow:

1. Downloads binaries from official sources
2. Computes actual SHA256 checksums
3. Compares against expected checksums
4. Fails the build if checksums don't match
5. Tests Docker build with checksum verification

## Updating Checksums

### When to Update

Update checksums when:

- Upgrading to new binary versions
- Checksum verification fails in CI
- Security audit reveals checksum mismatches

### How to Update

#### Method 1: Manual Update

1. Download the binary from the official release page
2. Compute the SHA256 checksum:
   ```bash
   sha256sum binary_name
   ```
3. Update the corresponding `.sha256` file with the new checksum

#### Method 2: Automated Update

1. **Automatic Issue Creation**: When checksum verification fails, the workflow automatically creates a GitHub issue with:

   - Clear title indicating checksum verification failure
   - Detailed information about the failure
   - Proper labels (`security`, `checksum-verification`, `needs-attention`)
   - Step-by-step instructions for resolution

2. **Manual Workflow Trigger**: Run the GitHub workflow manually with `workflow_dispatch`
3. **Auto-Update**: The workflow will automatically update checksums if verification fails
4. **Review and Commit**: Review the updated checksums and commit the changes

### Example Update Process

```bash
# Download circom binary
wget https://github.com/iden3/circom/releases/download/v2.2.2/circom_linux

# Compute checksum
sha256sum circom_linux
# Output: a8b4b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0  circom_linux

# Update the checksum file
echo "a8b4b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0" > circuits/scripts/expected-checksums/circom_v2.2.2.sha256
```

## Security Considerations

### Trust Model

- **Source of Truth**: Official GitHub release pages
- **Verification**: SHA256 checksums from release assets
- **Fallback**: NPM installation for circom if binary download fails

### Best Practices

1. **Pin Versions**: Always use specific version tags, not `latest`
2. **Verify Sources**: Only download from official GitHub releases
3. **Regular Updates**: Keep checksums current with security updates
4. **Audit Trail**: Document all checksum updates in commit messages

### Threat Mitigation

- **Supply Chain Attacks**: Checksum verification prevents tampered binaries
- **Network Attacks**: SHA256 verification detects corrupted downloads
- **Repository Compromise**: Expected checksums stored separately from Dockerfile

## Troubleshooting

### Common Issues

#### Checksum Mismatch

```
❌ circom checksum verification failed
Expected: a8b4b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0
Actual: b9c5c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1
```

**Solution**: Update the expected checksum file with the actual checksum

#### Download Failure

```
WARNING: failed to download cosign from https://github.com/sigstore/cosign/releases/download/v2.5.3/cosign-linux-amd64
```

**Solution**: Check network connectivity and GitHub availability

#### Permission Denied

```
chmod: cannot access '/usr/local/bin/circom': No such file or directory
```

**Solution**: Verify the download and checksum verification steps completed successfully

### Debug Commands

```bash
# Test checksum verification manually
wget -O /tmp/test-binary https://github.com/iden3/circom/releases/download/v2.2.2/circom_linux
sha256sum /tmp/test-binary
echo "expected_checksum  /tmp/test-binary" | sha256sum --check

# Test Docker build locally
cd circuits
docker build -t circuits-test .
docker run --rm circuits-test circom --version
```

## Related Files

- `circuits/Dockerfile` - Main Docker build file with checksum verification
- `.github/workflows/verify-binaries.yml` - CI workflow for checksum verification
- `circuits/package.json` - NPM dependencies including circom fallback

## References

- [Docker ADD instruction with checksum](https://docs.docker.com/engine/reference/builder/#add)
- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides)
- [Supply Chain Security Best Practices](https://slsa.dev/)
