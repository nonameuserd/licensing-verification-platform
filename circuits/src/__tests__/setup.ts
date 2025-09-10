/**
 * Test setup for ZK-SNARK circuit testing
 * Configures Jest environment for circom and snarkjs testing
 */

import { expect } from '@jest/globals';
import { CircuitLogger } from '../lib/logger';
import { PublicCredentialData, CircuitInput, ProofData } from '../lib/types';
import {
  buildTree,
  getProof,
  generateCredentialLeaf,
  generateNullifierLeaf,
  validateProof,
  initPoseidon,
} from '../../scripts/merkle-helper';

// Increase Jest timeout globally to accommodate WASM initialization used by
// initPoseidon() which may take longer than the default 5s in some environments.
// 30s should be sufficient for CI and local runs; adjust if necessary.
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
// Replace console methods with typed no-op implementations while preserving
// the rest of the Console interface. We reference the original console so
// calls here don't accidentally recurse.
const originalConsole: Console = global.console;

global.console = {
  ...originalConsole,
  log: (..._args: unknown[]): void => {
    // intentionally no-op to reduce test noise; reference args to avoid
    // unused parameter lint warnings
    void _args;
  },
  debug: (..._args: unknown[]): void => {
    void _args;
  },
  info: (..._args: unknown[]): void => {
    void _args;
  },
  warn: (..._args: unknown[]): void => {
    void _args;
  },
  error: (..._args: unknown[]): void => {
    void _args;
  },
} as Console;

// Configure test logger
const testLogger = new CircuitLogger('test-setup');
testLogger.info('Test environment initialized', {
  environment: 'test',
  timestamp: new Date().toISOString(),
});

// Global test utilities for ZK-SNARK testing
/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidProof(): R;
      toBeInvalidProof(): R;
      toHaveValidWitness(): R;
      toHaveInvalidWitness(): R;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

// Custom Jest matchers for ZK-SNARK testing
expect.extend({
  toBeValidProof(received: ProofData | null | undefined) {
    const pass = received && received.proof && received.publicSignals;
    if (pass) {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} not to be a valid proof`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} to be a valid proof`,
        pass: false,
      };
    }
  },

  toBeInvalidProof(received: ProofData | null | undefined) {
    const pass = !received || !received.proof || !received.publicSignals;
    if (pass) {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} not to be an invalid proof`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} to be an invalid proof`,
        pass: false,
      };
    }
  },

  toHaveValidWitness(received: CircuitInput | null | undefined) {
    const pass =
      received &&
      typeof received === 'object' &&
      Object.keys(received).length > 0;
    if (pass) {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} not to have a valid witness`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} to have a valid witness`,
        pass: false,
      };
    }
  },

  toHaveInvalidWitness(received: CircuitInput | null | undefined) {
    const pass =
      !received ||
      typeof received !== 'object' ||
      Object.keys(received).length === 0;
    if (pass) {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} not to have an invalid witness`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} to have an invalid witness`,
        pass: false,
      };
    }
  },
});

// Test data constants
export const TEST_CONSTANTS: {
  VALID_CREDENTIAL: PublicCredentialData;
  INVALID_CREDENTIAL: PublicCredentialData;
  PRIVATE_KEY: string;
  NULLIFIER: string;
} = {
  // Valid credential data
  VALID_CREDENTIAL: {
    credentialId: 'MED-2024-001234',
    holderName: 'Dr. John Smith',
    licenseNumber: 'MD123456',
    examId: 'medical-license-2024',
    achievementLevel: 'Passed',
    issuedDate: '2024-01-15',
    expiryDate: '2026-01-15',
    issuer: 'California Medical Board',
    holderDOB: '1980-05-15',
    proofHash: '0xabcd1234567890abcdef1234567890abcdef123456',
    isActive: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },

  // Invalid credential data
  INVALID_CREDENTIAL: {
    credentialId: 'MED-2024-INVALID',
    holderName: 'Dr. Jane Doe',
    licenseNumber: 'INVALID123',
    examId: 'medical-license-2024',
    achievementLevel: 'Failed',
    issuedDate: '2024-01-15',
    expiryDate: '2026-01-15',
    issuer: 'California Medical Board',
    holderDOB: '1980-05-15',
    proofHash: '0x0000000000000000000000000000000000000000',
    isActive: false,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },

  // Test private key for nullifier generation
  PRIVATE_KEY: '0x1234567890abcdef1234567890abcdef12345678',

  // Test nullifier (prevents replay attacks)
  NULLIFIER: '0xabcdef1234567890abcdef1234567890abcdef12',
};

// Test logger helper
export const createTestLogger = (testName: string): CircuitLogger => {
  const logger = new CircuitLogger(testName);
  logger.info('Test logger created', { testName });
  return logger;
};

// Test tree configuration
const TEST_TREE_HEIGHT = 4; // Small tree for testing
let testCredentialTree: { root: bigint; layers: bigint[][] } | null = null;
let testNullifierTree: { root: bigint; layers: bigint[][] } | null = null;

