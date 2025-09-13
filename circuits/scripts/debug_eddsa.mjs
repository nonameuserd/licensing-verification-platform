import fs from 'fs';
(async () => {
  try {
    const m = await import('circomlibjs');
    console.log('module keys:', Object.keys(m));
    const poseidon = await m.buildPoseidon();
    const F = poseidon.F;
    const eddsa = await m.buildEddsa();
    console.log('built eddsa keys:', Object.keys(eddsa));
    const canon = 'proofs/2025-09-10T11-40-16-534Z/canonical-input.fixed2.json';
    const orig = 'proofs/input.json';
    const c = JSON.parse(fs.readFileSync(canon, 'utf8'));
    const o = JSON.parse(fs.readFileSync(orig, 'utf8'));
    const a = BigInt(c.examIdHash.toString());
    const b = BigInt(c.achievementLevelHash.toString());
    const d = BigInt(c.issuerHash.toString());
    const e = BigInt(c.holderSecret.toString());
    const credPose = poseidon([a, b, d, e]);
    const credentialHash = F.toObject(credPose);
    console.log('credentialHash (dec):', credentialHash.toString());

    const skHex = (
      o.privateKey.startsWith('0x') ? o.privateKey.slice(2) : o.privateKey
    ).padStart(64, '0');
    const skBuf = Buffer.from(skHex, 'hex');
    console.log('skBuf len', skBuf.length, 'hex preview', skHex.slice(0, 16));

    // examine eddsa instance
    console.dir(eddsa, { depth: 2 });

    // try common methods
    if (typeof eddsa.prv2pub === 'function') {
      const pub = eddsa.prv2pub(skBuf);
      console.log('prv2pub result type:', typeof pub);
      console.dir(pub, { depth: 2 });
    }
    if (typeof eddsa.sign === 'function') {
      try {
        const sig = eddsa.sign(skBuf, credentialHash);
        console.log('sign returned:');
        console.dir(sig, { depth: 4 });
      } catch (e) {
        console.log('sign(skBuf,credentialHash) failed:', e.message);
      }
      try {
        const msgHex = credentialHash.toString(16);
        const msgBuf = Buffer.from(msgHex.padStart(64, '0'), 'hex');
        const sig2 = eddsa.sign(skBuf, msgBuf);
        console.log('sign(skBuf,msgBuf) returned:');
        console.dir(sig2, { depth: 4 });
      } catch (e) {
        console.log('sign(skBuf,msgBuf) failed:', e.message);
      }
    }
    if (typeof eddsa.signPoseidon === 'function') {
      try {
        const sigp = eddsa.signPoseidon(skBuf, credentialHash);
        console.log('signPoseidon returned:');
        console.dir(sigp, { depth: 4 });
      } catch (e) {
        console.log('signPoseidon failed:', e.message);
      }
    }

    console.log('done');
  } catch (e) {
    console.error('ERR', e);
    process.exit(1);
  }
})();
