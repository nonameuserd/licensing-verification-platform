/**
 * Circuit utilities for ZK-SNARK operations
 * Provides helper functions for circuit compilation and interaction
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { CircuitLogger } from './logger';

export interface CircuitCompilationResult {
  r1cs: string;
  wasm: string;
  sym: string;
  compilationTime: number;
}

export interface CircuitConfig {
  inputPath: string;
  outputPath: string;
  circuitName: string;
}

/**
 * Compile a circom circuit to R1CS, WASM, and symbol files
 */
export async function compileCircuit(
  config: CircuitConfig
): Promise<CircuitCompilationResult> {
  const logger = new CircuitLogger('circuit-compilation');
  const startTime = Date.now();

  logger.compilationStart(config);

  // Ensure output directory exists
  if (!existsSync(config.outputPath)) {
    mkdirSync(config.outputPath, { recursive: true });
    logger.info('Created output directory', { outputPath: config.outputPath });
  }

  try {
    // Compile the circuit
    const command = `circom ${config.inputPath} --r1cs --wasm --sym --c -o ${config.outputPath}`;
    logger.debug('Executing compilation command', { command });

    execSync(command, { stdio: 'pipe' });

    const endTime = Date.now();
    const compilationTime = endTime - startTime;

    const result = {
      r1cs: join(config.outputPath, `${config.circuitName}.r1cs`),
      wasm: join(config.outputPath, `${config.circuitName}.wasm`),
      sym: join(config.outputPath, `${config.circuitName}.sym`),
      compilationTime,
    };

    logger.compilationComplete(result);
    logger.performance('circuit-compilation', compilationTime, {
      circuitName: config.circuitName,
      outputPath: config.outputPath,
    });

    return result;
  } catch (error) {
    const endTime = Date.now();
    const compilationTime = endTime - startTime;

    logger.compilationError(error as Error, config);
    logger.performance('circuit-compilation-failed', compilationTime, {
      circuitName: config.circuitName,
      error: (error as Error).message,
    });

    throw new Error(`Circuit compilation failed: ${error}`);
  }
}

/**
 * Get default circuit configuration for ExamProof
 */
export function getDefaultCircuitConfig(): CircuitConfig {
  return {
    inputPath: 'src/ExamProof.circom',
    outputPath: 'build',
    circuitName: 'ExamProof',
  };
}

/**
 * Check if circuit files exist
 */
export function circuitFilesExist(config: CircuitConfig): boolean {
  const logger = new CircuitLogger('circuit-files-check');

  const r1csPath = join(config.outputPath, `${config.circuitName}.r1cs`);
  const wasmPath = join(config.outputPath, `${config.circuitName}.wasm`);
  const symPath = join(config.outputPath, `${config.circuitName}.sym`);

  const r1csExists = existsSync(r1csPath);
  const wasmExists = existsSync(wasmPath);
  const symExists = existsSync(symPath);

  const allExist = r1csExists && wasmExists && symExists;

  logger.debug('Circuit files check', {
    circuitName: config.circuitName,
    r1csExists,
    wasmExists,
    symExists,
    allExist,
  });

  return allExist;
}

/**
 * Clean circuit build files
 */
export function cleanCircuitFiles(config: CircuitConfig): void {
  const logger = new CircuitLogger('circuit-cleanup');

  const files = [
    join(config.outputPath, `${config.circuitName}.r1cs`),
    join(config.outputPath, `${config.circuitName}.wasm`),
    join(config.outputPath, `${config.circuitName}.sym`),
    join(config.outputPath, `${config.circuitName}.cpp`),
    join(config.outputPath, `${config.circuitName}.dat`),
  ];

  let cleanedCount = 0;

  files.forEach((file) => {
    if (existsSync(file)) {
      try {
        execSync(`rm -f ${file}`);
        cleanedCount++;
        logger.debug('Cleaned circuit file', { file });
      } catch (error) {
        logger.error('Failed to clean circuit file', error as Error, { file });
      }
    }
  });

  logger.info('Circuit cleanup completed', {
    circuitName: config.circuitName,
    filesCleaned: cleanedCount,
    totalFiles: files.length,
  });
}
