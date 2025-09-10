#!/usr/bin/env ts-node

/**
 * Production-grade proof verification script for ZK-SNARK circuit
 * Uses snarkjs groth16 verification for ExamProof circuit proofs
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { CircuitLogger } from '../src/lib/logger';

const CIRCUIT_NAME_DEFAULT = 'ExamProof';
const SETUP_DIR = join(__dirname, '..', 'setup');
const PROOFS_DIR = join(__dirname, '..', 'proofs');

// CLI config
const RETRY_LIMIT = 3;
const RETRY_DELAY = 1000; // ms
const JSON_OUTPUT = process.argv.includes('--json');
const QUIET_MODE = process.argv.includes('--quiet');
const ALL_MODE = process.argv.includes('--all');

function getCircuitFlag(): string | null {
  const circuitFlagIndex = process.argv.indexOf('--circuit');
  if (circuitFlagIndex !== -1 && process.argv.length > circuitFlagIndex + 1) {
    return process.argv[circuitFlagIndex + 1];
  }
  return null;
}

const CIRCUIT_FLAG = getCircuitFlag();

interface Proof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
}

const logger = new CircuitLogger('proof-verification-script');

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(command: string, description: string): string {
  logger.info(`Starting: ${description}`);
  logger.debug('Executing command', { command, description });

  try {
    const result = execSync(command, {
      stdio: 'pipe',
      cwd: join(__dirname, '..'),
      encoding: 'utf8',
    });
    logger.info(`Completed: ${description}`);
    if (!QUIET_MODE) logger.info(`✅ ${description} completed successfully`);
    return result.trim();
  } catch (error) {
    logger.error(`Failed: ${description}`, error as Error, { command });
    throw new Error(
      `Command failed [${description}]: ${(error as Error).message}`
    );
  }
}
function validateJsonFile(path: string, name: string) {
  if (!existsSync(path)) {
    throw new Error(`${name} not found at ${path}`);
  }
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw);
  } catch {
    throw new Error(`${name} at ${path} is not valid JSON`);
  }
}

async function verifyProofWithKey(
  verificationKeyPath: string,
  proofPath: string,
  publicSignalsPath: string
): Promise<{
  valid: boolean;
  duration: number;
  proof?: Proof;
  publicSignals?: string[];
}> {
  const startTime = Date.now();
  logger.proofVerificationStart('script-proof-verification');

  // Validate required files exist and are valid JSON
  const verificationKey = validateJsonFile(
    verificationKeyPath,
    'Verification key'
  );
  const proof = validateJsonFile(proofPath, 'Proof file');
  const publicSignals = validateJsonFile(
    publicSignalsPath,
    'Public signals file'
  );

  // Validate verification key structure
  if (!verificationKey.protocol || verificationKey.protocol !== 'groth16') {
    throw new Error('Invalid verification key: protocol must be groth16');
  }
  if (!verificationKey.curve || verificationKey.curve !== 'bn128') {
    throw new Error('Invalid verification key: curve must be bn128');
  }
  if (!verificationKey.nPublic || typeof verificationKey.nPublic !== 'number') {
    throw new Error('Invalid verification key: nPublic must be a number');
  }

  // Validate public signals count matches verification key
  if (publicSignals.length !== verificationKey.nPublic) {
    throw new Error(
      `Public signals count mismatch: expected ${verificationKey.nPublic}, got ${publicSignals.length}`
    );
  }

  // Validate proof structure for groth16
  if (!proof.pi_a || !Array.isArray(proof.pi_a) || proof.pi_a.length !== 3) {
    throw new Error('Invalid proof: pi_a must be an array of 3 elements');
  }
  if (!proof.pi_b || !Array.isArray(proof.pi_b) || proof.pi_b.length !== 2) {
    throw new Error('Invalid proof: pi_b must be an array of 2 elements');
  }
  if (!proof.pi_c || !Array.isArray(proof.pi_c) || proof.pi_c.length !== 3) {
    throw new Error('Invalid proof: pi_c must be an array of 3 elements');
  }

  logger.debug('Validated input files', {
    verificationKeyPath,
    proofPath,
    publicSignalsPath,
    protocol: verificationKey.protocol,
    curve: verificationKey.curve,
    nPublic: verificationKey.nPublic,
    publicSignalsCount: publicSignals.length,
  });

  let result: string | null = null;
  let attempts = 0;

  while (attempts < RETRY_LIMIT) {
    try {
      result = runCommand(
        `snarkjs groth16 verify ${verificationKeyPath} ${publicSignalsPath} ${proofPath}`,
        'Proof verification'
      );
      break;
    } catch {
      attempts++;
      if (attempts >= RETRY_LIMIT) {
        throw new Error(
          `Proof verification failed after ${RETRY_LIMIT} attempts: ${'unknown error'}`
        );
      }
      logger.warn(
        `Verification attempt ${attempts} failed. Retrying in ${RETRY_DELAY}ms...`
      );
      await sleep(RETRY_DELAY);
    }
  }

  const endTime = Date.now();
  const duration = endTime - startTime;
  const isValid = result === 'OK';

  logger.proofVerificationComplete(
    'script-proof-verification',
    isValid,
    duration
  );
  logger.performance('proof-verification-script', duration, {
    circuitName: basename(verificationKeyPath).replace(
      '/verification_key.json',
      ''
    ),
    isValid,
  });

  if (!QUIET_MODE) {
    if (isValid) {
      logger.info('\n🎉 Proof verification successful!');
      logger.info('✅ The proof is valid and the credential is verified.');
    } else {
      logger.info('\n❌ Proof verification failed!');
      logger.info('❌ The proof is invalid or the credential is not verified.');
    }

    logger.info('\n📋 Verification Details:');
    logger.info(`- Protocol: ${verificationKey.protocol}`);
    logger.info(`- Curve: ${verificationKey.curve}`);
    logger.info(`- Expected public signals: ${verificationKey.nPublic}`);
    logger.info(`- Proof structure: ${Object.keys(proof).join(', ')}`);
    logger.info(`- Public signals count: ${publicSignals.length}`);
    logger.info(`- Public signals: ${publicSignals.join(', ')}`);
  }

  return {
    valid: isValid,
    duration,
    proof,
    publicSignals,
  };
}

function findProofDirectories(baseDir: string): string[] {
  const entries = readdirSync(baseDir);
  const proofDirs: string[] = [];

  for (const entry of entries) {
    const fullPath = join(baseDir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      // Check if proof.json and public.json exist inside directory
      const proofFile = join(fullPath, 'proof.json');
      const publicFile = join(fullPath, 'public.json');
      if (existsSync(proofFile) && existsSync(publicFile)) {
        proofDirs.push(fullPath);
      }
    } else if (stat.isFile()) {
      // Also consider if proof.json and public.json are directly in baseDir
      if (entry === 'proof.json') {
        const publicFile = join(baseDir, 'public.json');
        if (existsSync(publicFile)) {
          proofDirs.push(baseDir);
          break; // Only add once for baseDir
        }
      }
    }
  }

  return proofDirs;
}

function detectCircuitName(
  proofJsonPath: string,
  publicJsonPath: string,
  parentDirName: string
): string {
  // Try to detect circuitName from proof.json
  try {
    const proofJson = validateJsonFile(proofJsonPath, 'Proof file');
    if (
      proofJson.circuitName &&
      typeof proofJson.circuitName === 'string' &&
      proofJson.circuitName.trim() !== ''
    ) {
      return proofJson.circuitName.trim();
    }
  } catch {
    // ignore error, try next
  }
  // Try to detect circuitName from public.json
  try {
    const publicJson = validateJsonFile(publicJsonPath, 'Public signals file');
    if (
      publicJson.circuitName &&
      typeof publicJson.circuitName === 'string' &&
      publicJson.circuitName.trim() !== ''
    ) {
      return publicJson.circuitName.trim();
    }
  } catch {
    // ignore error, try next
  }
  // fallback to parent directory name
  if (parentDirName && parentDirName.trim() !== '') {
    return parentDirName.trim();
  }
  // fallback to default circuit name
  return CIRCUIT_NAME_DEFAULT;
}

async function verifyAllProofsBatch() {
  // Scan all subdirectories under proofs/ and gather every proof.json
  // Group proofs by detected circuit
  const proofDirs = findProofDirectories(PROOFS_DIR);
  if (proofDirs.length === 0) {
    throw new Error(`No proofs found in directory ${PROOFS_DIR}`);
  }

  type ProofInfo = {
    proofDir: string;
    proofFile: string;
    publicFile: string;
    circuitName: string;
    proofName: string;
  };

  const proofsByCircuit: Map<string, ProofInfo[]> = new Map();

  for (const dir of proofDirs) {
    const proofFile = join(dir, 'proof.json');
    const publicFile = join(dir, 'public.json');
    const parentDirName = basename(dir);
    let circuitName: string;
    try {
      circuitName = detectCircuitName(proofFile, publicFile, parentDirName);
    } catch {
      circuitName = CIRCUIT_NAME_DEFAULT;
    }
    const proofName = parentDirName || 'default';

    if (!proofsByCircuit.has(circuitName)) {
      proofsByCircuit.set(circuitName, []);
    }
    proofsByCircuit.get(circuitName).push({
      proofDir: dir,
      proofFile,
      publicFile,
      circuitName,
      proofName,
    });
  }

  if (!QUIET_MODE) {
    const totalProofs = Array.from(proofsByCircuit.values()).reduce(
      (acc, arr) => acc + arr.length,
      0
    );
    logger.info(
      `Found ${totalProofs} proof(s) across ${proofsByCircuit.size} circuit(s) to verify concurrently.`
    );
  }

  // For each circuit, verify all proofs concurrently using the correct verification key
  type Result = {
    circuit: string;
    proofName: string;
    valid: boolean | null;
    duration: number;
    error: string | null;
    skipped: boolean;
  };

  const allResults: Result[] = [];

  for (const [circuitName, proofs] of proofsByCircuit.entries()) {
    const verificationKeyPath = join(
      SETUP_DIR,
      circuitName,
      'verification_key.json'
    );
    if (!existsSync(verificationKeyPath)) {
      // Skip all proofs for this circuit
      for (const proofInfo of proofs) {
        allResults.push({
          circuit: circuitName,
          proofName: proofInfo.proofName,
          valid: null,
          duration: 0,
          error: `Verification key missing for circuit '${circuitName}', skipping proof.`,
          skipped: true,
        });
      }
      continue;
    }

    if (!QUIET_MODE) {
      logger.info(
        `\nVerifying proofs for circuit '${circuitName}' with verification key at '${verificationKeyPath}'...`
      );
    }

    const verificationPromises = proofs.map(async (proofInfo) => {
      try {
        const result = await verifyProofWithKey(
          verificationKeyPath,
          proofInfo.proofFile,
          proofInfo.publicFile
        );
        return {
          circuit: circuitName,
          proofName: proofInfo.proofName,
          valid: result.valid,
          duration: result.duration,
          error: null,
          skipped: false,
        };
      } catch (error) {
        return {
          circuit: circuitName,
          proofName: proofInfo.proofName,
          valid: false,
          duration: 0,
          error: (error as Error).message,
          skipped: false,
        };
      }
    });

    const results = await Promise.all(verificationPromises);
    allResults.push(...results);
  }

  // Output results
  if (JSON_OUTPUT) {
    // Group results by circuit
    const grouped: Record<string, Result[]> = {};
    for (const res of allResults) {
      if (!grouped[res.circuit]) {
        grouped[res.circuit] = [];
      }
      grouped[res.circuit].push(res);
    }
    logger.info(JSON.stringify(grouped, null, 2));
  } else {
    // Print summary table grouped by circuit
    logger.info('\nProof Verification Summary:');
    logger.info(
      '--------------------------------------------------------------------------------'
    );
    logger.info(
      '| Circuit             | Proof Name          | Valid     | Duration(ms) | Error   |'
    );
    logger.info(
      '--------------------------------------------------------------------------------'
    );
    for (const circuitName of Array.from(proofsByCircuit.keys()).sort()) {
      const results = allResults.filter((r) => r.circuit === circuitName);
      for (const res of results) {
        const validStr = res.skipped
          ? 'Skipped'
          : res.valid
          ? '✅ Valid'
          : '❌ Invalid';
        const durationStr = res.duration.toString().padStart(11, ' ');
        const errorStr = res.error ? res.error : '';
        logger.info(
          `| ${circuitName.padEnd(19, ' ')} | ${res.proofName.padEnd(
            18,
            ' '
          )} | ${validStr.padEnd(9, ' ')} | ${durationStr} | ${errorStr} |`
        );
      }
    }
    logger.info(
      '--------------------------------------------------------------------------------'
    );
  }

  // Exit codes:
  // 0 → all proofs in all circuits valid.
  // 2 → at least one proof invalid.
  // 1 → unexpected error occurred.

  // Check for unexpected errors
  const anyUnexpectedError = allResults.some(
    (r) => !r.skipped && r.error !== null && r.valid === false && r.error !== ''
  );
  if (anyUnexpectedError) {
    process.exit(1);
  }
  // Check for invalid proofs
  const anyInvalid = allResults.some((r) => !r.skipped && r.valid === false);
  if (anyInvalid) {
    process.exit(2);
  }
  // All valid or skipped
  process.exit(0);
}

async function verifyProofsForCircuit(circuitName: string) {
  // Scan all proof directories and filter by circuitName
  const proofDirs = findProofDirectories(PROOFS_DIR);
  if (proofDirs.length === 0) {
    throw new Error(`No proofs found in directory ${PROOFS_DIR}`);
  }

  type ProofInfo = {
    proofDir: string;
    proofFile: string;
    publicFile: string;
    circuitName: string;
    proofName: string;
  };

  const filteredProofs: ProofInfo[] = [];

  for (const dir of proofDirs) {
    const proofFile = join(dir, 'proof.json');
    const publicFile = join(dir, 'public.json');
    const parentDirName = basename(dir);
    let detectedCircuitName: string;
    try {
      detectedCircuitName = detectCircuitName(
        proofFile,
        publicFile,
        parentDirName
      );
    } catch {
      detectedCircuitName = CIRCUIT_NAME_DEFAULT;
    }
    if (detectedCircuitName === circuitName) {
      filteredProofs.push({
        proofDir: dir,
        proofFile,
        publicFile,
        circuitName,
        proofName: parentDirName || 'default',
      });
    }
  }

  if (filteredProofs.length === 0) {
    if (!QUIET_MODE) {
      logger.warn(`No proofs found for circuit '${circuitName}'.`);
    }
    process.exit(2);
  }

  const verificationKeyPath = join(
    SETUP_DIR,
    circuitName,
    'verification_key.json'
  );
  if (!existsSync(verificationKeyPath)) {
    if (!QUIET_MODE) {
      logger.warn(`Verification key missing for circuit '${circuitName}'.`);
    }
    process.exit(2);
  }

  if (!QUIET_MODE) {
    logger.info(
      `\nVerifying proofs for circuit '${circuitName}' with verification key at '${verificationKeyPath}'...`
    );
  }

  type Result = {
    circuit: string;
    proofName: string;
    valid: boolean | null;
    duration: number;
    error: string | null;
    skipped: boolean;
  };

  const verificationPromises = filteredProofs.map(async (proofInfo) => {
    try {
      const result = await verifyProofWithKey(
        verificationKeyPath,
        proofInfo.proofFile,
        proofInfo.publicFile
      );
      return {
        circuit: circuitName,
        proofName: proofInfo.proofName,
        valid: result.valid,
        duration: result.duration,
        error: null,
        skipped: false,
      };
    } catch (error) {
      return {
        circuit: circuitName,
        proofName: proofInfo.proofName,
        valid: false,
        duration: 0,
        error: (error as Error).message,
        skipped: false,
      };
    }
  });

  const allResults = await Promise.all(verificationPromises);

  // Output results
  if (JSON_OUTPUT) {
    const grouped: Record<string, Result[]> = {};
    grouped[circuitName] = allResults;
    logger.info(JSON.stringify(grouped, null, 2));
  } else {
    logger.info('\nProof Verification Summary:');
    logger.info(
      '--------------------------------------------------------------------------------'
    );
    logger.info(
      '| Circuit             | Proof Name          | Valid     | Duration(ms) | Error   |'
    );
    logger.info(
      '--------------------------------------------------------------------------------'
    );
    for (const res of allResults) {
      const validStr = res.skipped
        ? 'Skipped'
        : res.valid
        ? '✅ Valid'
        : '❌ Invalid';
      const durationStr = res.duration.toString().padStart(11, ' ');
      const errorStr = res.error ? res.error : '';
      logger.info(
        `| ${circuitName.padEnd(19, ' ')} | ${res.proofName.padEnd(
          18,
          ' '
        )} | ${validStr.padEnd(9, ' ')} | ${durationStr} | ${errorStr} |`
      );
    }
    logger.info(
      '--------------------------------------------------------------------------------'
    );
  }

  // Exit codes:
  // 0 → all proofs valid.
  // 2 → at least one proof invalid.
  // 1 → unexpected error occurred.

  const anyUnexpectedError = allResults.some(
    (r) => !r.skipped && r.error !== null && r.valid === false && r.error !== ''
  );
  if (anyUnexpectedError) {
    process.exit(1);
  }
  const anyInvalid = allResults.some((r) => !r.skipped && r.valid === false);
  if (anyInvalid) {
    process.exit(2);
  }
  process.exit(0);
}

async function main() {
  try {
    if (CIRCUIT_FLAG) {
      await verifyProofsForCircuit(CIRCUIT_FLAG);
    } else if (ALL_MODE) {
      await verifyAllProofsBatch();
    } else {
      // Single proof verification with default circuit name and key path
      const proofPath = join(PROOFS_DIR, 'proof.json');
      const publicSignalsPath = join(PROOFS_DIR, 'public.json');
      const circuitName = detectCircuitName(
        proofPath,
        publicSignalsPath,
        basename(PROOFS_DIR)
      );
      const verificationKeyPath = join(
        SETUP_DIR,
        circuitName,
        'verification_key.json'
      );
      if (!existsSync(verificationKeyPath)) {
        throw new Error(`Verification key not found at ${verificationKeyPath}`);
      }
      const result = await verifyProofWithKey(
        verificationKeyPath,
        proofPath,
        publicSignalsPath
      );

      if (JSON_OUTPUT) {
        logger.info(JSON.stringify(result, null, 2));
      }

      process.exit(result.valid ? 0 : 2);
    }
  } catch (error) {
    logger.proofVerificationError(error as Error, 'script-proof-verification');
    logger.error('❌ Proof verification failed:', (error as Error).message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
