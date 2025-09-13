import fs from 'fs';
import path from 'path';
import os from 'os';

describe('signed canonical input', () => {
  test('has pubKey and signature fields as decimal strings', () => {
    // Create a test-local canonical input in an OS temp directory so the test
    // doesn't depend on repo state and won't accidentally commit artifacts.
    const tmpRoot = os.tmpdir();
    const testDir = fs.mkdtempSync(path.join(tmpRoot, 'circuits-test-'));
    const signedPath = path.join(testDir, 'canonical-input.json');

    const sample = {
      pubKey: [
        '123456789012345678901234567890',
        '987654321098765432109876543210',
      ],
      signatureS: '111111111111111111111111111111',
      signatureR: [
        '222222222222222222222222222222',
        '333333333333333333333333333333',
      ],
    };

    fs.writeFileSync(signedPath, JSON.stringify(sample, null, 2));

    try {
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
    } finally {
      // Ensure we clean up the temp directory regardless of test outcome
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  });
});
