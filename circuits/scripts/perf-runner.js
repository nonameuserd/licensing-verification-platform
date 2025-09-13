#!/usr/bin/env node
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
const logger_js_1 = require('../src/lib/logger.js');
const root = path_1.default.resolve(__dirname, '..', '..');
const baselinePath = path_1.default.join(
  root,
  'circuits',
  'perf',
  'baseline.json'
);
const artifactsPath = path_1.default.join(root, 'artifacts');
function nowMs() {
  return Date.now();
}
if (!fs_1.default.existsSync(baselinePath)) {
  logger_js_1.circuitLogger.error('Baseline file not found at', baselinePath);
  process.exit(2);
}
const baseline = JSON.parse(fs_1.default.readFileSync(baselinePath, 'utf8'));
// Run witness generation if wasm exists
const witnessJs = path_1.default.join(
  root,
  'circuits',
  'build',
  'ExamProof_js',
  'generate_witness.js'
);
if (!fs_1.default.existsSync(witnessJs)) {
  logger_js_1.circuitLogger.warn(
    'witness generator not found, skipping perf test'
  );
  process.exit(0);
}
logger_js_1.circuitLogger.info('Running witness generation perf test');
const start = nowMs();
const res = (0, child_process_1.spawnSync)(
  'node',
  [
    witnessJs,
    path_1.default.join(root, 'circuits', 'proofs', 'input.json'),
    'witness.wtns',
  ],
  { cwd: path_1.default.join(root, 'circuits'), stdio: 'inherit' }
);
const dur = nowMs() - start;
if (res.status !== 0) {
  logger_js_1.circuitLogger.error('witness generation failed');
  process.exit(res.status || 1);
}
logger_js_1.circuitLogger.info('witness generation time (ms):', dur);
const threshold = Number(
  process.env['PERF_THRESHOLD_PERCENT'] || baseline.threshold_percent || 20
);
const allowed = Math.round(baseline.witness_time_ms * (1 + threshold / 100));
const result = {
  timestamp: new Date().toISOString(),
  witness_time_ms: dur,
  baseline_witness_time_ms: baseline.witness_time_ms,
  threshold_percent: threshold,
  allowed_ms: allowed,
};
// Ensure artifacts dir exists and write result JSON for CI consumption
try {
  fs_1.default.mkdirSync(artifactsPath, { recursive: true });
  fs_1.default.writeFileSync(
    path_1.default.join(artifactsPath, 'perf-result.json'),
    JSON.stringify(result, null, 2)
  );
  logger_js_1.circuitLogger.info('Wrote perf-result.json');
} catch (e) {
  logger_js_1.circuitLogger.warn('Failed to write perf artifact', e);
}
if (dur > allowed) {
  logger_js_1.circuitLogger.error(
    `PERF REGRESSION: ${dur}ms > allowed ${allowed}ms (+${threshold}%)`
  );
  process.exit(5);
}
logger_js_1.circuitLogger.info('perf check passed');
process.exit(0);
