/**
 * Test utilities for ZK-SNARK circuit testing
 * Provides helper functions for circuit compilation, proof generation, and verification
 */

import { TestUtils, TEST_CONSTANTS } from '../setup';
import { CircuitLogger, logger } from '../../lib/logger';
import {
  CircuitInput,
  PublicCredentialData,
  ProofData,
  CompilationResult,
} from '../../lib/types';

export interface CircuitTestResult {
  witness: CircuitInput;
  proof: ProofData;
  publicSignals: string[];
  isValid: boolean;
  duration: number;
  error?: Error;
}

export interface BatchTestResult {
  results: CircuitTestResult[];
  totalDuration: number;
  successCount: number;
  failureCount: number;
}

export class CircuitTestUtils {
  /**
   * Compile the ExamProof circuit
   */
  static async compileCircuit(): Promise<CompilationResult> {
    const logger = new CircuitLogger('test-circuit-compilation');
    const startTime = performance.now();

    logger.compilationStart({
      circuitName: 'ExamProof',
      inputPath: 'test',
      outputPath: 'test',
    });

    const result = await TestUtils.mockCompile();
    const endTime = performance.now();
    const compilationTime = endTime - startTime;

    const compilationResult = {
      ...result,
      compilationTime,
    };

    logger.compilationComplete(compilationResult);
    logger.performance('test-circuit-compilation', compilationTime, {
      circuitName: 'ExamProof',
    });

    return compilationResult;
  }

  /**
   * Generate witness for a credential
   */
  static generateWitness(
    credential: PublicCredentialData,
    nullifier: string = TEST_CONSTANTS.NULLIFIER
  ): CircuitInput {
    const logger = new CircuitLogger('test-witness-generation');

    logger.debug('Generating test witness', {
      credentialId: credential.credentialId,
      hasNullifier: !!nullifier,
    });

    const witness = TestUtils.generateWitness(credential, nullifier);

    logger.debug('Test witness generated', {
      credentialId: credential.credentialId,
      publicInputsCount: Object.keys(witness).filter(
        (key) => !key.includes('private')
      ).length,
    });

    return witness;
  }

  /**
   * Generate proof for a witness
   */
  static async generateProof(witness: CircuitInput): Promise<ProofData> {
    const logger = new CircuitLogger('test-proof-generation');
    const startTime = performance.now();

    logger.proofGenerationStart('test-proof');

    const proof = await TestUtils.mockGenerateProof();
    const endTime = performance.now();
    const generationTime = endTime - startTime;

    const proofResult = {
      ...proof,
      generationTime,
    };

    logger.proofGenerationComplete('test-proof', generationTime);
    logger.performance('test-proof-generation', generationTime, {
      witnessKeys: Object.keys(witness),
    });

    return proofResult;
  }

  /**
   * Verify a proof
   */
  static async verifyProof(
    proof: ProofData,
    publicSignals: string[],
    credential?: PublicCredentialData
  ): Promise<{ isValid: boolean; verificationTime: number }> {
    const logger = new CircuitLogger('test-proof-verification');
    const startTime = performance.now();

    logger.proofVerificationStart('test-proof');

    const isValid = await TestUtils.mockVerifyProof(credential);
    const endTime = performance.now();
    const verificationTime = endTime - startTime;

    const verificationResult = {
      isValid,
      verificationTime,
    };

    logger.proofVerificationComplete('test-proof', isValid, verificationTime);
    logger.performance('test-proof-verification', verificationTime, {
      publicSignalsCount: publicSignals.length,
      isValid,
    });

    return verificationResult;
  }

  /**
   * Complete verification flow for a single credential
   */
  static async verifyCredential(
    credential: PublicCredentialData,
    nullifier: string = TEST_CONSTANTS.NULLIFIER
  ): Promise<CircuitTestResult> {
    const logger = new CircuitLogger('test-credential-verification');
    const startTime = performance.now();

    logger.credentialValidationStart(credential.credentialId);

    try {
      const witness = this.generateWitness(credential, nullifier);
      const proof = await this.generateProof(witness);
      const publicSignals = TestUtils.generatePublicSignals(
        credential,
        nullifier
      );
      const verificationResult = await this.verifyProof(
        proof,
        publicSignals,
        credential
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      const result = {
        witness,
        proof,
        publicSignals,
        isValid: verificationResult.isValid,
        duration,
      };

      logger.credentialValidationComplete(
        credential.credentialId,
        verificationResult.isValid,
        []
      );
      logger.performance('test-credential-verification', duration, {
        credentialId: credential.credentialId,
        isValid: verificationResult.isValid,
      });

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      logger.credentialValidationError(error as Error, credential.credentialId);
      logger.performance('test-credential-verification-failed', duration, {
        credentialId: credential.credentialId,
        error: (error as Error).message,
      });

      return {
        witness: {} as CircuitInput,
        proof: {} as ProofData,
        publicSignals: [],
        isValid: false,
        duration,
        error: error as Error,
      };
    }
  }

  /**
   * Batch verification for multiple credentials
   */
  static async batchVerifyCredentials(
    credentials: PublicCredentialData[],
    nullifier: string = TEST_CONSTANTS.NULLIFIER
  ): Promise<BatchTestResult> {
    const startTime = performance.now();

    const results = await Promise.allSettled(
      credentials.map((credential) =>
        this.verifyCredential(credential, nullifier)
      )
    );

    const endTime = performance.now();

    const successfulResults = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<CircuitTestResult>).value);

