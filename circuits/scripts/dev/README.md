# Dev probe helpers

This folder contains small helper scripts for developers to inspect the
compiled circuit artifacts (wasm + witness_calculator) and probe which
top-level input signals the wasm witness calculator recognizes.

probe-wasm.js

- Probes `build/ExamProof_js/ExamProof.wasm` using the generated
  `witness_calculator.js` and prints the `getInputSignalSize` results for a
  handful of commonly-used signal names. Useful to decide whether the wasm
  expects `main.foo` or bare `foo` names.

## Usage

From the `circuits/` directory run:

```sh
node scripts/dev/probe-wasm.js
```

This prints a small table showing which signals the wasm recognizes. Use
this when you need to emit wasm-preferred canonical JSON for `snarkjs`.
