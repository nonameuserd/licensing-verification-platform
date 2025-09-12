/**
 * Unit tests for proof-utils.ts
 * Tests ExamProofCircuit class and proof generation/verification
 */

import {
  ExamProofCircuit,
  examProofCircuit,
  Proof,
  ProofResult,
  Witness,
  VerificationResult,
} from '../lib/proof-utils';
import { PublicCredentialData } from '../lib/types';
import { CircuitLogger } from '../lib/logger';

// Mock the logger to avoid console output during tests
jest.mock('../lib/logger', () => ({
  CircuitLogger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  })),
}));

// Mock verification-utils
jest.mock('../lib/verification-utils', () => ({
  validateCredential: jest.fn(),
}));

import { validateCredential } from '../lib/verification-utils';

const mockValidateCredential = validateCredential as jest.MockedFunction<
  typeof validateCredential
>;

describe('ExamProofCircuit', () => {
  let circuit: ExamProofCircuit;
  let validCredential: PublicCredentialData;
  let invalidCredential: PublicCredentialData;

  beforeEach(() => {
    circuit = new ExamProofCircuit();

    validCredential = {
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
    };

    invalidCredential = {
      ...validCredential,
      achievementLevel: 'Failed',
      isActive: false,
    };

    jest.clearAllMocks();
  });

  describe('verifyCredential', () => {
    it('should verify valid credential successfully', async () => {
      const nullifier = '0xabcdef1234567890abcdef1234567890abcdef12';
      const privateKey = '0x1234567890abcdef1234567890abcdef1234567890';

      mockValidateCredential.mockReturnValue({
        valid: true,
        errors: [],
      });

      const result = await circuit.verifyCredential(
        validCredential,
        nullifier,
        privateKey
      );

      expect(result.verified).toBe(true);
      expect(result.credential).toEqual(validCredential);
      expect(result.error).toBeUndefined();
      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('string');
    });

    it('should reject invalid credential due to validation failure', async () => {
      const nullifier = '0xabcdef1234567890abcdef1234567890abcdef12';
      const privateKey = '0x1234567890abcdef1234567890abcdef1234567890';

      mockValidateCredential.mockReturnValue({
        valid: false,
        errors: ['Invalid achievement level', 'Credential has expired'],
      });

      const result = await circuit.verifyCredential(
        invalidCredential,
        nullifier,
        privateKey
      );

      expect(result.verified).toBe(false);
      expect(result.credential).toBeUndefined();
      expect(result.error).toBe(
        'Credential validation failed: Invalid achievement level, Credential has expired'
      );
      expect(result.timestamp).toBeDefined();
    });

    it('should handle validation errors gracefully', async () => {
      const nullifier = '0xabcdef1234567890abcdef1234567890abcdef12';
      const privateKey = '0x1234567890abcdef1234567890abcdef1234567890';

      mockValidateCredential.mockImplementation(() => {
        throw new Error('Validation system error');
      });

      const result = await circuit.verifyCredential(
        validCredential,
        nullifier,
        privateKey
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Verification failed: Validation system error');
      expect(result.timestamp).toBeDefined();
    });

    it('should handle proof generation errors', async () => {
      const nullifier = '0xabcdef1234567890abcdef1234567890abcdef12';
      const privateKey = '0x1234567890abcdef1234567890abcdef1234567890';

      mockValidateCredential.mockReturnValue({
        valid: true,
        errors: [],
      });

      // Mock the private methods to throw an error
      const originalGenerateProof = (circuit as any).generateProof;
      (circuit as any).generateProof = jest
        .fn()
        .mockRejectedValue(new Error('Proof generation failed'));

      const result = await circuit.verifyCredential(
        validCredential,
        nullifier,
        privateKey
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Verification failed: Proof generation failed');

      // Restore original method
      (circuit as any).generateProof = originalGenerateProof;
    });

    it('should handle proof verification errors', async () => {
      const nullifier = '0xabcdef1234567890abcdef1234567890abcdef12';
      const privateKey = '0x1234567890abcdef1234567890abcdef1234567890';

      mockValidateCredential.mockReturnValue({
        valid: true,
        errors: [],
      });

      // Mock the private methods
      const originalGenerateProof = (circuit as any).generateProof;
      const originalVerifyProof = (circuit as any).verifyProof;

      (circuit as any).generateProof = jest.fn().mockResolvedValue({
        proof: { pi_a: ['0x1'], pi_b: [['0x2']], pi_c: ['0x3'] },
        publicSignals: ['signal1', 'signal2'],
      });
      (circuit as any).verifyProof = jest
        .fn()
        .mockRejectedValue(new Error('Proof verification failed'));

      const result = await circuit.verifyCredential(
        validCredential,
        nullifier,
        privateKey
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBe(
        'Verification failed: Proof verification failed'
      );

      // Restore original methods
      (circuit as any).generateProof = originalGenerateProof;
      (circuit as any).verifyProof = originalVerifyProof;
    });

    it('should handle missing nullifier', async () => {
      const nullifier = '';
      const privateKey = '0x1234567890abcdef1234567890abcdef1234567890';

      mockValidateCredential.mockReturnValue({
        valid: true,
        errors: [],
      });

      const result = await circuit.verifyCredential(
        validCredential,
        nullifier,
        privateKey
      );

      expect(result.verified).toBe(true);
      expect(result.credential).toEqual(validCredential);
    });

    it('should handle missing private key', async () => {
      const nullifier = '0xabcdef1234567890abcdef1234567890abcdef12';
      const privateKey = '';

      mockValidateCredential.mockReturnValue({
        valid: true,
        errors: [],
      });

      const result = await circuit.verifyCredential(
        validCredential,
        nullifier,
        privateKey
      );

      expect(result.verified).toBe(true);
      expect(result.credential).toEqual(validCredential);
    });
  });

  describe('generateWitness (private method)', () => {
    it('should generate witness with all credential fields', () => {
      const nullifier = '0xabcdef1234567890abcdef1234567890abcdef12';
      const privateKey = '0x1234567890abcdef1234567890abcdef1234567890';

      const witness = (circuit as any).generateWitness(
        validCredential,
        nullifier,
        privateKey
      );

      expect(witness).toEqual({
        holderName: validCredential.holderName,
        licenseNumber: validCredential.licenseNumber,
        examId: validCredential.examId,
        achievementLevel: validCredential.achievementLevel,
        issuedDate: validCredential.issuedDate,
        expiryDate: validCredential.expiryDate,
        issuer: validCredential.issuer,
        nullifier: nullifier,
        holderDOB: validCredential.holderDOB,
        privateKey: privateKey,
      });
    });

    it('should handle empty credential fields', () => {
      const emptyCredential: PublicCredentialData = {
        credentialId: '',
        holderName: '',
        licenseNumber: '',
        examId: '',
        achievementLevel: '',
        issuedDate: '',
        expiryDate: '',
        issuer: '',
        holderDOB: '',
        proofHash: '',
        isActive: false,
        createdAt: '',
        updatedAt: '',
      };

      const nullifier = '0xabcdef1234567890abcdef1234567890abcdef12';
      const privateKey = '0x1234567890abcdef1234567890abcdef1234567890';

      const witness = (circuit as any).generateWitness(
        emptyCredential,
        nullifier,
        privateKey
      );

      expect(witness.holderName).toBe('');
      expect(witness.licenseNumber).toBe('');
      expect(witness.examId).toBe('');
      expect(witness.achievementLevel).toBe('');
      expect(witness.issuedDate).toBe('');
      expect(witness.expiryDate).toBe('');
      expect(witness.issuer).toBe('');
      expect(witness.holderDOB).toBe('');
      expect(witness.nullifier).toBe(nullifier);
      expect(witness.privateKey).toBe(privateKey);
    });
  });

  describe('generateProof (private method)', () => {
    it('should generate proof with correct structure', async () => {
      const witness: Witness = {
        holderName: 'Dr. John Smith',
        licenseNumber: 'MD123456',
        examId: 'medical-license-2024',
        achievementLevel: 'Passed',
        issuedDate: '2024-01-15',
        expiryDate: '2026-01-15',
        issuer: 'California Medical Board',
        nullifier: '0xabcdef1234567890abcdef1234567890abcdef12',
        holderDOB: '1980-05-15',
        privateKey: '0x1234567890abcdef1234567890abcdef1234567890',
      };

      const result = await (circuit as any).generateProof(witness);

      expect(result).toHaveProperty('proof');
      expect(result).toHaveProperty('publicSignals');
      expect(result.proof).toHaveProperty('pi_a');
      expect(result.proof).toHaveProperty('pi_b');
      expect(result.proof).toHaveProperty('pi_c');
      expect(Array.isArray(result.publicSignals)).toBe(true);
      expect(result.publicSignals).toHaveLength(8);
    });

    it('should include witness data in public signals', async () => {
      const witness: Witness = {
        holderName: 'Dr. Jane Doe',
        licenseNumber: 'MD789012',
        examId: 'medical-license-2024',
        achievementLevel: 'Passed',
        issuedDate: '2024-02-01',
        expiryDate: '2026-02-01',
        issuer: 'Texas Medical Board',
        nullifier: '0xfedcba0987654321fedcba0987654321fedcba09',
        holderDOB: '1985-03-20',
        privateKey: '0xfedcba0987654321fedcba0987654321fedcba09',
      };

      const result = await (circuit as any).generateProof(witness);

      expect(result.publicSignals[0]).toBe(witness.holderName);
      expect(result.publicSignals[1]).toBe(witness.licenseNumber);
      expect(result.publicSignals[2]).toBe(witness.examId);
      expect(result.publicSignals[3]).toBe(witness.achievementLevel);
      expect(result.publicSignals[4]).toBe(witness.issuedDate);
      expect(result.publicSignals[5]).toBe(witness.expiryDate);
      expect(result.publicSignals[6]).toBe(witness.issuer);
      expect(result.publicSignals[7]).toBe(witness.nullifier);
    });
  });

  describe('verifyProof (private method)', () => {
    it('should verify valid proof', async () => {
      const validProof: ProofResult = {
        proof: {
          pi_a: ['0x1', '0x2', '0x1'],
          pi_b: [
            ['0x3', '0x4'],
            ['0x5', '0x6'],
            ['0x1', '0x0'],
          ],
          pi_c: ['0x7', '0x8', '0x1'],
        },
        publicSignals: ['signal1', 'signal2', 'signal3'],
      };

      const result = await (circuit as any).verifyProof(validProof);

      expect(result).toBe(true);
    });

    it('should reject proof with missing proof object', async () => {
      const invalidProof = {
        publicSignals: ['signal1', 'signal2'],
      } as ProofResult;

      const result = await (circuit as any).verifyProof(invalidProof);

      expect(result).toBe(false);
    });

    it('should reject proof with missing public signals', async () => {
      const invalidProof = {
        proof: {
          pi_a: ['0x1'],
          pi_b: [['0x2']],
          pi_c: ['0x3'],
        },
        publicSignals: [],
      };

      const result = await (circuit as any).verifyProof(invalidProof);

      expect(result).toBe(false);
    });

    it('should reject null proof', async () => {
      const result = await (circuit as any).verifyProof(null);

      expect(result).toBe(false);
    });

    it('should reject undefined proof', async () => {
      const result = await (circuit as any).verifyProof(undefined);

      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long credential data', async () => {
      const longCredential: PublicCredentialData = {
        ...validCredential,
        holderName: 'A'.repeat(1000),
        licenseNumber: 'B'.repeat(1000),
        examId: 'C'.repeat(1000),
        issuer: 'D'.repeat(1000),
      };

      const nullifier = '0xabcdef1234567890abcdef1234567890abcdef12';
      const privateKey = '0x1234567890abcdef1234567890abcdef1234567890';

      mockValidateCredential.mockReturnValue({
        valid: true,
        errors: [],
      });

      const result = await circuit.verifyCredential(
        longCredential,
        nullifier,
        privateKey
      );

      expect(result.verified).toBe(true);
    });

    it('should handle special characters in credential data', async () => {
      const specialCredential: PublicCredentialData = {
        ...validCredential,
        holderName: 'Dr. José María García-López',
        licenseNumber: 'MD-123-456',
        examId: 'medical-license-2024-ñ',
        issuer: 'California Medical Board (San Francisco)',
      };

      const nullifier = '0xabcdef1234567890abcdef1234567890abcdef12';
      const privateKey = '0x1234567890abcdef1234567890abcdef1234567890';

      mockValidateCredential.mockReturnValue({
        valid: true,
        errors: [],
      });

      const result = await circuit.verifyCredential(
        specialCredential,
        nullifier,
        privateKey
      );

      expect(result.verified).toBe(true);
    });

    it('should handle concurrent verification requests', async () => {
      const nullifier = '0xabcdef1234567890abcdef1234567890abcdef12';
      const privateKey = '0x1234567890abcdef1234567890abcdef1234567890';

      mockValidateCredential.mockReturnValue({
        valid: true,
        errors: [],
      });

      const promises = Array(10)
        .fill(null)
        .map(() =>
          circuit.verifyCredential(validCredential, nullifier, privateKey)
        );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result.verified).toBe(true);
        expect(result.credential).toEqual(validCredential);
      });
    });
  });
});

