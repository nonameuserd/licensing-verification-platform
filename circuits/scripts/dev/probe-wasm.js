#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

async function main() {
  const ROOT = path.join(__dirname, '..');
  const BUILD = path.join(ROOT, '..', 'build');
  const CIRCUIT = 'ExamProof';
  const wasmPath = path.join(BUILD, `${CIRCUIT}_js`, `${CIRCUIT}.wasm`);
  if (!fs.existsSync(wasmPath)) {
    console.error('WASM not found at', wasmPath);
    process.exit(2);
  }

  const wcBuilder = require(path.join(
    BUILD,
    `${CIRCUIT}_js`,
    'witness_calculator.js'
  ));
  const code = fs.readFileSync(wasmPath);
  const wc = await wcBuilder(code);
  const instance = wc.instance;

  const fnvHash = (str) => {
    const uint64_max = BigInt(2) ** BigInt(64);
    let hash = BigInt('0xCBF29CE484222325');
    for (let i = 0; i < str.length; i++) {
      hash ^= BigInt(str.charCodeAt(i));
      hash *= BigInt(0x100000001b3);
      hash %= uint64_max;
    }
    let shash = hash.toString(16);
    if (shash.length < 16) shash = '0'.repeat(16 - shash.length) + shash;
    return shash;
  };

  const keys = [
    'nullifier',
    'pubKey',
    'merkleProof',
    'merkleProofNullifier',
    'storedNullifierLeaf',
    'nullifierRoot',
    'credentialRoot',
    'main.nullifier',
    'main.pubKey',
    'main.merkleProof',
    'main.merkleProofNullifier',
    'main.storedNullifierLeaf',
    'main.nullifierRoot',
    'main.credentialRoot',
  ];

  for (const k of keys) {
    const h = fnvHash(k);
    const hMSB = parseInt(h.slice(0, 8), 16);
    const hLSB = parseInt(h.slice(8, 16), 16);
    let s = null;
    try {
      s = instance.exports.getInputSignalSize(hMSB, hLSB);
    } catch (e) {
      void e;
      s = 'error';
    }
    console.log(`${k}: ${s}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
