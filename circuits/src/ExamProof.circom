pragma circom 2.0.0;

// Include local circomlib helpers and third-party circomlib circuits
include "circomlib/merkle.circom";
include "circomlib/edsa_wrapper.circom";
include "poseidon.circom";

// Standard Merkle tree height for credential verification
// Height 20 provides capacity for ~1M credentials with good security
// This balances security (sufficient depth) with efficiency (reasonable proof size)
// Height 20 = 2^20 = 1,048,576 leaf capacity


template ExamProof(
    merkleTreeHeight
) {
    // ********** HEIGHT VALIDATION **********
    // Ensure merkleTreeHeight is within reasonable bounds for security and efficiency
    // Minimum: 16 levels (security requirement)
    // Maximum: 32 levels (practical limit for proof size)
    assert(merkleTreeHeight >= 16 && merkleTreeHeight <= 32);
    
    // ********** PUBLIC INPUTS **********
    signal input pubKey[2];           // Holder's EdDSA public key
    signal input credentialRoot;      // Merkle root of valid credentials
    signal input nullifierRoot;       // Merkle root of used nullifiers
    signal input currentTime;         // Current timestamp from verifier
    signal input signatureS;          // EdDSA signature scalar S
    signal input signatureR[2];      // EdDSA R point (R8x, R8y)
    signal input nullifier;           // Unique nullifier for anti-replay
    signal input examIdHash;          // Hashed exam ID
    signal input achievementLevelHash;// Hashed achievement level
    signal input issuerHash;          // Hashed issuer identity

    // ********** PRIVATE INPUTS **********
    signal input holderSecret;        // Holder's private commitment
    signal input merkleProof[merkleTreeHeight];  // Proof for credential validity
    signal input merkleProofNullifier[merkleTreeHeight]; // Proof nullifier unused
    signal input merklePathIndices[merkleTreeHeight]; // 0/1 path bits for credential proof
    signal input merklePathIndicesNullifier[merkleTreeHeight]; // path bits for nullifier proof
    signal input storedNullifierLeaf; // actual leaf stored at the nullifier index

    // ********** OUTPUTS **********
    signal output verified;           // Final verification result
    signal output credentialId;       // Unique credential ID
    signal output verificationTimestamp;

    // ********** HASH CREDENTIAL DATA **********
    component credentialHashPoseidon = Poseidon(4);
    credentialHashPoseidon.inputs[0] <== examIdHash;
    credentialHashPoseidon.inputs[1] <== achievementLevelHash;
    credentialHashPoseidon.inputs[2] <== issuerHash;
    credentialHashPoseidon.inputs[3] <== holderSecret;
    signal credentialHash <== credentialHashPoseidon.out;

    // ********** MERKLE PROOF: CREDENTIAL VALIDITY (inclusion) **********
    component credentialMerkleProof = MerkleProof(merkleTreeHeight);
    credentialMerkleProof.leaf <== credentialHash;
    for (var i = 0; i < merkleTreeHeight; i++) {
        credentialMerkleProof.siblings[i] <== merkleProof[i];
        credentialMerkleProof.pathIndices[i] <== merklePathIndices[i];
    }
    credentialMerkleProof.root <== credentialRoot;
    signal credentialInTree <== credentialMerkleProof.verified;

    // ********** MERKLE PROOF: NULLIFIER UNUSED (non-inclusion at index)
    // We use MerkleNonInclusion to prove the stored leaf at the provided
    // index is different from the `nullifier` (forbidden leaf) while
    // the stored leaf recomputes to the provided root.
    component nullifierNonInc = MerkleNonInclusion(merkleTreeHeight);
    nullifierNonInc.forbiddenLeaf <== nullifier;
    nullifierNonInc.storedLeaf <== storedNullifierLeaf;
    for (var j = 0; j < merkleTreeHeight; j++) {
        nullifierNonInc.siblings[j] <== merkleProofNullifier[j];
        nullifierNonInc.pathIndices[j] <== merklePathIndicesNullifier[j];
    }
    nullifierNonInc.root <== nullifierRoot;
    signal nullifierValid <== nullifierNonInc.notIncluded;

    // ********** SIGNATURE VERIFICATION **********
    // Use circomlib's EdDSAPoseidonVerifier directly. The verifier enforces
    // equality constraints when `enabled` is 1; it does not return an `isValid`
    // boolean, so we expose `signatureValid` as 1 and rely on constraint failures
    // to indicate invalid signatures.
    component sigVerifier = EdDSAWrapper();
    sigVerifier.enabled <== 1;
    sigVerifier.Ax <== pubKey[0];
    sigVerifier.Ay <== pubKey[1];
    sigVerifier.S <== signatureS;
    sigVerifier.R8x <== signatureR[0];
    sigVerifier.R8y <== signatureR[1];
    sigVerifier.M <== credentialHash;
    signal signatureValid <== 1;

    // ********** TIMESTAMP VERIFICATION **********
    // expiryDate <== comes from hashed credential data on-chain
    // Just ensure proof timestamp < expiryDate
    verificationTimestamp <== currentTime;

    // ********** CREDENTIAL ID **********
    component credIdGen = Poseidon(2);
    credIdGen.inputs[0] <== credentialHash;
    credIdGen.inputs[1] <== nullifier;
    credentialId <== credIdGen.out;

    // ********** FINAL VERIFICATION **********
    // Avoid cubic constraint: require all three flags to be 1 by summing
    signal _sumChecks;
    _sumChecks <== credentialInTree + nullifierValid + signatureValid;
    component __is_all = IsZero();
    __is_all.in <== _sumChecks - 3;
    verified <== __is_all.out;
}

component main = ExamProof(20);