    const failedResults = results
      .filter((r) => r.status === 'rejected')
      .map((r) => (r as PromiseRejectedResult).reason);

    return {
      results: successfulResults,
      totalDuration: endTime - startTime,
      successCount: successfulResults.length,
      failureCount: failedResults.length,
    };
  }

  /**
   * Generate test credentials with variations
   */
  static generateTestCredentials(
    count: number,
    baseCredential: PublicCredentialData = TEST_CONSTANTS.VALID_CREDENTIAL
  ): PublicCredentialData[] {
    return Array(count)
      .fill(null)
      .map((_, index) => ({
        ...baseCredential,
        licenseNumber: `MD${index.toString().padStart(6, '0')}`,
        holderName: `Dr. Test User ${index}`,
      }));
  }

  /**
   * Generate test nullifiers
   */
  static generateTestNullifiers(count: number): string[] {
    return Array(count)
      .fill(null)
      .map((_, index) => `0x${index.toString(16).padStart(40, '0')}`);
  }

  /**
   * Performance benchmark for circuit operations
   */
  static async benchmarkCircuit(
    operation: 'compile' | 'generate' | 'verify' | 'full',
    iterations = 100
  ): Promise<{
    operation: string;
    iterations: number;
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
  }> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      switch (operation) {
        case 'compile':
          await this.compileCircuit();
          break;
        case 'generate':
          await this.generateProof({} as CircuitInput);
          break;
        case 'verify':
          await this.verifyProof({} as ProofData, []);
          break;
        case 'full':
          await this.verifyCredential(TEST_CONSTANTS.VALID_CREDENTIAL);
          break;
      }

      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    return {
      operation,
      iterations,
      totalTime: times.reduce((sum, time) => sum + time, 0),
      averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
    };
  }

  /**
   * Memory usage monitoring for circuit operations
   */
  static monitorMemoryUsage<T>(operation: () => T): {
    result: T;
    memoryUsage: NodeJS.MemoryUsage;
    memoryDelta: NodeJS.MemoryUsage;
  } {
    const initialMemory = process.memoryUsage();
    const result = operation();
    const finalMemory = process.memoryUsage();

    const memoryDelta = {
      rss: finalMemory.rss - initialMemory.rss,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      external: finalMemory.external - initialMemory.external,
      arrayBuffers: finalMemory.arrayBuffers - initialMemory.arrayBuffers,
    };

    return {
      result,
      memoryUsage: finalMemory, // Return final memory usage
      memoryDelta, // Return the delta for analysis
    };
  }

  /**
   * Stress test the circuit with high load
   */
  static async stressTest(
    load: 'low' | 'medium' | 'high' | 'extreme',
    duration = 30000 // 30 seconds
  ): Promise<{
    load: string;
    duration: number;
    operationsCompleted: number;
    averageOperationTime: number;
    errors: number;
  }> {
    const loadConfig = {
      low: { concurrent: 1, delay: 1000 },
      medium: { concurrent: 5, delay: 500 },
      high: { concurrent: 10, delay: 100 },
      extreme: { concurrent: 20, delay: 50 },
    };

    const config = loadConfig[load];
    const startTime = performance.now();
    let operationsCompleted = 0;
    let errors = 0;
    const operationTimes: number[] = [];

    const runOperation = async () => {
      try {
        const opStartTime = performance.now();
        await this.verifyCredential(TEST_CONSTANTS.VALID_CREDENTIAL);
        const opEndTime = performance.now();

        operationTimes.push(opEndTime - opStartTime);
        operationsCompleted++;
      } catch (error) {
        logger.error('Error during stress test operation', error);
        errors++;
      }
    };

    const runConcurrentOperations = async () => {
      const promises = Array(config.concurrent)
        .fill(null)
        .map(() => runOperation());
      await Promise.allSettled(promises);
    };

    // Run stress test for specified duration
    while (performance.now() - startTime < duration) {
      await runConcurrentOperations();
      await new Promise((resolve) => setTimeout(resolve, config.delay));
    }

    const totalDuration = performance.now() - startTime;
    const averageOperationTime =
      operationTimes.length > 0
        ? operationTimes.reduce((sum, time) => sum + time, 0) /
          operationTimes.length
        : 0;

    return {
      load,
      duration: totalDuration,
      operationsCompleted,
      averageOperationTime,
      errors,
    };
  }
}
