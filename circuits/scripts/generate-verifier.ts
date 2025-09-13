#!/usr/bin/env ts-node

/**
 * Production-ready verifier generation script.
 * Generates Solidity verifier + TS interface for ZK-SNARK proofs.
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import execa from 'execa';
import chalk from 'chalk';
import ora from 'ora';
import { CircuitLogger } from '../src/lib/logger';

const CIRCUIT_NAME = process.env['CIRCUIT_NAME'] || 'ExamProof';
const ROOT_DIR = join(__dirname, '..');
const SETUP_DIR = join(ROOT_DIR, 'zkey');
const CONTRACTS_DIR = join(ROOT_DIR, 'contracts');

const snarkJsCommand = 'snarkjs';
const logger = new CircuitLogger('verifier-generation');

/**
 * Ensures the given directory exists, creates it otherwise.
 */
function ensureDirectoryExists(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    logger.info(chalk.green(`📂 Created directory: ${dir}`));
  }
}

/**
 * Executes a shell command safely with retries.
 */
async function runCommand(
  command: string,
  args: string[],
  description: string,
  retries = 2
): Promise<void> {
  const spinner = ora(`Starting: ${description}`).start();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await execa(command, args, { cwd: ROOT_DIR, stdio: 'inherit' });
      spinner.succeed(`${description} completed successfully`);
      return;
    } catch (error: unknown) {
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
function generateVerifierInterface(): string {
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
async function main(): Promise<void> {
  const startTime = Date.now();
  logger.info(
    chalk.cyan(`\n🔧 Generating Solidity verifier for ${CIRCUIT_NAME}...\n`)
  );

  try {
    // Check for snarkjs
    try {
      await execa(snarkJsCommand, ['--version'], { stdio: 'pipe' });
    } catch (error: unknown) {
      // snarkjs --version returns exit code 99 (normal behavior)
      const exitCode = (error as { exitCode?: number })?.exitCode;
      if (exitCode !== 99) {
        logger.error(
          chalk.red(
            '❌ snarkjs is not installed. Please install it globally or locally:\n\n  npm install -g snarkjs'
          )
        );
        process.exit(1);
      }
    }

    // Ensure contracts directory exists
    ensureDirectoryExists(CONTRACTS_DIR);

    // Check if zkey exists
    const zkeyPath = join(SETUP_DIR, `${CIRCUIT_NAME}_0001.zkey`);
    if (!existsSync(zkeyPath)) {
      logger.error(
        chalk.red(
          `❌ ZKey file not found: ${zkeyPath}\nPlease run the setup script first.`
        )
      );
      process.exit(1);
    }

    // Generate Solidity verifier
    const verifierPath = join(CONTRACTS_DIR, `${CIRCUIT_NAME}Verifier.sol`);
    await runCommand(
      snarkJsCommand,
      ['zkey', 'export', 'solidityverifier', zkeyPath, verifierPath],
      'Solidity verifier generation'
    );

    // Generate TypeScript interface
    const interfacePath = join(CONTRACTS_DIR, `${CIRCUIT_NAME}Verifier.ts`);
    writeFileSync(interfacePath, generateVerifierInterface());
    logger.info(
      chalk.green(`✅ Created TypeScript interface: ${interfacePath}`)
    );

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      chalk.greenBright(`\n🎉 Verifier generated successfully in ${duration}s!`)
    );
    logger.info(chalk.blue('\nGenerated files:'));
    logger.info(`  • ${verifierPath}`);
    logger.info(`  • ${interfacePath}`);
    logger.info(chalk.yellow('\nNext steps:'));
    logger.info(`  1. Deploy ${CIRCUIT_NAME}Verifier.sol`);
    logger.info('  2. Use the TypeScript interface for contract interaction');
    logger.info('  3. Integrate with your backend verification service\n');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(chalk.red(`❌ Verifier generation failed: ${errorMessage}`));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
