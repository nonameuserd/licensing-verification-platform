pragma circom 2.0.0;

// Simple wrapper that forwards the minimal interface used by ExamProof
// to the full EdDSAPoseidonVerifier implementation. This lets other
// circuits include `edsa_wrapper.circom` when only the verifier interface
// is required without importing the whole library by name.

include "eddsaposeidon.circom";

template EdDSAWrapper() {
    // Minimal inputs used by ExamProof.circom
    signal input enabled;
    signal input Ax;
    signal input Ay;
    signal input S;
    signal input R8x;
    signal input R8y;
    signal input M; // message (Poseidon field) being verified

    // Instantiate the canonical verifier and forward fields
    component verifier = EdDSAPoseidonVerifier();
    verifier.enabled <== enabled;
    verifier.Ax <== Ax;
    verifier.Ay <== Ay;
    verifier.S <== S;
    verifier.R8x <== R8x;
    verifier.R8y <== R8y;
    verifier.M <== M;

    // No outputs other than constraints enforced by the underlying verifier
}
