/**
 * Main test suite for ExamProof.circom circuit
 * Runs all test categories and provides comprehensive coverage
 */

import { TestUtils, TEST_CONSTANTS } from './setup';
import { CircuitTestUtils } from './utils/circuit-test-utils';
import { MOCK_TEST_SCENARIOS } from './utils/mock-data';
import { CircuitLogger } from '../lib/logger';

describe('ExamProof Circuit - Complete Test Suite', () => {
  let logger: CircuitLogger;

  beforeAll(() => {
    logger = new CircuitLogger('complete-test-suite');
    logger.info('Complete test suite started', {
      timestamp: new Date().toISOString(),
      environment: 'test',
    });
  });

  beforeEach(() => {
    logger.info('Test case started', {
      testName: expect.getState().currentTestName,
    });
  });

  describe('Test Suite Overview', () => {
    it('should have all required test files', () => {
      // This test ensures all test files are properly structured
      expect(TestUtils).toBeDefined();
      expect(CircuitTestUtils).toBeDefined();
      expect(MOCK_TEST_SCENARIOS).toBeDefined();
      expect(TEST_CONSTANTS).toBeDefined();
    });

    it('should have proper test constants', () => {
      expect(TEST_CONSTANTS.VALID_CREDENTIAL).toBeDefined();
      expect(TEST_CONSTANTS.INVALID_CREDENTIAL).toBeDefined();
      expect(TEST_CONSTANTS.PRIVATE_KEY).toBeDefined();
      expect(TEST_CONSTANTS.NULLIFIER).toBeDefined();
    });

    it('should have proper mock data', () => {
      expect(MOCK_TEST_SCENARIOS.validCredentials).toBeDefined();
      expect(MOCK_TEST_SCENARIOS.invalidCredentials).toBeDefined();
      expect(MOCK_TEST_SCENARIOS.edgeCases).toBeDefined();
      expect(MOCK_TEST_SCENARIOS.mixedScenarios).toBeDefined();
    });
  });

  describe('Circuit Test Utils', () => {
    it('should compile circuit successfully', async () => {
      const result = await CircuitTestUtils.compileCircuit();
      expect(result).toBeDefined();
      expect(result.r1cs).toBeDefined();
      expect(result.wasm).toBeDefined();
      expect(result.sym).toBeDefined();
    });

    it('should generate witness for valid credential', () => {
      const witness = CircuitTestUtils.generateWitness(
        TEST_CONSTANTS.VALID_CREDENTIAL
      );
      expect(witness).toHaveValidWitness();
      expect(witness.holderName).toBe(
        TEST_CONSTANTS.VALID_CREDENTIAL.holderName
      );
    });

    it('should generate proof successfully', async () => {
      const witness = CircuitTestUtils.generateWitness(
        TEST_CONSTANTS.VALID_CREDENTIAL
      );
      const proof = await CircuitTestUtils.generateProof(witness);
      expect(proof).toBeValidProof();
    });

    it('should verify proof successfully', async () => {
      const witness = CircuitTestUtils.generateWitness(
        TEST_CONSTANTS.VALID_CREDENTIAL
      );
      const proof = await CircuitTestUtils.generateProof(witness);
      const publicSignals = TestUtils.generatePublicSignals(
        TEST_CONSTANTS.VALID_CREDENTIAL,
        TEST_CONSTANTS.NULLIFIER
      );
      const result = await CircuitTestUtils.verifyProof(proof, publicSignals);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Complete Verification Flow', () => {
    it('should complete full verification for valid credential', async () => {
      const result = await CircuitTestUtils.verifyCredential(
        TEST_CONSTANTS.VALID_CREDENTIAL
      );

      expect(result.witness).toHaveValidWitness();
      expect(result.proof).toBeValidProof();
      expect(result.isValid).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle invalid credential gracefully', async () => {
      const result = await CircuitTestUtils.verifyCredential(
        TEST_CONSTANTS.INVALID_CREDENTIAL
      );

      expect(result.isValid).toBe(false);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle batch verification', async () => {
      const credentials = MOCK_TEST_SCENARIOS.validCredentials.slice(0, 4);
      const result = await CircuitTestUtils.batchVerifyCredentials(credentials);

      expect(result.results).toHaveLength(4);
      expect(result.successCount).toBe(4);
      expect(result.failureCount).toBe(0);
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    it('should handle mixed batch verification', async () => {
      const credentials = MOCK_TEST_SCENARIOS.mixedScenarios.slice(0, 6);
      const result = await CircuitTestUtils.batchVerifyCredentials(credentials);

      expect(result.results.length).toBeGreaterThan(0);
      expect(result.totalDuration).toBeGreaterThan(0);

      // Check that some credentials are invalid (isValid: false)
      const invalidResults = result.results.filter((r) => !r.isValid);
      expect(invalidResults.length).toBeGreaterThan(0);

      // Check that some credentials are valid (isValid: true)
      const validResults = result.results.filter((r) => r.isValid);
      expect(validResults.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should benchmark circuit compilation', async () => {
      const benchmark = await CircuitTestUtils.benchmarkCircuit('compile', 10);

      expect(benchmark.operation).toBe('compile');
      expect(benchmark.iterations).toBe(10);
      expect(benchmark.totalTime).toBeGreaterThan(0);
      expect(benchmark.averageTime).toBeGreaterThan(0);
    });

    it('should benchmark proof generation', async () => {
      const benchmark = await CircuitTestUtils.benchmarkCircuit('generate', 10);

      expect(benchmark.operation).toBe('generate');
      expect(benchmark.iterations).toBe(10);
      expect(benchmark.totalTime).toBeGreaterThan(0);
      expect(benchmark.averageTime).toBeGreaterThan(0);
    });

    it('should benchmark proof verification', async () => {
      const benchmark = await CircuitTestUtils.benchmarkCircuit('verify', 10);

      expect(benchmark.operation).toBe('verify');
      expect(benchmark.iterations).toBe(10);
      expect(benchmark.totalTime).toBeGreaterThan(0);
      expect(benchmark.averageTime).toBeGreaterThan(0);
    });

    it('should benchmark full verification flow', async () => {
      const benchmark = await CircuitTestUtils.benchmarkCircuit('full', 10);

      expect(benchmark.operation).toBe('full');
      expect(benchmark.iterations).toBe(10);
      expect(benchmark.totalTime).toBeGreaterThan(0);
      expect(benchmark.averageTime).toBeGreaterThan(0);
    });
  });

  describe('Memory Usage Monitoring', () => {
    it('should monitor memory usage for single verification', () => {
      const result = CircuitTestUtils.monitorMemoryUsage(() => {
        return CircuitTestUtils.generateWitness(
          TEST_CONSTANTS.VALID_CREDENTIAL
        );
      });

      expect(result.result).toHaveValidWitness();
      expect(result.memoryUsage).toBeDefined();
      expect(result.memoryDelta).toBeDefined();
      // Final memory usage should be positive
      expect(result.memoryUsage.heapUsed).toBeGreaterThan(0);
      // Memory delta can be negative due to garbage collection, so we just check it's a number
      expect(typeof result.memoryDelta.heapUsed).toBe('number');
    });

    it('should monitor memory usage for batch verification', () => {
      const credentials = MOCK_TEST_SCENARIOS.validCredentials.slice(0, 4);

      const result = CircuitTestUtils.monitorMemoryUsage(() => {
        return credentials.map((cred) =>
          CircuitTestUtils.generateWitness(cred)
        );
      });

      expect(result.result).toHaveLength(4);
      expect(result.memoryUsage).toBeDefined();
      expect(result.memoryDelta).toBeDefined();
      // Final memory usage should be positive
      expect(result.memoryUsage.heapUsed).toBeGreaterThan(0);
      // Memory delta can be negative due to garbage collection, so we just check it's a number
      expect(typeof result.memoryDelta.heapUsed).toBe('number');
    });
  });

  describe('Stress Testing', () => {
    it('should handle low load stress test', async () => {
      const result = await CircuitTestUtils.stressTest('low', 5000); // 5 seconds

      expect(result.load).toBe('low');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.operationsCompleted).toBeGreaterThan(0);
      expect(result.averageOperationTime).toBeGreaterThan(0);
    }, 10000); // 10 second timeout

    it('should handle medium load stress test', async () => {
      const result = await CircuitTestUtils.stressTest('medium', 5000); // 5 seconds

      expect(result.load).toBe('medium');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.operationsCompleted).toBeGreaterThan(0);
      expect(result.averageOperationTime).toBeGreaterThan(0);
    }, 10000); // 10 second timeout

    it('should handle high load stress test', async () => {
      const result = await CircuitTestUtils.stressTest('high', 5000); // 5 seconds

      expect(result.load).toBe('high');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.operationsCompleted).toBeGreaterThan(0);
      expect(result.averageOperationTime).toBeGreaterThan(0);
    }, 15000); // 15 second timeout
  });

  describe('Test Data Validation', () => {
    it('should have valid test credentials', () => {
      MOCK_TEST_SCENARIOS.validCredentials.forEach((credential) => {
        expect(credential.holderName).toBeTruthy();
        expect(credential.licenseNumber).toBeTruthy();
        expect(credential.examId).toBeTruthy();
        expect(credential.achievementLevel).toBeTruthy();
        expect(credential.issuedDate).toBeTruthy();
        expect(credential.expiryDate).toBeTruthy();
        expect(credential.issuer).toBeTruthy();
        expect(credential.holderDOB).toBeTruthy();
        // SSN is not part of public credential data
      });
    });

    it('should have invalid test credentials', () => {
      MOCK_TEST_SCENARIOS.invalidCredentials.forEach((credential) => {
        expect(credential.holderName).toBeTruthy();
        expect(credential.licenseNumber).toBeTruthy();
        expect(credential.examId).toBeTruthy();
        expect(credential.achievementLevel).toBeTruthy();
        expect(credential.issuedDate).toBeTruthy();
        expect(credential.expiryDate).toBeTruthy();
        expect(credential.issuer).toBeTruthy();
        expect(credential.holderDOB).toBeTruthy();
        // SSN is not part of public credential data
      });
    });

    it('should have edge case test credentials', () => {
      MOCK_TEST_SCENARIOS.edgeCases.forEach((credential) => {
        expect(credential).toBeDefined();
        // Edge cases may have empty or special values
      });
    });
  });

  describe('Test Coverage Validation', () => {
    it('should cover all major test scenarios', () => {
      const testCategories = [
        'validCredentials',
        'invalidCredentials',
        'edgeCases',
        'mixedScenarios',
        'credentialIdFormats',
        'personalInfoScenarios',
        'crossBoardScenarios',
        'statusScenarios',
        'dateFormatScenarios',
        'documentVerificationScenarios',
        'malformedDataScenarios',
      ];

      testCategories.forEach((category) => {
        expect(
          MOCK_TEST_SCENARIOS[category as keyof typeof MOCK_TEST_SCENARIOS]
        ).toBeDefined();
      });
    });

    it('should have comprehensive test data', () => {
      expect(MOCK_TEST_SCENARIOS.validCredentials.length).toBeGreaterThan(0);
      expect(MOCK_TEST_SCENARIOS.invalidCredentials.length).toBeGreaterThan(0);
      expect(MOCK_TEST_SCENARIOS.edgeCases.length).toBeGreaterThan(0);
      expect(MOCK_TEST_SCENARIOS.mixedScenarios.length).toBeGreaterThan(0);
      expect(MOCK_TEST_SCENARIOS.credentialIdFormats.length).toBeGreaterThan(0);
      expect(MOCK_TEST_SCENARIOS.personalInfoScenarios.length).toBeGreaterThan(
        0
      );
      expect(MOCK_TEST_SCENARIOS.crossBoardScenarios.length).toBeGreaterThan(0);
      expect(MOCK_TEST_SCENARIOS.statusScenarios.length).toBeGreaterThan(0);
      expect(MOCK_TEST_SCENARIOS.dateFormatScenarios.length).toBeGreaterThan(0);
      expect(
        MOCK_TEST_SCENARIOS.documentVerificationScenarios.length
      ).toBeGreaterThan(0);
      expect(MOCK_TEST_SCENARIOS.malformedDataScenarios.length).toBeGreaterThan(
        0
      );
    });

    it('should test credential ID format validation', () => {
      MOCK_TEST_SCENARIOS.credentialIdFormats.forEach((credential) => {
        expect(credential.credentialId).toMatch(
          /^(MED|LAW|ENG|NUR|PHM)-2024-\d{6}$/
        );
        expect(credential.examId).toBeTruthy();
        expect(credential.licenseNumber).toBeTruthy();
      });
    });

    it('should test personal information scenarios', () => {
      MOCK_TEST_SCENARIOS.personalInfoScenarios.forEach((credential) => {
        expect(credential.holderName).toBeTruthy();
        expect(credential.holderDOB).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('should test cross-board verification scenarios', () => {
      MOCK_TEST_SCENARIOS.crossBoardScenarios.forEach((credential) => {
        expect(credential.issuer).toBeTruthy();
        expect(credential.licenseNumber).toMatch(
          /^(MD|BAR|PE)-[A-Z]{2}-\d{6}$/
        );
      });
    });

    it('should test status verification scenarios', () => {
      MOCK_TEST_SCENARIOS.statusScenarios.forEach((credential) => {
        expect(credential.achievementLevel).toBeTruthy();
        expect(credential.expiryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof credential.isActive).toBe('boolean');
      });
    });

    it('should test date format scenarios', () => {
      MOCK_TEST_SCENARIOS.dateFormatScenarios.forEach((credential) => {
        expect(credential.issuedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(credential.expiryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('should test document verification scenarios', () => {
      MOCK_TEST_SCENARIOS.documentVerificationScenarios.forEach(
        (credential) => {
          expect(credential.proofHash).toMatch(/^0x[a-fA-F0-9]{40,42}$/);
        }
      );
    });

    it('should test malformed data scenarios', () => {
      MOCK_TEST_SCENARIOS.malformedDataScenarios.forEach((credential) => {
        // These should be malformed by design
        expect(credential).toBeDefined();
      });
    });
  });
});
