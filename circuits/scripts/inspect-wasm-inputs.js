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

  if (!fs.existsSync(wasmPath)) {
    console.error('WASM not found at', wasmPath);
    process.exit(1);
  }
  if (!fs.existsSync(inputJsonPath)) {
    console.error('input.json not found at', inputJsonPath);
    process.exit(1);
  }

  const code = fs.readFileSync(wasmPath);
  const builder = require('../build/ExamProof_js/witness_calculator.js');
  const wc = await builder(code);

  const instance = wc.instance;

  console.log('getInputSize =', instance.exports.getInputSize());

  const input = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
  const keys = Object.keys(input);

  for (const k of keys) {
    const h = fnvHash(k);
    const hMSB = parseInt(h.slice(0, 8), 16);
    const hLSB = parseInt(h.slice(8, 16), 16);
    try {
      const sz = instance.exports.getInputSignalSize(hMSB, hLSB);
      console.log(
        k,
        '-> signalSize =',
        sz,
        'type=',
        Array.isArray(input[k]) ? 'array' : typeof input[k],
        'len=',
        Array.isArray(input[k]) ? input[k].length : 1
      );
    } catch (err) {
      console.error(
        k,
        '-> error calling getInputSignalSize:',
        err && err.message
      );
    }
  }
})();
