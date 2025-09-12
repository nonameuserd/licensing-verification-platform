#!/usr/bin/env ts-node

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';
import { CircuitLogger } from '../src/lib/logger';
import {
  initPoseidon,
  readTreeFile,
  getProof,
  validateProof,
  generateCredentialLeaf,
  generateNullifierLeaf,
  toField,
  getPoseidon,
} from './merkle-helper';

dotenv.config();
const asyncExec = promisify(exec);

const CIRCUIT_NAME = 'ExamProof';
const ROOT_DIR = join(__dirname, '..');
const BUILD_DIR = join(ROOT_DIR, 'build');
const ZKEY_DIR = join(ROOT_DIR, 'zkey');
const PROOFS_DIR = join(ROOT_DIR, 'proofs');

const logger = new CircuitLogger('proof-generation');

interface CircuitInput {
  holderName: string;
  licenseNumber: string;
  examId: string;
  achievementLevel: string;
  issuedDate: string;
  expiryDate: string;
  issuer: string;
  nullifier: string;
  holderDOB: string;
  privateKey: string;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
}

function getCredentialData(): CircuitInput {
  const requiredVars = [
    'HOLDER_NAME',
    'LICENSE_NUMBER',
    'EXAM_ID',
    'ACHIEVEMENT_LEVEL',
    'ISSUED_DATE',
    'EXPIRY_DATE',
    'ISSUER',
    'HOLDER_DOB',
    'NULLIFIER',
    'PRIVATE_KEY',
  ];

  for (const v of requiredVars) {
    if (!process.env[v]) {
      logger.error(`Missing required environment variable: ${v}`);
      throw new Error(`Environment variable ${v} is required`);
    }
  }

  return {
    holderName: process.env['HOLDER_NAME'] as string,
    licenseNumber: process.env['LICENSE_NUMBER'] as string,
    examId: process.env['EXAM_ID'] as string,
    achievementLevel: process.env['ACHIEVEMENT_LEVEL'] as string,
    issuedDate: process.env['ISSUED_DATE'] as string,
    expiryDate: process.env['EXPIRY_DATE'] as string,
    issuer: process.env['ISSUER'] as string,
    holderDOB: process.env['HOLDER_DOB'] as string,
    nullifier: process.env['NULLIFIER'] as string,
    privateKey: process.env['PRIVATE_KEY'] as string,
  };
}

function validateInput(input: CircuitInput): void {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const hexRegex = /^0x[a-fA-F0-9]+$/;
  const validLevels = [
    'Passed',
    'Conditional',
    'Failed',
    'Suspended',
    'Revoked',
    'Pending',
  ];

  if (
    !dateRegex.test(input.issuedDate) ||
    !dateRegex.test(input.expiryDate) ||
    !dateRegex.test(input.holderDOB)
  ) {
    throw new Error('Invalid date format: use YYYY-MM-DD');
  }

  if (!hexRegex.test(input.nullifier) || !hexRegex.test(input.privateKey)) {
    throw new Error(
      'Invalid hex format: nullifier/privateKey must start with 0x'
    );
  }

  if (!validLevels.includes(input.achievementLevel)) {
    throw new Error(
      `Invalid achievementLevel: must be one of ${validLevels.join(', ')}`
    );
  }
}

async function runCommand(command: string, description: string): Promise<void> {
  logger.info(`Starting: ${description}`);
  try {
    const { stderr } = await asyncExec(command, { cwd: ROOT_DIR });
    if (stderr) logger.warn(stderr);
    logger.info(`Completed: ${description}`);
  } catch (error) {
    logger.error(`Failed: ${description}`, error as Error);
    throw new Error(`${description} failed`);
  }
}

