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
  console.log('DEBUG start', { canon, orig, out });
  try {
    console.log('checking files');
    if (!fs.existsSync(canon))
      throw new Error(`Canonical input not found: ${canon}`);
    if (!fs.existsSync(orig))
      throw new Error(`Original input not found: ${orig}`);
    console.log('reading files');
    const c = JSON.parse(fs.readFileSync(canon, 'utf8'));
    const o = JSON.parse(fs.readFileSync(orig, 'utf8'));
    console.log('files read; importing circomlibjs');

    const circomlib = await import('circomlibjs');
    console.log('imported circomlibjs keys', Object.keys(circomlib));
    console.log('building poseidon');
    const poseidon = await circomlib.buildPoseidon();
    const F = poseidon.F;
    console.log('poseidon built');

    console.log('building eddsa');
    const eddsa = await circomlib.buildEddsa();
    console.log('eddsa built; keys:', Object.keys(eddsa || {}));

    const a = BigInt(c.examIdHash.toString());
    const b = BigInt(c.achievementLevelHash.toString());
    const d = BigInt(c.issuerHash.toString());
    const e = BigInt(c.holderSecret.toString());
    console.log('hash inputs', {
      a: a.toString().slice(0, 8),
      b: b.toString().slice(0, 8),
      d: d.toString().slice(0, 8),
      e: e.toString().slice(0, 8),
    });
    const credPose = poseidon([a, b, d, e]);
    const credentialHash = F.toObject(credPose);
    console.log('credentialHash', credentialHash.toString().slice(0, 48));

    let skHex = o.privateKey;
    console.log(
      'raw skHex',
      typeof skHex === 'string' ? skHex.slice(0, 8) : typeof skHex
    );
    if (!skHex) throw new Error('privateKey missing in original input');
    if (typeof skHex === 'string' && skHex.startsWith('0x'))
      skHex = skHex.slice(2);
    const skBuf = Buffer.from(skHex.padStart(64, '0'), 'hex');
    console.log('skBuf len', skBuf.length);

    const toDec = (x) => {
      if (typeof x === 'bigint') return x.toString();
      if (Buffer.isBuffer(x))
        return BigInt('0x' + x.toString('hex')).toString();
      if (Array.isArray(x)) return toDec(x[0]);
      return String(x);
    };
    let Ax = '0',
      Ay = '0';
    if (typeof eddsa.prv2pub === 'function') {
      console.log('calling prv2pub');
      const pubDerived = eddsa.prv2pub(skBuf);
      console.log('prv2pub returned type', typeof pubDerived);
      console.dir(pubDerived);
      if (Array.isArray(pubDerived)) {
        Ax = toDec(pubDerived[0]);
        Ay = toDec(pubDerived[1]);
      } else if (pubDerived && pubDerived.x && pubDerived.y) {
        Ax = toDec(pubDerived.x);
        Ay = toDec(pubDerived.y);
      }
    } else {
      console.log('no prv2pub');
    }

    let sig = null;
    console.log('determining sign strategy');
    if (typeof eddsa.sign === 'function') {
      console.log('eddsa.sign exists; trying sign(sk,credentialHash)');
      try {
        sig = eddsa.sign(skBuf, credentialHash);
        console.log('sign returned');
        console.dir(sig);
      } catch (e) {
        console.log('sign(skBuf,credentialHash) failed:', e && e.message);
        try {
          const msgHex = credentialHash.toString(16);
          const msgBuf = Buffer.from(msgHex.padStart(64, '0'), 'hex');
          console.log('trying sign(sk,msgBuf) with msgBuf len', msgBuf.length);
          sig = eddsa.sign(skBuf, msgBuf);
          console.log('sign(sk,msgBuf) returned');
          console.dir(sig);
        } catch (err2) {
          console.log('sign(sk,msgBuf) failed:', err2 && err2.message);
        }
      }
    } else if (typeof eddsa.signPoseidon === 'function') {
      console.log('eddsa.signPoseidon exists; trying');
      sig = eddsa.signPoseidon(skBuf, credentialHash);
      console.log('signPoseidon returned');
      console.dir(sig);
    } else {
      console.log('no sign function');
    }

    console.log('normalizing signature');
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
        console.log(
          'Unexpected signature shape, keys:',
          Object.keys(sig || {})
        );
      }
    } else {
      console.log('no sig produced');
    }

    c.signatureS = S;
    c.signatureR = [R8x, R8y];
    c.pubKey = [Ax, Ay];

    console.log('writing signed file to', out);
    fs.writeFileSync(out, JSON.stringify(c, null, 2));
    console.log('Wrote signed input to', out);
  } catch (err) {
    console.error('Error in signing script:', (err && err.message) || err);
  }
})();
