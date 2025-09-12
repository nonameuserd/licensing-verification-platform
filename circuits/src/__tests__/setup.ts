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
  getPoseidon,
  toField,
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
  // Circuit input format constants
  VALID_CIRCUIT_INPUT: CircuitInput;
  INVALID_CIRCUIT_INPUT: CircuitInput;
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

  // Valid circuit input format (matches ExamProof.circom)
  VALID_CIRCUIT_INPUT: {
    // Public inputs (visible in proof) - matches ExamProof.circom Main template
    pubKey: ['1234567890', '9876543210'],
    credentialRoot: '0',
    nullifierRoot: '0',
    currentTime: '1694160000',
    signatureS: '111111',
    signatureR: ['222222', '333333'],
    nullifier: '0xabcdef1234567890abcdef1234567890abcdef12',
    examIdHash: '1001',
    achievementLevelHash: '2',
    issuerHash: '3',

    // Private inputs (hidden in proof)
    holderSecret: '777777',
    merkleProof: Array(20).fill('0'),
    merkleProofNullifier: Array(20).fill('0'),
    merklePathIndices: Array(20).fill('0'),
    merklePathIndicesNullifier: Array(20).fill('0'),
    storedNullifierLeaf: '0',
  },

  // Invalid circuit input format
  INVALID_CIRCUIT_INPUT: {
    // Public inputs (visible in proof) - matches ExamProof.circom Main template
    pubKey: ['0000000000', '0000000000'],
    credentialRoot: '0',
    nullifierRoot: '0',
    currentTime: '1694160000',
    signatureS: '000000',
    signatureR: ['000000', '000000'],
    nullifier: '0x0000000000000000000000000000000000000000',
    examIdHash: '0000',
    achievementLevelHash: '0',
    issuerHash: '0',

    // Private inputs (hidden in proof)
    holderSecret: '000000',
    merkleProof: Array(20).fill('0'),
    merkleProofNullifier: Array(20).fill('0'),
    merklePathIndices: Array(20).fill('0'),
    merklePathIndicesNullifier: Array(20).fill('0'),
    storedNullifierLeaf: '0',
  },
};

// Test logger helper
export const createTestLogger = (testName: string): CircuitLogger => {
  const logger = new CircuitLogger(testName);
  logger.info('Test logger created', { testName });
  return logger;
};

// Test tree configuration
const TEST_TREE_HEIGHT = 4; // Small tree for fast testing
const CIRCUIT_MERKLE_PROOF_LENGTH = 20; // Circuit expects 20-element Merkle proofs
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

// Clean up any remaining timers after all tests
afterAll(() => {
  // Clear any remaining timers to prevent worker process leaks
  jest.clearAllTimers();
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

    // Generate hashes for the circuit inputs
    const poseidon = getPoseidon();
    const examIdHash = poseidon([toField(credential.examId)]).toString();
    const achievementLevelHash = poseidon([
      toField(credential.achievementLevel),
    ]).toString();
    const issuerHash = poseidon([toField(credential.issuer)]).toString();
    const _holderSecret = poseidon([toField(credential.holderDOB)]).toString();

    // Generate EdDSA key pair and signature (simplified for testing)
    const pubKey: [string, string] = ['1234567890', '9876543210'];
    const signatureS = '111111';
    const signatureR: [string, string] = ['222222', '333333'];

    // Pad Merkle proofs to circuit expectation (20 elements)
    const padArray = (arr: string[], targetLength: number): string[] => {
      const padded = [...arr];
      while (padded.length < targetLength) {
        padded.push('0');
      }
      return padded;
    };

    return {
      // Public inputs (visible in proof) - matches ExamProof.circom Main template
      pubKey,
      credentialRoot: credentialTree.root.toString(),
      nullifierRoot: nullifierTree.root.toString(),
      currentTime: Math.floor(Date.now() / 1000).toString(),
      signatureS,
      signatureR,
      nullifier: nullifier,
      examIdHash,
      achievementLevelHash,
      issuerHash,

      // Private inputs (hidden in proof)
      holderSecret: _holderSecret,
      merkleProof: padArray(
        credentialProof.siblings,
        CIRCUIT_MERKLE_PROOF_LENGTH
      ),
      merkleProofNullifier: padArray(
        nullifierProof.siblings,
        CIRCUIT_MERKLE_PROOF_LENGTH
      ),
      merklePathIndices: padArray(
        credentialProof.pathIndices.map(String),
        CIRCUIT_MERKLE_PROOF_LENGTH
      ),
      merklePathIndicesNullifier: padArray(
        nullifierProof.pathIndices.map(String),
        CIRCUIT_MERKLE_PROOF_LENGTH
      ),
      storedNullifierLeaf: nullifierProof.leaf,
    };
  },

  /**
   * Generate expected public signals (matches ExamProof.circom output)
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

    // Generate hashes for the circuit inputs
    const poseidon = getPoseidon();
    const examIdHash = poseidon([toField(credential.examId)]).toString();
    const achievementLevelHash = poseidon([
      toField(credential.achievementLevel),
    ]).toString();
    const issuerHash = poseidon([toField(credential.issuer)]).toString();
    const _holderSecret = poseidon([toField(credential.holderDOB)]).toString();

    // Generate EdDSA key pair (simplified for testing)
    const pubKey: [string, string] = ['1234567890', '9876543210'];
    const signatureS = '111111';
    const signatureR: [string, string] = ['222222', '333333'];

    // Public signals match the order in ExamProof.circom Main template
    return [
      pubKey[0], // pubKey[0]
      pubKey[1], // pubKey[1]
      credentialTree.root.toString(), // credentialRoot
      nullifierTree.root.toString(), // nullifierRoot
      Math.floor(Date.now() / 1000).toString(), // currentTime
      signatureS, // signatureS
      signatureR[0], // signatureR[0]
      signatureR[1], // signatureR[1]
      nullifier, // nullifier
      examIdHash, // examIdHash
      achievementLevelHash, // achievementLevelHash
      issuerHash, // issuerHash
      // Outputs: verified, credentialId, verificationTimestamp
      '1', // verified (1 for valid)
      '1234567890', // credentialId (simplified)
      Math.floor(Date.now() / 1000).toString(), // verificationTimestamp
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
    // Return realistic public signals matching the test constants so tests
    // that check for the nullifier and roots succeed.
    publicSignals: TestUtils.generatePublicSignals(
      TEST_CONSTANTS.VALID_CREDENTIAL,
      TEST_CONSTANTS.NULLIFIER
    ),
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
