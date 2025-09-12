const fs = require('fs');
const path = require('path');
(async function main() {
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

    const circomlibjs = require('circomlibjs');
    const poseidon = await circomlibjs.buildPoseidon();
    const F = poseidon.F;
    const a = BigInt(c.examIdHash.toString());
    const b = BigInt(c.achievementLevelHash.toString());
    const d = BigInt(c.issuerHash.toString());
    const eVal = BigInt(c.holderSecret.toString());
    const credPose = poseidon([a, b, d, eVal]);
    const credentialHash = F.toObject(credPose);
    console.log('credentialHash:', credentialHash.toString().slice(0, 40));

    // Use BLAKE2 variant which is recommended for public key derivation
    const zk = require('@zk-kit/eddsa-poseidon/blake-2b');
    console.log('zk-kit-blake exports:', Object.keys(zk));

    // normalize private key
    let priv = o.privateKey || o.sk || o.private_key;
    if (!priv) throw new Error('no private key in original input');
    if (typeof priv === 'string' && priv.startsWith('0x')) priv = priv.slice(2);
    // if private key is hex, derive from hex; signers accept strings too

    // derive public key and secret scalar
    let pubKey = ['0', '0'];
    if (typeof zk.derivePublicKey === 'function') {
      const pub = zk.derivePublicKey(priv);
      pubKey = [String(pub[0]), String(pub[1])];
      console.log('derived pubKey');
    }

    let secretScalar = null;
    if (typeof zk.deriveSecretScalar === 'function') {
      secretScalar = zk.deriveSecretScalar(priv);
      console.log('derived secretScalar', secretScalar);
    }

    // sign the credentialHash: convert to string as message
    let signature = null;
    if (typeof zk.signMessage === 'function') {
      // signMessage expects (privateKey, message)
      signature = zk.signMessage(priv, credentialHash.toString());
      console.log('signed with signMessage');
    }

    // normalize signature
    let S = '0',
      R8x = '0',
      R8y = '0';
    if (signature) {
      if (signature.S && signature.R8) {
        S = String(signature.S);
        R8x = String(signature.R8[0]);
        R8y = String(signature.R8[1]);
      } else if (Array.isArray(signature) && signature.length >= 3) {
        R8x = String(signature[0]);
        R8y = String(signature[1]);
        S = String(signature[2]);
      } else if (signature.R && signature.S) {
        R8x = String(signature.R[0]);
        R8y = String(signature.R[1]);
        S = String(signature.S);
      } else {
        console.log('unknown signature shape', Object.keys(signature || {}));
      }
    } else {
      console.log('no signature produced');
    }

    c.pubKey = pubKey;
    c.signatureS = S;
    c.signatureR = [R8x, R8y];
    // Do not overwrite holderSecret: circuit computes credentialHash from
    // the provided holderSecret, so keep the original value to match the
    // signed message.

    fs.writeFileSync(outPath, JSON.stringify(c, null, 2));
    console.log('wrote signed input to', outPath);

    // run snarkjs witness calculate
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
})();
