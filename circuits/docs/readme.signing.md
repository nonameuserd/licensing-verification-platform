This file documents how to reproduce signing and witness/proof generation for the ExamProof circuit.

Prereqs

- Node (>=22)
- npx (snarkjs will be run via npx)
- Install deps in repo root: `yarn` or `yarn install`
- The project includes a helper signer using @zk-kit/eddsa-poseidon (blake-2b). See `scripts/sign-with-zkkit-blake.cjs` in this folder.

Steps

1. Generate canonical input (the repo provides a helper):

   - scripts/generate-proof.ts writes canonical-input.json into a timestamped folder under `proofs/`.

2. Sign the canonical input:

   - From `circuits/` run:
     node scripts/sign-with-zkkit-blake.cjs proofs/<timestamp>/canonical-input.fixed2.json
   - This writes `canonical-input.signed.json` in the same proofs folder.

3. Calculate witness:

   - Use the compiled wasm: `build/ExamProof_js/ExamProof.wasm` and the signed input:
     npx --yes snarkjs wtns calculate build/ExamProof_js/ExamProof.wasm proofs/<timestamp>/canonical-input.signed.json proofs/<timestamp>/witness.wtns

4. Prove and verify (pre-built zkeys in `dist/circuits/zkey` or local `zkey/`):

- Artifact locations (repo layout):

  - proofs/ - timestamped folders created by the helper scripts. Each folder may contain:
    - canonical-input.json
    - canonical-input.fixed2.json
    - canonical-input.signed.json
    - witness.wtns
    - proof.json / public.json
  - build/ExamProof_js/ - compiled wasm and witness helper (generate_witness.js)
  - zkey/ - local ceremony artifacts (when you run `scripts/setup.ts`) containing `ExamProof_0001.zkey` and pot files
  - dist/circuits/zkey/ - shipped pre-built proving key (used by CI and smoke tests)
  - dist/circuits/zkey/verification_key.json - exported verification key for verifier generation

- Prove (use either the local `setup/ExamProof_0001.zkey` or the packaged one under `dist`):
  npx --yes snarkjs groth16 prove <path-to-zkey> proofs/<timestamp>/witness.wtns proofs/<timestamp>/proof.json proofs/<timestamp>/public.json

- Verify (use the exported verification key):
  npx --yes snarkjs groth16 verify <path-to-verification_key.json> proofs/<timestamp>/public.json proofs/<timestamp>/proof.json

Notes:

- The `signed-input` test in `src/__tests__/signed-input.test.ts` is now flexible and will automatically pick the most-recent `proofs/<timestamp>/` folder that contains a canonical input (signed/fixed/canonical). This makes CI and local testing more resilient to different helper workflows.
- If you rebuild circuits locally, ensure the r1cs/wasm/witness generation matches the proving key you use to prove. Mismatched artifacts will fail proving/verification.
- Helper scripts present in `circuits/scripts/` (for example `inspect-circomlib.js`, `inspect-wasm-inputs-keys.js`, `inspect-wasm-inputs.js`, `make-signed-input-debug.mjs`, `make-signed-input-fallback.mjs`) are developer utilities. They are useful for debugging but can be removed if you prefer a minimal repo. Before removing, verify that no CI job or other scripts reference them.

Optional cleanup guidance

- `circuits/src/circomlib/edsa_wrapper.circom`: the main `ExamProof.circom` currently includes `circomlib/edsa_wrapper.circom`. If you have switched to the canonical `EdDSAPoseidonVerifier` from `circomlib` and no other circuits depend on the wrapper, it can be removed. Grep for `edsa_wrapper.circom` usages to confirm (there are references in `src/ExamProof.circom`).

- Before deleting any setup/zkey/ptau files from the repo, ensure you have backups or that CI uses `dist/circuits/setup/` or an external secure artifact store. Final `.zkey` files are sensitive and should not be widely distributed.

Notes & caveats

