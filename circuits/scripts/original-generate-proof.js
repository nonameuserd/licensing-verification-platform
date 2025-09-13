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
/**
 * Converts tree file data to leaf inputs for building a new tree
 * Tree file data contains the root and layers as strings, we need to extract the leaves
 */
function convertTreeFileToLeaves(treeData) {
  // The first layer (index 0) contains the leaves
  return treeData.layers[0] || [];
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
    const { stdout, stderr } = await asyncExec(command, { cwd: ROOT_DIR });
    if (stderr) logger.warn(stderr);
    // Avoid logging raw stdout/stderr which may contain sensitive artifacts
    const sanitize = (s) => {
      if (!s) return '';
      // redact long hex strings (private keys, nullifiers) and file paths that look like secrets
      return s
        .replace(/0x[a-fA-F0-9]{8,}/g, '[REDACTED_HEX]')
        .replace(
          /([A-Za-z0-9_/-]*)(?:private|secret|cosign|key)[A-Za-z0-9_/-]*/gi,
          '[REDACTED]'
        );
    };
    logger.info(`Completed: ${description}`);
    // Attach sanitized output at debug level to avoid leaking secrets in normal logs
    logger.debug(`stdout (sanitized):\n${sanitize(stdout)}`);
    if (stderr) logger.debug(`stderr (sanitized):\n${sanitize(stderr)}`);
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
    // Auto-generate Merkle proofs from separate credential and nullifier trees
    const CREDENTIAL_TREE_FILE = process.env['CREDENTIAL_TREE_FILE'];
    const NULLIFIER_TREE_FILE = process.env['NULLIFIER_TREE_FILE'];
    const CREDENTIAL_INDEX = process.env['CREDENTIAL_LEAF_INDEX']
      ? parseInt(process.env['CREDENTIAL_LEAF_INDEX'], 10)
      : 0;
    const NULLIFIER_INDEX = process.env['NULLIFIER_LEAF_INDEX']
      ? parseInt(process.env['NULLIFIER_LEAF_INDEX'], 10)
      : 0;
    let merkleProof = new Array(0).fill('0');
    let merklePathIndices = [];
    let merkleProofNullifier = new Array(0).fill('0');
    let merklePathIndicesNullifier = [];
    let storedNullifierLeaf = '0';
    let credentialRoot = '0';
    let nullifierRoot = '0';
    // Track whether the generated proofs validated against their roots
    // prefixed with _ to avoid unused-var lint if only used for informational purposes
    let _credentialProofValid = false;
    let _nullifierProofValid = false;
    // Determine tree height from expected merkleTreeHeight in circuit
    // Default to 20 (STANDARD_MERKLE_HEIGHT) if not provided via env
    const TREE_HEIGHT = process.env['MERKLE_TREE_HEIGHT']
      ? parseInt(process.env['MERKLE_TREE_HEIGHT'], 10)
      : 20;
    // Ensure merkle-related arrays are the expected length for the circuit
    if (!merkleProof || merkleProof.length !== TREE_HEIGHT) {
      merkleProof = new Array(TREE_HEIGHT).fill('0');
    }
    if (!merklePathIndices || merklePathIndices.length !== TREE_HEIGHT) {
      merklePathIndices = new Array(TREE_HEIGHT).fill(0);
    }
    if (!merkleProofNullifier || merkleProofNullifier.length !== TREE_HEIGHT) {
      merkleProofNullifier = new Array(TREE_HEIGHT).fill('0');
    }
    if (
      !merklePathIndicesNullifier ||
      merklePathIndicesNullifier.length !== TREE_HEIGHT
    ) {
      merklePathIndicesNullifier = new Array(TREE_HEIGHT).fill(0);
    }
    // Handle credential tree
    if (CREDENTIAL_TREE_FILE && (0, fs_1.existsSync)(CREDENTIAL_TREE_FILE)) {
      try {
        const credentialTreeData = (0, merkle_helper_1.readTreeFile)(
          CREDENTIAL_TREE_FILE
        );
        const credentialLeaves = convertTreeFileToLeaves(credentialTreeData);
        const { root: credRoot, layers: credLayers } = (0,
        merkle_helper_1.buildTree)(credentialLeaves, TREE_HEIGHT);
        const credProof = (0, merkle_helper_1.getProof)(
          credLayers,
          CREDENTIAL_INDEX,
          TREE_HEIGHT
        );
        merkleProof = credProof.siblings;
        merklePathIndices = credProof.pathIndices;
        credentialRoot = credRoot.toString();
        // Validate the credential proof
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
          credRoot,
          TREE_HEIGHT
        );
        _credentialProofValid = !!isValidProof;
        if (!isValidProof) {
          logger.warn(
            'Generated credential proof failed validation - this may indicate tree inconsistency'
          );
        }
        logger.info(
          `Auto-generated credential Merkle proof from ${CREDENTIAL_TREE_FILE}`
        );
        logger.info(`Credential root: ${credentialRoot}`);
        logger.info(`Credential proof valid: ${isValidProof}`);
      } catch (e) {
        logger.warn(
          'Failed to auto-generate credential Merkle proof: ' + e.message
        );
      }
    } else {
      logger.info(
        'No CREDENTIAL_TREE_FILE provided; generating a per-run credential Merkle tree with the provided credential at the configured index.'
      );
      try {
        // Build a tree with the credential leaf at CREDENTIAL_INDEX and zeros elsewhere.
        const N = 1 << TREE_HEIGHT;
        // Create an array of leaves (as raw inputs accepted by buildTree)
        const credLeaves = new Array(N).fill('0');
        const credentialLeaf = (0, merkle_helper_1.generateCredentialLeaf)(
          credentialData.examId,
          credentialData.achievementLevel,
          credentialData.issuer,
          credentialData.privateKey
        );
        // place the credential leaf at the configured index
        credLeaves[CREDENTIAL_INDEX] = credentialLeaf.toString();
        const { root: credRoot, layers: credLayers } = (0,
        merkle_helper_1.buildTree)(credLeaves, TREE_HEIGHT);
        const credProof = (0, merkle_helper_1.getProof)(
          credLayers,
          CREDENTIAL_INDEX,
          TREE_HEIGHT
        );
        merkleProof = credProof.siblings;
        merklePathIndices = credProof.pathIndices;
        credentialRoot = credRoot.toString();
        const isValidProof = (0, merkle_helper_1.validateProof)(
          credentialLeaf,
          credProof.siblings,
          credProof.pathIndices,
          credRoot,
          TREE_HEIGHT
        );
        _credentialProofValid = !!isValidProof;
        if (!isValidProof) {
          logger.warn('Generated in-memory credential proof failed validation');
        }
        logger.info('Generated in-memory credential Merkle tree');
      } catch (e) {
        logger.warn(
          'Failed to generate in-memory credential tree: ' + e.message
        );
      }
    }
    // Handle nullifier tree
    if (NULLIFIER_TREE_FILE && (0, fs_1.existsSync)(NULLIFIER_TREE_FILE)) {
      try {
        const nullifierTreeData = (0, merkle_helper_1.readTreeFile)(
          NULLIFIER_TREE_FILE
        );
        const nullifierLeaves = convertTreeFileToLeaves(nullifierTreeData);
        const { root: nullRoot, layers: nullLayers } = (0,
        merkle_helper_1.buildTree)(nullifierLeaves, TREE_HEIGHT);
        const nullProof = (0, merkle_helper_1.getProof)(
          nullLayers,
          NULLIFIER_INDEX,
          TREE_HEIGHT
        );
        merkleProofNullifier = nullProof.siblings;
        merklePathIndicesNullifier = nullProof.pathIndices;
        storedNullifierLeaf = nullProof.leaf;
        nullifierRoot = nullRoot.toString();
        // Validate the nullifier proof
        const nullifierLeaf = (0, merkle_helper_1.generateNullifierLeaf)(
          credentialData.nullifier
        );
        const isValidNullifierProof = (0, merkle_helper_1.validateProof)(
          nullifierLeaf,
          nullProof.siblings,
          nullProof.pathIndices,
          nullRoot,
          TREE_HEIGHT
        );
        _nullifierProofValid = !!isValidNullifierProof;
        if (!isValidNullifierProof) {
          logger.warn(
            'Generated nullifier proof failed validation - this may indicate tree inconsistency'
          );
        }
        logger.info(
          `Auto-generated nullifier Merkle proof from ${NULLIFIER_TREE_FILE}`
        );
        logger.info(`Nullifier root: ${nullifierRoot}`);
        logger.info(`Nullifier proof valid: ${isValidNullifierProof}`);
      } catch (e) {
        logger.warn(
          'Failed to auto-generate nullifier Merkle proof: ' + e.message
        );
      }
    } else {
      logger.info(
        'No NULLIFIER_TREE_FILE provided; generating a per-run nullifier Merkle tree with the provided nullifier at the configured index.'
      );
      try {
        const N = 1 << TREE_HEIGHT;
        const nullLeaves = new Array(N).fill('0');
        const nullLeaf = (0, merkle_helper_1.generateNullifierLeaf)(
          credentialData.nullifier
        );
        nullLeaves[NULLIFIER_INDEX] = nullLeaf.toString();
        const { root: nullRoot, layers: nullLayers } = (0,
        merkle_helper_1.buildTree)(nullLeaves, TREE_HEIGHT);
        const nullProof = (0, merkle_helper_1.getProof)(
          nullLayers,
          NULLIFIER_INDEX,
          TREE_HEIGHT
        );
        merkleProofNullifier = nullProof.siblings;
        merklePathIndicesNullifier = nullProof.pathIndices;
        storedNullifierLeaf = nullProof.leaf;
        nullifierRoot = nullRoot.toString();
        const isValidNullifierProof = (0, merkle_helper_1.validateProof)(
          nullLeaf,
          nullProof.siblings,
          nullProof.pathIndices,
          nullRoot,
          TREE_HEIGHT
        );
        _nullifierProofValid = !!isValidNullifierProof;
        if (!isValidNullifierProof) {
          logger.warn('Generated in-memory nullifier proof failed validation');
        }
        logger.info('Generated in-memory nullifier Merkle tree');
      } catch (e) {
        logger.warn(
          'Failed to generate in-memory nullifier tree: ' + e.message
        );
      }
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const proofFolder = (0, path_1.join)(PROOFS_DIR, timestamp);
    ensureDir(proofFolder);
    // Merge auto-generated merkle fields into input
    const fullInput = {
      ...credentialData,
      merkleProof,
      merklePathIndices,
      merkleProofNullifier,
      merklePathIndicesNullifier,
      storedNullifierLeaf,
      credentialRoot,
      nullifierRoot,
    };
    // Helper: convert text to fixed-length byte arrays (utf8), pad with 0, truncate if too long
    const toFixedLengthBytesFromString = (s, length) => {
      const buf = Buffer.from(s, 'utf8');
      if (buf.length >= length) return Array.from(buf.slice(0, length));
      const arr = Array.from(buf);
      while (arr.length < length) arr.push(0);
      return arr;
    };
    // Helper: convert hex string (0x...) to fixed-length byte array, pad with 0 on the right
    const toFixedLengthBytesFromHex = (hex, length) => {
      const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
      const normalized = clean.length % 2 === 1 ? `0${clean}` : clean;
      const buf = Buffer.from(normalized, 'hex');
      if (buf.length > length) {
        // If too long, truncate to the first `length` bytes
        return Array.from(buf.slice(0, length));
      }
      const arr = Array.from(buf);
      while (arr.length < length) arr.push(0);
      return arr;
    };
    // Build a properly typed input object for snarkjs (numbers and numeric arrays)
    let wasmInput;
    try {
      // Field sizes derived from circuit symbol (`build/ExamProof.sym`)
      const holderNameBytes = toFixedLengthBytesFromString(
        fullInput.holderName,
        32
      );
      const licenseNumberBytes = toFixedLengthBytesFromString(
        fullInput.licenseNumber,
        16
      );
      const examIdBytes = toFixedLengthBytesFromString(fullInput.examId, 16);
      const achievementLevelBytes = toFixedLengthBytesFromString(
        fullInput.achievementLevel,
        8
      );
      // Dates in circuit are 8-byte fields. Convert YYYY-MM-DD -> YYYYMMDD and encode
      const issuedCompact = fullInput.issuedDate.replace(/-/g, '');
      const expiryCompact = fullInput.expiryDate.replace(/-/g, '');
      const dobCompact = fullInput.holderDOB.replace(/-/g, '');
      const issuedDateBytes = toFixedLengthBytesFromString(issuedCompact, 8);
      const expiryDateBytes = toFixedLengthBytesFromString(expiryCompact, 8);
      const holderDOBBytes = toFixedLengthBytesFromString(dobCompact, 8);
      const issuerBytes = toFixedLengthBytesFromString(fullInput.issuer, 32);
      // Nullifier and privateKey are hex values; convert to bytes arrays of expected length
      const nullifierBytes = toFixedLengthBytesFromHex(fullInput.nullifier, 8);
      const privateKeyBytes = toFixedLengthBytesFromHex(
        fullInput.privateKey,
        32
      );
      // Preserve merkle proof elements as strings to avoid JS Number
      // exponential notation for very large integers. We'll stringify when
      // writing canonical JSON for snarkjs consumption.
      const merkleProofNums = merkleProof.map((v) =>
        typeof v === 'string' ? v : String(v)
      );
      const merkleProofNullifierNums = merkleProofNullifier.map((v) =>
        typeof v === 'string' ? v : String(v)
      );
      const merklePathIndicesNums = merklePathIndices.map((v) => Number(v));
      const merklePathIndicesNullifierNums = merklePathIndicesNullifier.map(
        (v) => Number(v)
      );
      // Ensure scalar leaves/roots are numbers (not string "0")
      // Keep leaves/roots as strings to preserve full integer precision.
      const storedNullifierLeafNum = String(storedNullifierLeaf || '0');
      const credentialRootNum = String(credentialRoot || '0');
      const nullifierRootNum = String(nullifierRoot || '0');
      wasmInput = {
        holderName: holderNameBytes,
        licenseNumber: licenseNumberBytes,
        examId: examIdBytes,
        achievementLevel: achievementLevelBytes,
        issuedDate: issuedDateBytes,
        expiryDate: expiryDateBytes,
        issuer: issuerBytes,
        nullifier: nullifierBytes,
        holderDOB: holderDOBBytes,
        privateKey: privateKeyBytes,
        merkleProof: merkleProofNums,
        merklePathIndices: merklePathIndicesNums,
        merkleProofNullifier: merkleProofNullifierNums,
        merklePathIndicesNullifier: merklePathIndicesNullifierNums,
        storedNullifierLeaf: storedNullifierLeafNum,
        credentialRoot: credentialRootNum,
        nullifierRoot: nullifierRootNum,
      };
    } catch (e) {
      logger.error('Failed to encode inputs into fixed-length byte arrays', e);
      throw e;
    }
    // Map to the circuit's expected top-level signals
    const circuitInput = {
      // EdDSA public key and signature are optional in CI; use zeros for smoke tests.
      pubKey: [0, 0],
      credentialRoot: String(wasmInput.credentialRoot || 0),
      nullifierRoot: String(wasmInput.nullifierRoot || 0),
      currentTime: Math.floor(Date.now() / 1000),
      signature: [0, 0],
      // nullifier is a field element (accept hex input)
      nullifier: String((0, merkle_helper_1.toField)(fullInput.nullifier)),
      // Circuit expects pre-hashed fields for these inputs
      examIdHash: String((0, merkle_helper_1.toField)(fullInput.examId)),
      achievementLevelHash: String(
        (0, merkle_helper_1.toField)(fullInput.achievementLevel)
      ),
      issuerHash: String((0, merkle_helper_1.toField)(fullInput.issuer)),
      // holderSecret in tests uses the private key as the secret commitment
      holderSecret: String((0, merkle_helper_1.toField)(fullInput.privateKey)),
      // Merkle-related inputs (arrays of field elements)
      merkleProof: wasmInput.merkleProof.map((v) => String(v)),
      merkleProofNullifier: wasmInput.merkleProofNullifier.map((v) =>
        String(v)
      ),
      merklePathIndices: wasmInput.merklePathIndices.map((v) => String(v)),
      merklePathIndicesNullifier: wasmInput.merklePathIndicesNullifier.map(
        (v) => String(v)
      ),
      storedNullifierLeaf: String(wasmInput.storedNullifierLeaf || 0),
    };
    // Compute credentialHash and derive EdDSA key/signature so the circuit
    // receives a matching public key and signature for the Poseidon-based
    // message (credentialHash). This is production-critical: if Poseidon or
    // the signature derivation fails, abort early (no silent fallbacks).
    let derivedPubKey;
    let derivedSignature;
    {
      // getPoseidon should be initialized by initPoseidon() above
      const poseidon = (0, merkle_helper_1.getPoseidon)();
      if (!poseidon) throw new Error('Poseidon not initialized');
      const F = poseidon.F;
      const a = (0, merkle_helper_1.toField)(fullInput.examId);
      const b = (0, merkle_helper_1.toField)(fullInput.achievementLevel);
      const d = (0, merkle_helper_1.toField)(fullInput.issuer);
      const eVal = (0, merkle_helper_1.toField)(fullInput.privateKey);
      const credPose = poseidon([a, b, d, eVal]);
      const credentialHash = F.toObject(credPose);
      // Use zk-kit eddsa (blake-2b) to derive pubKey and sign the credentialHash
      const zk = require('@zk-kit/eddsa-poseidon/blake-2b');
      let priv = fullInput.privateKey;
      if (typeof priv === 'string' && priv.startsWith('0x'))
        priv = priv.slice(2);
      if (
        typeof zk.derivePublicKey !== 'function' ||
        typeof zk.signMessage !== 'function'
      ) {
        throw new Error('EdDSA-Poseidon library missing required functions');
      }
      const pub = zk.derivePublicKey(priv);
      if (!pub || !Array.isArray(pub) || pub.length < 2) {
        throw new Error('Failed to derive public key from private key');
      }
      derivedPubKey = [String(pub[0]), String(pub[1])];
      const sig = zk.signMessage(priv, String(credentialHash));
      if (!sig) throw new Error('Failed to sign credentialHash');
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
    }
    const inputPath = (0, path_1.join)(proofFolder, 'input.json');
    const canonicalPath = (0, path_1.join)(proofFolder, 'canonical-input.json');
    // Write the basic input.json immediately. Do NOT write the canonical
    // canonical-input.json here — defer writing the canonical file until after
    // we construct the sym-driven `finalInput` below so it is authoritative
    // about which signals are scalars vs arrays.
    (0, fs_1.writeFileSync)(inputPath, JSON.stringify(circuitInput, null, 2));
    logger.info(`Created input file: ${inputPath}`);
    const witnessPath = (0, path_1.join)(proofFolder, 'witness.wtns');
    const proofPath = (0, path_1.join)(proofFolder, 'proof.json');
    const publicSignalsPath = (0, path_1.join)(proofFolder, 'public.json');
    // Locate the compiled wasm for the circuit. circom outputs wasm sometimes under
    // build/<CIRCUIT>_js/<CIRCUIT>.wasm (ExamProof_js/ExamProof.wasm). Try known locations.
    const wasmCandidates = [
      (0, path_1.join)(BUILD_DIR, `${CIRCUIT_NAME}.wasm`),
      (0, path_1.join)(BUILD_DIR, `${CIRCUIT_NAME}_js`, `${CIRCUIT_NAME}.wasm`),
      (0, path_1.join)(BUILD_DIR, `${CIRCUIT_NAME}_js`, `${CIRCUIT_NAME}.wasm`),
    ];
    const wasmPath = wasmCandidates.find((p) => (0, fs_1.existsSync)(p));
    if (!wasmPath) {
      throw new Error(
        `Missing wasm file for circuit. Checked: ${wasmCandidates.join(', ')}`
      );
    }
    // Build final input using the authoritative symbol file if available.
    // This parses `build/<CIRCUIT>.sym` to get exact top-level input names and array lengths
    // (preferred), and falls back to probing the wasm witness calculator when sym is missing.
    try {
      const symPath = (0, path_1.join)(BUILD_DIR, `${CIRCUIT_NAME}.sym`);
      let symContent = null;
      if ((0, fs_1.existsSync)(symPath)) {
        symContent = (0, fs_1.readFileSync)(symPath, 'utf8');
      }
      // Compute Poseidon-based credentialHash and a small Poseidon-based
      // checksum (_sumChecks) using the same Poseidon instance used by the
      // circuit. This ensures we emit the exact field value representation
      // expected by the circuit (no lossy JS numeric formatting).
      // Compute Poseidon-based credentialHash and checksum. Production: fail if Poseidon not available.
      const poseidon = (0, merkle_helper_1.getPoseidon)();
      if (!poseidon) throw new Error('Poseidon not initialized');
      // If we derived a pubKey/signature above, prefer those values when
      // constructing the candidate value map so the canonical JSON emitted
      // will contain the actual signature/public-key expected by the circuit.
      // derivedPubKey and derivedSignature must exist in production
      if (!derivedPubKey || !derivedSignature) {
        throw new Error('Derived signature or public key missing');
      }
      const pubKeyArray = [String(derivedPubKey[0]), String(derivedPubKey[1])];
      const signatureRArray = [
        String(derivedSignature.R8[0]),
        String(derivedSignature.R8[1]),
      ];
      const signatureSScalar = String(derivedSignature.S);
      // Require merkle proofs validated earlier; abort if not valid
      if (!_credentialProofValid)
        throw new Error('Credential Merkle proof validation failed');
      if (!_nullifierProofValid)
        throw new Error('Nullifier Merkle proof validation failed');
      // Only include actual INPUT signals (not outputs) that the circuit expects
      const candidateValues = {
        // Core circuit inputs (from the circuit definition)
        pubKey: { array: pubKeyArray },
        credentialRoot: { scalar: String(wasmInput.credentialRoot || 0) },
        nullifierRoot: { scalar: String(wasmInput.nullifierRoot || 0) },
        currentTime: { scalar: String(Math.floor(Date.now() / 1000)) },
        signatureS: { scalar: signatureSScalar },
        signatureR: { array: signatureRArray },
        nullifier: {
          scalar: String((0, merkle_helper_1.toField)(fullInput.nullifier)),
        },
        examIdHash: {
          scalar: String((0, merkle_helper_1.toField)(fullInput.examId)),
        },
        achievementLevelHash: {
          scalar: String(
            (0, merkle_helper_1.toField)(fullInput.achievementLevel)
          ),
        },
        issuerHash: {
          scalar: String((0, merkle_helper_1.toField)(fullInput.issuer)),
        },
        holderSecret: {
          scalar: String((0, merkle_helper_1.toField)(fullInput.privateKey)),
        },
        // Merkle proof arrays
        merkleProof: { array: wasmInput.merkleProof.map((v) => String(v)) },
        merkleProofNullifier: {
          array: wasmInput.merkleProofNullifier.map((v) => String(v)),
        },
        merklePathIndices: {
          array: wasmInput.merklePathIndices.map((v) => String(v)),
        },
        merklePathIndicesNullifier: {
          array: wasmInput.merklePathIndicesNullifier.map((v) => String(v)),
        },
        storedNullifierLeaf: {
          scalar: String(wasmInput.storedNullifierLeaf || 0),
        },
      };
      const symSizes = {};
      if (symContent) {
        // We must prefer explicit scalar declarations over incidental
        // indexed entries. Some .sym files emit both `main.foo` and
        // `main.foo[0]` which would otherwise mark `foo` as an array of
        // length 1. Treat an explicit scalar declaration as authoritative.
        const lines = symContent.split(/\r?\n/);
        const scalarDeclared = {};
        const arrayMaxIndex = {};
        for (const l of lines) {
          if (!l) continue;
          const parts = l.split(',');
          if (parts.length < 4) continue;
          const sig = parts[3].trim();
          if (!sig.startsWith('main.')) continue;
          const withoutMain = sig.slice('main.'.length);
          const m = withoutMain.match(/^([a-zA-Z0-9_]+)\[(\d+)\]$/);
          if (m) {
            const base = m[1];
            const idx = parseInt(m[2], 10);
            arrayMaxIndex[base] = Math.max(arrayMaxIndex[base] ?? 0, idx + 1);
          } else {
            const base = withoutMain;
            scalarDeclared[base] = true;
          }
        }
        // Finalize sizes: if scalar declared, size = 0. Otherwise use array max or 0.
        for (const base of Object.keys({
          ...arrayMaxIndex,
          ...scalarDeclared,
        })) {
          if (scalarDeclared[base]) {
            symSizes[base] = 0;
          } else {
            symSizes[base] = arrayMaxIndex[base] ?? 0;
          }
        }
      }
      // Diagnostic: expose the parsed symbol sizes for debugging test failures
      logger.debug(`Parsed symSizes: ${JSON.stringify(symSizes)}`);
      // Also print to stdout to ensure test runners (which may not capture
      // debug logs) can inspect the parsed sizes when debugging failures.
      try {
        // Keep machine-friendly single-line output
        // Example: SYM_SIZES={"holderName":32,...}
        logger.info(`SYM_SIZES=${JSON.stringify(symSizes)}`);
      } catch (e) {
        void e;
      }
      // Attempt to load the wasm witness calculator so we can probe input signal
      // sizes directly from the wasm. This is more accurate than relying solely
      // on the .sym file which includes many internal signals. Proceed quietly
      // if the witness_calculator is not available.
      // The following block interacts with generated wasm artifacts and
      // dynamic symbol probing. These modules lack TypeScript types so we
      // allow a narrow `no-explicit-any` exemption for this small region.

      let wasmInstance = null;
      try {
        const wcBuilder = require((0, path_1.join)(
          BUILD_DIR,
          `${CIRCUIT_NAME}_js`,
          'witness_calculator.js'
        ));
        const code = (0, fs_1.readFileSync)(wasmPath);
        const wc = await wcBuilder(code);
        wasmInstance = wc.instance;
      } catch (err) {
        void err;
        wasmInstance = null;
      }
      logger.debug(`wasmInstance available: ${!!wasmInstance}`);
      // Build finalInput in a single pass: probe wasm (preferred) then symSizes
      // finalInput is dynamic and driven by runtime symbol probing; allow a
      // tightly-scoped any here.

      const finalInput = {};
      const fnvHash = (str) => {
        const uint64_max = BigInt(2) ** BigInt(64);
        let hash = BigInt('0xCBF29CE484222325');
        for (let i = 0; i < str.length; i++) {
          hash ^= BigInt(str.charCodeAt(i));
          hash *= BigInt(0x100000001b3);
          hash %= uint64_max;
        }
        let shash = hash.toString(16);
        if (shash.length < 16) shash = '0'.repeat(16 - shash.length) + shash;
        return shash;
      };
      for (const key of Object.keys(candidateValues)) {
        const cand = candidateValues[key];
        let signalSize = null;
        // If we have the .sym file, treat it as authoritative for which
        // top-level signals exist. Only consider keys present in the
        // sym-derived map. This prevents accidentally passing values for
        // helper/test-only keys that are not actual circuit inputs.
        if (symContent) {
          if (key in symSizes) {
            signalSize = symSizes[key];
          } else {
            // Key not declared in symbol -> skip
            continue;
          }
        } else if (wasmInstance) {
          try {
            const h = fnvHash(key);
            const hMSB = parseInt(h.slice(0, 8), 16);
            const hLSB = parseInt(h.slice(8, 16), 16);
            const s = wasmInstance.exports.getInputSignalSize(hMSB, hLSB);
            signalSize = s === -1 ? null : s;
          } catch (err) {
            void err;
            signalSize = null;
          }
        }
        // If neither sym nor wasm indicate this signal exists, skip it
        if (signalSize === null) continue;
        // Diagnostic: record decision inputs
        logger.debug(
          `decide: key=${key} signalSize=${signalSize} hasScalar=${
            cand.scalar !== undefined
          } hasArray=${cand.array !== undefined}`
        );
        // Scalar (signalSize === 0)
        if (signalSize === 0) {
          if (cand.scalar !== undefined) {
            finalInput[key] = cand.scalar;
            logger.debug(`final[${key}]=scalar (from cand.scalar)`);
            continue;
          }
          // If we only have an array of bytes, pack it into a field
          if (cand.array !== undefined && cand.array.length > 0) {
            const packed = cand.array
              .map((v) => {
                const n = typeof v === 'string' ? v : String(v);
                const num = parseInt(n, 10);
                const b = num & 0xff;
                return b.toString(16).padStart(2, '0');
              })
              .join('');
            try {
              // Pack into a field and ensure we set a primitive (never an array)
              finalInput[key] = String(
                (0, merkle_helper_1.toField)('0x' + packed)
              );
              logger.debug(
                `final[${key}]=scalar (packed from array, len=${
                  cand.array?.length ?? 0
                })`
              );
            } catch (err) {
              void err;
              // Fallback to string '0' if packing fails
              finalInput[key] = '0';
            }
            continue;
          }
          // As a last resort use '0'
          finalInput[key] = '0';
          continue;
        }
        // Array expected: ensure exact length and string elements
        if (cand.array !== undefined) {
          const arr = cand.array.slice(0, signalSize).map((v) => String(v));
          while (arr.length < signalSize) arr.push('0');
          finalInput[key] = arr;
          logger.debug(`final[${key}]=array (len=${arr.length})`);
        } else if (cand.scalar !== undefined) {
          finalInput[key] = new Array(signalSize).fill(String(cand.scalar));
          logger.debug(
            `final[${key}]=array_filled_from_scalar (len=${signalSize})`
          );
        } else {
          // Fill with zeros if we have no candidate value
          finalInput[key] = new Array(signalSize).fill('0');
          logger.debug(`final[${key}]=array_zeros (len=${signalSize})`);
        }
      }
      // Normalize finalInput to match .sym-derived signal sizes exactly.
      // For scalar signals (symSizes[k] === 0) ensure a primitive string/number
      // is emitted. For array signals ensure an array of the exact length is
      // emitted (padding or truncating as necessary). This makes the
      // canonical JSON deterministic and avoids single-element-array vs
      // primitive mismatches that break tests.
      const normalizeFinalInput = () => {
        for (const k of Object.keys(finalInput)) {
          try {
            const expected = symSizes[k];
            const val = finalInput[k];
            // If we don't have a size for this signal, skip normalization.
            if (expected === undefined || expected === null) continue;
            // If the symbol declares a scalar, prefer a primitive value.
            if (expected === 0) {
              // Scalar: always convert arrays to a primitive, prefer candidate scalar if present.
              if (Array.isArray(val)) {
                const cand = candidateValues[k];
                if (cand && cand.scalar !== undefined) {
                  finalInput[k] = cand.scalar;
                } else {
                  finalInput[k] = val.length > 0 ? val[0] : '0';
                }
              }
              // Leave primitives as-is (string/number)
              continue;
            }
            // Array expected: ensure array of exact length with string elements
            if (Array.isArray(val)) {
              const arr = val.map((v) => String(v));
              // Truncate or pad with '0' to match expected length
              finalInput[k] = arr
                .slice(0, expected)
                .concat(
                  new Array(Math.max(0, expected - arr.length)).fill('0')
                );
              // Edge-case: some toolchains or earlier code produced single-element
              // arrays for values that are semantically scalars. If the array has
              // length 1 and we have a scalar candidate, prefer emitting the scalar
              // to avoid brittle mismatches in tests and downstream consumers.

              const cand = candidateValues[k];
              if (
                finalInput[k] &&
                Array.isArray(finalInput[k]) &&
                finalInput[k].length === 1 &&
                cand &&
                cand.scalar !== undefined
              ) {
                finalInput[k] = cand.scalar;
              }
            } else if (val !== undefined) {
              // Fill array from scalar value
              finalInput[k] = new Array(expected).fill(String(val));
            } else {
              finalInput[k] = new Array(expected).fill('0');
            }
          } catch (err) {
            // Non-fatal normalization error: leave the original value
            logger.debug(`Normalization ignored key=${k}: ${err.message}`);
          }
        }
      };
      if (symContent) normalizeFinalInput();
      // Custom replacer to ensure large numeric-like strings remain strings
      const jsonReplacer = (_key, value) => {
        // If a value is a number, convert to string to avoid JS exponential
        // formatting for integers larger than Number.MAX_SAFE_INTEGER.
        if (typeof value === 'number') {
          return String(value);
        }
        // If it's a string that looks like a large float in exponential
        // notation, keep it as-is. We avoid parsing to Number anywhere.
        return value;
      };
      // Expand scientific-notation strings (e.g. "1.234e+77") into
      // full decimal strings so downstream tools (snarkjs) don't see
      // exponential notation. This operates recursively over the finalInput
      // object and returns a new object suitable for JSON.stringify.
      const expandSciNotation = (s) => {
        // Quick path: if no exponent marker, return original
        if (!/[eE]/.test(s)) return s;
        const parts = s.split(/[eE]/);
        if (parts.length !== 2) return s;
        let mant = parts[0];
        const exp = parseInt(parts[1], 10);
        if (Number.isNaN(exp)) return s;
        // Remove leading + on mantissa and normalize sign
        let sign = '';
        if (mant.startsWith('+')) mant = mant.slice(1);
        if (mant.startsWith('-')) {
          sign = '-';
          mant = mant.slice(1);
        }
        // Split mantissa into integer and fractional parts
        const idx = mant.indexOf('.');
        let intPart = idx >= 0 ? mant.slice(0, idx) : mant;
        const fracPart = idx >= 0 ? mant.slice(idx + 1) : '';
        // Remove any leading zeros on integer part for clean assembly
        if (intPart === '') intPart = '0';
        // Shift decimal point by exponent
        if (exp >= 0) {
          // Move digits from fracPart into intPart as exponent allows
          if (exp >= fracPart.length) {
            const zeros = '0'.repeat(exp - fracPart.length);
            void zeros;
            const newInt = intPart + fracPart + zeros;
            // Trim leading zeros except keep single zero
            const trimmed = newInt.replace(/^0+(?!$)/, '');
            return sign + (trimmed === '' ? '0' : trimmed);
          } else {
            const newInt = intPart + fracPart.slice(0, exp);
            const newFrac = fracPart.slice(exp);
            return sign + newInt.replace(/^0+(?!$)/, '') + '.' + newFrac;
          }
        } else {
          // Negative exponent: prepend zeros after decimal
          const zeros = '0'.repeat(Math.abs(exp) - intPart.length);
          void zeros;
          if (intPart !== '0') {
            // e.g. 12.34e-3 -> 0.01234
            const combined = intPart + fracPart;
            const shift = Math.abs(exp);
            const padded =
              '0'.repeat(Math.max(0, shift - combined.length)) + combined;
            const pos = padded.length - shift;
            const result = '0.' + padded.slice(pos);
            return sign + result.replace(/^0+(?=\.)/, '');
          }
          // intPart === '0'
          return (
            sign + '0.' + '0'.repeat(Math.abs(exp) - 1) + intPart + fracPart
          );
        }
      };
      const convertSciStrings = (obj) => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'string') {
          // If string contains exponent notation, expand it
          if (/[eE][+-]?\d+/.test(obj)) return expandSciNotation(obj);
          return obj;
        }
        if (typeof obj === 'number') {
          // Convert numbers to strings to avoid JS formatting
          return String(obj);
        }
        if (Array.isArray(obj)) {
          const arr = obj;
          return arr.map((v) => convertSciStrings(v));
        }
        if (typeof obj === 'object') {
          const rec = obj;
          const out = {};
          for (const k of Object.keys(rec)) out[k] = convertSciStrings(rec[k]);
          return out;
        }
        return obj;
      };
      const serializableFinal = convertSciStrings(finalInput);
      // Emit a flat mapping using the signal names that the circuit expects.
      // Based on testing, the circuit expects unprefixed names (e.g. `nullifier`,
      // `merkleProof`) without the `main.` prefix.
      const flatSerializable = {};
      for (const k of Object.keys(serializableFinal)) {
        const val = serializableFinal[k];
        // Determine expected length from symSizes if available; fall back to
        // array length or treat as scalar.
        const expected =
          symSizes && symSizes[k] !== undefined ? symSizes[k] : undefined;
        // Use unprefixed signal names as the circuit expects them
        const outKey = k;
        if (Array.isArray(val)) {
          const len = expected === undefined ? val.length : expected;
          if (len === 0) {
            // scalar expected but we have an array; emit the first element as scalar
            flatSerializable[outKey] = val.length > 0 ? String(val[0]) : '0';
          } else {
            const outArr = [];
            for (let i = 0; i < len; i++) {
              outArr.push(String(val[i] ?? '0'));
            }
            flatSerializable[outKey] = outArr;
          }
        } else {
          // Primitive -> emit as scalar under chosen outKey
          flatSerializable[outKey] = val === undefined ? '0' : String(val);
        }
      }
      // Write flattened JSON for both input and canonical paths
      (0, fs_1.writeFileSync)(
        inputPath,
        JSON.stringify(flatSerializable, jsonReplacer, 2)
      );
      try {
        // DEBUG: emit a single-line JSON snapshot of key signal values that
        // frequently cause mismatches in tests. This helps us see whether the
        // finalInput values are arrays or primitives at the time of writing.
        try {
          const inspectKeys = [
            'nullifier',
            'storedNullifierLeaf',
            'credentialRoot',
            'nullifierRoot',
            'currentTime',
            'examIdHash',
            'achievementLevelHash',
            'issuerHash',
            'holderSecret',
          ];
          const snapshot = {};
          for (const k of inspectKeys) {
            if (k in finalInput) snapshot[k] = finalInput[k];
          }
          logger.info('FINAL_INPUT_SNAPSHOT=' + JSON.stringify(snapshot));
        } catch (e) {
          void e;
        }
        (0, fs_1.writeFileSync)(
          canonicalPath,
          JSON.stringify(flatSerializable, jsonReplacer, 2)
        );
        logger.info(`Canonical input (sym-driven) written: ${canonicalPath}`);
        // Write a small marker file that points to the canonical path so
        // test harnesses or external tools can deterministically discover
        // which canonical file was produced by this run. Also write a
        // top-level marker (`.last-canonical`) inside the circuits root so
        // callers that don't want to scan timestamped folders can find the
        // most-recent canonical file reliably. Print a single-line stdout
        // marker for processes that capture stdout.
        try {
          (0, fs_1.writeFileSync)(
            (0, path_1.join)(proofFolder, '.canonical-path'),
            canonicalPath
          );
          // ensure the marker is flushed to disk
          try {
            const fd = (0, fs_1.openSync)(
              (0, path_1.join)(proofFolder, '.canonical-path'),
              'r'
            );
            (0, fs_1.fsyncSync)(fd);
            (0, fs_1.closeSync)(fd);
          } catch (e) {
            void e;
          }
        } catch (e) {
          logger.debug(`Failed to write .canonical-path marker: ${e.message}`);
        }
        try {
          // Top-level marker inside the circuits root (ROOT_DIR)
          (0, fs_1.writeFileSync)(
            (0, path_1.join)(ROOT_DIR, '.last-canonical'),
            canonicalPath
          );
          try {
            const fd2 = (0, fs_1.openSync)(
              (0, path_1.join)(ROOT_DIR, '.last-canonical'),
              'r'
            );
            (0, fs_1.fsyncSync)(fd2);
            (0, fs_1.closeSync)(fd2);
          } catch (e) {
            void e;
          }
        } catch (e) {
          void e;
        }
        try {
          // Emit a single-line machine-parseable stdout marker to help
          // test runners capture the canonical path without scanning.
          // Keep this as plain logger.info so `execSync` callers can read it.
          // Example: CANONICAL_PATH=/abs/path/to/canonical-input.json
          logger.info(`CANONICAL_PATH=${canonicalPath}`);
        } catch (e) {
          void e;
        }
      } catch (e) {
        logger.warn(`Failed to write canonical input file: ${e.message}`);
      }
    } catch (e) {
      logger.error('Failed to build sym-driven canonical input: ' + e.message);
      throw e;
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
🔐 ZK-SNARK Proof Generation Script

Usage:
  ts-node generate-proof.ts [options]

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
  CREDENTIAL_TREE_FILE     Path to credential Merkle tree file
  NULLIFIER_TREE_FILE      Path to nullifier Merkle tree file
  CREDENTIAL_LEAF_INDEX    Index of credential in tree (default: 0)
  NULLIFIER_LEAF_INDEX     Index of nullifier in tree (default: 0)
  MERKLE_TREE_HEIGHT       Height of Merkle trees (default: 20)

Examples:
  # Generate proof with separate credential and nullifier trees
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
  ts-node generate-proof.ts
`);
  }
  main().catch((error) => {
    logger.error('Script failed:', error.message);
    process.exit(1);
  });
}
