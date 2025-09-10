const fs = require('fs');
const path = require('path');

function fnvHash(str) {
  const uint64_max = BigInt(2) ** BigInt(64);
  let hash = BigInt('0xCBF29CE484222325');
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str[i].charCodeAt());
    hash *= BigInt(0x100000001b3);
    hash %= uint64_max;
  }
  let shash = hash.toString(16);
  const n = 16 - shash.length;
  shash = '0'.repeat(n).concat(shash);
  return shash;
}

(async () => {
  const wasmPath = path.resolve(
    __dirname,
    '../build/ExamProof_js/ExamProof.wasm'
  );
  const inputJsonPath = path.resolve(
    __dirname,
    '../proofs/2025-09-08T20-11-26-198Z/input.json'
  );

  const code = fs.readFileSync(wasmPath);
  const builder = require('../build/ExamProof_js/witness_calculator.js');
  const wc = await builder(code);
  const instance = wc.instance;

  const input = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
  const keys = Object.keys(input);

  const prefixes = ['', 'main.', 'main'];

  for (const k of keys) {
    console.log('\nKey:', k);
    for (const p of prefixes) {
      const full = p + k;
      const h = fnvHash(full);
      const hMSB = parseInt(h.slice(0, 8), 16);
      const hLSB = parseInt(h.slice(8, 16), 16);
      try {
        const sz = instance.exports.getInputSignalSize(hMSB, hLSB);
        console.log(`  '${full}' -> signalSize = ${sz}`);
      } catch (err) {
        console.log(`  '${full}' -> error: ${err && err.message}`);
      }
    }
  }
})();
