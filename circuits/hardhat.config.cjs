// CommonJS Hardhat config for local CI when package.json is ESM
// Duplicate of hardhat.config.js but with .cjs extension so Node treats it as CommonJS
module.exports = {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  // using default networks configuration for local runs
};
