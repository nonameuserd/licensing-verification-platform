#!/usr/bin/env ts-node
'use strict';
/**
 * Production-grade proof verification script for ZK-SNARK circuit
 * Uses snarkjs groth16 verification for ExamProof circuit proofs
 */
Object.defineProperty(exports, '__esModule', { value: true });
const child_process_1 = require('child_process');
const fs_1 = require('fs');
const path_1 = require('path');
const logger_1 = require('../src/lib/logger');
const CIRCUIT_NAME_DEFAULT = 'ExamProof';
const SETUP_DIR = (0, path_1.join)(__dirname, '..', 'zkey');
const PROOFS_DIR = (0, path_1.join)(__dirname, '..', 'proofs');
// CLI config
const RETRY_LIMIT = 3;
const RETRY_DELAY = 1000; // ms
const JSON_OUTPUT = process.argv.includes('--json');
const QUIET_MODE = process.argv.includes('--quiet');
const ALL_MODE = process.argv.includes('--all');
function getCircuitFlag() {
  const circuitFlagIndex = process.argv.indexOf('--circuit');
  if (circuitFlagIndex !== -1 && process.argv.length > circuitFlagIndex + 1) {
    return process.argv[circuitFlagIndex + 1];
  }
  return null;
}
const CIRCUIT_FLAG = getCircuitFlag();
const logger = new logger_1.CircuitLogger('proof-verification-script');
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function runCommand(command, description) {
  logger.info(`Starting: ${description}`);
  logger.debug('Executing command', { command, description });
  try {
    const result = (0, child_process_1.execSync)(command, {
      stdio: 'pipe',
      cwd: (0, path_1.join)(__dirname, '..'),
      encoding: 'utf8',
    });
    logger.info(`Completed: ${description}`);
    if (!QUIET_MODE) logger.info(`✅ ${description} completed successfully`);
    return result.trim();
  } catch (error) {
    logger.error(`Failed: ${description}`, error, { command });
    throw new Error(`Command failed [${description}]: ${error.message}`);
  }
}
function validateJsonFile(path, name) {
  if (!(0, fs_1.existsSync)(path)) {
    throw new Error(`${name} not found at ${path}`);
  }
  try {
    const raw = (0, fs_1.readFileSync)(path, 'utf8');
    return JSON.parse(raw);
  } catch {
    throw new Error(`${name} at ${path} is not valid JSON`);
  }
}
async function verifyProofWithKey(
  verificationKeyPath,
  proofPath,
  publicSignalsPath
) {
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
  if (!proof.pi_b || !Array.isArray(proof.pi_b) || proof.pi_b.length !== 3) {
    throw new Error('Invalid proof: pi_b must be an array of 3 elements');
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
  let result = null;
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
  const isValid = result && result.includes('OK');
  logger.proofVerificationComplete('script-proof-verification', true, duration);
  logger.performance('proof-verification-script', duration, {
    circuitName: (0, path_1.basename)(verificationKeyPath).replace(
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
    valid: true,
    duration,
    proof,
    publicSignals,
  };
}
function findProofDirectories(baseDir) {
  const entries = (0, fs_1.readdirSync)(baseDir);
  const proofDirs = [];
  for (const entry of entries) {
    const fullPath = (0, path_1.join)(baseDir, entry);
    const stat = (0, fs_1.statSync)(fullPath);
    if (stat.isDirectory()) {
      // Check if proof.json and public.json exist inside directory
      const proofFile = (0, path_1.join)(fullPath, 'proof.json');
      const publicFile = (0, path_1.join)(fullPath, 'public.json');
      if ((0, fs_1.existsSync)(proofFile) && (0, fs_1.existsSync)(publicFile)) {
        proofDirs.push(fullPath);
      }
    } else if (stat.isFile()) {
      // Also consider if proof.json and public.json are directly in baseDir
      if (entry === 'proof.json') {
        const publicFile = (0, path_1.join)(baseDir, 'public.json');
        if ((0, fs_1.existsSync)(publicFile)) {
          proofDirs.push(baseDir);
          break; // Only add once for baseDir
        }
      }
    }
  }
  return proofDirs;
}
function detectCircuitName(proofJsonPath, publicJsonPath, parentDirName) {
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
  const proofsByCircuit = new Map();
  for (const dir of proofDirs) {
    const proofFile = (0, path_1.join)(dir, 'proof.json');
    const publicFile = (0, path_1.join)(dir, 'public.json');
    const parentDirName = (0, path_1.basename)(dir);
    let circuitName;
    try {
      circuitName = detectCircuitName(proofFile, publicFile, parentDirName);
    } catch {
      circuitName = CIRCUIT_NAME_DEFAULT;
    }
    const proofName = parentDirName || 'default';
    // Ensure we have an array for this circuit and push into it.
    let circuitArr = proofsByCircuit.get(circuitName);
    if (!circuitArr) {
      circuitArr = [];
      proofsByCircuit.set(circuitName, circuitArr);
    }
    circuitArr.push({
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
  const allResults = [];
  for (const [circuitName, proofs] of proofsByCircuit.entries()) {
    const verificationKeyPath = (0, path_1.join)(
      SETUP_DIR,
      'verification_key.json'
    );
    if (!(0, fs_1.existsSync)(verificationKeyPath)) {
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
          error: error.message,
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
    const grouped = {};
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
async function verifyProofsForCircuit(circuitName) {
  // Scan all proof directories and filter by circuitName
  const proofDirs = findProofDirectories(PROOFS_DIR);
  if (proofDirs.length === 0) {
    throw new Error(`No proofs found in directory ${PROOFS_DIR}`);
  }
  const filteredProofs = [];
  for (const dir of proofDirs) {
    const proofFile = (0, path_1.join)(dir, 'proof.json');
    const publicFile = (0, path_1.join)(dir, 'public.json');
    const parentDirName = (0, path_1.basename)(dir);
    let detectedCircuitName;
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
  const verificationKeyPath = (0, path_1.join)(
    SETUP_DIR,
    'verification_key.json'
  );
  if (!(0, fs_1.existsSync)(verificationKeyPath)) {
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
        error: error.message,
        skipped: false,
      };
    }
  });
  const allResults = await Promise.all(verificationPromises);
  // Output results
  if (JSON_OUTPUT) {
    const grouped = {};
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
      const proofPath = (0, path_1.join)(PROOFS_DIR, 'proof.json');
      const publicSignalsPath = (0, path_1.join)(PROOFS_DIR, 'public.json');
      const verificationKeyPath = (0, path_1.join)(
        SETUP_DIR,
        'verification_key.json'
      );
      if (!(0, fs_1.existsSync)(verificationKeyPath)) {
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
    logger.proofVerificationError(error, 'script-proof-verification');
    logger.error('❌ Proof verification failed:', error.message);
    process.exit(1);
  }
}
if (require.main === module) {
  main();
}
