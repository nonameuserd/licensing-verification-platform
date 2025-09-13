'use strict';
const __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const child_process_1 = require('child_process');
const path_1 = __importDefault(require('path'));
const fs_1 = __importDefault(require('fs'));
function findRepoRoot() {
  let cur = process.cwd();
  while (!fs_1.default.existsSync(path_1.default.join(cur, 'package.json'))) {
    const parent = path_1.default.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return cur;
}
const root = findRepoRoot();
const artifactsDir = path_1.default.join(root, 'artifacts');
const metadataPath = path_1.default.join(
  artifactsDir,
  'artifact-metadata.json'
);
const logger_js_1 = require('../src/lib/logger.js');
if (!fs_1.default.existsSync(metadataPath)) {
  logger_js_1.circuitLogger.error(
    'artifact-metadata.json not found in artifacts directory'
  );
  process.exit(2);
}
// Expect COSIGN_KEY or rely on OIDC+workflow identity for cosign
const cosignKey = process.env['COSIGN_KEY'] || '';
function run(cmd, args) {
  const res = (0, child_process_1.spawnSync)(cmd, args, { stdio: 'inherit' });
  if (res.error) {
    logger_js_1.circuitLogger.error(
      res.error instanceof Error ? res.error.message : String(res.error)
    );
    process.exit(3);
  }
  if (res.status !== 0) process.exit(res.status || 1);
}
if (cosignKey) {
  logger_js_1.circuitLogger.info('Signing with cosign key file');
  run('cosign', ['sign-blob', '--key', cosignKey, metadataPath]);
  // cosign writes signature to <file>.sig by default
} else {
  logger_js_1.circuitLogger.info(
    'No COSIGN_KEY provided — attempting default cosign sign-blob (relying on environment auth)'
  );
  run('cosign', ['sign-blob', metadataPath]);
}
logger_js_1.circuitLogger.info('Signed artifact-metadata.json');
