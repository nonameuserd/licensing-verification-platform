/**
 * Type definitions for ZK-SNARK circuit operations
 */

export interface CircuitInput {
  // Public inputs (visible in proof)
  holderName: string;
  licenseNumber: string;
  examId: string;
  achievementLevel: string;
  issuedDate: string;
  expiryDate: string;
  issuer: string;
  nullifier: string;
  credentialRoot: string;
  nullifierRoot: string;

  // Private inputs (hidden in proof)
  holderDOB: string;
  privateKey: string;
  merkleProof: string[];
  merklePathIndices: number[];
  merkleProofNullifier: string[];
  merklePathIndicesNullifier: number[];
  storedNullifierLeaf: string;
}

export interface PublicCredentialData {
  credentialId: string;
  holderName: string;
  licenseNumber: string;
  examId: string;
  achievementLevel: string;
  issuedDate: string;
  expiryDate: string;
  issuer: string;
  holderDOB: string;
  proofHash: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CircuitOutput {
  // Public outputs
  verified: boolean;
  credentialId: string;
  verificationTimestamp: string;
}

export interface ProofData {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
  };
  publicSignals: string[];
}

export interface VerificationRequest {
  credential: CircuitInput;
  privateKey: string;
  nullifier: string;
}

export interface VerificationResponse {
  verified: boolean;
  proof?: ProofData;
  error?: string;
  timestamp: string;
}

export interface BatchVerificationRequest {
  verifications: VerificationRequest[];
}

export interface BatchVerificationResponse {
  results: VerificationResponse[];
  summary: {
    total: number;
    verified: number;
    failed: number;
  };
}

export interface CircuitConfiguration {
  inputPath: string;
  outputPath: string;
  circuitName: string;
  provingKeyPath?: string;
  verificationKeyPath?: string;
}

export interface CompilationResult {
  r1cs: string;
  wasm: string;
  sym: string;
  compilationTime: number;
}

export interface SetupResult {
  provingKey: string;
  verificationKey: string;
  setupTime: number;
}

export interface PerformanceMetrics {
  compilationTime: number;
  setupTime: number;
  proofGenerationTime: number;
  proofVerificationTime: number;
  totalTime: number;
}

export interface SecurityConfig {
  nullifierExpiry: number; // in milliseconds
  maxRetries: number;
  rateLimitWindow: number; // in milliseconds
  rateLimitMax: number;
}

export interface ErrorResult {
  code: string;
  message: string;
  timestamp: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any;
}

export type VerificationStatus =
  | 'pending'
  | 'verified'
  | 'failed'
  | 'expired'
  | 'suspended'
  | 'revoked';

export interface CredentialStatus {
  status: VerificationStatus;
  lastVerified?: string;
  expiryDate: string;
  issuer: string;
  achievementLevel: string;
}
