# Circuits Quickstart

This quickstart shows how to verify and reproduce the circuit artifacts produced by CI.

## CI & Runtime note

- Ensure your CI pipeline runs `yarn install --non-interactive` at the repository root immediately after checkout so Yarn workspaces are linked. The circuits job depends on workspace symlinks being present.
- The proof generator runs with `ts-node` during CI/dev and uses `tsconfig-paths/register` so imports like `@licensing-verification-platform/shared` resolve from source according to `tsconfig.base.json` `paths`. In `circuits` you can invoke the generator with:

```bash
# from the circuits directory
yarn run generate-proof:tsnode
```

The `scripts/verify-binaries-local.sh` script downloads pinned `circom` and
`cosign` binaries and verifies checksums. It performs checksum verification
and exits successfully (no nested Docker builds are attempted).

Prereqs

- Node.js (20+), yarn
- Docker (for reproducible builds)
- cosign (for signature verification) or the public key provided by the project

Local build (reproducible)

```bash
# install and build compiled helpers
yarn --cwd circuits install --frozen-lockfile
yarn --cwd circuits build:ts
```

Verify artifact bundle downloaded from Releases

```bash
# verify signature
cosign verify-blob --key <publicKey> artifacts/artifact-metadata.json
# check hashes listed inside
cat artifacts/artifact-metadata.json
```

Generate witness and proof locally (using build outputs)

```bash
# create witness (example)
node circuits/build/ExamProof_js/generate_witness.js circuits/proofs/input.json witness.wtns
snarkjs groth16 prove circuits/build/ExamProof_js/ExamProof.zkey proof.json public.json
snarkjs groth16 verify verification_key.json public.json proof.json
```

On-chain verification (example)

```bash
# start a local Hardhat node and run the included CI-style script (it will build helpers then run the flow)
yarn --cwd circuits build:ts
chmod +x circuits/scripts/gen-proof-ci.sh
./circuits/scripts/gen-proof-ci.sh
```

Notes

- The CI flow signs `artifact-metadata.json` with cosign and uploads a draft Release for review. A separate `publish-release` workflow is provided to publish the draft after manual approval.
- Final `.zkey` files are sensitive and should be stored in secure object storage for pilot partners.

# ZK-SNARK Circuit Testing Suite

This directory contains comprehensive unit tests for the ExamProof.circom circuit using Test-Driven Development (TDD) principles.

## Test Structure

### Core Test Files

- **`src/__tests__/setup.ts`** - Test setup and configuration
- **`src/__tests__/ExamProof.test.ts`** - Main unit tests for the circuit
- **`src/__tests__/ExamProof.integration.test.ts`** - Integration tests
- **`src/__tests__/ExamProof.performance.test.ts`** - Performance tests
- **`src/__tests__/ExamProof.security.test.ts`** - Security tests
- **`src/__tests__/index.test.ts`** - Complete test suite runner

### Test Utilities

- **`src/__tests__/utils/circuit-test-utils.ts`** - Circuit testing utilities
- **`src/__tests__/utils/mock-data.ts`** - Mock data for testing

## Test Categories

### 1. Unit Tests (`ExamProof.test.ts`)

Tests individual circuit functionality:

- **Circuit Compilation** - Tests circuit compilation process
- **Valid Credential Verification** - Tests successful verification flows
- **Invalid Credential Verification** - Tests failure scenarios
- **Nullifier System** - Tests replay attack prevention
- **Privacy Preservation** - Tests data privacy
- **Edge Cases** - Tests boundary conditions
- **Performance Tests** - Tests timing requirements
- **Security Tests** - Tests security aspects

### 2. Integration Tests (`ExamProof.integration.test.ts`)

Tests complete verification flows:

- **Complete Verification Flow** - End-to-end testing
- **Batch Verification** - Multiple credential testing
- **Cross-Board Verification** - Multi-board testing
- **Error Handling Integration** - Error scenario testing
- **Performance Integration** - Performance under load

### 3. Performance Tests (`ExamProof.performance.test.ts`)

Tests performance characteristics:

