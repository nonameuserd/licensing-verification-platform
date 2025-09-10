#!/usr/bin/env ts-node

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  initPoseidon,
  buildTree,
  generateCredentialLeaf,
  generateNullifierLeaf,
} from './merkle-helper';

async function main() {
  await initPoseidon();

  const ROOT = join(__dirname, '..');
  const TREES_DIR = join(ROOT, 'trees');
  if (!existsSync(TREES_DIR)) mkdirSync(TREES_DIR, { recursive: true });

  const TREE_HEIGHT = process.env['MERKLE_TREE_HEIGHT']
    ? parseInt(process.env['MERKLE_TREE_HEIGHT']!, 10)
    : 4;
  const CREDENTIAL_INDEX = process.env['CREDENTIAL_LEAF_INDEX']
    ? parseInt(process.env['CREDENTIAL_LEAF_INDEX']!, 10)
    : 0;
  const NULLIFIER_INDEX = process.env['NULLIFIER_LEAF_INDEX']
    ? parseInt(process.env['NULLIFIER_LEAF_INDEX']!, 10)
    : 0;

  // Read credential inputs from env or use sensible defaults for local/dev
  const examId = process.env['EXAM_ID'] || 'EXAM_LOCAL';
  const achievementLevel = process.env['ACHIEVEMENT_LEVEL'] || 'Passed';
  const issuer = process.env['ISSUER'] || 'LocalIssuer';
  const privateKey = process.env['PRIVATE_KEY'] || '0xabcdef1234';
  const nullifier = process.env['NULLIFIER'] || '0x1234';

  const N = 1 << TREE_HEIGHT;
  // Build credential leaves
  const credLeaves: (string | number)[] = new Array(N).fill('0');
  const credLeaf = generateCredentialLeaf(
    examId,
    achievementLevel,
    issuer,
    privateKey
  );
  credLeaves[CREDENTIAL_INDEX] = credLeaf.toString();
  const { root: credRoot, layers: credLayers } = buildTree(
    credLeaves,
    TREE_HEIGHT
  );

  const credTree = {
    root: credRoot.toString(),
    layers: credLayers.map((layer) => layer.map((v) => v.toString())),
  };

  const credPath = join(TREES_DIR, 'credential-tree.json');
  writeFileSync(credPath, JSON.stringify(credTree, null, 2));
  console.log(`Wrote credential tree: ${credPath}`);

  // Build nullifier leaves
  const nullLeaves: (string | number)[] = new Array(N).fill('0');
  const nullLeaf = generateNullifierLeaf(nullifier);
  nullLeaves[NULLIFIER_INDEX] = nullLeaf.toString();
  const { root: nullRoot, layers: nullLayers } = buildTree(
    nullLeaves,
    TREE_HEIGHT
  );

  const nullTree = {
    root: nullRoot.toString(),
    layers: nullLayers.map((layer) => layer.map((v) => v.toString())),
  };

  const nullPath = join(TREES_DIR, 'nullifier-tree.json');
  writeFileSync(nullPath, JSON.stringify(nullTree, null, 2));
  console.log(`Wrote nullifier tree: ${nullPath}`);

  console.log('Done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
