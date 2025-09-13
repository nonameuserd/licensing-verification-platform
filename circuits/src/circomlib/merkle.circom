pragma circom 2.0.0;

// NOTE: This local `merkle.circom` is intentionally kept in the repo because:
//  - It contains project-specific encoding/leaf layout and helper conventions that
//    must match the on-chain verifier and JS witness generation exactly.
//  - Upstream `circomlib` provides useful primitives (Poseidon, comparators), but
//    the leaf encoding and MerkleNonInclusion semantics here are project-specific.
//  - Keeping this file locally makes it easy to audit and guarantees stability
//    across developers and CI. The file still uses upstream primitives via -l.

// Include circomlib templates (resolved via -l library paths)
include "poseidon.circom";
include "comparators.circom";


/**
 * Merkle Tree Inclusion Proof
 *
 * Inputs:
 *  - leaf: Poseidon hash of the leaf data
 *  - siblings[levels]: Merkle proof path hashes
 *  - pathIndices[levels]: 0 if current node is left child, 1 if right child
 *  - root: expected Merkle root
 *
 * Outputs:
 *  - verified: 1 if the proof is valid, else 0
 */
template MerkleProof(levels) {
    signal input leaf;
    signal input siblings[levels];
    signal input pathIndices[levels]; // 0 for left, 1 for right
    signal input root;

    signal output verified;

    // Intermediate hash signals (use array to avoid reassigning same signal)
    signal currentHash[levels+1];
    currentHash[0] <== leaf;

    // Poseidon hashers
    component hashers[levels];
    // Predeclare left/right as arrays so signals are in the initial scope
    signal left[levels];
    signal right[levels];
    // Predeclare diff arrays used inside loop
    signal diff[levels];
    signal diffR[levels];

    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);

    // Use a safe quadratic expression: left = currentHash + path*(siblings - currentHash)
    // This keeps constraints quadratic (path is 0/1).
    diff[i] <== siblings[i] - currentHash[i];
    left[i] <== currentHash[i] + pathIndices[i] * diff[i];
    // right is symmetric
    diffR[i] <== currentHash[i] - siblings[i];
    right[i] <== siblings[i] + pathIndices[i] * diffR[i];

    hashers[i].inputs[0] <== left[i];
    hashers[i].inputs[1] <== right[i];

    currentHash[i+1] <== hashers[i].out;
    }

    // Proof is valid if computed root matches the given root
    component __eq_root = IsZero();
    __eq_root.in <== currentHash[levels] - root;
    verified <== __eq_root.out;
}

/**
 * Helper to produce a leaf hash in a deterministic way compatible with
 * on-chain Solidity verifiers that expect the same Poseidon parameters.
 *
 * Encoding contract (must match on-chain packing):
 *  - input A: primary value (e.g. credential id or hashed credential)
 *  - input B: secondary value (e.g. nonce, salt, or 0)
 *
 * The resulting leaf is Poseidon([A, B]). Use this consistently in JS/solidity
 * code that generates leaves for insertion/verifier.
 */
template HashLeaf() {
    signal input a;
    signal input b; // optional nonce/salt; use 0 if unused
    signal output out;

    component h = Poseidon(2);
    h.inputs[0] <== a;
    h.inputs[1] <== b;
    out <== h.out;
}


/**
 * Merkle non-inclusion proof.
 *
 * Proves that the value `forbiddenLeaf` is NOT the value stored at the
 * provided leaf index (i.e. the member at that index is different), and
 * that the provided `storedLeaf` indeed sits at that index in the tree
 * (it recomputes to `root`). This is a simple and practical non-inclusion
 * witness: it proves the tree contains a different value at the chosen
 * index.
 *
 * Inputs:
 *  - forbiddenLeaf: Poseidon hash of the credential we're asserting is not present
 *  - storedLeaf: Poseidon hash of the actual leaf stored at the index
 *  - siblings[levels], pathIndices[levels], root: same as inclusion proof
 *
 * Outputs:
 *  - notIncluded: 1 if storedLeaf matches root and storedLeaf != forbiddenLeaf
 */
template MerkleNonInclusion(levels) {
    signal input forbiddenLeaf;
    signal input storedLeaf;
    signal input siblings[levels];
    signal input pathIndices[levels]; // 0 for left, 1 for right
    signal input root;

    signal output notIncluded;

    // Compute the Merkle root starting from the provided storedLeaf
    signal currentHash[levels+1];
    currentHash[0] <== storedLeaf;

    component hashers[levels];
    signal left[levels];
    signal right[levels];
    signal diff[levels];
    signal diffR[levels];
    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);


    diff[i] <== siblings[i] - currentHash[i];
    left[i] <== currentHash[i] + pathIndices[i] * diff[i];
    diffR[i] <== currentHash[i] - siblings[i];
    right[i] <== siblings[i] + pathIndices[i] * diffR[i];

        hashers[i].inputs[0] <== left[i];
        hashers[i].inputs[1] <== right[i];

    currentHash[i+1] <== hashers[i].out;
    }

    // rootMatch = 1 if storedLeaf path recomputes to provided root
    signal rootMatch;
    component __rm = IsZero();
    __rm.in <== currentHash[levels] - root;
    rootMatch <== __rm.out;

    // equalLeaves = 1 if forbiddenLeaf == storedLeaf
    signal equalLeaves;
    component __eq_leaves = IsZero();
    __eq_leaves.in <== forbiddenLeaf - storedLeaf;
    equalLeaves <== __eq_leaves.out;

    // notIncluded is true when storedLeaf is at root (rootMatch) AND
    // storedLeaf is different from forbiddenLeaf (1 - equalLeaves)
    notIncluded <== rootMatch * (1 - equalLeaves);
}

/**
 * Helper template to validate leaf index < 2^levels (optional but recommended)
 */
template CheckLeafIndex(levels) {
    signal input index;
    signal output valid;

    // Ensure index fits into `levels` bits
    component bits = Num2Bits(levels);
    bits.in <== index;

    valid <== 1; // If Num2Bits doesn't throw, index is valid
}