- **Single Verification Performance** - Individual operation timing
- **Batch Verification Performance** - Bulk operation timing
- **Memory Usage Performance** - Memory efficiency testing
- **Stress Testing** - High-load testing
- **Scalability Tests** - Performance scaling

### 4. Security Tests (`ExamProof.security.test.ts`)

Tests security aspects:

- **Privacy Preservation** - Data privacy testing
- **Nullifier System Security** - Replay attack prevention
- **Credential Tampering Prevention** - Tamper detection
- **Expired Credential Detection** - Expiration handling
- **Suspended Credential Detection** - Suspension handling
- **Input Validation Security** - Input sanitization
- **Cryptographic Security** - Hash function testing
- **Attack Prevention** - Security attack testing

## Test Data

### Mock Credentials

The test suite includes comprehensive mock data:

- **Valid Credentials** - Medical, legal, and engineering credentials
- **Invalid Credentials** - Failed, expired, suspended, revoked credentials
- **Edge Cases** - Empty fields, special characters, long strings, Unicode
- **Mixed Scenarios** - Combinations of valid and invalid credentials

### Test Constants

- **VALID_CREDENTIAL** - Standard valid credential for testing
- **INVALID_CREDENTIAL** - Standard invalid credential for testing
- **PRIVATE_KEY** - Test private key for nullifier generation
- **NULLIFIER** - Test nullifier for replay attack prevention

## Running Tests

### Install Dependencies

```bash
# From project root
yarn install
```

### Run All Tests

```bash
# From project root
yarn nx test circuits
```

### Run Specific Test Categories

```bash
# Unit tests only
yarn nx test circuits --testNamePattern="ExamProof.test.ts"

# Integration tests only
yarn nx test circuits --testNamePattern="ExamProof.integration.test.ts"

# Performance tests only
yarn nx test circuits --testNamePattern="ExamProof.performance.test.ts"

# Security tests only
yarn nx test circuits --testNamePattern="ExamProof.security.test.ts"
```

### Run Tests with Coverage

```bash
yarn nx test circuits --coverage
```

### Run Tests in Watch Mode

```bash
yarn nx test circuits --watch
```

## Circuit Compilation and Setup

### Compile the Circuit

```bash
# Compile the circuit to R1CS, WASM, and symbol files
yarn nx run circuits:compile
```

### Run Trusted Setup

```bash
# Generate proving and verification keys
yarn nx run circuits:setup
```

### Generate and Verify Proofs

```bash
# Generate a proof
yarn nx run circuits:generate-proof

# Verify a proof
yarn nx run circuits:verify-proof
```

### Generate Smart Contract Verifier

```bash
# Generate Solidity verifier contract for L2 blockchain integration
yarn nx run circuits:generate-verifier
```

This generates:

- `contracts/ExamProofVerifier.sol` - Solidity verifier contract
- `contracts/ExamProofVerifier.ts` - TypeScript interface for contract interaction

## Test Coverage

The test suite aims for 98% coverage across:

- **Branches** - 98% coverage
- **Functions** - 98% coverage
- **Lines** - 98% coverage
- **Statements** - 98% coverage

## Test Scenarios

### Valid Credential Scenarios

1. **Medical License Verification**

   - Valid medical credentials
   - Different licensing boards
   - Various achievement levels

2. **Legal License Verification**

   - Valid bar exam credentials
   - Different state bars
   - Various achievement levels

3. **Engineering License Verification**
   - Valid PE credentials
   - Different engineering boards
   - Various achievement levels

### Invalid Credential Scenarios

1. **Failed Credentials**

   - Achievement level: "Failed"
   - Invalid license numbers
   - Tampered data

2. **Expired Credentials**

   - Past expiry dates
   - Edge case: expiring today
   - Long-expired credentials

3. **Inactive Credentials**
   - Achievement level: "Failed"
   - Inactive status (isActive: false)
   - Status changes

### Edge Cases

1. **Empty Fields**

   - Missing required data
   - Null values
   - Undefined values

2. **Special Characters**

   - Unicode characters
   - Special symbols
   - International names

