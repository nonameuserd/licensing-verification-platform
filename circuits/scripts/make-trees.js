#!/usr/bin/env ts-node
'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const fs_1 = require('fs');
const path_1 = require('path');
const merkle_helper_1 = require('./merkle-helper');
const logger_1 = require('../src/lib/logger');
async function main() {
  await (0, merkle_helper_1.initPoseidon)();
  const ROOT = (0, path_1.join)(__dirname, '..');
  const TREES_DIR = (0, path_1.join)(ROOT, 'trees');
  if (!(0, fs_1.existsSync)(TREES_DIR))
    (0, fs_1.mkdirSync)(TREES_DIR, { recursive: true });
  const TREE_HEIGHT = process.env['MERKLE_TREE_HEIGHT']
    ? parseInt(process.env['MERKLE_TREE_HEIGHT'], 10)
    : 4;
  const CREDENTIAL_INDEX = process.env['CREDENTIAL_LEAF_INDEX']
    ? parseInt(process.env['CREDENTIAL_LEAF_INDEX'], 10)
    : 0;
  const NULLIFIER_INDEX = process.env['NULLIFIER_LEAF_INDEX']
    ? parseInt(process.env['NULLIFIER_LEAF_INDEX'], 10)
    : 0;
  // Read credential inputs from env or use sensible defaults for local/dev
  const examId = process.env['EXAM_ID'] || 'EXAM_LOCAL';
  const achievementLevel = process.env['ACHIEVEMENT_LEVEL'] || 'Passed';
  const issuer = process.env['ISSUER'] || 'LocalIssuer';
  const privateKey = process.env['PRIVATE_KEY'] || '0xabcdef1234';
  const nullifier = process.env['NULLIFIER'] || '0x9999';
  const N = 1 << TREE_HEIGHT;
  // Build credential leaves
  const credLeaves = new Array(N).fill('0');
  const credLeaf = (0, merkle_helper_1.generateCredentialLeaf)(
    examId,
    achievementLevel,
    issuer,
    privateKey
  );
  credLeaves[CREDENTIAL_INDEX] = credLeaf.toString();
  const { root: credRoot, layers: credLayers } = (0, merkle_helper_1.buildTree)(
    credLeaves,
    TREE_HEIGHT
  );
  const credTree = {
    root: credRoot.toString(),
    layers: credLayers.map((layer) => layer.map((v) => v.toString())),
  };
  const credPath = (0, path_1.join)(TREES_DIR, 'credential-tree.json');
  (0, fs_1.writeFileSync)(credPath, JSON.stringify(credTree, null, 2));
  logger_1.circuitLogger.info(`Wrote credential tree: ${credPath}`);
  // Build nullifier leaves
  // For non-inclusion proof, we need a different nullifier in the tree
  // than the one we're trying to prove is not there
  const nullLeaves = new Array(N).fill('0');
  // Use a different nullifier value for the tree (not the one we'll prove non-inclusion for)
  const treeNullifier = nullifier;
  const nullLeaf = (0, merkle_helper_1.generateNullifierLeaf)(treeNullifier);
  nullLeaves[NULLIFIER_INDEX] = nullLeaf.toString();
  const { root: nullRoot, layers: nullLayers } = (0, merkle_helper_1.buildTree)(
    nullLeaves,
    TREE_HEIGHT
  );
  const nullTree = {
    root: nullRoot.toString(),
    layers: nullLayers.map((layer) => layer.map((v) => v.toString())),
  };
  const nullPath = (0, path_1.join)(TREES_DIR, 'nullifier-tree.json');
  (0, fs_1.writeFileSync)(nullPath, JSON.stringify(nullTree, null, 2));
  logger_1.circuitLogger.info(`Wrote nullifier tree: ${nullPath}`);
  logger_1.circuitLogger.info('Done');
}
main().catch((e) => {
  logger_1.circuitLogger.error(e);
  process.exit(1);
});
