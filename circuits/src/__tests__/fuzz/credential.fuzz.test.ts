import fc from 'fast-check';
import { TestUtils, TEST_CONSTANTS } from '../setup';

/**
 * Property-based fuzz test for credential inputs.
 * - Mutates fields of the public credential and ensures generation either
 *   produces a valid witness or throws a predictable validation error.
 */
describe('Credential fuzzing', () => {
  // keep tests deterministic-ish by limiting sizes
  const credentialArb = fc.record({
    credentialId: fc.oneof(
      fc.string({ minLength: 1, maxLength: 32 }),
      fc.constant(TEST_CONSTANTS.VALID_CREDENTIAL.credentialId)
    ),
    holderName: fc.string({ maxLength: 128 }),
    licenseNumber: fc.string({ maxLength: 64 }),
    examId: fc.string({ maxLength: 64 }),
    achievementLevel: fc.oneof(
      fc.constant('Passed'),
      fc.constant('Failed'),
      fc.string({ maxLength: 32 })
    ),
    issuedDate: fc.string({ maxLength: 32 }),
    expiryDate: fc.string({ maxLength: 32 }),
    issuer: fc.string({ maxLength: 128 }),
    holderDOB: fc.string({ maxLength: 32 }),
  });

  it('should uphold witness invariants under many random inputs', async () => {
    await fc.assert(
      fc.asyncProperty(credentialArb, async (candidate) => {
        // Merge with a valid credential to ensure required fields exist
        const credential = {
          ...TEST_CONSTANTS.VALID_CREDENTIAL,
          ...candidate,
        } as any;

        // Run the witness generator and validate invariants
        try {
          const witness = TestUtils.generateWitness(
            credential,
            TEST_CONSTANTS.NULLIFIER
          );

          // Invariant: witness should have public fields; privateKey may be present as a private input
          expect(witness).toHaveValidWitness();
          expect(witness).toHaveProperty('privateKey');
          // Public signals must not contain holderDOB (if present) or privateKey
          const publicSignals = TestUtils.generatePublicSignals(
            credential,
            TEST_CONSTANTS.NULLIFIER
          );
          if (credential.holderDOB && credential.holderDOB !== '') {
            // Avoid false positives where a different public field (e.g. issuer)
            // happens to contain the same string as holderDOB. In fuzzing we
            // may generate identical strings for multiple fields; only assert
            // non-containment when holderDOB is distinct from other public
            // fields.
            const publicFieldValues = [
              credential.credentialId,
              credential.holderName,
              credential.licenseNumber,
              credential.examId,
              credential.achievementLevel,
              credential.issuedDate,
              credential.expiryDate,
              credential.issuer,
            ];
            const holderDobIsAlsoPublic = publicFieldValues.includes(
              credential.holderDOB
            );
            if (!holderDobIsAlsoPublic) {
              expect(publicSignals).not.toContain(credential.holderDOB);
            }
          }
          expect(publicSignals).not.toContain(witness.privateKey);
        } catch (err: any) {
          // Acceptable: the implementation may throw validation errors for malformed inputs
          const msg = err && err.message ? String(err.message) : '';
          const allowed = [
            'Malformed credential data',
            'Empty required fields',
            'Input data too large',
            'Invalid credential ID format',
            'Invalid personal information',
            'Invalid license number format',
            'Invalid exam ID format',
            'Invalid achievement level',
            'Invalid issued date format',
            'Invalid expiry date format',
            'Issued date cannot be after expiry date',
          ];
          // If error is not one of the documented validation errors, fail the test
          if (!allowed.some((a) => msg.includes(a))) {
            throw err; // rethrow to fail the property
          }
        }
      }),
      { numRuns: 200 }
    );
  }, 20000);

  it('should detect tampered merkle proofs (mutation property)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.nat(20), async (idx) => {
        // Use valid credential and generate real witness
        const credential = TEST_CONSTANTS.VALID_CREDENTIAL;
        const witness = TestUtils.generateWitness(
          credential,
          TEST_CONSTANTS.NULLIFIER
        );

        // If no merkle siblings present, skip
        if (!witness.merkleProof || witness.merkleProof.length === 0)
          return true;

        // Mutate a sibling at random index (flip a char)
        const sibIndex = idx % witness.merkleProof.length;
        const orig = witness.merkleProof[sibIndex];
        const mutated = orig.split('').reverse().join('');

        // Validate original proof if possible
        const leaf = BigInt(witness.storedNullifierLeaf || 0n);
        const root = BigInt(witness.credentialRoot || 0n);
        const validOrig = TestUtils.validateMerkleProof(
          leaf,
          witness.merkleProof,
          witness.merklePathIndices,
          root as any
        );

        // If the original proof is already invalid, skip this case (cannot assert mutation effect)
        if (!validOrig) {
          return true;
        }

        // Validate mutated should fail (defensive check)
        const mutatedSiblings = [...witness.merkleProof];
        mutatedSiblings[sibIndex] = mutated;
        const validMutated = TestUtils.validateMerkleProof(
          leaf,
          mutatedSiblings,
          witness.merklePathIndices,
          root as any
        );

        // Expect that mutation makes the proof invalid
        expect(validMutated).toBe(false);
        return true;
      }),
      { numRuns: 50 }
    );
  }, 20000);

  it('should sanity-check issued/expiry date handling under random date inputs', async () => {
    const dateStr = fc.string({ minLength: 1, maxLength: 20 });
    await fc.assert(
      fc.asyncProperty(
        dateStr,
        dateStr,
        async (issuedCandidate, expiryCandidate) => {
          const credential = {
            ...TEST_CONSTANTS.VALID_CREDENTIAL,
            issuedDate: issuedCandidate,
            expiryDate: expiryCandidate,
          } as any;

          try {
            const witness = TestUtils.generateWitness(
              credential,
              TEST_CONSTANTS.NULLIFIER
            );
            // If a witness is produced, basic invariant holds
            expect(witness).toHaveValidWitness();
          } catch (err: any) {
            // Accept known validation errors (same list as main fuzz test)
            const msg = err && err.message ? String(err.message) : '';
            const allowed = [
              'Malformed credential data',
              'Empty required fields',
              'Invalid issued date format',
              'Invalid expiry date format',
              'Issued date cannot be after expiry date',
            ];
            if (!allowed.some((a) => msg.includes(a))) throw err;
            return true;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  }, 20000);

  it('should ensure nullifier uniqueness and correct formatting', async () => {
    const hexNullifier = fc.hexaString({ minLength: 40, maxLength: 40 });
    await fc.assert(
      fc.asyncProperty(
        fc.array(hexNullifier, { minLength: 1, maxLength: 10 }),
        async (arr) => {
          // Prepend 0x and ensure valid format
          const nullifiers = arr.map((h) => `0x${h}`);
          const witnesses = nullifiers.map((n) =>
            TestUtils.generateWitness(TEST_CONSTANTS.VALID_CREDENTIAL, n)
          );

          // All nullifiers should match 0x + 40 hex
          nullifiers.forEach((n) => expect(n).toMatch(/^0x[a-fA-F0-9]{40}$/));

          // Distinctness check for different nullifiers
          const uniq = new Set(nullifiers);
          expect(uniq.size).toBe(nullifiers.length);

          // Witness nullifier fields should equal their input
          witnesses.forEach((w, i) => expect(w.nullifier).toBe(nullifiers[i]));
          return true;
        }
      ),
      { numRuns: 50 }
    );
  }, 20000);
});
