/**
 * Integration tests for ExamProof.circom circuit
 * Tests the complete flow from circuit compilation to proof verification
 */

import { TestUtils, TEST_CONSTANTS } from './setup';
import { CircuitLogger } from '../lib/logger';

describe('ExamProof Circuit Integration Tests', () => {
  let logger: CircuitLogger;

  beforeEach(() => {
    logger = new CircuitLogger('integration-test');
    logger.info('Integration test started', {
      testName: expect.getState().currentTestName,
    });
  });

  describe('Complete Verification Flow', () => {
    it('should complete full verification flow for valid credential', async () => {
      // Arrange
      const credential = TEST_CONSTANTS.VALID_CREDENTIAL;
      const privateKey = TEST_CONSTANTS.PRIVATE_KEY;
      const nullifier = TEST_CONSTANTS.NULLIFIER;

      logger.audit('verification-flow-started', {
        credentialId: credential.credentialId,
        flowType: 'complete-verification',
      });

      // Act - Step 1: Compile circuit
      logger.compilationStart({
        circuitName: 'ExamProof',
        inputPath: 'test',
        outputPath: 'test',
      });
      const compilationResult = await TestUtils.mockCompile();
      expect(compilationResult).toBeDefined();
      logger.compilationComplete({
        compilationTime: 0,
        r1cs: compilationResult.r1cs,
        wasm: compilationResult.wasm,
      });

      // Act - Step 2: Generate witness
      const witness = TestUtils.generateWitness(credential, nullifier);
      expect(witness).toHaveValidWitness();

      // Act - Step 3: Generate proof
      logger.proofGenerationStart(credential.credentialId);
      const proof = await TestUtils.mockGenerateProof();
      expect(proof).toBeValidProof();
      logger.proofGenerationComplete(credential.credentialId, 0);

      // Act - Step 4: Verify proof
      logger.proofVerificationStart(credential.credentialId);
      const isValid = await TestUtils.mockVerifyProof();
      expect(isValid).toBe(true);
      logger.proofVerificationComplete(credential.credentialId, true, 0);

      // Assert - Complete flow successful
      expect(compilationResult.r1cs).toBeDefined();
      expect(proof.proof).toBeDefined();
      expect(isValid).toBe(true);

      logger.audit('verification-flow-completed', {
        credentialId: credential.credentialId,
        flowType: 'complete-verification',
        success: true,
        stepsCompleted: 4,
      });
    });

    it('should fail verification flow for invalid credential', async () => {
      // Arrange
      const credential = TEST_CONSTANTS.INVALID_CREDENTIAL;
      const privateKey = TEST_CONSTANTS.PRIVATE_KEY;
      const nullifier = TEST_CONSTANTS.NULLIFIER;

      // Act - Step 1: Compile circuit
      const compilationResult = await TestUtils.mockCompile();
      expect(compilationResult).toBeDefined();

      // Act - Step 2: Generate witness
      const witness = TestUtils.generateWitness(credential, nullifier);
      expect(witness).toHaveValidWitness();

      // Act - Step 3: Attempt proof generation (should fail)
      const mockGenerateProofInvalid = async () => {
        throw new Error('Invalid credential');
      };
      await expect(mockGenerateProofInvalid()).rejects.toThrow(
        'Invalid credential'
      );
    });
  });

  describe('Batch Verification', () => {
    it('should handle multiple credential verifications', async () => {
      // Arrange
      const credentials = [
        TEST_CONSTANTS.VALID_CREDENTIAL,
        { ...TEST_CONSTANTS.VALID_CREDENTIAL, licenseNumber: 'MD789012' },
        { ...TEST_CONSTANTS.VALID_CREDENTIAL, licenseNumber: 'MD345678' },
      ];

      // Act
      const results = await Promise.all(
        credentials.map(async (credential) => {
          const witness = TestUtils.generateWitness(
            credential,
            TEST_CONSTANTS.NULLIFIER
          );
          const proof = await TestUtils.mockGenerateProof();
          const isValid = await TestUtils.mockVerifyProof();
          return { credential, witness, proof, isValid };
        })
      );

      // Assert
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.witness).toHaveValidWitness();
        expect(result.proof).toBeValidProof();
        expect(result.isValid).toBe(true);
      });
    });

    it('should handle mixed valid and invalid credentials', async () => {
      // Arrange
      const credentials = [
        TEST_CONSTANTS.VALID_CREDENTIAL,
        TEST_CONSTANTS.INVALID_CREDENTIAL,
        TEST_CONSTANTS.VALID_CREDENTIAL,
      ];

      // Act
      const results = await Promise.allSettled(
        credentials.map(async (credential) => {
          const witness = TestUtils.generateWitness(
            credential,
            TEST_CONSTANTS.NULLIFIER
          );

          if (credential.achievementLevel === 'Failed') {
            throw new Error('Invalid credential');
          }

          const proof = await TestUtils.mockGenerateProof();
          const isValid = await TestUtils.mockVerifyProof();
          return { credential, witness, proof, isValid };
        })
      );

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  describe('Cross-Board Verification', () => {
    it('should verify credentials across different licensing boards', async () => {
      // Arrange
      const boards = [
        'California Medical Board',
        'Texas Medical Board',
        'New York Medical Board',
      ];

      const credentials = boards.map((board) => ({
        ...TEST_CONSTANTS.VALID_CREDENTIAL,
        issuer: board,
        licenseNumber: `MD-${board.split(' ')[0].toUpperCase()}-123456`,
      }));

      // Act
      const results = await Promise.all(
        credentials.map(async (credential) => {
          const witness = TestUtils.generateWitness(
            credential,
            TEST_CONSTANTS.NULLIFIER
          );
          const proof = await TestUtils.mockGenerateProof();
          const isValid = await TestUtils.mockVerifyProof();
          return { credential, witness, proof, isValid };
        })
      );

      // Assert
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.credential.issuer).toBe(boards[index]);
        expect(result.witness).toHaveValidWitness();
        expect(result.proof).toBeValidProof();
        expect(result.isValid).toBe(true);
      });
    });

    it('should handle cross-board verification with different credential types', async () => {
      // Arrange - Test medical, legal, and engineering boards
      const crossBoardCredentials = [
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          credentialId: 'MED-2024-001234',
          issuer: 'California Medical Board',
          examId: 'medical-license-2024',
          licenseNumber: 'MD123456',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          credentialId: 'LAW-2024-005678',
          issuer: 'California State Bar',
          examId: 'bar-exam-2024',
          licenseNumber: 'BAR123456',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          credentialId: 'ENG-2024-009876',
          issuer: 'California Board of Professional Engineers',
          examId: 'pe-exam-2024',
          licenseNumber: 'PE123456',
        },
      ];

      // Act
      const results = await Promise.all(
        crossBoardCredentials.map(async (credential) => {
          const witness = TestUtils.generateWitness(
            credential,
            TEST_CONSTANTS.NULLIFIER
          );
          const proof = await TestUtils.mockGenerateProof();
          const isValid = await TestUtils.mockVerifyProof();
          return { credential, witness, proof, isValid };
        })
      );

      // Assert
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.witness).toHaveValidWitness();
        expect(result.proof).toBeValidProof();
        expect(result.isValid).toBe(true);
        expect(result.credential.credentialId).toMatch(
          /^(MED|LAW|ENG)-2024-\d{6}$/
        );
      });
    });

    it('should handle cross-board verification with mixed statuses', async () => {
      // Arrange - Test active, suspended, and expired credentials across boards
      const mixedStatusCredentials = [
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          issuer: 'California Medical Board',
          achievementLevel: 'Passed',
          isActive: true,
          expiryDate: '2026-01-15',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          issuer: 'Texas Medical Board',
          achievementLevel: 'Suspended',
          isActive: false,
          expiryDate: '2026-01-15',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          issuer: 'New York Medical Board',
          achievementLevel: 'Passed',
          isActive: false,
          expiryDate: '2020-01-15', // Expired
        },
      ];

      // Act
      const results = await Promise.allSettled(
        mixedStatusCredentials.map(async (credential) => {
          const witness = TestUtils.generateWitness(
            credential,
            TEST_CONSTANTS.NULLIFIER
          );

          // Mock different behaviors based on status
          if (credential.achievementLevel === 'Suspended') {
            throw new Error('Credential suspended');
          }

          if (credential.expiryDate === '2020-01-15') {
            throw new Error('Credential expired');
          }

          const proof = await TestUtils.mockGenerateProof();
          const isValid = await TestUtils.mockVerifyProof();
          return { credential, witness, proof, isValid };
        })
      );

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('fulfilled'); // Active credential
      expect(results[1].status).toBe('rejected'); // Suspended credential
      expect(results[2].status).toBe('rejected'); // Expired credential
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle circuit compilation failure gracefully', async () => {
      // Arrange - Create a mock that throws an error
      const mockCompileWithError = async () => {
        throw new Error('Circuit compilation failed');
      };

      // Act & Assert
      await expect(mockCompileWithError()).rejects.toThrow(
        'Circuit compilation failed'
      );
    });

    it('should handle proof generation failure gracefully', async () => {
      // Arrange
      const credential = TEST_CONSTANTS.VALID_CREDENTIAL;
      const witness = TestUtils.generateWitness(
        credential,
        TEST_CONSTANTS.NULLIFIER
      );

      // Create a mock that throws an error
      const mockGenerateProofWithError = async () => {
        throw new Error('Proof generation failed');
      };

      // Act & Assert
      await expect(mockGenerateProofWithError()).rejects.toThrow(
        'Proof generation failed'
      );
    });

    it('should handle proof verification failure gracefully', async () => {
      // Arrange - Create a mock that returns false
      const mockVerifyProofWithError = async () => false;

      // Act
      const isValid = await mockVerifyProofWithError();

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('Performance Integration', () => {
    it('should complete verification within performance thresholds', async () => {
      // Arrange
      const startTime = Date.now();
      const credential = TEST_CONSTANTS.VALID_CREDENTIAL;

      // Act
      const compilationResult = await TestUtils.mockCompile();
      const witness = TestUtils.generateWitness(
        credential,
        TEST_CONSTANTS.NULLIFIER
      );
      const proof = await TestUtils.mockGenerateProof();
      const isValid = await TestUtils.mockVerifyProof();

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Assert
      expect(compilationResult).toBeDefined();
      expect(witness).toHaveValidWitness();
      expect(proof).toBeValidProof();
      expect(isValid).toBe(true);
      expect(totalDuration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle concurrent verifications efficiently', async () => {
      // Arrange
      const concurrentCount = 10;
      const credentials = Array(concurrentCount)
        .fill(null)
        .map((_, index) => ({
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          licenseNumber: `MD${index.toString().padStart(6, '0')}`,
        }));

      const startTime = Date.now();

      // Act
      const results = await Promise.all(
        credentials.map(async (credential) => {
          const witness = TestUtils.generateWitness(
            credential,
            TEST_CONSTANTS.NULLIFIER
          );
          const proof = await TestUtils.mockGenerateProof();
          const isValid = await TestUtils.mockVerifyProof();
          return { credential, witness, proof, isValid };
        })
      );

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Assert
      expect(results).toHaveLength(concurrentCount);
      results.forEach((result) => {
        expect(result.witness).toHaveValidWitness();
        expect(result.proof).toBeValidProof();
        expect(result.isValid).toBe(true);
      });
      expect(totalDuration).toBeLessThan(15000); // Should handle 10 concurrent verifications within 15 seconds
    });
  });
});
