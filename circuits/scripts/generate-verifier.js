#!/usr/bin/env ts-node
'use strict';
/**
 * Production-ready verifier generation script.
 * Generates Solidity verifier + TS interface for ZK-SNARK proofs.
 */
const __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const fs_1 = require('fs');
const path_1 = require('path');
const execa_1 = __importDefault(require('execa'));
const chalk_1 = __importDefault(require('chalk'));
const ora_1 = __importDefault(require('ora'));
const logger_1 = require('../src/lib/logger');
const CIRCUIT_NAME = process.env['CIRCUIT_NAME'] || 'ExamProof';
const ROOT_DIR = (0, path_1.join)(__dirname, '..');
const SETUP_DIR = (0, path_1.join)(ROOT_DIR, 'zkey');
const CONTRACTS_DIR = (0, path_1.join)(ROOT_DIR, 'contracts');
const snarkJsCommand = 'snarkjs';
const logger = new logger_1.CircuitLogger('verifier-generation');
/**
 * Ensures the given directory exists, creates it otherwise.
 */
function ensureDirectoryExists(dir) {
  if (!(0, fs_1.existsSync)(dir)) {
    (0, fs_1.mkdirSync)(dir, { recursive: true });
    logger.info(chalk_1.default.green(`📂 Created directory: ${dir}`));
  }
}
/**
 * Executes a shell command safely with retries.
 */
async function runCommand(command, args, description, retries = 2) {
  const spinner = (0, ora_1.default)(`Starting: ${description}`).start();
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await (0, execa_1.default)(command, args, {
        cwd: ROOT_DIR,
        stdio: 'inherit',
      });
      spinner.succeed(`${description} completed successfully`);
      return;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      spinner.warn(
        `${description} failed on attempt ${attempt}/${retries}: ${errorMessage}`
      );
      if (attempt === retries) {
        spinner.fail(`❌ ${description} failed after ${retries} attempts`);
        throw error;
      }
      spinner.info(`Retrying ${description}...`);
    }
  }
}
/**
 * Generates the TypeScript interface for the Solidity verifier.
 */
function generateVerifierInterface() {
  return `/**
 * Auto-generated TypeScript interface for ${CIRCUIT_NAME}Verifier contract.
 * DO NOT EDIT MANUALLY.
 */

export interface ${CIRCUIT_NAME}Verifier {
  verifyProof(
    proof: [string, string, string],
    publicSignals: string[]
  ): Promise<boolean>;

  verifyProofView(
    proof: [string, string, string],
    publicSignals: string[]
  ): boolean;
}

export interface ProofData {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
}

export interface VerificationResult {
  verified: boolean;
  publicSignals: string[];
  timestamp: string;
}

export function formatProofForContract(proof: ProofData): [string, string, string] {
  return [proof.pi_a[0], proof.pi_a[1], proof.pi_a[2]];
}

export function formatPublicSignalsForContract(publicSignals: string[]): string[] {
  return publicSignals.map((signal: string) => signal.toString());
}
`;
}
/**
 * Main verifier generation workflow.
 */
async function main() {
  const startTime = Date.now();
  logger.info(
    chalk_1.default.cyan(
      `\n🔧 Generating Solidity verifier for ${CIRCUIT_NAME}...\n`
    )
  );
  try {
    // Check for snarkjs
    try {
      await (0, execa_1.default)(snarkJsCommand, ['--version'], {
        stdio: 'pipe',
      });
    } catch (error) {
      // snarkjs --version returns exit code 99 (normal behavior)
      const exitCode = error?.exitCode;
      if (exitCode !== 99) {
        logger.error(
          chalk_1.default.red(
            '❌ snarkjs is not installed. Please install it globally or locally:\n\n  npm install -g snarkjs'
          )
        );
        process.exit(1);
      }
    }
    // Ensure contracts directory exists
    ensureDirectoryExists(CONTRACTS_DIR);
    // Check if zkey exists
    const zkeyPath = (0, path_1.join)(SETUP_DIR, `${CIRCUIT_NAME}_0001.zkey`);
    if (!(0, fs_1.existsSync)(zkeyPath)) {
      logger.error(
        chalk_1.default.red(
          `❌ ZKey file not found: ${zkeyPath}\nPlease run the setup script first.`
        )
      );
      process.exit(1);
    }
    // Generate Solidity verifier
    const verifierPath = (0, path_1.join)(
      CONTRACTS_DIR,
      `${CIRCUIT_NAME}Verifier.sol`
    );
    await runCommand(
      snarkJsCommand,
      ['zkey', 'export', 'solidityverifier', zkeyPath, verifierPath],
      'Solidity verifier generation'
    );
    // Generate TypeScript interface
    const interfacePath = (0, path_1.join)(
      CONTRACTS_DIR,
      `${CIRCUIT_NAME}Verifier.ts`
    );
    (0, fs_1.writeFileSync)(interfacePath, generateVerifierInterface());
    logger.info(
      chalk_1.default.green(`✅ Created TypeScript interface: ${interfacePath}`)
    );
    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      chalk_1.default.greenBright(
        `\n🎉 Verifier generated successfully in ${duration}s!`
      )
    );
    logger.info(chalk_1.default.blue('\nGenerated files:'));
    logger.info(`  • ${verifierPath}`);
    logger.info(`  • ${interfacePath}`);
    logger.info(chalk_1.default.yellow('\nNext steps:'));
    logger.info(`  1. Deploy ${CIRCUIT_NAME}Verifier.sol`);
    logger.info('  2. Use the TypeScript interface for contract interaction');
    logger.info('  3. Integrate with your backend verification service\n');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      chalk_1.default.red(`❌ Verifier generation failed: ${errorMessage}`)
    );
    process.exit(1);
  }
}
if (require.main === module) {
  main();
}
