#!/usr/bin/env node
const { spawnSync } = require('child_process');
const { join } = require('path');
const { readFileSync, existsSync } = require('fs');
const { CircuitLogger } = require('../src/lib/logger');

const ROOT = join(__dirname, '..');
const PROOFS = join(ROOT, 'proofs');
const logger = new CircuitLogger('ci-local-check');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`);
}

async function main() {
  logger.info(
    'ci-local-check: attempting to run generator (INPUT_ONLY) to produce canonical input'
  );
  // Run the TypeScript generator using ts-node (same as package scripts). This may fail if env vars are not set.
  let generatorFailed = false;
  try {
    run(
      'npx',
      [
        'ts-node',
        '-P',
        'tsconfig.node.json',
        '-r',
        'tsconfig-paths/register',
        '--transpile-only',
        'scripts/generate-proof.ts',
      ],
      { cwd: ROOT, env: { ...process.env, INPUT_ONLY: '1' } }
    );
  } catch (e) {
    logger.warn(
      'ci-local-check: generator failed (this may be expected if env vars are not present)',
      { error: e.message }
    );
    generatorFailed = true;
  }

  // Read the .last-canonical marker if present, otherwise find the most recent proofs folder
  const lastCanonical = join(ROOT, '.last-canonical');
  let canonicalPath = null;
  if (existsSync(lastCanonical)) {
    canonicalPath = readFileSync(lastCanonical, 'utf8').trim();
  }
  if (!canonicalPath) {
    // fallback: pick the newest folder under proofs
    const fs = require('fs');
    const files = fs
      .readdirSync(PROOFS)
      .map((f) => ({ f, m: fs.statSync(join(PROOFS, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m);
    if (!files || files.length === 0)
      throw new Error('No proof output folders found under circuits/proofs');
    const cand = files[0].f;
    canonicalPath = join(PROOFS, cand, 'canonical-input.json');
  }

  // If generator failed and we still don't have a canonical file, abort early
  if (generatorFailed && !existsSync(canonicalPath)) {
    throw new Error(
      'Generator failed and no canonical input found to validate'
    );
  }

  logger.info('ci-local-check: canonical input path', { canonicalPath });
  if (!existsSync(canonicalPath))
    throw new Error('Canonical input not found at ' + canonicalPath);

  const canonical = JSON.parse(readFileSync(canonicalPath, 'utf8'));

  // Basic shape checks: pubKey[2], signatureR[2], signatureS non-zero
  const pubKey =
    canonical['main.pubKey'] ||
    canonical['pubKey'] ||
    canonical['main.pubkey'] ||
    canonical['pubkey'];
  const sigR =
    canonical['main.signatureR'] ||
    canonical['signatureR'] ||
    canonical['main.signaturer'];
  const sigS =
    canonical['main.signatureS'] ||
    canonical['signatureS'] ||
    canonical['main.signatures'];

  function isNonZeroArray(a) {
    if (!Array.isArray(a)) return false;
    if (a.length < 2) return false;
    return a.some((x) => String(x) !== '0' && x !== 0);
  }

  if (!isNonZeroArray(pubKey))
    throw new Error('pubKey missing or zero in canonical input');
  if (!isNonZeroArray(sigR))
    throw new Error('signatureR missing or zero in canonical input');
  if (!sigS || String(sigS) === '0')
    throw new Error('signatureS missing or zero in canonical input');

  logger.info(
    'ci-local-check: signature/pubKey present in canonical JSON — now running snarkjs witness calculation (fast)'
  );

  // Determine wasm and run snarkjs wtns calculate
  const wasmCandidates = [
    join(ROOT, 'build', 'ExamProof.wasm'),
    join(ROOT, 'build', 'ExamProof_js', 'ExamProof.wasm'),
  ];
  const fs = require('fs');
  const wasmPath = wasmCandidates.find((p) => fs.existsSync(p));
  if (!wasmPath)
    throw new Error(
      'wasm not found, ensure circuit build artifacts are present under circuits/build'
    );

  // Use wasm-preferred emitter if available to map names
  const wasmPreferred = canonicalPath.replace(
    'canonical-input.json',
    'canonical-input-wasm-preferred.json'
  );
  const inputForWasm = fs.existsSync(wasmPreferred)
    ? wasmPreferred
    : canonicalPath;

  const witnessOut = inputForWasm
    .replace('canonical-input', 'witness')
    .replace('.json', '.wtns');

  run(
    'npx',
    [
      '--yes',
      'snarkjs',
      'wtns',
      'calculate',
      wasmPath,
      inputForWasm,
      witnessOut,
    ],
    { cwd: ROOT }
  );

  logger.info('ci-local-check: witness calculation succeeded', { witnessOut });
  logger.info('ci-local-check: OK');
}

main().catch((e) => {
  logger.error('ci-local-check failed', { error: e.message });
  process.exit(1);
});
