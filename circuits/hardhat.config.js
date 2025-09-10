// Minimal Hardhat config for CI/local smoke runs used by scripts/gen-proof-ci.sh
/**
 * This file provides a minimal configuration so `npx hardhat node` can run
 * without requiring a project-level hardhat config in the repository root.
 */
module.exports = {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  // using default networks configuration for local runs
};
