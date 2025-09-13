const fs = require('fs');
const path = require('path');

const symPath = path.resolve(__dirname, '../build/ExamProof.sym');
const inputJsonPath = path.resolve(
  __dirname,
  '../proofs/2025-09-08T20-11-26-198Z/input.json'
);

if (!fs.existsSync(symPath)) {
  console.error('sym not found', symPath);
  process.exit(1);
}
const sym = fs.readFileSync(symPath, 'utf8').split('\n');

const inputSignals = {};
for (const line of sym) {
  const parts = line.split(',');
  if (parts.length < 4) continue;
  const name = parts[3].trim();
  // consider only main.* signals
  if (!name.startsWith('main.')) continue;
  const m = name.match(/^main\.([a-zA-Z0-9_]+)(?:\[(\d+)\])?$/);
  if (!m) continue;
  const base = m[1];
  const idx = m[2] !== undefined ? parseInt(m[2], 10) : null;
  if (!inputSignals[base])
    inputSignals[base] = { count: 0, indices: new Set() };
  if (idx !== null) {
    inputSignals[base].indices.add(idx);
    inputSignals[base].count = Math.max(inputSignals[base].count, idx + 1);
  } else {
    inputSignals[base].hasScalar = true;
  }
}

console.log('Parsed signal bases from sym:');
for (const k of Object.keys(inputSignals).sort()) {
  const info = inputSignals[k];
  console.log(`${k}: count=${info.count}, hasScalar=${!!info.hasScalar}`);
}

// compare to input.json keys
if (fs.existsSync(inputJsonPath)) {
  const input = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
  console.log('\nInput.json keys:');
  Object.keys(input).forEach((k) => console.log(' -', k));

  console.log('\nKeys not present in sym bases:');
  Object.keys(input).forEach((k) => {
    if (!inputSignals[k]) console.log(' -', k);
  });
} else {
  console.log('\nNo input.json found to compare.');
}
