README - Merkle tree JSONs for circuits tests

This folder contains supporting Merkle tree JSON files used by the circuits test and generator scripts.

Files

- `credential-tree.json` - a Merkle tree representation used to build credential proofs. Shape: { root: string, layers: string[][] }
- `nullifier-tree.json` - a Merkle tree representation used to build nullifier proofs. Same shape as above.

Tree JSON format

- The file must be a JSON object matching the repository's `TreeFileData` type:
  - `root` (string): decimal/string representation of the Merkle root field element.
  - `layers` (string[][]): an array of layers from leaves upward; `layers[0]` is the list of leaf values (strings), `layers[1]` are parents, and so on until the root layer which should contain a single string equal to `root`.

How the circuits code uses these files

- `circuits/scripts/generate-proof.ts` will read these files when you set the environment variables `CREDENTIAL_TREE_FILE` and `NULLIFIER_TREE_FILE`.
- The generator will use the leaf at the configured leaf index (defaults can be set via `CREDENTIAL_LEAF_INDEX` and `NULLIFIER_LEAF_INDEX`) to produce the Merkle proof which is then embedded into the canonical input file written to `circuits/proofs/<timestamp>/canonical-input.json`.

Quick commands (zsh)

- Generate trees (helper script):

```bash
cd circuits
# create two trees and write them to ./trees
node -r ts-node/register scripts/make-trees.ts
```

- Run the generator using the trees and stop after writing canonical input (`INPUT_ONLY=1`):

```bash
cd circuits
# point the generator at the generated trees and produce canonical-input.json
CREDENTIAL_TREE_FILE=./trees/credential-tree.json \
NULLIFIER_TREE_FILE=./trees/nullifier-tree.json \
INPUT_ONLY=1 \
node -r ts-node/register scripts/generate-proof.ts
```

- Run the input.sym shape test (this test will locate the most recent canonical file produced by the generator):

```bash
cd circuits
npx jest src/__tests__/input.sym.test.ts -i --color
```

Notes and troubleshooting

- The generator detects canonical-output and prints a machine-friendly `CANONICAL_PATH=` line with the path it wrote; if the test can't find the canonical file make sure the generator completed successfully and that `CANONICAL_PATH` points inside `circuits/proofs/`.
- The Merkle tree files must match the `TreeFileData` shape exactly. Layers should be strings (decimal or hex field elements).
- If you see `Credential proof valid: false` or `Nullifier proof valid: false` in generator output after using test trees, that's expected for synthetic test trees where the leaf/value used for proof generation doesn't match a production tree - but shape validation and most tests only assert canonical input shapes and presence of the proof object.

If you want me to commit the helper scripts or add a CI job that regenerates these trees before running the tests, say so and I'll prepare a small Git commit + CI tweak.
