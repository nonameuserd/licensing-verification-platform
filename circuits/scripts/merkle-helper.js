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
exports.initPoseidon = initPoseidon;
exports.getPoseidon = getPoseidon;
exports.toField = toField;
exports.hashLeaf = hashLeaf;
exports.hashInternal = hashInternal;
exports.buildTree = buildTree;
exports.getProof = getProof;
exports.readTreeFile = readTreeFile;
exports.validateProof = validateProof;
exports.generateCredentialLeaf = generateCredentialLeaf;
exports.generateNullifierLeaf = generateNullifierLeaf;
exports.createEmptyTree = createEmptyTree;
exports.updateTree = updateTree;
const fs_1 = require('fs');
const crypto_1 = require('crypto');
// circomlibjs does not provide TypeScript type definitions, so we use `any` for the Poseidon hash function instance.
// This allows us to bypass type checking for the Poseidon function and its properties until type definitions are available.
// See: https://github.com/iden3/circomlibjs/issues/61

let poseidon;
/**
 * Initializes the Poseidon hash function instance.
 * Uses a dynamic import and casts to `any` to avoid TS2339 errors due to missing types in circomlibjs.
 */
async function initPoseidon() {
  if (!poseidon) {
    // Dynamically import circomlibjs to avoid static type checking errors (TS2339)

    const circomlibjs = await Promise.resolve().then(() =>
      __importStar(require('circomlibjs'))
    );
    poseidon = await circomlibjs.buildPoseidon();
  }
}
function getPoseidon() {
  if (!poseidon) {
    throw new Error(
      'Poseidon is not initialized. Call initPoseidon() before using Poseidon functions.'
    );
  }
  return poseidon;
}
function toField(x) {
  if (typeof x === 'bigint') return x;
  if (typeof x === 'number') return BigInt(x);
  if (typeof x === 'string') {
    // If string looks like a hex literal, ensure it has hex digits after 0x
    if (x.startsWith('0x')) {
      const hex = x.slice(2);
      // Accept only when there is at least one hex digit and all characters are valid hex
      if (hex.length > 0 && /^[0-9a-fA-F]+$/.test(hex)) {
        return BigInt(x);
      }
      // Otherwise fall through to hashing fallback
    }
    // Check if string is numeric (base 10)
    if (/^\d+$/.test(x)) return BigInt(x);
    // For non-numeric or invalid-hex strings, use a deterministic hash to derive a field element
    const hash = (0, crypto_1.createHash)('sha256').update(x).digest('hex');
    return BigInt('0x' + hash);
  }
  return BigInt(x);
}
// Poseidon hash function
function poseidonHash(inputs) {
  const poseidonInstance = getPoseidon();
  const res = poseidonInstance(inputs);
  // poseidon returns a BigNumber object, convert to bigint
  return poseidonInstance.F.toObject(res);
}
function hashLeaf(a, b) {
  return poseidonHash([a, b]);
}
function hashInternal(left, right) {
  return poseidonHash([left, right]);
}
function buildTree(rawLeaves, height) {
  const N = 1 << height;
  const leaves = new Array(N).fill(0n);
  for (let i = 0; i < Math.min(rawLeaves.length, N); i++) {
    const v = rawLeaves[i];
    // Accept either pre-hashed leaf (string/bigint) or pair [a,b]
    if (Array.isArray(v) && v.length === 2) {
      leaves[i] = hashLeaf(toField(v[0]), toField(v[1]));
    } else {
      leaves[i] = toField(v);
    }
  }
  const layers = [];
  layers.push(leaves);
  for (let level = 1; level <= height; level++) {
    const prev = layers[level - 1];
    const next = new Array(prev.length / 2).fill(0n);
    for (let i = 0; i < next.length; i++) {
      next[i] = hashInternal(prev[2 * i], prev[2 * i + 1]);
    }
    layers.push(next);
  }
  const root = layers[height][0];
  return { root, layers };
}
function getProof(layers, index, height) {
  const siblings = [];
  const pathIndices = [];
  let idx = index;
  for (let level = 0; level < height; level++) {
    const layer = layers[level];
    const pairIndex = idx ^ 1;
    const sibling = layer[pairIndex] || 0n;
    siblings.push(sibling.toString());
    pathIndices.push(idx % 2 === 0 ? 0 : 1);
    idx = Math.floor(idx / 2);
  }
  const leaf = layers[0][index] || 0n;
  return { siblings, pathIndices, leaf: leaf.toString() };
}
function readTreeFile(treeFilePath) {
  const raw = (0, fs_1.readFileSync)(treeFilePath, 'utf8');
  return JSON.parse(raw);
}
/**
 * Validates that a Merkle proof is consistent with the given root and leaf
 */
function validateProof(leaf, siblings, pathIndices, root, height) {
  let current = leaf;
  for (let i = 0; i < height; i++) {
    const sibling = BigInt(siblings[i] || '0');
    const pathIndex = pathIndices[i] || 0;
    if (pathIndex === 0) {
      // Current is left child
      current = hashInternal(current, sibling);
    } else {
      // Current is right child
      current = hashInternal(sibling, current);
    }
  }
  return current === root;
}
/**
 * Generates a credential leaf hash from credential data
 */
function generateCredentialLeaf(
  examIdHash,
  achievementLevelHash,
  issuerHash,
  holderSecret
) {
  // The circuit computes credentialHash as Poseidon([examIdHash, achievementLevelHash, issuerHash, holderSecret])
  // so we must construct the same value here to ensure the merkle leaf and the signed message match the circuit.
  return poseidonHash([
    toField(examIdHash),
    toField(achievementLevelHash),
    toField(issuerHash),
    toField(holderSecret),
  ]);
}
/**
 * Generates a nullifier leaf hash
 */
function generateNullifierLeaf(nullifier) {
  return toField(nullifier);
}
/**
 * Creates an empty tree with the specified height
 */
function createEmptyTree(height) {
  const N = 1 << height;
  const leaves = new Array(N).fill(0n);
  return buildTree(leaves, height);
}
/**
 * Updates a tree with a new leaf at the specified index
 */
function updateTree(existingLayers, newLeaf, index, height) {
  const N = 1 << height;
  const leaves = [...existingLayers[0]];
  if (index >= N) {
    throw new Error(`Index ${index} exceeds tree capacity ${N}`);
  }
  leaves[index] = newLeaf;
  return buildTree(leaves, height);
}
