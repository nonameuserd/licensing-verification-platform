import { HardhatUserConfig } from 'hardhat/config';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // Local development network
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
      type: 'http',
    },
    // Ethereum testnets
    sepolia: {
      url:
        process.env.SEPOLIA_RPC_URL ||
        'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
      chainId: 11155111,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      type: 'http',
    },
    // Polygon testnets
    amoy: {
      url:
        process.env.AMOY_RPC_URL ||
        'https://polygon-amoy.infura.io/v3/YOUR_INFURA_KEY',
      chainId: 80002,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      type: 'http',
    },
    // Arbitrum testnets
    arbitrumSepolia: {
      url:
        process.env.ARBITRUM_SEPOLIA_RPC_URL ||
        'https://sepolia-rollup.arbitrum.io/rpc',
      chainId: 421614,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      type: 'http',
    },
    // Optimism testnets
    optimismSepolia: {
      url:
        process.env.OPTIMISM_SEPOLIA_RPC_URL || 'https://sepolia.optimism.io',
      chainId: 11155420,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      type: 'http',
    },
  },
};

export default config;
