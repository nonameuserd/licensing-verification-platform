import fs from 'fs';
import path from 'path';

(async () => {
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

    // build poseidon via circomlibjs to compute credentialHash same as circuit
    const circomlibjs = await import('circomlibjs');
    const poseidon = await circomlibjs.buildPoseidon();
    const F = poseidon.F;
    const a = BigInt(c.examIdHash.toString());
    const b = BigInt(c.achievementLevelHash.toString());
    const d = BigInt(c.issuerHash.toString());
    const eVal = BigInt(c.holderSecret.toString());
    const credPose = poseidon([a, b, d, eVal]);
    const credentialHash = F.toObject(credPose);
    console.log('credentialHash:', credentialHash.toString().slice(0, 40));

    // load zk-kit eddsa poseidon
    const zk = await import('@zk-kit/eddsa-poseidon');
    console.log('zk-kit exports:', Object.keys(zk));

    // normalize private key hex from original input
    let skHex = o.privateKey || o.sk || o.private_key;
    if (!skHex) throw new Error('no private key in original input');
    if (typeof skHex === 'string' && skHex.startsWith('0x'))
      skHex = skHex.slice(2);
    skHex = skHex.padStart(64, '0');

    // Try common APIs from @zk-kit/eddsa-poseidon
    let pubKey = ['0', '0'];
    let signature = null;

    // helper to normalize values to decimal strings
    const norm = (v) => {
      if (typeof v === 'bigint') return v.toString();
      if (Buffer.isBuffer(v))
        return BigInt('0x' + v.toString('hex')).toString();
      if (Array.isArray(v)) return norm(v[0]);
      return String(v);
    };

    // Many versions expose functions differently; try likely ones
    if (typeof zk.signPoseidon === 'function') {
      console.log('using zk.signPoseidon');
      // expects privKey (hex or bytes) and message field element
      signature = await zk.signPoseidon(skHex, credentialHash);
      if (typeof zk.prvToPub === 'function') {
        const pub = await zk.prvToPub(skHex);
        pubKey = [norm(pub[0]), norm(pub[1])];
      } else if (typeof zk.prv2pub === 'function') {
        const pub = await zk.prv2pub(Buffer.from(skHex, 'hex'));
        pubKey = [norm(pub[0]), norm(pub[1])];
      }
    }
    // fallback patterns
    if (
      !signature &&
      zk.default &&
      typeof zk.default.signPoseidon === 'function'
    ) {
      console.log('using default.signPoseidon');
      signature = await zk.default.signPoseidon(skHex, credentialHash);
      if (!pubKey || pubKey[0] === '0') {
        if (typeof zk.default.prvToPub === 'function') {
          const pub = await zk.default.prvToPub(skHex);
          pubKey = [norm(pub[0]), norm(pub[1])];
        }
      }
    }

    // another fallback: some exports expose EdDSA object
    if (!signature && zk.EdDSA) {
      console.log('using EdDSA.sign');
      try {
        signature = await zk.EdDSA.sign(skHex, credentialHash);
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

    // final fallback: try to use circomlibjs babyjub to derive pubkey if available
    if ((!pubKey || pubKey[0] === '0') && circomlibjs.buildBabyjub) {
      try {
        const baby = await circomlibjs.buildBabyjub();
        if (typeof baby.prv2pub === 'function') {
          const pub = baby.prv2pub(Buffer.from(skHex, 'hex'));
          pubKey = [norm(pub[0]), norm(pub[1])];
        }
      } catch (e) {}
    }

    // normalize signature to S, R8x, R8y
    let S = '0',
      R8x = '0',
      R8y = '0';
    if (signature) {
      console.log('signature keys:', Object.keys(signature));
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
        // try stringified
        const sjson = JSON.stringify(signature);
        console.log('unknown signature shape, raw:', sjson.slice(0, 200));
      }
    } else {
      console.log('no signature produced by zk-kit eddsa package');
    }

    // populate canonical input
    c.pubKey = pubKey;
    c.signatureS = S;
    c.signatureR = [R8x, R8y];

    fs.writeFileSync(outPath, JSON.stringify(c, null, 2));
    console.log('wrote signed input to', outPath);

    // run snarkjs witness calculate
    const { spawnSync } = await import('child_process');
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
})();
