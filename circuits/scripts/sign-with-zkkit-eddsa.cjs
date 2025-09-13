const fs = require('fs');
const path = require('path');
async function main() {
  try {
    const proofsDir = path.join('proofs', '2025-09-10T11-40-16-534Z');
    const canonPath = path.join(proofsDir, 'canonical-input.fixed2.json');
    const origPath = path.join('proofs', 'input.json');
    const outPath = path.join(proofsDir, 'canonical-input.signed.json');

    if (!fs.existsSync(canonPath))
      throw new Error('canonical input not found: ' + canonPath);
    if (!fs.existsSync(origPath))
      throw new Error('original input not found: ' + origPath);

    const c = JSON.parse(fs.readFileSync(canonPath, 'utf8'));
    const o = JSON.parse(fs.readFileSync(origPath, 'utf8'));

    // require modules using CommonJS to avoid ESM<>CJS named-export issues
    const zk = require('@zk-kit/eddsa-poseidon');
    const circomlibjs = require('circomlibjs');

    // build poseidon
    const poseidon = await circomlibjs.buildPoseidon();
    const F = poseidon.F;
    const a = BigInt(c.examIdHash.toString());
    const b = BigInt(c.achievementLevelHash.toString());
    const d = BigInt(c.issuerHash.toString());
    const eVal = BigInt(c.holderSecret.toString());
    const credPose = poseidon([a, b, d, eVal]);
    const credentialHash = F.toObject(credPose);
    console.log('credentialHash:', credentialHash.toString().slice(0, 40));

    // normalize private key
    let skHex = o.privateKey || o.sk || o.private_key;
    if (!skHex) throw new Error('no private key in original input');
    if (typeof skHex === 'string' && skHex.startsWith('0x'))
      skHex = skHex.slice(2);
    skHex = skHex.padStart(64, '0');

    const norm = (v) => {
      if (typeof v === 'bigint') return v.toString();
      if (Buffer.isBuffer(v))
        return BigInt('0x' + v.toString('hex')).toString();
      if (Array.isArray(v)) return norm(v[0]);
      return String(v);
    };

    let pubKey = ['0', '0'];
    let signature = null;

    // try zk-kit APIs (CommonJS require should work)
    if (typeof zk.signPoseidon === 'function') {
      signature = zk.signPoseidon(skHex, credentialHash);
      if (typeof zk.prvToPub === 'function') {
        const pub = zk.prvToPub(skHex);
        pubKey = [norm(pub[0]), norm(pub[1])];
      } else if (typeof zk.prv2pub === 'function') {
        const pub = zk.prv2pub(Buffer.from(skHex, 'hex'));
        pubKey = [norm(pub[0]), norm(pub[1])];
      }
    }
    if (
      !signature &&
      zk.default &&
      typeof zk.default.signPoseidon === 'function'
    ) {
      signature = zk.default.signPoseidon(skHex, credentialHash);
      if (!pubKey || pubKey[0] === '0') {
        if (typeof zk.default.prvToPub === 'function') {
          const pub = zk.default.prvToPub(skHex);
          pubKey = [norm(pub[0]), norm(pub[1])];
        }
      }
    }
    if (!signature && zk.EdDSA && typeof zk.EdDSA.sign === 'function') {
      try {
        signature = zk.EdDSA.sign(skHex, credentialHash);
      } catch (e) {
        console.log('EdDSA.sign failed', e && e.message);
      }
      try {
        if (zk.EdDSA.prv2pub) {
          const pub = zk.EdDSA.prv2pub(skHex);
          pubKey = [norm(pub[0]), norm(pub[1])];
        }
      } catch (e) {}
    }

    // fallback derive pub via babyjub
    if ((!pubKey || pubKey[0] === '0') && circomlibjs.buildBabyjub) {
      try {
        const baby = await circomlibjs.buildBabyjub();
        if (typeof baby.prv2pub === 'function') {
          const pub = baby.prv2pub(Buffer.from(skHex, 'hex'));
          pubKey = [norm(pub[0]), norm(pub[1])];
        }
      } catch (e) {
        console.log('babyjub derive failed', e && e.message);
      }
    }

    let S = '0',
      R8x = '0',
      R8y = '0';
    if (signature) {
      if (signature.S && signature.R8) {
        S = norm(signature.S);
        R8x = norm(signature.R8[0]);
        R8y = norm(signature.R8[1]);
      } else if (Array.isArray(signature) && signature.length >= 3) {
        R8x = norm(signature[0]);
        R8y = norm(signature[1]);
        S = norm(signature[2]);
      } else if (signature.R && signature.S) {
        R8x = norm(signature.R[0]);
        R8y = norm(signature.R[1]);
        S = norm(signature.S);
      } else {
        console.log(
          'unknown signature shape, raw:',
          JSON.stringify(signature).slice(0, 200)
        );
      }
    } else {
      console.log(
        'no signature produced by zk-kit; signature fields will be zeros'
      );
    }

    c.pubKey = pubKey;
    c.signatureS = S;
    c.signatureR = [R8x, R8y];

    fs.writeFileSync(outPath, JSON.stringify(c, null, 2));
    console.log('wrote signed input to', outPath);

    // run snarkjs
    const spawnSync = require('child_process').spawnSync;
    const res = spawnSync(
      'npx',
      [
        '--yes',
        'snarkjs',
        'wtns',
        'calculate',
        'build/ExamProof_js/ExamProof.wasm',
        outPath,
        path.join(proofsDir, 'witness.wtns'),
      ],
      { cwd: process.cwd(), stdio: 'inherit' }
    );
    console.log('snarkjs exit code', res.status);
  } catch (e) {
    console.error('ERROR', (e && (e.stack || e.message)) || e);
    process.exit(1);
  }
}
main();