3. **Large Data**
   - Long strings
   - Maximum length fields
   - Memory-intensive data

## Performance Benchmarks

### Timing Requirements

- **Circuit Compilation** - < 5 seconds
- **Proof Generation** - < 5 seconds
- **Proof Verification** - < 1 second
- **Full Verification Flow** - < 10 seconds

### Load Testing

- **Single Verification** - < 5 seconds
- **Batch Verification (100)** - < 30 seconds
- **Sequential Verification (1000)** - < 60 seconds
- **Concurrent Verification (10)** - < 15 seconds

### Memory Usage

- **Single Verification** - < 10MB increase
- **Batch Verification (500)** - < 100MB increase
- **Memory Cleanup** - Proper garbage collection

## Security Testing

### Privacy Preservation

- Sensitive data not in public signals
- Date of birth hidden in private inputs
- Credential data reconstruction prevention

### Nullifier System

- Unique nullifier generation
- Replay attack prevention
- Nullifier reuse detection
- Cryptographic security

### Attack Prevention

- Brute force attack prevention
- Timing attack prevention
- Tampering detection
- Input validation

## TDD Approach

This test suite follows Test-Driven Development principles:

1. **Red** - Write failing tests first
2. **Green** - Implement minimal code to pass tests
3. **Refactor** - Improve code while maintaining test coverage

### Test-First Benefits

- **Clear Requirements** - Tests define expected behavior
- **Better Design** - Tests drive better API design
- **Regression Prevention** - Tests catch breaking changes
- **Documentation** - Tests serve as living documentation
- **Confidence** - High test coverage provides confidence

## NX Integration

This circuits project is integrated into the NX monorepo workspace:

### Available NX Commands

```bash
# Build the circuits library
yarn nx build circuits

# Test the circuits library
yarn nx test circuits

# Lint the circuits library
yarn nx lint circuits

# Compile the circom circuit
yarn nx run circuits:compile

# Setup trusted parameters
yarn nx run circuits:setup

# Generate proof
yarn nx run circuits:generate-proof

# Verify proof
yarn nx run circuits:verify-proof
```

### Project Structure

```
circuits/
├── src/
│   ├── lib/                    # Circuit utilities and types
│   ├── __tests__/              # Test files
│   └── index.ts                # Main library export
├── scripts/                    # TypeScript helper scripts
│   ├── setup.ts                # Trusted setup script
│   ├── generate-proof.ts       # Proof generation script
│   └── verify-proof.ts         # Proof verification script
├── build/                      # Compiled circuit files
├── setup/                      # Trusted setup parameters
├── proofs/                     # Generated proofs
├── project.json                # NX project configuration
├── tsconfig.json               # TypeScript configuration
├── jest.config.ts              # Jest configuration
└── README.md                   # This file
```

## Next Steps

After the tests are written, the next step is to implement the actual ExamProof.circom circuit to make these tests pass. The circuit should:

1. **Compile successfully** - Pass compilation tests
2. **Generate valid proofs** - Pass proof generation tests
3. **Verify proofs correctly** - Pass verification tests
4. **Maintain privacy** - Pass privacy tests
5. **Prevent attacks** - Pass security tests
6. **Meet performance requirements** - Pass performance tests

The comprehensive test suite ensures that the circuit implementation will be robust, secure, and performant.

## CI-only performance buffers

The performance tests include two optional environment variables that CI can set to reduce flaky failures on slower runners or noisy build machines. They default to zero for local runs so developers keep strict timing and memory checks while iterating.

- `PERF_TEST_BUFFER_MS` - number of milliseconds to add to timing thresholds (default: `0` locally). Example: `PERF_TEST_BUFFER_MS=2000` will add a 2 second buffer to timing assertions.
- `PERF_TEST_MEMORY_BUFFER_BYTES` - number of bytes to add to memory increase thresholds (default: `0` locally). Example: `PERF_TEST_MEMORY_BUFFER_BYTES=10485760` will add a 10MB buffer to memory assertions.

Recommendation: set these in CI (or in selective flaky job runs) rather than in local environments. That keeps local development strict while making CI robust to noisy slowdowns.
