import { readFileSync } from 'fs';
import { createHash } from 'crypto';
// Small, dependency-light Merkle tree builder compatible with Poseidon hashing
// Exports: buildTree(leaves, height) -> {root, layers}
//         getProof(layers, index, height) -> {siblings, pathIndices, leaf}

// Poseidon hash function interface
interface PoseidonHash {
  (inputs: bigint[]): bigint;
  F: {
    toObject: (value: bigint) => bigint;
  };
}

// Merkle tree structure interfaces
export interface MerkleTree {
  root: bigint;
  layers: bigint[][];
}

export interface MerkleProof {
  siblings: string[];
  pathIndices: number[];
  leaf: string;
}

// Leaf input types - can be a single value or a pair for hashing
export type LeafInput =
  | bigint
  | number
  | string
  | [bigint | number | string, bigint | number | string];

// Tree file structure
export interface TreeFileData {
  root: string;
  layers: string[][];
}

// circomlibjs does not provide TypeScript type definitions, so we use `any` for the Poseidon hash function instance.
// This allows us to bypass type checking for the Poseidon function and its properties until type definitions are available.
// See: https://github.com/iden3/circomlibjs/issues/61
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let poseidon: any;

/**
 * Initializes the Poseidon hash function instance.
 * Uses a dynamic import and casts to `any` to avoid TS2339 errors due to missing types in circomlibjs.
 */
export async function initPoseidon(): Promise<void> {
  if (!poseidon) {
    // Dynamically import circomlibjs to avoid static type checking errors (TS2339)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const circomlibjs: any = await import('circomlibjs');
    poseidon = await circomlibjs.buildPoseidon();
  }
}

export function getPoseidon(): PoseidonHash {
  if (!poseidon) {
    throw new Error(
      'Poseidon is not initialized. Call initPoseidon() before using Poseidon functions.'
    );
  }
  return poseidon;
}

export function toField(x: bigint | number | string): bigint {
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
    const hash = createHash('sha256').update(x).digest('hex');
    return BigInt('0x' + hash);
  }
  return BigInt(x);
}

// Poseidon hash function
function poseidonHash(inputs: bigint[]): bigint {
  const poseidonInstance = getPoseidon();
  const res = poseidonInstance(inputs);
  // poseidon returns a BigNumber object, convert to bigint
  return poseidonInstance.F.toObject(res);
}

export function hashLeaf(a: bigint, b: bigint): bigint {
  return poseidonHash([a, b]);
}

export function hashInternal(left: bigint, right: bigint): bigint {
  return poseidonHash([left, right]);
}

export function buildTree(rawLeaves: LeafInput[], height: number): MerkleTree {
  const N = 1 << height;
  const leaves: bigint[] = new Array(N).fill(0n);

  for (let i = 0; i < Math.min(rawLeaves.length, N); i++) {
    const v = rawLeaves[i];
    // Accept either pre-hashed leaf (string/bigint) or pair [a,b]
    if (Array.isArray(v) && v.length === 2) {
      leaves[i] = hashLeaf(toField(v[0]), toField(v[1]));
    } else {
      leaves[i] = toField(v);
    }
  }

  const layers: bigint[][] = [];
  layers.push(leaves);

  for (let level = 1; level <= height; level++) {
    const prev = layers[level - 1];
    const next: bigint[] = new Array(prev.length / 2).fill(0n);
    for (let i = 0; i < next.length; i++) {
      next[i] = hashInternal(prev[2 * i], prev[2 * i + 1]);
    }
    layers.push(next);
  }

  const root = layers[height][0];
  return { root, layers };
}

export function getProof(
  layers: bigint[][],
  index: number,
  height: number
): MerkleProof {
  const siblings: string[] = [];
  const pathIndices: number[] = [];
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

export function readTreeFile(treeFilePath: string): TreeFileData {
  const raw = readFileSync(treeFilePath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Validates that a Merkle proof is consistent with the given root and leaf
 */
export function validateProof(
  leaf: bigint,
  siblings: string[],
  pathIndices: number[],
  root: bigint,
  height: number
): boolean {
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
export function generateCredentialLeaf(
  examIdHash: string,
  achievementLevelHash: string,
  issuerHash: string,
  holderSecret: string
): bigint {
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
export function generateNullifierLeaf(nullifier: string): bigint {
  return toField(nullifier);
}

/**
 * Creates an empty tree with the specified height
 */
export function createEmptyTree(height: number): MerkleTree {
  const N = 1 << height;
  const leaves: bigint[] = new Array(N).fill(0n);
  return buildTree(leaves, height);
}

/**
 * Updates a tree with a new leaf at the specified index
 */
export function updateTree(
  existingLayers: bigint[][],
  newLeaf: bigint,
  index: number,
  height: number
): MerkleTree {
  const N = 1 << height;
  const leaves: bigint[] = [...existingLayers[0]];

  if (index >= N) {
    throw new Error(`Index ${index} exceeds tree capacity ${N}`);
  }

  leaves[index] = newLeaf;
  return buildTree(leaves, height);
}