- The repository contains `dist/circuits/setup` with pre-generated ptau/zkey/verification keys used above; if you rebuild the circuit locally the r1cs/witness/wasm must match the zkey used to prove.
- If you want to generate new zkeys, follow the standard snarkjs sequence (groth16 setup, zkey contribute, export verification key). This can be slow and the final zkey must be treated as sensitive.
- The signing script uses the Poseidon hash computed via circomlibjs to ensure the same message is signed as the circuit expects.

Quick artifact locations (paths you will commonly need)

- `circuits/proofs/` — timestamped folders created by proof-generation helpers. Each folder may contain:
  - `canonical-input.json` / `canonical-input.fixed2.json` / `canonical-input.signed.json`
  - `witness.wtns`
  - `proof.json` / `public.json`
- `circuits/build/ExamProof_js/` — compiled wasm and `generate_witness` helpers (produced by `yarn --cwd circuits compile` or `npm run compile --prefix circuits`).
- `circuits/setup/` — local ceremony artifacts (when you run `yarn --cwd circuits setup` or `npm run setup --prefix circuits`) containing pot/zkey files such as `ExamProof_0001.zkey`.
- `dist/circuits/setup/` — packaged ceremony artifacts used by CI and some smoke tests (may contain `.zkey`, `verification_key.json`, and `pot` files).
- `circuits/src/` — circuit sources (`ExamProof.circom`, `poseidon.circom`, `circomlib/edsa_wrapper.circom`, etc.)

Regenerating or rotating a zkey (recommended workflow)

1. Recompile the circuit (r1cs/wasm/sym):

   - From repo root (uses local circom binary if present):

     ```bash
     # in zsh
     cd circuits
     npm run compile
     ```

2. Create a new setup / zkey (example using snarkjs):

   ```bash
   # ensure snarkjs is available
   cd circuits

   # 1) generate a ptau (if you don't have a trusted setup):
   npx --yes snarkjs powersoftau new bn128 16 pot16_0000.ptau
   npx --yes snarkjs powersoftau contribute pot16_0000.ptau pot16_0001.ptau --name="init contribution"

   # 2) setup the zkey
   npx --yes snarkjs groth16 setup build/ExamProof.r1cs zkey/pot16_0001.ptau zkey/ExamProof_0001.zkey

   # 3) (optional) contribute to the zkey to make it unique
   npx --yes snarkjs zkey contribute setup/ExamProof_0001.zkey setup/ExamProof_0001.zkey --name="dev contribution" -v

   # 4) export verification key
   npx --yes snarkjs zkey export verificationkey zkey/ExamProof_0001.zkey zkey/verification_key.json
   ```

3. Cleanup or rotate old zkeys

- Remove or archive older `.zkey` files from `circuits/zkey/` or `dist/circuits/zkey/` if you are rotating keys. Treat `.zkey` as sensitive. Keep a copy in a secure artifact store if needed for reproducibility.

Cleanup candidates in this repo

- `circuits/scripts/` contains several developer helper scripts (for inspecting wasm inputs, debugging signing, and fallbacks). These are useful for development but not required for core CI. Files you can consider removing (after checking CI and release scripts):

  - `inspect-circomlib.js`
  - `inspect-wasm-inputs-keys.js`
  - `inspect-wasm-inputs.js`
  - `make-signed-input-debug.mjs`
  - `make-signed-input-fallback.mjs`

- `circuits/src/circomlib/edsa_wrapper.circom` is included by `src/ExamProof.circom` and therefore required unless you refactor `ExamProof.circom` to use an alternative verifier implementation. Do not remove it unless you update `ExamProof.circom` and confirm no other circuits reference it.

Before removing any of the script files above:

- Grep the repository for usages: `git grep '<filename>'` or `rg '<filename>'` to ensure there are no references in CI, release scripts, or other tooling.
- Update any CI workflows that rely on pre-built artifacts under `dist/` to point to a new location if you change where zkeys are stored.
