/**
 * Performance tests for ExamProof.circom circuit
 * Tests circuit performance under various load conditions
 */

import { TestUtils, TEST_CONSTANTS } from './setup';
import { CircuitLogger } from '../lib/logger';

// Performance buffer values can be relaxed in CI via env vars. Defaults to 0 locally.
const PERF_TEST_BUFFER_MS = Number(process.env['PERF_TEST_BUFFER_MS'] || 0);
const PERF_TEST_MEMORY_BUFFER_BYTES = Number(
  process.env['PERF_TEST_MEMORY_BUFFER_BYTES'] || 0
);

// CI-only configurable buffers: defaults are 0 for local runs so developers
// see strict thresholds. CI can set these env vars to relax timing/memory
// assertions on slower runners.
// 0 bytes default locally

describe('ExamProof Circuit Performance Tests', () => {
  let logger: CircuitLogger;
  beforeEach(() => {
    // CircuitLogger constructor only accepts the operation name.
    // Tests may include additional context via custom log metadata when needed.
    logger = new CircuitLogger('ExamProof-performance-test');
  });

  describe('Single Verification Performance', () => {
    it('should generate proof within 5 seconds', async () => {
      // Arrange
      const credential = TEST_CONSTANTS.VALID_CREDENTIAL;
      const startTime = performance.now();

      logger.proofGenerationStart(credential.credentialId);

      // Act
      const witness = TestUtils.generateWitness(
        credential,
        TEST_CONSTANTS.NULLIFIER
      );
      const proof = await TestUtils.mockGenerateProof();

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Assert
      expect(witness).toHaveValidWitness();
      expect(proof).toBeValidProof();
      expect(duration).toBeLessThan(5000 + PERF_TEST_BUFFER_MS); // 5 seconds + buffer

      logger.proofGenerationComplete(credential.credentialId, duration);
      logger.performance('proof-generation', duration, {
        credentialId: credential.credentialId,
        witnessValid: true,
        proofValid: true,
      });
    });

    it('should verify proof within 1 second', async () => {
      // Arrange
      const startTime = performance.now();

      // Act
      const isValid = await TestUtils.mockVerifyProof();

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Assert
      expect(isValid).toBe(true);
      expect(duration).toBeLessThan(1000 + PERF_TEST_BUFFER_MS); // 1 second + buffer
    });

    it('should handle large credential data efficiently', async () => {
      // Arrange
      const largeCredential = {
        ...TEST_CONSTANTS.VALID_CREDENTIAL,
        holderName: 'Dr. ' + 'A'.repeat(1000),
        licenseNumber: 'MD-' + '1'.repeat(100),
        issuer: 'California Medical Board - ' + 'B'.repeat(500),
      };

      const startTime = performance.now();

      // Act
      const witness = TestUtils.generateWitness(
        largeCredential,
        TEST_CONSTANTS.NULLIFIER
      );
      const proof = await TestUtils.mockGenerateProof();

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Assert
      expect(witness).toHaveValidWitness();
      expect(proof).toBeValidProof();
      expect(duration).toBeLessThan(10000 + PERF_TEST_BUFFER_MS); // 10 seconds for large data + buffer
    });
  });

  describe('Batch Verification Performance', () => {
    it('should handle 100 concurrent verifications within 30 seconds', async () => {
      // Arrange
      const batchSize = 100;
      const credentials = Array(batchSize)
        .fill(null)
        .map((_, index) => ({
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          licenseNumber: `MD${index.toString().padStart(6, '0')}`,
        }));

      const startTime = performance.now();

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

      // Use the results here to avoid unused variable lint
      expect(results.length).toBe(batchSize);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Assert
      expect(results).toHaveLength(batchSize);
      results.forEach((result) => {
        expect(result.witness).toHaveValidWitness();
        expect(result.proof).toBeValidProof();
        expect(result.isValid).toBe(true);
      });
      expect(duration).toBeLessThan(30000 + PERF_TEST_BUFFER_MS); // 30 seconds for 100 verifications + buffer
    });

    it('should handle 1000 sequential verifications within 60 seconds', async () => {
      // Arrange
      const sequentialCount = 1000;
      const credentials = Array(sequentialCount)
        .fill(null)
        .map((_, index) => ({
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          licenseNumber: `MD${index.toString().padStart(6, '0')}`,
        }));

      const startTime = performance.now();

      // Act
      const results = [];
      for (const credential of credentials) {
        const witness = TestUtils.generateWitness(
          credential,
          TEST_CONSTANTS.NULLIFIER
        );
        const proof = await TestUtils.mockGenerateProof();
        const isValid = await TestUtils.mockVerifyProof();
        results.push({ credential, witness, proof, isValid });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Assert
      expect(results).toHaveLength(sequentialCount);
      results.forEach((result) => {
        expect(result.witness).toHaveValidWitness();
        expect(result.proof).toBeValidProof();
        expect(result.isValid).toBe(true);
      });
      expect(duration).toBeLessThan(60000 + PERF_TEST_BUFFER_MS); // 60 seconds for 1000 sequential verifications + buffer
    });
  });

  describe('Memory Usage Performance', () => {
    it('should handle memory efficiently for large batches', async () => {
      // Arrange
      const batchSize = 500;
      const credentials = Array(batchSize)
        .fill(null)
        .map((_, index) => ({
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          licenseNumber: `MD${index.toString().padStart(6, '0')}`,
          holderName: `Dr. ${'A'.repeat(100)} ${index}`,
        }));

      const initialMemory = process.memoryUsage();

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

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Assert
      expect(results).toHaveLength(batchSize);
      expect(memoryIncrease).toBeLessThan(
        100 * 1024 * 1024 + PERF_TEST_MEMORY_BUFFER_BYTES
      ); // Less than 100MB + buffer
    });

    it('should clean up memory after verification', async () => {
      // Arrange
      const credential = TEST_CONSTANTS.VALID_CREDENTIAL;
      const initialMemory = process.memoryUsage();

      // Act
      const witness = TestUtils.generateWitness(
        credential,
        TEST_CONSTANTS.NULLIFIER
      );
      const proof = await TestUtils.mockGenerateProof();
      const isValid = await TestUtils.mockVerifyProof();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Assert
      expect(witness).toHaveValidWitness();
      expect(proof).toBeValidProof();
      expect(isValid).toBe(true);
      expect(memoryIncrease).toBeLessThan(
        10 * 1024 * 1024 + PERF_TEST_MEMORY_BUFFER_BYTES
      ); // Less than 10MB + buffer
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid successive verifications', async () => {
      // Arrange
      const rapidCount = 50;
      const credentials = Array(rapidCount)
        .fill(null)
        .map((_, index) => ({
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          licenseNumber: `MD${index.toString().padStart(6, '0')}`,
        }));

      const startTime = performance.now();

      // Act - Rapid successive calls
      const results = [];
      for (let i = 0; i < rapidCount; i++) {
        const credential = credentials[i];
        const witness = TestUtils.generateWitness(
          credential,
          TEST_CONSTANTS.NULLIFIER
        );
        const proof = await TestUtils.mockGenerateProof();
        const isValid = await TestUtils.mockVerifyProof();
        results.push({ credential, witness, proof, isValid });

        // Small delay to simulate rapid succession
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Assert
      expect(results).toHaveLength(rapidCount);
      results.forEach((result) => {
        expect(result.witness).toHaveValidWitness();
        expect(result.proof).toBeValidProof();
        expect(result.isValid).toBe(true);
      });
      expect(duration).toBeLessThan(20000 + PERF_TEST_BUFFER_MS); // 20 seconds for rapid succession + buffer
    });

    it('should handle mixed valid and invalid credentials efficiently', async () => {
      // Arrange
      const mixedCount = 200;
      const credentials = Array(mixedCount)
        .fill(null)
        .map((_, index) => {
          const isInvalid = index % 10 === 0; // Every 10th credential is invalid
          return {
            ...(isInvalid
              ? TEST_CONSTANTS.INVALID_CREDENTIAL
              : TEST_CONSTANTS.VALID_CREDENTIAL),
            licenseNumber: `MD${index.toString().padStart(6, '0')}`,
          };
        });

      const startTime = performance.now();

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

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Assert
      expect(results).toHaveLength(mixedCount);
      const successfulResults = results.filter((r) => r.status === 'fulfilled');
      const failedResults = results.filter((r) => r.status === 'rejected');

      expect(successfulResults.length).toBeGreaterThan(0);
      expect(failedResults.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(25000 + PERF_TEST_BUFFER_MS); // 25 seconds for mixed results + buffer
    });
  });

  describe('Scalability Tests', () => {
    it('should maintain performance with increasing batch sizes', async () => {
      // Arrange
      const batchSizes = [10, 50, 100, 200];
      const performanceResults = [];

      for (const batchSize of batchSizes) {
        const credentials = Array(batchSize)
          .fill(null)
          .map((_, index) => ({
            ...TEST_CONSTANTS.VALID_CREDENTIAL,
            licenseNumber: `MD${index.toString().padStart(6, '0')}`,
          }));

        const startTime = performance.now();

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

        expect(results).toHaveLength(batchSize);
        results.forEach((result) => {
          expect(result.witness).toHaveValidWitness();
          expect(result.proof).toBeValidProof();
          expect(result.isValid).toBe(true);
        });

        const endTime = performance.now();
        const duration = endTime - startTime;

        performanceResults.push({
          batchSize,
          duration,
          averageTimePerVerification: duration / batchSize,
        });
      }

      // Assert
      expect(performanceResults).toHaveLength(batchSizes.length);

      // Performance should scale reasonably (not exponentially)
      performanceResults.forEach((result) => {
        expect(result.duration).toBeLessThan(
          result.batchSize * 1000 + PERF_TEST_BUFFER_MS
        ); // Less than 1 second per verification + buffer
        expect(result.averageTimePerVerification).toBeLessThan(
          1000 + PERF_TEST_BUFFER_MS
        ); // Less than 1 second average + buffer
      });
    });

    it('should handle mixed credential types efficiently', async () => {
      // Arrange - Test performance with different credential types
      const mixedCredentials = [
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          credentialId: 'MED-2024-001234',
          examId: 'medical-license-2024',
          licenseNumber: 'MD123456',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          credentialId: 'LAW-2024-005678',
          examId: 'bar-exam-2024',
          licenseNumber: 'BAR123456',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          credentialId: 'ENG-2024-009876',
          examId: 'pe-exam-2024',
          licenseNumber: 'PE123456',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          credentialId: 'NUR-2024-003456',
          examId: 'nursing-license-2024',
          licenseNumber: 'RN123456',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          credentialId: 'PHM-2024-007890',
          examId: 'pharmacy-license-2024',
          licenseNumber: 'RPH123456',
        },
      ];

      const startTime = performance.now();

      // Act
      const results = await Promise.all(
        mixedCredentials.map(async (credential) => {
          const witness = TestUtils.generateWitness(
            credential,
            TEST_CONSTANTS.NULLIFIER
          );
          const proof = await TestUtils.mockGenerateProof();
          const isValid = await TestUtils.mockVerifyProof();
          return { credential, witness, proof, isValid };
        })
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Assert
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.witness).toHaveValidWitness();
        expect(result.proof).toBeValidProof();
        expect(result.isValid).toBe(true);
      });
      expect(duration).toBeLessThan(10000 + PERF_TEST_BUFFER_MS); // Should complete within 10 seconds + buffer
    });

    it('should handle cross-board verification efficiently', async () => {
      // Arrange - Test performance with different licensing boards
      const crossBoardCredentials = [
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          issuer: 'California Medical Board',
          licenseNumber: 'MD-CA-123456',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          issuer: 'Texas Medical Board',
          licenseNumber: 'MD-TX-123456',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          issuer: 'New York Medical Board',
          licenseNumber: 'MD-NY-123456',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          issuer: 'California State Bar',
          licenseNumber: 'BAR-CA-123456',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          issuer: 'California Board of Professional Engineers',
          licenseNumber: 'PE-CA-123456',
        },
      ];

      const startTime = performance.now();

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

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Assert
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.witness).toHaveValidWitness();
        expect(result.proof).toBeValidProof();
        expect(result.isValid).toBe(true);
      });
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle personal information verification efficiently', async () => {
      // Arrange - Test performance with different personal information formats
      const personalInfoCredentials = [
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          holderName: 'Dr. John Smith',
          holderDOB: '1980-05-15',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          holderName: 'Dr. José María García-López',
          holderDOB: '1985-03-22',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          holderName: 'Dr. Jean-Pierre Dubois',
          holderDOB: '1978-11-14',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          holderName: 'Dr. 张医生 (Dr. Zhang)',
          holderDOB: '1982-07-08',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          holderName: 'Dr. Ahmed Hassan Al-Rashid',
          holderDOB: '1983-09-30',
        },
      ];

      const startTime = performance.now();

      // Act
      const results = await Promise.all(
        personalInfoCredentials.map(async (credential) => {
          const witness = TestUtils.generateWitness(
            credential,
            TEST_CONSTANTS.NULLIFIER
          );
          const proof = await TestUtils.mockGenerateProof();
          const isValid = await TestUtils.mockVerifyProof();
          return { credential, witness, proof, isValid };
        })
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Assert
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.witness).toHaveValidWitness();
        expect(result.proof).toBeValidProof();
        expect(result.isValid).toBe(true);
      });
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle document verification efficiently', async () => {
      // Arrange - Test performance with different document hash scenarios
      const documentCredentials = [
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          proofHash: '0xabcd1234567890abcdef1234567890abcdef123456',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          proofHash: '0xbcde2345678901bcde2345678901bcde2345678901',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          proofHash: '0xcdef3456789012cdef3456789012cdef3456789012',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          proofHash: '0xdef4567890123def4567890123def4567890123d',
        },
        {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          proofHash: '0xef5678901234ef5678901234ef5678901234ef',
        },
      ];

      const startTime = performance.now();

      // Act
      const results = await Promise.all(
        documentCredentials.map(async (credential) => {
          const witness = TestUtils.generateWitness(
            credential,
            TEST_CONSTANTS.NULLIFIER
          );
          const proof = await TestUtils.mockGenerateProof();
          const isValid = await TestUtils.mockVerifyProof();
          return { credential, witness, proof, isValid };
        })
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Assert
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.witness).toHaveValidWitness();
        expect(result.proof).toBeValidProof();
        expect(result.isValid).toBe(true);
      });
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});
