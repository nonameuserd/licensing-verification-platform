# ExamProof.circom — Circuit documentation

Purpose

This document explains the `ExamProof.circom` circuit (located at `circuits/src/ExamProof.circom`). The circuit proves that a holder possesses a credential for an exam, that the credential is included in a credential Merkle tree, that a given nullifier has not been used (via a separate Merkle root), and that the holder signed the credential data with their EdDSA key.

High-level contract (inputs / outputs)

- Parameters

  - `merkleTreeHeight` (template parameter): tree height for Merkle proofs. The circuit asserts it is between 16 and 32.

- Public inputs

  - `pubKey[2]` — holder's EdDSA public key (x,y or group representation required by `EdDSA` component).
  - `credentialRoot` — Merkle root for the credential registry.
  - `nullifierRoot` — Merkle root for the used-nullifiers registry.
  - `currentTime` — current verifier timestamp (propagated to `verificationTimestamp`).
  - `signature[2]` — EdDSA signature over the credential hash.
  - `nullifier` — unique nullifier value used to prevent replay.
  - `examIdHash` — hashed exam identifier.
  - `achievementLevelHash` — hashed achievement/grade level.
  - `issuerHash` — hashed issuer identity.

- Private inputs

  - `holderSecret` — secret value owned by the holder and included in the credential hash.
  - `merkleProof[merkleTreeHeight]` — sibling nodes for the credential inclusion proof.
  - `merklePathIndices[merkleTreeHeight]` — 0/1 bits for credential path directions.
  - `merkleProofNullifier[merkleTreeHeight]` — sibling nodes for the nullifier tree.
  - `merklePathIndicesNullifier[merkleTreeHeight]` — 0/1 bits for nullifier path directions.
  - `storedNullifierLeaf` — leaf value stored at the nullifier index in the nullifier tree.

- Outputs
  - `verified` — boolean-like signal (field element 0/1) indicating final verification success.
  - `credentialId` — Poseidon hash of `credentialHash` and `nullifier`, unique identifier for the credential usage.
  - `verificationTimestamp` — echo of the `currentTime` public input.

Components and internal flow

1. credentialHash: Poseidon(4) over `(examIdHash, achievementLevelHash, issuerHash, holderSecret)` — this represents the credential contents committed on-chain.
2. credentialMerkleProof: `MerkleProof(merkleTreeHeight)` — checks inclusion of `credentialHash` in `credentialRoot` using `merkleProof` and `merklePathIndices`.
3. nullifierNonInc: `MerkleNonInclusion(merkleTreeHeight)` — verifies that the provided `nullifier` is not present at the provided path by proving the stored leaf at that path equals `storedNullifierLeaf` and that `storedNullifierLeaf != nullifier`, and that the recomputed root equals `nullifierRoot`. The circuit exposes `nullifierNonInc.notIncluded` as `nullifierValid`.
4. sigVerifier: `EdDSA` — validates that `signature` signs `credentialHash` under `pubKey`.
5. credentialId: Poseidon(2) of `(credentialHash, nullifier)` to bind the usage to this credential and nullifier.
6. Final: `verified = credentialMerkleProof.inTree * nullifierValid * signatureValid` and a constraint `verified * (1 - verified) === 0` ensures `verified` is boolean.

Design notes and assumptions

- The circuit assumes the included `circomlib` components exist and have the expected names and interfaces: `Poseidon`, `EdDSA`, `MerkleProof`, `MerkleNonInclusion`.
- `merkleTreeHeight` is enforced to be within [16,32] for a balance between capacity and proof size.
- `EdDSA` is used with `enableAssertEqual === 1` in the circuit; ensure your EdDSA implementation supports the `isValid` and `pubkey`/`signature`/`message` signals as shown.
- The timestamp checks are minimal: the circuit only copies `currentTime` into `verificationTimestamp`. Any expiry logic must be enforced off-chain or by additional constraints that compare to a credential expiry included in `credentialHash` (not present in the current circuit).

Edge cases and security considerations

- Nullifier non-inclusion requires the caller to supply the correct `storedNullifierLeaf` and path; callers must be careful to build correct proofs for the provided `nullifierRoot` and index.
- The circuit does not hide credential attributes; the hashed attributes are inputs. Use suitable domain separation and hashing for `examIdHash`, `issuerHash`, etc., before putting them on-chain.
- Ensure signature verification parameters (curve, base point encoding) match the prover/client library.

Try it (compile + witness + zkp)

Below are example steps (adjust tools and versions to your environment):

```bash
# Compile the circuit (circom v2)
circom circuits/src/ExamProof.circom --r1cs --wasm --sym -o build

# (Optional) View constraints
snarkjs r1cs info build/ExamProof.r1cs

# Generate witness (requires a JS witness generator and a valid input.json)
node build/ExamProof_js/generate_witness.js build/ExamProof_js/ExamProof.wasm input.json witness.wtns

# Create a proof (example with Groth16 using snarkjs)
snarkjs groth16 setup build/ExamProof.r1cs pot16_final.ptau build/zkkey_final.zkey
snarkjs groth16 prove build/zkkey_final.zkey witness.wtns proof.json public.json
snarkjs groth16 verify build/verification_key.json public.json proof.json
```

Replace `pot16_final.ptau` and other filenames with your trusted setup artifacts. The project may use a different proving system (PLONK, etc.); adapt commands accordingly.

Files

- `circuits/src/ExamProof.circom` — source circuit (explained here).
- `circuits/docs/ExamProof.md` — this document.

If you want, I can also:

- add a short example `input.json` that matches the circuit fields, or
- add a small test script that compiles the circuit and runs a witness using example inputs.

## Example input.json

Below is a minimal example `input.json` that matches the public and private inputs used by `ExamProof.circom`.
This uses a 20-level Merkle tree (the circuit's `STANDARD_MERKLE_HEIGHT`) so the Merkle arrays contain 20 elements.

Use this file as a template and replace the placeholder values with real hashes, keys, signatures and proofs from your prover setup.

```json
{
  "pubKey": ["1234567890", "9876543210"],
  "credentialRoot": "0",
  "nullifierRoot": "0",
  "currentTime": 1694160000,
  "signature": ["111111", "222222"],
  "nullifier": "999999",
  "examIdHash": "1001",
  "achievementLevelHash": "2",
  "issuerHash": "3",

  "holderSecret": "777777",

  "merkleProof": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],

  "merkleProofNullifier": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],

  "merklePathIndices": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],

  "merklePathIndicesNullifier": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],

  "storedNullifierLeaf": 0
}
```

Notes

- Replace the numeric placeholders with the correct field elements (decimal strings) or strings your tooling expects.
- `merkleProof` and `merkleProofNullifier` are sibling node values; provide the correct 20 siblings for your leaf/index.
- `merklePathIndices` and `merklePathIndicesNullifier` are arrays of 0/1 indicating left/right at each tree level.
- `pubKey`, `signature`, and other cryptographic values must be encoded to match your EdDSA/poseidon implementations.