describe('examProofCircuit (default instance)', () => {
  it('should be an instance of ExamProofCircuit', () => {
    expect(examProofCircuit).toBeInstanceOf(ExamProofCircuit);
  });

  it('should be a singleton instance', () => {
    const { examProofCircuit: anotherInstance } = require('../lib/proof-utils');
    expect(examProofCircuit).toBe(anotherInstance);
  });
});

describe('Type Definitions', () => {
  it('should have correct Proof interface structure', () => {
    const proof: Proof = {
      pi_a: ['0x1', '0x2', '0x1'],
      pi_b: [
        ['0x3', '0x4'],
        ['0x5', '0x6'],
        ['0x1', '0x0'],
      ],
      pi_c: ['0x7', '0x8', '0x1'],
    };

    expect(proof.pi_a).toHaveLength(3);
    expect(proof.pi_b).toHaveLength(3);
    expect(proof.pi_c).toHaveLength(3);
    expect(Array.isArray(proof.pi_b[0])).toBe(true);
  });

  it('should have correct ProofResult interface structure', () => {
    const proofResult: ProofResult = {
      proof: {
        pi_a: ['0x1'],
        pi_b: [['0x2']],
        pi_c: ['0x3'],
      },
      publicSignals: ['signal1', 'signal2'],
    };

    expect(proofResult.proof).toBeDefined();
    expect(Array.isArray(proofResult.publicSignals)).toBe(true);
  });

  it('should have correct VerificationResult interface structure', () => {
    const verificationResult: VerificationResult = {
      verified: true,
      credential: {
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
      timestamp: '2024-01-15T10:00:00Z',
    };

    expect(verificationResult.verified).toBe(true);
    expect(verificationResult.credential).toBeDefined();
    expect(verificationResult.timestamp).toBeDefined();
  });
});
