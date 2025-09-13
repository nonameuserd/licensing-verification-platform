'use strict';
const __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const fs_1 = __importDefault(require('fs'));
const path_1 = __importDefault(require('path'));
const crypto_1 = __importDefault(require('crypto'));
const logger_js_1 = require('../src/lib/logger.js');
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
const circuitsDir = path_1.default.join(root, 'circuits');
const outDir = path_1.default.join(root, 'artifacts');
if (!fs_1.default.existsSync(outDir)) fs_1.default.mkdirSync(outDir);
const files = [
  'build/ExamProof_js/ExamProof.wasm',
  'build/ExamProof.r1cs',
  'verification_key.json',
];
const meta = {
  artifact_version: '1',
  name: 'ExamProof',
  commit: process.env['GITHUB_SHA'] || 'local',
  build_time: new Date().toISOString(),
  files: {},
};
for (const f of files) {
  const p = path_1.default.join(circuitsDir, f);
  if (!fs_1.default.existsSync(p)) continue;
  const buf = fs_1.default.readFileSync(p);
  const h = crypto_1.default.createHash('sha256').update(buf).digest('hex');
  meta.files[f] = { sha256: h, size: buf.length };
}
const outPath = path_1.default.join(outDir, 'artifact-metadata.json');
fs_1.default.writeFileSync(outPath, JSON.stringify(meta, null, 2));
logger_js_1.circuitLogger.info('Wrote', outPath);
