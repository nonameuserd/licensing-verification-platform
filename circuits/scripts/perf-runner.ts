#!/usr/bin/env node
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const root = path.resolve(__dirname, '..', '..');
const baselinePath = path.join(root, 'circuits', 'perf', 'baseline.json');
const artifactsPath = path.join(root, 'artifacts');

function nowMs() {
  return Date.now();
}

if (!fs.existsSync(baselinePath)) {
  console.error('Baseline file not found at', baselinePath);
  process.exit(2);
}
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

// Run witness generation if wasm exists
const witnessJs = path.join(
  root,
  'circuits',
  'build',
  'ExamProof_js',
  'generate_witness.js'
);
if (!fs.existsSync(witnessJs)) {
  console.warn('witness generator not found, skipping perf test');
  process.exit(0);
}

console.log('Running witness generation perf test');
const start = nowMs();
const res = spawnSync(
  'node',
  [
    witnessJs,
    path.join(root, 'circuits', 'proofs', 'input.json'),
    'witness.wtns',
  ],
  { cwd: path.join(root, 'circuits'), stdio: 'inherit' }
);
const dur = nowMs() - start;
if (res.status !== 0) {
  console.error('witness generation failed');
  process.exit(res.status || 1);
}
console.log('witness generation time (ms):', dur);

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
  fs.mkdirSync(artifactsPath, { recursive: true });
  fs.writeFileSync(
    path.join(artifactsPath, 'perf-result.json'),
    JSON.stringify(result, null, 2)
  );
  console.log('Wrote perf-result.json');
} catch (e) {
  console.warn('Failed to write perf artifact', e);
}

if (dur > allowed) {
  console.error(
    `PERF REGRESSION: ${dur}ms > allowed ${allowed}ms (+${threshold}%)`
  );
  process.exit(5);
}

console.log('perf check passed');
process.exit(0);
