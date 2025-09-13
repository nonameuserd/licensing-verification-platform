#!/usr/bin/env ts-node
'use strict';
const __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        let desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
const __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
const __importStar =
  (this && this.__importStar) ||
  (function () {
    let ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          const ar = [];
          for (const k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      const result = {};
      if (mod != null)
        for (let k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
const child_process_1 = require('child_process');
const util_1 = require('util');
const fs_1 = require('fs');
const path_1 = require('path');
const dotenv = __importStar(require('dotenv'));
const logger_1 = require('../src/lib/logger');
const merkle_helper_1 = require('./merkle-helper');
dotenv.config();
const asyncExec = (0, util_1.promisify)(child_process_1.exec);
const CIRCUIT_NAME = 'ExamProof';
const ROOT_DIR = (0, path_1.join)(__dirname, '..');
const BUILD_DIR = (0, path_1.join)(ROOT_DIR, 'build');
const ZKEY_DIR = (0, path_1.join)(ROOT_DIR, 'zkey');
const PROOFS_DIR = (0, path_1.join)(ROOT_DIR, 'proofs');
const logger = new logger_1.CircuitLogger('proof-generation');
function ensureDir(dir) {
  if (!(0, fs_1.existsSync)(dir)) {
    (0, fs_1.mkdirSync)(dir, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
}
function getCredentialData() {
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
    holderName: process.env['HOLDER_NAME'],
    licenseNumber: process.env['LICENSE_NUMBER'],
    examId: process.env['EXAM_ID'],
    achievementLevel: process.env['ACHIEVEMENT_LEVEL'],
    issuedDate: process.env['ISSUED_DATE'],
    expiryDate: process.env['EXPIRY_DATE'],
    issuer: process.env['ISSUER'],
    holderDOB: process.env['HOLDER_DOB'],
    nullifier: process.env['NULLIFIER'],
    privateKey: process.env['PRIVATE_KEY'],
  };
}
function validateInput(input) {
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
async function runCommand(command, description) {
  logger.info(`Starting: ${description}`);
  try {
    const { stderr } = await asyncExec(command, { cwd: ROOT_DIR });
    if (stderr) logger.warn(stderr);
    logger.info(`Completed: ${description}`);
  } catch (error) {
    logger.error(`Failed: ${description}`, error);
    throw new Error(`${description} failed`);
  }
}
async function main() {
  const start = Date.now();
  logger.proofGenerationStart('script-proof-generation');
  logger.info(`🔐 Generating ZK-SNARK proof for ${CIRCUIT_NAME}...`);
  try {
    await (0, merkle_helper_1.initPoseidon)();
    ensureDir(PROOFS_DIR);
    const provingKeyPath = (0, path_1.join)(
      ZKEY_DIR,
      `${CIRCUIT_NAME}_0001.zkey`
    );
    if (!(0, fs_1.existsSync)(provingKeyPath)) {
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
      ? parseInt(process.env['CREDENTIAL_LEAF_INDEX'], 10)
      : 0;
    const NULLIFIER_INDEX = process.env['NULLIFIER_LEAF_INDEX']
      ? parseInt(process.env['NULLIFIER_LEAF_INDEX'], 10)
      : 0;
    let merkleProof = new Array(20).fill('0');
    let merklePathIndices = new Array(20).fill(0);
    let merkleProofNullifier = new Array(20).fill('0');
    let merklePathIndicesNullifier = new Array(20).fill(0);
    let storedNullifierLeaf = '0';
    let credentialRoot = '0';
    let nullifierRoot = '0';
    // Load pre-generated credential tree
    if ((0, fs_1.existsSync)(CREDENTIAL_TREE_FILE)) {
      try {
        logger.info(`Loading credential tree from ${CREDENTIAL_TREE_FILE}`);
        const credentialTreeData = (0, merkle_helper_1.readTreeFile)(
          CREDENTIAL_TREE_FILE
        );
        const TREE_HEIGHT = credentialTreeData.layers.length - 1; // Height is layers.length - 1
        logger.info(`Using tree height: ${TREE_HEIGHT}`);
        const credProof = (0, merkle_helper_1.getProof)(
          credentialTreeData.layers.map((level) =>
            level.map((leaf) => BigInt(leaf))
          ),
          CREDENTIAL_INDEX,
          TREE_HEIGHT
        );
        merkleProof = credProof.siblings;
        merklePathIndices = credProof.pathIndices;
        credentialRoot = credentialTreeData.root;
        const credentialLeaf = (0, merkle_helper_1.generateCredentialLeaf)(
          credentialData.examId,
          credentialData.achievementLevel,
          credentialData.issuer,
          credentialData.privateKey
        );
        const isValidProof = (0, merkle_helper_1.validateProof)(
          credentialLeaf,
          credProof.siblings,
          credProof.pathIndices,
          BigInt(credentialTreeData.root),
          TREE_HEIGHT
        );
        logger.info(`Credential proof valid: ${isValidProof}`);
      } catch (e) {
        logger.warn('Failed to load credential tree: ' + e.message);
      }
    } else {
      logger.warn(`Credential tree file not found: ${CREDENTIAL_TREE_FILE}`);
    }
    // Load pre-generated nullifier tree
    if ((0, fs_1.existsSync)(NULLIFIER_TREE_FILE)) {
      try {
        logger.info(`Loading nullifier tree from ${NULLIFIER_TREE_FILE}`);
        const nullifierTreeData = (0, merkle_helper_1.readTreeFile)(
          NULLIFIER_TREE_FILE
        );
        const NULLIFIER_TREE_HEIGHT = nullifierTreeData.layers.length - 1; // Height is layers.length - 1
        logger.info(`Using nullifier tree height: ${NULLIFIER_TREE_HEIGHT}`);
        const nullProof = (0, merkle_helper_1.getProof)(
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
        const nullifierLeaf = (0, merkle_helper_1.generateNullifierLeaf)(
          credentialData.nullifier
        );
        const storedLeaf = BigInt(storedNullifierLeaf);
        // The proof should be valid if the stored leaf is different from our nullifier
        const isDifferentNullifier = nullifierLeaf !== storedLeaf;
        logger.info(
          `Nullifier different from stored leaf: ${isDifferentNullifier}`
        );
        logger.info(`Our nullifier: ${nullifierLeaf.toString()}`);
        logger.info(`Stored leaf: ${storedLeaf.toString()}`);
        // Validate that the stored leaf path is correct (this is what we're proving)
        const isValidStoredLeafPath = (0, merkle_helper_1.validateProof)(
          storedLeaf,
          nullProof.siblings,
          nullProof.pathIndices,
          BigInt(nullifierTreeData.root),
          NULLIFIER_TREE_HEIGHT
        );
        logger.info(`Stored leaf path valid: ${isValidStoredLeafPath}`);
      } catch (e) {
        logger.warn('Failed to load nullifier tree: ' + e.message);
      }
    } else {
      logger.warn(`Nullifier tree file not found: ${NULLIFIER_TREE_FILE}`);
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const proofFolder = (0, path_1.join)(PROOFS_DIR, timestamp);
    ensureDir(proofFolder);
    // Compute credentialHash and derive EdDSA key/signature
    const poseidon = (0, merkle_helper_1.getPoseidon)();
    if (!poseidon) throw new Error('Poseidon not initialized');
    const F = poseidon.F;
    const a = (0, merkle_helper_1.toField)(credentialData.examId);
    const b = (0, merkle_helper_1.toField)(credentialData.achievementLevel);
    const d = (0, merkle_helper_1.toField)(credentialData.issuer);
    const eVal = (0, merkle_helper_1.toField)(credentialData.privateKey);
    const credPose = poseidon([a, b, d, eVal]);
    const credentialHash = F.toObject(credPose);
    // Use the same holderSecret value that the circuit will use
    const holderSecret = eVal;
    const zk = require('@zk-kit/eddsa-poseidon/blake-2b');
    let priv = credentialData.privateKey;
    if (priv.startsWith('0x')) priv = priv.slice(2);
    const pub = zk.derivePublicKey(priv);
    if (!pub || !Array.isArray(pub) || pub.length < 2) {
      throw new Error('Failed to derive public key from private key');
    }
    const derivedPubKey = [String(pub[0]), String(pub[1])];
    const sig = zk.signMessage(priv, String(credentialHash));
    if (!sig) throw new Error('Failed to sign credentialHash');
    let derivedSignature;
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
    const inputPath = (0, path_1.join)(proofFolder, 'input.json');
    const canonicalPath = (0, path_1.join)(proofFolder, 'canonical-input.json');
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
      nullifier: String((0, merkle_helper_1.toField)(credentialData.nullifier)),
      examIdHash: String((0, merkle_helper_1.toField)(credentialData.examId)),
      achievementLevelHash: String(
        (0, merkle_helper_1.toField)(credentialData.achievementLevel)
      ),
      issuerHash: String((0, merkle_helper_1.toField)(credentialData.issuer)),
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
    (0, fs_1.writeFileSync)(inputPath, JSON.stringify(finalInput, null, 2));
    (0, fs_1.writeFileSync)(canonicalPath, JSON.stringify(finalInput, null, 2));
    logger.info(`Created input file: ${inputPath}`);
    logger.info(`Canonical input written: ${canonicalPath}`);
    const witnessPath = (0, path_1.join)(proofFolder, 'witness.wtns');
    const proofPath = (0, path_1.join)(proofFolder, 'proof.json');
    const publicSignalsPath = (0, path_1.join)(proofFolder, 'public.json');
    // Locate the compiled wasm for the circuit
    const wasmCandidates = [
      (0, path_1.join)(BUILD_DIR, `${CIRCUIT_NAME}.wasm`),
      (0, path_1.join)(BUILD_DIR, `${CIRCUIT_NAME}_js`, `${CIRCUIT_NAME}.wasm`),
    ];
    const wasmPath = wasmCandidates.find((p) => (0, fs_1.existsSync)(p));
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
    (0, fs_1.writeFileSync)(
      (0, path_1.join)(ROOT_DIR, '.last-canonical'),
      canonicalPath
    );
    logger.info(`📝 Updated .last-canonical marker: ${canonicalPath}`);
  } catch (error) {
    const duration = Date.now() - start;
    logger.proofGenerationError(error, 'script-proof-generation');
    logger.performance('proof-generation-failed', duration, {
      error: error.message,
    });
    logger.error(`❌ Proof generation failed: ${error.message}`);
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
