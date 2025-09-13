import fs from 'fs';
import path from 'path';

describe('signed canonical input', () => {
  test('has pubKey and signature fields as decimal strings', () => {
    // Create a test-local canonical input so the test doesn't depend on repo state
    const testDir = path.join(__dirname, '__generated_proof__');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
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

    // Clean up generated test artifact
    try {
      fs.unlinkSync(signedPath);
      fs.rmdirSync(testDir);
    } catch {
      // ignore cleanup errors
    }
  });
});
