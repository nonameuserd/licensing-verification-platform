import fs from 'fs';
import path from 'path';

function findLatestProofDir(): string | null {
  const proofsRoot = path.join(__dirname, '..', '..', 'proofs');
  if (!fs.existsSync(proofsRoot)) return null;

  // Look for the most-recent folder that contains a signed canonical input
  const candidates = fs
    .readdirSync(proofsRoot)
    .map((n) => {
      const full = path.join(proofsRoot, n);
      try {
        const stat = fs.statSync(full);
        if (!stat.isDirectory()) return null;
        // Accept folders that contain either canonical-input.signed.json or canonical-input.fixed2.json
        const hasSigned = fs.existsSync(
          path.join(full, 'canonical-input.signed.json')
        );
        const hasFixed = fs.existsSync(
          path.join(full, 'canonical-input.fixed2.json')
        );
        const hasCanonical = fs.existsSync(
          path.join(full, 'canonical-input.json')
        );
        const hasWitness = fs.existsSync(path.join(full, 'witness.wtns'));
        if (!hasSigned && !hasFixed && !hasCanonical) return null;
        return {
          name: n,
          mtime: stat.mtimeMs,
          full,
          hasSigned,
          hasFixed,
          hasCanonical,
          hasWitness,
        };
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean) as Array<{
    name: string;
    mtime: number;
    full: string;
    hasSigned: boolean;
    hasFixed: boolean;
    hasCanonical: boolean;
    hasWitness: boolean;
  }>;

  if (!candidates.length) return null;
  // Prefer the newest folder (mtime) and prefer folders that already have a signed canonical input
  candidates.sort((a, b) => {
    // signed files first
    const aScore =
      (a.hasSigned ? 100 : 0) + (a.hasWitness ? 10 : 0) + a.mtime / 1e6;
    const bScore =
      (b.hasSigned ? 100 : 0) + (b.hasWitness ? 10 : 0) + b.mtime / 1e6;
    return bScore - aScore;
  });
  return candidates[0].full;
}

describe('signed canonical input', () => {
  test('has pubKey and signature fields as decimal strings', () => {
    const proofDir = findLatestProofDir();
    expect(proofDir).not.toBeNull();
    const signedPath = path.join(
      proofDir as string,
      'canonical-input.signed.json'
    );
    expect(fs.existsSync(signedPath)).toBe(true);

    const raw = fs.readFileSync(signedPath, 'utf8');
    const obj = JSON.parse(raw);

    expect(obj.pubKey).toBeDefined();
    expect(Array.isArray(obj.pubKey)).toBe(true);
    expect(obj.pubKey.length).toBe(2);
    for (const v of obj.pubKey) {
      expect(typeof v).toBe('string');
      expect(/^[0-9]+$/.test(v)).toBe(true);
    }

    expect(obj.signatureS).toBeDefined();
    expect(typeof obj.signatureS).toBe('string');
    expect(/^[0-9]+$/.test(obj.signatureS)).toBe(true);

    expect(obj.signatureR).toBeDefined();
    expect(Array.isArray(obj.signatureR)).toBe(true);
    expect(obj.signatureR.length).toBe(2);
    for (const v of obj.signatureR) {
      expect(typeof v).toBe('string');
      expect(/^[0-9]+$/.test(v)).toBe(true);
    }
  });
});
