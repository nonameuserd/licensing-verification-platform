/**
 * Unit tests for networks.ts
 * Tests network configuration and utility functions
 */

import {
  NETWORKS,
  getNetwork,
  getAvailableNetworks,
  NetworkConfig,
  NetworksConfig,
} from '../lib/networks';

describe('Networks', () => {
  describe('NETWORKS constant', () => {
    it('should have development networks', () => {
      expect(NETWORKS.development).toBeDefined();
      expect(NETWORKS.development.sepolia).toBeDefined();
      expect(NETWORKS.development.amoy).toBeDefined();
      expect(NETWORKS.development.arbitrumSepolia).toBeDefined();
      expect(NETWORKS.development.optimismSepolia).toBeDefined();
    });

    it('should have production networks', () => {
      expect(NETWORKS.production).toBeDefined();
      expect(NETWORKS.production.ethereum).toBeDefined();
      expect(NETWORKS.production.polygon).toBeDefined();
      expect(NETWORKS.production.arbitrum).toBeDefined();
      expect(NETWORKS.production.optimism).toBeDefined();
    });

    it('should have correct network structure', () => {
      const network: NetworkConfig = NETWORKS.development.sepolia;

      expect(network).toHaveProperty('name');
      expect(network).toHaveProperty('chainId');
      expect(network).toHaveProperty('rpcUrl');
      expect(typeof network.name).toBe('string');
      expect(typeof network.chainId).toBe('number');
      expect(typeof network.rpcUrl).toBe('string');
    });

    it('should have correct chain IDs', () => {
      expect(NETWORKS.development.sepolia.chainId).toBe(11155111);
      expect(NETWORKS.development.amoy.chainId).toBe(80002);
      expect(NETWORKS.development.arbitrumSepolia.chainId).toBe(421614);
      expect(NETWORKS.development.optimismSepolia.chainId).toBe(11155420);

      expect(NETWORKS.production.ethereum.chainId).toBe(1);
      expect(NETWORKS.production.polygon.chainId).toBe(137);
      expect(NETWORKS.production.arbitrum.chainId).toBe(42161);
      expect(NETWORKS.production.optimism.chainId).toBe(10);
    });

    it('should have valid RPC URLs', () => {
      Object.values(NETWORKS.development).forEach((network) => {
        expect(network.rpcUrl).toMatch(/^https?:\/\//);
      });

      Object.values(NETWORKS.production).forEach((network) => {
        expect(network.rpcUrl).toMatch(/^https?:\/\//);
      });
    });

    it('should use environment variables for RPC URLs', () => {
      const originalEnv = process.env;

      process.env = {
        ...originalEnv,
        SEPOLIA_RPC_URL: 'https://custom-sepolia-rpc.com',
        POLYGON_RPC_URL: 'https://custom-polygon-rpc.com',
      };

      // Re-import to get updated environment variables
      jest.resetModules();
      const { NETWORKS: updatedNetworks } = require('../lib/networks');

      expect(updatedNetworks.development.sepolia.rpcUrl).toBe(
        'https://custom-sepolia-rpc.com'
      );
      expect(updatedNetworks.production.polygon.rpcUrl).toBe(
        'https://custom-polygon-rpc.com'
      );

      process.env = originalEnv;
    });

    it('should fall back to default RPC URLs when environment variables are not set', () => {
      const originalEnv = process.env;

      process.env = {
        ...originalEnv,
        SEPOLIA_RPC_URL: undefined,
        POLYGON_RPC_URL: undefined,
      };

      // Re-import to get updated environment variables
      jest.resetModules();
      const { NETWORKS: updatedNetworks } = require('../lib/networks');

      expect(updatedNetworks.development.sepolia.rpcUrl).toContain(
        'sepolia.infura.io'
      );
      expect(updatedNetworks.production.polygon.rpcUrl).toContain(
        'polygon-mainnet.infura.io'
      );

      process.env = originalEnv;
    });
  });

  describe('getNetwork', () => {
    it('should return correct network for development environment', () => {
      const network = getNetwork('development', 'sepolia');

      expect(network).toEqual(NETWORKS.development.sepolia);
      expect(network.name).toBe('Sepolia');
      expect(network.chainId).toBe(11155111);
    });

    it('should return correct network for production environment', () => {
      const network = getNetwork('production', 'ethereum');

      expect(network).toEqual(NETWORKS.production.ethereum);
      expect(network.name).toBe('Ethereum Mainnet');
      expect(network.chainId).toBe(1);
    });

    it('should return correct network for all development networks', () => {
      const networks = [
        'sepolia',
        'amoy',
        'arbitrumSepolia',
        'optimismSepolia',
      ];

      networks.forEach((networkName) => {
        const network = getNetwork('development', networkName);
        expect(network).toBeDefined();
        expect(network.name).toBeDefined();
        expect(network.chainId).toBeGreaterThan(0);
        expect(network.rpcUrl).toBeDefined();
      });
    });

    it('should return correct network for all production networks', () => {
      const networks = ['ethereum', 'polygon', 'arbitrum', 'optimism'];

      networks.forEach((networkName) => {
        const network = getNetwork('production', networkName);
        expect(network).toBeDefined();
        expect(network.name).toBeDefined();
        expect(network.chainId).toBeGreaterThan(0);
        expect(network.rpcUrl).toBeDefined();
      });
    });

    it('should throw error for unknown environment', () => {
      expect(() => getNetwork('unknown', 'sepolia')).toThrow(
        'Unknown network: sepolia for environment: unknown'
      );
    });

    it('should throw error for unknown network in development', () => {
      expect(() => getNetwork('development', 'unknown')).toThrow(
        'Unknown network: unknown for environment: development'
      );
    });

    it('should throw error for unknown network in production', () => {
      expect(() => getNetwork('production', 'unknown')).toThrow(
        'Unknown network: unknown for environment: production'
      );
    });

    it('should handle case-sensitive network names', () => {
      expect(() => getNetwork('development', 'Sepolia')).toThrow(
        'Unknown network: Sepolia for environment: development'
      );
      expect(() => getNetwork('production', 'Ethereum')).toThrow(
        'Unknown network: Ethereum for environment: production'
      );
    });

    it('should handle empty environment string', () => {
      expect(() => getNetwork('', 'sepolia')).toThrow(
        'Unknown network: sepolia for environment: '
      );
    });

    it('should handle empty network string', () => {
      expect(() => getNetwork('development', '')).toThrow(
        'Unknown network:  for environment: development'
      );
    });

    it('should handle null/undefined environment', () => {
      expect(() => getNetwork(null as any, 'sepolia')).toThrow();
      expect(() => getNetwork(undefined as any, 'sepolia')).toThrow();
    });

    it('should handle null/undefined network', () => {
      expect(() => getNetwork('development', null as any)).toThrow();
      expect(() => getNetwork('development', undefined as any)).toThrow();
    });
  });

  describe('getAvailableNetworks', () => {
    it('should return available networks for development', () => {
      const networks = getAvailableNetworks('development');

      expect(networks).toEqual([
        'sepolia',
        'amoy',
        'arbitrumSepolia',
        'optimismSepolia',
      ]);
      expect(networks).toHaveLength(4);
    });

    it('should return available networks for production', () => {
      const networks = getAvailableNetworks('production');

      expect(networks).toEqual(['ethereum', 'polygon', 'arbitrum', 'optimism']);
      expect(networks).toHaveLength(4);
    });

    it('should return empty array for unknown environment', () => {
      const networks = getAvailableNetworks('unknown');

      expect(networks).toEqual([]);
    });

    it('should return empty array for empty environment', () => {
      const networks = getAvailableNetworks('');

      expect(networks).toEqual([]);
    });

    it('should handle null/undefined environment', () => {
      expect(getAvailableNetworks(null as any)).toEqual([]);
      expect(getAvailableNetworks(undefined as any)).toEqual([]);
    });

    it('should return networks in consistent order', () => {
      const networks1 = getAvailableNetworks('development');
      const networks2 = getAvailableNetworks('development');

      expect(networks1).toEqual(networks2);
    });
  });

  describe('Type Safety', () => {
    it('should have correct NetworkConfig interface', () => {
      const network: NetworkConfig = {
        name: 'Test Network',
        chainId: 12345,
        rpcUrl: 'https://test-rpc.com',
      };

      expect(network.name).toBe('Test Network');
      expect(network.chainId).toBe(12345);
      expect(network.rpcUrl).toBe('https://test-rpc.com');
    });

    it('should have correct NetworksConfig interface', () => {
      const networks: NetworksConfig = {
        test1: {
          name: 'Test Network 1',
          chainId: 1,
          rpcUrl: 'https://test1.com',
        },
        test2: {
          name: 'Test Network 2',
          chainId: 2,
          rpcUrl: 'https://test2.com',
        },
      };

      expect(networks['test1'].name).toBe('Test Network 1');
      expect(networks['test2'].chainId).toBe(2);
    });

    it('should be readonly constant', () => {
      // This test ensures the NETWORKS constant is properly typed as readonly
      // Note: In JavaScript, const objects are not deeply frozen, so this test
      // verifies the structure is defined but doesn't actually prevent modification
      expect(NETWORKS).toBeDefined();
      expect(NETWORKS.development).toBeDefined();
      expect(NETWORKS.production).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long environment names', () => {
      const longEnv = 'a'.repeat(1000);
      const networks = getAvailableNetworks(longEnv);

      expect(networks).toEqual([]);
    });

    it('should handle very long network names', () => {
      const longNetwork = 'a'.repeat(1000);

      expect(() => getNetwork('development', longNetwork)).toThrow();
    });

    it('should handle special characters in environment names', () => {
      const specialEnv = 'dev@#$%^&*()';
      const networks = getAvailableNetworks(specialEnv);

      expect(networks).toEqual([]);
    });

    it('should handle special characters in network names', () => {
      const specialNetwork = 'sepolia@#$%^&*()';

      expect(() => getNetwork('development', specialNetwork)).toThrow();
    });

    it('should handle numeric environment names', () => {
      const numericEnv = '123';
      const networks = getAvailableNetworks(numericEnv);

      expect(networks).toEqual([]);
    });

    it('should handle numeric network names', () => {
      const numericNetwork = '123';

      expect(() => getNetwork('development', numericNetwork)).toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should work with all valid environment/network combinations', () => {
      const environments = ['development', 'production'];
      const developmentNetworks = [
        'sepolia',
        'amoy',
        'arbitrumSepolia',
        'optimismSepolia',
      ];
      const productionNetworks = [
        'ethereum',
        'polygon',
        'arbitrum',
        'optimism',
      ];

      environments.forEach((env) => {
        const availableNetworks = getAvailableNetworks(env);

        if (env === 'development') {
          expect(availableNetworks).toEqual(developmentNetworks);
          developmentNetworks.forEach((network) => {
            const networkConfig = getNetwork(env, network);
            expect(networkConfig).toBeDefined();
            expect(networkConfig.name).toBeDefined();
            expect(networkConfig.chainId).toBeGreaterThan(0);
            expect(networkConfig.rpcUrl).toMatch(/^https?:\/\//);
          });
        } else if (env === 'production') {
          expect(availableNetworks).toEqual(productionNetworks);
          productionNetworks.forEach((network) => {
            const networkConfig = getNetwork(env, network);
            expect(networkConfig).toBeDefined();
            expect(networkConfig.name).toBeDefined();
            expect(networkConfig.chainId).toBeGreaterThan(0);
            expect(networkConfig.rpcUrl).toMatch(/^https?:\/\//);
          });
        }
      });
    });

    it('should maintain consistency between NETWORKS constant and getAvailableNetworks', () => {
      const developmentNetworks = getAvailableNetworks('development');
      const productionNetworks = getAvailableNetworks('production');

      developmentNetworks.forEach((network) => {
        expect(
          NETWORKS.development[network as keyof typeof NETWORKS.development]
        ).toBeDefined();
      });

      productionNetworks.forEach((network) => {
        expect(
          NETWORKS.production[network as keyof typeof NETWORKS.production]
        ).toBeDefined();
      });
    });
  });
});
