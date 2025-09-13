interface PoseidonHash {
  (inputs: bigint[]): bigint;
  F: {
    toObject: (value: bigint) => bigint;
  };
}
export interface MerkleTree {
  root: bigint;
  layers: bigint[][];
}
export interface MerkleProof {
  siblings: string[];
  pathIndices: number[];
  leaf: string;
}
export type LeafInput =
  | bigint
  | number
  | string
  | [bigint | number | string, bigint | number | string];
export interface TreeFileData {
  root: string;
  layers: string[][];
}
/**
 * Initializes the Poseidon hash function instance.
 * Uses a dynamic import and casts to `any` to avoid TS2339 errors due to missing types in circomlibjs.
 */
export declare function initPoseidon(): Promise<void>;
export declare function getPoseidon(): PoseidonHash;
export declare function toField(x: bigint | number | string): bigint;
export declare function hashLeaf(a: bigint, b: bigint): bigint;
export declare function hashInternal(left: bigint, right: bigint): bigint;
export declare function buildTree(
  rawLeaves: LeafInput[],
  height: number
): MerkleTree;
export declare function getProof(
  layers: bigint[][],
  index: number,
  height: number
): MerkleProof;
export declare function readTreeFile(treeFilePath: string): TreeFileData;
/**
 * Validates that a Merkle proof is consistent with the given root and leaf
 */
export declare function validateProof(
  leaf: bigint,
  siblings: string[],
  pathIndices: number[],
  root: bigint,
  height: number
): boolean;
/**
 * Generates a credential leaf hash from credential data
 */
export declare function generateCredentialLeaf(
  examIdHash: string,
  achievementLevelHash: string,
  issuerHash: string,
  holderSecret: string
): bigint;
/**
 * Generates a nullifier leaf hash
 */
export declare function generateNullifierLeaf(nullifier: string): bigint;
/**
 * Creates an empty tree with the specified height
 */
export declare function createEmptyTree(height: number): MerkleTree;
/**
 * Updates a tree with a new leaf at the specified index
 */
export declare function updateTree(
  existingLayers: bigint[][],
  newLeaf: bigint,
  index: number,
  height: number
): MerkleTree;
export {};