// Initialize test trees
function initializeTestTrees(): void {
  if (!testCredentialTree) {
    // Create test credential tree with sample credentials
    const credentialLeaves = [
      generateCredentialLeaf(
        TEST_CONSTANTS.VALID_CREDENTIAL.examId,
        TEST_CONSTANTS.VALID_CREDENTIAL.achievementLevel,
        TEST_CONSTANTS.VALID_CREDENTIAL.issuer,
        TEST_CONSTANTS.PRIVATE_KEY
      ),
      generateCredentialLeaf(
        TEST_CONSTANTS.INVALID_CREDENTIAL.examId,
        TEST_CONSTANTS.INVALID_CREDENTIAL.achievementLevel,
        TEST_CONSTANTS.INVALID_CREDENTIAL.issuer,
        TEST_CONSTANTS.PRIVATE_KEY
      ),
    ];
    testCredentialTree = buildTree(credentialLeaves, TEST_TREE_HEIGHT);
  }

  if (!testNullifierTree) {
    // Create test nullifier tree
    const nullifierLeaves = [
      generateNullifierLeaf(TEST_CONSTANTS.NULLIFIER),
      generateNullifierLeaf(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      ),
    ];
    testNullifierTree = buildTree(nullifierLeaves, TEST_TREE_HEIGHT);
  }
}

// Ensure Poseidon is initialized before any tests run
beforeAll(async () => {
  // Initialize the real Poseidon implementation (may load WASM)
  await initPoseidon();
});

// Utility functions for testing
export const TestUtils = {
  /**
   * Initialize test trees
   */
  initializeTestTrees,

  /**
   * Generate test witness data for the circuit with real Merkle proofs
   */
  generateWitness: (
    credential: PublicCredentialData,
    nullifier: string
  ): CircuitInput => {
    initializeTestTrees();

    // Get Merkle proofs. initializeTestTrees() above ensures trees exist.
    const credentialTree = testCredentialTree;
    const nullifierTree = testNullifierTree;

    if (!credentialTree || !nullifierTree) {
      throw new Error('Test trees not initialized');
    }

    const credentialProof = getProof(
      credentialTree.layers,
      0,
      TEST_TREE_HEIGHT
    );
    const nullifierProof = getProof(nullifierTree.layers, 0, TEST_TREE_HEIGHT);

    return {
      // Public inputs (visible in proof)
      holderName: credential.holderName,
      licenseNumber: credential.licenseNumber,
      examId: credential.examId,
      achievementLevel: credential.achievementLevel,
      issuedDate: credential.issuedDate,
      expiryDate: credential.expiryDate,
      issuer: credential.issuer,
      nullifier: nullifier,
      credentialRoot: credentialTree.root.toString(),
      nullifierRoot: nullifierTree.root.toString(),

      // Private inputs (hidden in proof)
      holderDOB: credential.holderDOB,
      privateKey: TEST_CONSTANTS.PRIVATE_KEY,
      merkleProof: credentialProof.siblings,
      merklePathIndices: credentialProof.pathIndices,
      merkleProofNullifier: nullifierProof.siblings,
      merklePathIndicesNullifier: nullifierProof.pathIndices,
      storedNullifierLeaf: nullifierProof.leaf,
    };
  },

  /**
   * Generate expected public signals
   */
  generatePublicSignals: (
    credential: PublicCredentialData,
    nullifier: string
  ): string[] => {
    initializeTestTrees();

    const credentialTree = testCredentialTree;
    const nullifierTree = testNullifierTree;

    if (!credentialTree || !nullifierTree) {
      throw new Error('Test trees not initialized');
    }

    return [
      credential.holderName,
      credential.licenseNumber,
      credential.examId,
      credential.achievementLevel,
      credential.issuedDate,
      credential.expiryDate,
      credential.issuer,
      nullifier,
      credentialTree.root.toString(),
      nullifierTree.root.toString(),
    ];
  },

  /**
   * Get test credential tree for validation
   */
  getTestCredentialTree: () => {
    initializeTestTrees();
    return testCredentialTree;
  },

  /**
   * Get test nullifier tree for validation
   */
  getTestNullifierTree: () => {
    initializeTestTrees();
    return testNullifierTree;
  },

  /**
   * Validate Merkle proof
   */
  validateMerkleProof: (
    leaf: bigint,
    siblings: string[],
    pathIndices: number[],
    root: bigint
  ): boolean => {
    return validateProof(leaf, siblings, pathIndices, root, TEST_TREE_HEIGHT);
  },

  /**
   * Mock circuit compilation
   */
  mockCompile: async () => ({
    r1cs: 'mock-r1cs',
    wasm: 'mock-wasm',
    sym: 'mock-sym',
  }),

  /**
   * Mock proof generation
   */
  mockGenerateProof: async (): Promise<ProofData> => ({
    proof: {
      pi_a: ['0x1', '0x2', '0x1'],
      pi_b: [
        ['0x3', '0x4'],
        ['0x5', '0x6'],
        ['0x1', '0x0'],
      ],
      pi_c: ['0x7', '0x8', '0x1'],
    },
    publicSignals: [],
  }),

  /**
   * Mock proof verification
   */
  mockVerifyProof: async (
    credential?: PublicCredentialData
  ): Promise<boolean> => {
    // Return false for invalid credentials
    if (
      credential &&
      (credential.credentialId === 'MED-2024-INVALID' ||
        credential.credentialId === 'MED-2020-999999' ||
        credential.credentialId === 'MED-2024-888888' ||
        credential.credentialId === 'MED-2024-777777')
    ) {
      return false;
    }
    return true;
  },
};
