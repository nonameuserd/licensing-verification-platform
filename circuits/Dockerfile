# NOTE: pinned base image for reproducible builds
FROM node:22-bullseye-slim

# Install system deps including Rust
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    git \
    wget \
    unzip \
    curl \
    ca-certificates \
    netcat-openbsd \
 && rm -rf /var/lib/apt/lists/*

# Install Rust (required for building circom from source)
RUN curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install circom and snarkjs pinned versions
ENV CIRCOM_VERSION=2.2.2
ENV SNARKJS_VERSION=0.7.2

# Copy expected checksums into the image so Docker build and CI use the same source-of-truth
COPY scripts/expected-checksums/ /tmp/checksums/

# Install circom by building from source (as recommended in official docs)
RUN set -eux; \
    echo "Building circom from source as recommended in https://docs.circom.io/getting-started/installation/"; \
    git clone https://github.com/iden3/circom.git /tmp/circom-src; \
    cd /tmp/circom-src; \
    git checkout v${CIRCOM_VERSION}; \
    cargo build --release; \
    cp target/release/circom /usr/local/bin/circom; \
    chmod +x /usr/local/bin/circom; \
    rm -rf /tmp/circom-src; \
    circom --version

# Install cosign with checksum verification (pin a known release for reproducibility). If download
# fails (network or remote issue) continue the build — CI should provide
# cosign in the production environment.
ENV COSIGN_VERSION=2.5.3
RUN set -eux; \
        COSIGN_URL="https://github.com/sigstore/cosign/releases/download/v${COSIGN_VERSION}/cosign-linux-amd64"; \
        if wget -q --tries=3 --timeout=30 -O /tmp/cosign "$COSIGN_URL"; then \
            COSIGN_CHECKSUM="$(tr -d '\n' < /tmp/checksums/cosign_v${COSIGN_VERSION}.sha256)"; \
            if echo "$COSIGN_CHECKSUM  /tmp/cosign" | sha256sum --check; then \
                mv /tmp/cosign /usr/local/bin/cosign; \
                chmod +x /usr/local/bin/cosign; \
            else \
                echo "ERROR: cosign checksum mismatch; aborting build to avoid producing an image with an unverified cosign binary"; \
                rm -f /tmp/cosign || true; \
                exit 1; \
            fi; \
        else \
            echo "ERROR: failed to download cosign from $COSIGN_URL; aborting build"; \
            exit 1; \
        fi

WORKDIR /work

# Copy package.json for installing node deps only when they change
# Use files from the build context (expected when building from the `circuits` folder)
COPY package.json /work/circuits/package.json
COPY yarn.lock /work/circuits/yarn.lock

# Install Yarn v1 and use the repo's yarn.lock to install exact deps for circuits
RUN if [ -x "/usr/local/bin/yarn" ]; then \
            echo "yarn already present at /usr/local/bin/yarn, skipping global install"; \
        else \
            npm install -g yarn@1.22.22; \
        fi \
 && cd /work/circuits \
 && yarn install --non-interactive

# Install snarkjs globally
RUN npm i -g snarkjs@${SNARKJS_VERSION}

ENV PATH="/usr/local/bin:${PATH}"

CMD ["/bin/bash"]