async function main() {
  const start = Date.now();
  logger.proofGenerationStart('script-proof-generation');
  logger.info(`🔐 Generating ZK-SNARK proof for ${CIRCUIT_NAME}...`);

  try {
    await initPoseidon();
    ensureDir(PROOFS_DIR);

    const provingKeyPath = join(ZKEY_DIR, `${CIRCUIT_NAME}_0001.zkey`);
    if (!existsSync(provingKeyPath)) {
      throw new Error(
        `Proving key missing: ${provingKeyPath}. Please ensure the proving key is present under circuits/zkey/ (e.g. ${CIRCUIT_NAME}_0001.zkey).`
      );
    }

    const credentialData = getCredentialData();
    validateInput(credentialData);

    // Use pre-generated tree files for fast proof generation
    const CREDENTIAL_TREE_FILE =
      process.env['CREDENTIAL_TREE_FILE'] || './trees/credential-tree.json';
    const NULLIFIER_TREE_FILE =
      process.env['NULLIFIER_TREE_FILE'] || './trees/nullifier-tree.json';
    const CREDENTIAL_INDEX = process.env['CREDENTIAL_LEAF_INDEX']
      ? parseInt(process.env['CREDENTIAL_LEAF_INDEX'] as string, 10)
      : 0;
    const NULLIFIER_INDEX = process.env['NULLIFIER_LEAF_INDEX']
      ? parseInt(process.env['NULLIFIER_LEAF_INDEX'] as string, 10)
      : 0;

    let merkleProof: string[] = new Array(20).fill('0');
    let merklePathIndices: number[] = new Array(20).fill(0);
    let merkleProofNullifier: string[] = new Array(20).fill('0');
    let merklePathIndicesNullifier: number[] = new Array(20).fill(0);
    let storedNullifierLeaf = '0';
    let credentialRoot = '0';
    let nullifierRoot = '0';

    // Load pre-generated credential tree
    if (existsSync(CREDENTIAL_TREE_FILE)) {
      try {
        logger.info(`Loading credential tree from ${CREDENTIAL_TREE_FILE}`);
        const credentialTreeData = readTreeFile(CREDENTIAL_TREE_FILE);
        const TREE_HEIGHT = credentialTreeData.layers.length - 1; // Height is layers.length - 1
        logger.info(`Using tree height: ${TREE_HEIGHT}`);
        const credProof = getProof(
          credentialTreeData.layers.map((level) =>
            level.map((leaf) => BigInt(leaf))
          ),
          CREDENTIAL_INDEX,
          TREE_HEIGHT
        );
        merkleProof = credProof.siblings;
        merklePathIndices = credProof.pathIndices;
        credentialRoot = credentialTreeData.root;

        const credentialLeaf = generateCredentialLeaf(
          credentialData.examId,
          credentialData.achievementLevel,
          credentialData.issuer,
          credentialData.privateKey
        );

        const isValidProof = validateProof(
          credentialLeaf,
          credProof.siblings,
          credProof.pathIndices,
          BigInt(credentialTreeData.root),
          TREE_HEIGHT
        );

        logger.info(`Credential proof valid: ${isValidProof}`);
      } catch (e) {
        logger.warn('Failed to load credential tree: ' + (e as Error).message);
      }
    } else {
      logger.warn(`Credential tree file not found: ${CREDENTIAL_TREE_FILE}`);
    }

    // Load pre-generated nullifier tree
    if (existsSync(NULLIFIER_TREE_FILE)) {
      try {
        logger.info(`Loading nullifier tree from ${NULLIFIER_TREE_FILE}`);
        const nullifierTreeData = readTreeFile(NULLIFIER_TREE_FILE);
        const NULLIFIER_TREE_HEIGHT = nullifierTreeData.layers.length - 1; // Height is layers.length - 1
        logger.info(`Using nullifier tree height: ${NULLIFIER_TREE_HEIGHT}`);
        const nullProof = getProof(
          nullifierTreeData.layers.map((level) =>
            level.map((leaf) => BigInt(leaf))
          ),
          NULLIFIER_INDEX,
          NULLIFIER_TREE_HEIGHT
        );
        merkleProofNullifier = nullProof.siblings;
        merklePathIndicesNullifier = nullProof.pathIndices;
        storedNullifierLeaf = nullProof.leaf;
        nullifierRoot = nullifierTreeData.root;

        // For non-inclusion proof, we need to verify that the nullifier we're proving
        // is different from what's stored in the tree
        const nullifierLeaf = generateNullifierLeaf(credentialData.nullifier);
        const storedLeaf = BigInt(storedNullifierLeaf);

        // The proof should be valid if the stored leaf is different from our nullifier
        const isDifferentNullifier = nullifierLeaf !== storedLeaf;
        logger.info(
          `Nullifier different from stored leaf: ${isDifferentNullifier}`
        );
        logger.info(`Our nullifier: ${nullifierLeaf.toString()}`);
        logger.info(`Stored leaf: ${storedLeaf.toString()}`);

        // Validate that the stored leaf path is correct (this is what we're proving)
        const isValidStoredLeafPath = validateProof(
          storedLeaf,
          nullProof.siblings,
          nullProof.pathIndices,
          BigInt(nullifierTreeData.root),
          NULLIFIER_TREE_HEIGHT
        );

        logger.info(`Stored leaf path valid: ${isValidStoredLeafPath}`);
      } catch (e) {
        logger.warn('Failed to load nullifier tree: ' + (e as Error).message);
      }
    } else {
      logger.warn(`Nullifier tree file not found: ${NULLIFIER_TREE_FILE}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const proofFolder = join(PROOFS_DIR, timestamp);
    ensureDir(proofFolder);

    // Compute credentialHash and derive EdDSA key/signature
    const poseidon = getPoseidon();
    if (!poseidon) throw new Error('Poseidon not initialized');

    const F = poseidon.F;
    const a = toField(credentialData.examId);
    const b = toField(credentialData.achievementLevel);
    const d = toField(credentialData.issuer);
    const eVal = toField(credentialData.privateKey);
    const credPose = poseidon([a, b, d, eVal]);
    const credentialHash = F.toObject(credPose);

    // Use the same holderSecret value that the circuit will use
    const holderSecret = eVal;

    const zk = require('@zk-kit/eddsa-poseidon/blake-2b');
    let priv: string = credentialData.privateKey;
    if (priv.startsWith('0x')) priv = priv.slice(2);

    const pub = zk.derivePublicKey(priv);
    if (!pub || !Array.isArray(pub) || pub.length < 2) {
      throw new Error('Failed to derive public key from private key');
    }
    const derivedPubKey: [string, string] = [String(pub[0]), String(pub[1])];

    const sig = zk.signMessage(priv, String(credentialHash));
    if (!sig) throw new Error('Failed to sign credentialHash');

    let derivedSignature: { S: string; R8: [string, string] };
    if (sig.S && sig.R8) {
      derivedSignature = {
        S: String(sig.S),
        R8: [String(sig.R8[0]), String(sig.R8[1])],
      };
    } else if (Array.isArray(sig) && sig.length >= 3) {
      derivedSignature = {
        S: String(sig[2]),
        R8: [String(sig[0]), String(sig[1])],
      };
    } else if (sig.R && sig.S) {
      derivedSignature = {
        S: String(sig.S),
        R8: [String(sig.R[0]), String(sig.R[1])],
      };
    } else {
      throw new Error('Unsupported signature shape returned by signer');
    }

    const inputPath = join(proofFolder, 'input.json');
    const canonicalPath = join(proofFolder, 'canonical-input.json');

    // Generate the final input using the known correct format
    const finalInput = {
      pubKey: [String(derivedPubKey[0]), String(derivedPubKey[1])],
      credentialRoot: credentialRoot,
      nullifierRoot: nullifierRoot,
      currentTime: String(Math.floor(Date.now() / 1000)),
      signatureS: String(derivedSignature.S),
      signatureR: [
        String(derivedSignature.R8[0]),
        String(derivedSignature.R8[1]),
      ],
      nullifier: String(toField(credentialData.nullifier)),
      examIdHash: String(toField(credentialData.examId)),
      achievementLevelHash: String(toField(credentialData.achievementLevel)),
      issuerHash: String(toField(credentialData.issuer)),
      holderSecret: String(holderSecret),
      merkleProof: merkleProof.map((v) => String(v)),
      merkleProofNullifier: merkleProofNullifier.map((v) => String(v)),
      merklePathIndices: merklePathIndices.map((v) => String(v)),
      merklePathIndicesNullifier: merklePathIndicesNullifier.map((v) =>
        String(v)
      ),
      storedNullifierLeaf: String(storedNullifierLeaf),
    };

    // Write the input file
    writeFileSync(inputPath, JSON.stringify(finalInput, null, 2));
    writeFileSync(canonicalPath, JSON.stringify(finalInput, null, 2));
    logger.info(`Created input file: ${inputPath}`);
    logger.info(`Canonical input written: ${canonicalPath}`);

    const witnessPath = join(proofFolder, 'witness.wtns');
    const proofPath = join(proofFolder, 'proof.json');
    const publicSignalsPath = join(proofFolder, 'public.json');

    // Locate the compiled wasm for the circuit
    const wasmCandidates = [
      join(BUILD_DIR, `${CIRCUIT_NAME}.wasm`),
      join(BUILD_DIR, `${CIRCUIT_NAME}_js`, `${CIRCUIT_NAME}.wasm`),
    ];
    const wasmPath = wasmCandidates.find((p) => existsSync(p));
    if (!wasmPath) {
      throw new Error(
        `Missing wasm file for circuit. Checked: ${wasmCandidates.join(', ')}`
      );
    }

    // If running in CI or a sandbox mode where we only need the canonical input,
    // exit early to avoid running witness/proof generation. Set INPUT_ONLY=1 to enable.
    if (process.env['INPUT_ONLY']) {
      logger.info('INPUT_ONLY set; exiting after writing canonical input');
      process.exit(0);
    }

    // Now run witness calculation
    await runCommand(
      `snarkjs wtns calculate ${wasmPath} ${inputPath} ${witnessPath}`,
      'Witness calculation'
    );

    await runCommand(
      `snarkjs groth16 prove ${provingKeyPath} ${witnessPath} ${proofPath} ${publicSignalsPath}`,
      'Proof generation'
    );

    const duration = Date.now() - start;
    logger.proofGenerationComplete('script-proof-generation', duration);
    logger.info(`\n🎉 Proof generated successfully in ${duration / 1000}s`);
    logger.info(`📂 Proof folder: ${proofFolder}`);

    // Write canonical path marker for CI scripts
    writeFileSync(join(ROOT_DIR, '.last-canonical'), canonicalPath);
    logger.info(`📝 Updated .last-canonical marker: ${canonicalPath}`);
  } catch (error) {
    const duration = Date.now() - start;
    logger.proofGenerationError(error as Error, 'script-proof-generation');
    logger.performance('proof-generation-failed', duration, {
      error: (error as Error).message,
    });
    logger.error(`❌ Proof generation failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  // Show usage information if no arguments provided
  if (process.argv.length === 2) {
    logger.info(`
🔐 ZK-SNARK Proof Generation Script (Fast - Uses Pre-generated Trees)

Usage:
  ts-node generate-proof-fast.ts [options]

Environment Variables Required:
  HOLDER_NAME              Name of credential holder
  LICENSE_NUMBER           License number
  EXAM_ID                  Exam identifier
  ACHIEVEMENT_LEVEL        Achievement level (Passed, Conditional, Failed, Suspended, Revoked, Pending)
  ISSUED_DATE              Issue date (YYYY-MM-DD format)
  EXPIRY_DATE              Expiry date (YYYY-MM-DD format)
  ISSUER                   Issuing authority
  HOLDER_DOB               Holder date of birth (YYYY-MM-DD format)
  NULLIFIER                Unique nullifier (hex format starting with 0x)
  PRIVATE_KEY              Holder's private key (hex format starting with 0x)

Optional Environment Variables:
  CREDENTIAL_TREE_FILE     Path to credential Merkle tree file (default: ./trees/credential-tree.json)
  NULLIFIER_TREE_FILE      Path to nullifier Merkle tree file (default: ./trees/nullifier-tree.json)
  CREDENTIAL_LEAF_INDEX    Index of credential in tree (default: 0)
  NULLIFIER_LEAF_INDEX     Index of nullifier in tree (default: 0)

Examples:
  # Generate proof with default tree files
  HOLDER_NAME="John Doe" \\
  LICENSE_NUMBER="MD123456" \\
  EXAM_ID="USMLE_STEP_1" \\
  ACHIEVEMENT_LEVEL="Passed" \\
  ISSUED_DATE="2024-01-15" \\
  EXPIRY_DATE="2025-01-15" \\
  ISSUER="FSMB" \\
  HOLDER_DOB="1990-05-20" \\
  NULLIFIER="0x1234567890abcdef" \\
  PRIVATE_KEY="0xabcdef1234567890" \\
  ts-node generate-proof-fast.ts

  # Generate proof with custom tree files
  CREDENTIAL_TREE_FILE=./trees/credential-tree.json \\
  NULLIFIER_TREE_FILE=./trees/nullifier-tree.json \\
  HOLDER_NAME="John Doe" \\
  LICENSE_NUMBER="MD123456" \\
  EXAM_ID="USMLE_STEP_1" \\
  ACHIEVEMENT_LEVEL="Passed" \\
  ISSUED_DATE="2024-01-15" \\
  EXPIRY_DATE="2025-01-15" \\
  ISSUER="FSMB" \\
  HOLDER_DOB="1990-05-20" \\
  NULLIFIER="0x1234567890abcdef" \\
  PRIVATE_KEY="0xabcdef1234567890" \\
  ts-node generate-proof-fast.ts
`);
  }

  main().catch((error) => {
    logger.error('Script failed:', error.message);
    process.exit(1);
  });
}
