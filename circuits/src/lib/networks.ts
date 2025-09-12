/**
 * Network configurations for different environments
 * Shared across all scripts to avoid duplication
 */

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
}

export interface NetworksConfig {
  [key: string]: NetworkConfig;
}

export const NETWORKS = {
  development: {
    sepolia: {
      name: 'Sepolia',
      chainId: 11155111,
      rpcUrl:
        process.env['SEPOLIA_RPC_URL'] ||
        'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
    },
    amoy: {
      name: 'Amoy',
      chainId: 80002,
      rpcUrl:
        process.env['AMOY_RPC_URL'] ||
        'https://polygon-amoy.infura.io/v3/YOUR_INFURA_KEY',
    },
    arbitrumSepolia: {
      name: 'Arbitrum Sepolia',
      chainId: 421614,
      rpcUrl:
        process.env['ARBITRUM_SEPOLIA_RPC_URL'] ||
        'https://sepolia-rollup.arbitrum.io/rpc',
    },
    optimismSepolia: {
      name: 'Optimism Sepolia',
      chainId: 11155420,
      rpcUrl:
        process.env['OPTIMISM_SEPOLIA_RPC_URL'] ||
        'https://sepolia.optimism.io',
    },
  },
  production: {
    ethereum: {
      name: 'Ethereum Mainnet',
      chainId: 1,
      rpcUrl:
        process.env['ETHEREUM_RPC_URL'] ||
        'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
    },
    polygon: {
      name: 'Polygon Mainnet',
      chainId: 137,
      rpcUrl:
        process.env['POLYGON_RPC_URL'] ||
        'https://polygon-mainnet.infura.io/v3/YOUR_INFURA_KEY',
    },
    arbitrum: {
      name: 'Arbitrum One',
      chainId: 42161,
      rpcUrl: process.env['ARBITRUM_RPC_URL'] || 'https://arb1.arbitrum.io/rpc',
    },
    optimism: {
      name: 'Optimism',
      chainId: 10,
      rpcUrl: process.env['OPTIMISM_RPC_URL'] || 'https://mainnet.optimism.io',
    },
  },
} as const;

export function getNetwork(
  environment: string,
  networkName: string
): NetworkConfig {
  const availableNetworks = NETWORKS[environment as keyof typeof NETWORKS];
  if (
    !availableNetworks ||
    !availableNetworks[networkName as keyof typeof availableNetworks]
  ) {
    throw new Error(
      `Unknown network: ${networkName} for environment: ${environment}`
    );
  }
  return availableNetworks[networkName as keyof typeof availableNetworks];
}

export function getAvailableNetworks(environment: string): string[] {
  const availableNetworks = NETWORKS[environment as keyof typeof NETWORKS];
  return availableNetworks ? Object.keys(availableNetworks) : [];
}
