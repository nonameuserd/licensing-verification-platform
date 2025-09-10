import fs from 'fs';
import path from 'path';

(async () => {
  const canon =
    process.argv[2] ||
    path.join(
      'proofs',
      '2025-09-10T11-40-16-534Z',
      'canonical-input.fixed2.json'
    );
  const orig = process.argv[3] || path.join('proofs', 'input.json');
  const out =
    process.argv[4] ||
    path.join(
      'proofs',
      '2025-09-10T11-40-16-534Z',
      'canonical-input.signed.json'
    );
  try {
    if (!fs.existsSync(canon))
      throw new Error(`Canonical input not found: ${canon}`);
    if (!fs.existsSync(orig))
      throw new Error(`Original input not found: ${orig}`);
    const c = JSON.parse(fs.readFileSync(canon, 'utf8'));
    const o = JSON.parse(fs.readFileSync(orig, 'utf8'));

    const circomlib = await import('circomlibjs');
    const poseidon = await circomlib.buildPoseidon();
    const F = poseidon.F;
    // Build the eddsa instance via the builder exported by circomlibjs
    const eddsa = await circomlib.buildEddsa();
    console.log('built eddsa instance, keys:', Object.keys(eddsa || {}));

    const a = BigInt(c.examIdHash.toString());
    const b = BigInt(c.achievementLevelHash.toString());
    const d = BigInt(c.issuerHash.toString());
    const e = BigInt(c.holderSecret.toString());
    const credPose = poseidon([a, b, d, e]);
    const credentialHash = F.toObject(credPose);
    console.log(
      'credentialHash (dec, first 32 chars):',
      credentialHash.toString().slice(0, 32)
    );

    let skHex = o.privateKey;
    if (!skHex) throw new Error('privateKey missing in original input');
    if (typeof skHex === 'string' && skHex.startsWith('0x'))
      skHex = skHex.slice(2);
    const skBuf = Buffer.from(skHex.padStart(64, '0'), 'hex');
    console.log('privateKey bytes len:', skBuf.length);

    const toDec = (x) => {
      if (typeof x === 'bigint') return x.toString();
      if (Buffer.isBuffer(x))
        return BigInt('0x' + x.toString('hex')).toString();
      if (Array.isArray(x)) return toDec(x[0]);
      return String(x);
    };
    let Ax = '0',
      Ay = '0';
    console.log('pubKey lengths placeholder');
    if (typeof eddsa.prv2pub === 'function') {
      // derive pubkey using the eddsa builder
      // eddsa.sign expects message as field element or buffer depending on impl
      const pubDerived = eddsa.prv2pub(skBuf);
      if (Array.isArray(pubDerived)) {
        Ax = toDec(pubDerived[0]);
        Ay = toDec(pubDerived[1]);
      } else if (pubDerived && pubDerived.x && pubDerived.y) {
        Ax = toDec(pubDerived.x);
        Ay = toDec(pubDerived.y);
      }
    }

    if (typeof eddsa.sign === 'function') {
      // try signing the credential hash as BigInt/field
      try {
        sig = eddsa.sign(skBuf, credentialHash);
      } catch (e) {
        // fallback: sign buffer
        const msgHex = credentialHash.toString(16);
        const msgBuf = Buffer.from(msgHex.padStart(64, '0'), 'hex');
        sig = eddsa.sign(skBuf, msgBuf);
      }
      console.log('Used eddsa.sign');
    } else if (typeof eddsa.signPoseidon === 'function') {
      sig = eddsa.signPoseidon(skBuf, credentialHash);
      console.log('Used eddsa.signPoseidon');
    } else {
      throw new Error('No eddsa.sign API available from built eddsa');
    }

    const norm = (v) => {
      if (typeof v === 'bigint') return v.toString();
      if (Buffer.isBuffer(v))
        return BigInt('0x' + v.toString('hex')).toString();
      if (Array.isArray(v)) return norm(v[0]);
      return String(v);
    };
    let S = '0',
      R8x = '0',
      R8y = '0';
    if (sig) {
      if (sig.S && sig.R8) {
        S = norm(sig.S);
        R8x = norm(sig.R8[0]);
        R8y = norm(sig.R8[1]);
      } else if (Array.isArray(sig) && sig.length >= 3) {
        R8x = norm(sig[0]);
        R8y = norm(sig[1]);
        S = norm(sig[2]);
      } else if (sig.R && sig.S) {
        R8x = norm(sig.R[0]);
        R8y = norm(sig.R[1]);
        S = norm(sig.S);
      } else {
        throw new Error(
          'Unexpected signature shape: ' + JSON.stringify(Object.keys(sig))
        );
      }
    }

    c.signatureS = S;
    c.signatureR = [R8x, R8y];
    c.pubKey = [Ax, Ay];

    fs.writeFileSync(out, JSON.stringify(c, null, 2));
    console.log('Wrote signed input to', out);
    process.exit(0);
  } catch (err) {
    console.error('Error in signing script:', (err && err.message) || err);
    process.exit(1);
  }
})();
