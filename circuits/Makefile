.PHONY: all setup compile build-ts start-hardhat gen-proof onchain-verify perf ci-local clean

REPO_ROOT := $(shell realpath ..)

all: ci-local

setup:
	@echo "Installing workspace deps and building shared package..."
	cd $(REPO_ROOT) && yarn install --non-interactive || true
	npx nx build shared || true
	cd $(REPO_ROOT)/circuits && yarn install --non-interactive || true

compile:
	@echo "Compiling circuits (circom -> build)..."
	@echo "Running circom compile (repo root: $(REPO_ROOT))"
	# If a downloaded circom binary exists, prefer it and skip any Docker build
	if [ -x "$(REPO_ROOT)/circuits/.bin/circom" ]; then \
		echo "Using downloaded circom: $(REPO_ROOT)/circuits/.bin/circom"; \
		"$(REPO_ROOT)/circuits/.bin/circom" "$(REPO_ROOT)/circuits/src/ExamProof.circom" -l "$(REPO_ROOT)/circuits/src" -l "$(REPO_ROOT)/node_modules/circomlib/circuits" --r1cs --wasm --sym --c -o "$(REPO_ROOT)/circuits/build/"; \
	else \
		@echo "Building lvp-circuits:local Docker image (if missing)"; \
		if ! docker image inspect lvp-circuits:local >/dev/null 2>&1; then \
			echo "Building Docker image lvp-circuits:local"; \
			docker build --platform linux/amd64 -t lvp-circuits:local -f Dockerfile ..; \
		fi; \
		echo "Attempting to use Docker image lvp-circuits:local for circom v2.2.2"; \
		docker run --platform linux/amd64 --rm -v "$(REPO_ROOT)":/work -w /work lvp-circuits:local \
			sh -c "cd circuits && /usr/local/bin/circom src/ExamProof.circom -l src -l ../node_modules/circomlib/circuits --r1cs --wasm --sym --c -o build/"; \
	fi

build-ts:
	@echo "Building TypeScript helpers..."
	cd $(REPO_ROOT)/circuits && yarn build:ts

start-hardhat:
	@echo "Starting local Hardhat node (background)..."
	cd $(REPO_ROOT)/circuits && npx hardhat node --config hardhat.config.cjs --hostname 127.0.0.1 &

gen-proof:
	@echo "Generating proof and running on-chain verify (local)..."
	$(REPO_ROOT)/circuits/scripts/ci-local.sh

onchain-verify: gen-proof

perf:
	@echo "Run perf runner (requires build artifacts)..."
	cd $(REPO_ROOT)/circuits && node dist/scripts/perf-runner.js || true

ci-local: setup compile build-ts gen-proof

# A faster CI-local path that skips the heavy `compile` step when build artifacts exist.
# Use this when you've already compiled the circom circuits and only need to run the TS build
# and proof generation. This avoids re-running Docker/circom and is useful for iterative dev.
ci-local-fast:
	@echo "Running fast ci-local: skip compile if build exists"
	# If build directory exists, skip the circom compile step which is the slow part.
	if [ -d "$(REPO_ROOT)/circuits/build" ]; then \
		echo "Found existing build/ directory — skipping compile"; \
	else \
		echo "No build/ found — running compile"; \
		$(MAKE) -C $(REPO_ROOT)/circuits compile; \
	fi
	@echo "Building TypeScript helpers..."
	cd $(REPO_ROOT)/circuits && yarn build:ts
	@echo "Generating proof (fast path)"
	cd $(REPO_ROOT)/circuits && $(REPO_ROOT)/circuits/scripts/ci-local.sh

clean:
	@echo "No-op clean; use CI to clean heavy artifacts."
