import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

function findRepoRoot() {
  let cur = process.cwd();
  while (!fs.existsSync(path.join(cur, 'package.json'))) {
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return cur;
}

const root = findRepoRoot();
const artifactsDir = path.join(root, 'artifacts');
const metadataPath = path.join(artifactsDir, 'artifact-metadata.json');
import { circuitLogger as logger } from '../src/lib/logger.js';

if (!fs.existsSync(metadataPath)) {
  logger.error('artifact-metadata.json not found in artifacts directory');
  process.exit(2);
}

// Expect COSIGN_KEY or rely on OIDC+workflow identity for cosign
const cosignKey = process.env['COSIGN_KEY'] || '';

function run(cmd: string, args: string[]) {
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.error) {
    logger.error(
      res.error instanceof Error ? res.error.message : String(res.error)
    );
    process.exit(3);
  }
  if (res.status !== 0) process.exit(res.status || 1);
}

if (cosignKey) {
  logger.info('Signing with cosign key file');
  run('cosign', ['sign-blob', '--key', cosignKey, metadataPath]);
  // cosign writes signature to <file>.sig by default
} else {
  logger.info(
    'No COSIGN_KEY provided — attempting default cosign sign-blob (relying on environment auth)'
  );
  run('cosign', ['sign-blob', metadataPath]);
}

logger.info('Signed artifact-metadata.json');
