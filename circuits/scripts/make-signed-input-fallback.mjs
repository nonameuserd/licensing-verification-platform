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
  console.log('FALLBACK start', { canon, orig, out });
  try {
    const c = JSON.parse(fs.readFileSync(canon, 'utf8'));
    const o = JSON.parse(fs.readFileSync(orig, 'utf8'));
    const circomlib = await import('circomlibjs');
    const poseidon = await circomlib.buildPoseidon();
    const F = poseidon.F;
    // Try buildEddsa with timeout
    let eddsa = null;
    try {
      eddsa = await Promise.race([
        circomlib.buildEddsa(),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('buildEddsa timeout')), 3000)
        ),
      ]);
      console.log('built eddsa via builder');
    } catch (err) {
      console.log('buildEddsa failed or timed out:', err && err.message);
    }
    // fallback: use buildBabyjub and direct signing via eddsa from old style
    const babyjub = await circomlib.buildBabyjub();
    const Fp = babyjub.F;
    console.log(
      'babyjub built; keys sample:',
      Object.keys(babyjub).slice(0, 6)
    );

    const a = BigInt(c.examIdHash.toString());
    const b = BigInt(c.achievementLevelHash.toString());
    const d = BigInt(c.issuerHash.toString());
    const e = BigInt(c.holderSecret.toString());
    const credPose = poseidon([a, b, d, e]);
    const credentialHash = F.toObject(credPose);

    const skHex = (
      o.privateKey.startsWith('0x') ? o.privateKey.slice(2) : o.privateKey
    ).padStart(64, '0');
    const skBuf = Buffer.from(skHex, 'hex');

    // derive pubkey via babyjub
    // babyjub.prv2pub exists in older circomlib; in this build, babyjub has prf2pub? inspect
    console.dir(Object.keys(babyjub));
    let Ax = '0',
      Ay = '0';
    if (typeof babyjub.prv2pub === 'function') {
      const pub = babyjub.prv2pub(skBuf);
      Ax = BigInt('0x' + Buffer.from(pub[0]).toString('hex')).toString();
      Ay = BigInt('0x' + Buffer.from(pub[1]).toString('hex')).toString();
      console.log('derived pub via babyjub');
    } else {
      console.log('no prv2pub on babyjub');
    }

    // If eddsa builder exists, try sign; else skip signature generation and write zeros so we can see snarkjs errors
    let S = '0',
      R8x = '0',
      R8y = '0';
    if (eddsa && typeof eddsa.sign === 'function') {
      console.log('using eddsa.sign');
      const sig = eddsa.sign(skBuf, credentialHash);
      console.dir(Object.keys(sig));
      // normalize
    } else {
      console.log('no eddsa available; writing zeros for signature');
    }

    c.signatureS = S;
    c.signatureR = [R8x, R8y];
    c.pubKey = [Ax, Ay];

    fs.writeFileSync(out, JSON.stringify(c, null, 2));
    console.log('wrote fallback signed file', out);
  } catch (err) {
    console.error('FALLBACK error', (err && err.message) || err);
    process.exit(1);
  }
})();
