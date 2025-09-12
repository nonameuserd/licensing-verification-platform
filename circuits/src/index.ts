/**
 * @licensing-verification-platform/circuits
 *
 * ZK-SNARK circuits for credential verification
 *
 * This library provides:
 * - ExamProof.circom circuit for privacy-preserving credential verification
 * - TypeScript utilities for circuit interaction
 * - Privacy-first logging with automatic PII redaction
 * - Support for multiple verification methods (credential ID, license number, personal info)
 * - L2 blockchain compatibility
 * - HIPAA and SOC 2 compliance features
 * - Test utilities and mock data
 */

// Export circuit utilities
export * from './lib/circuit-utils';
export * from './lib/proof-utils';

// Export verification utilities
export * from './lib/verification-utils';

// Export network utilities
export * from './lib/networks';

// Export logger utilities
export * from './lib/logger';

// Export types
export * from './lib/types';

// Note: test utilities are intentionally not exported from the library entrypoint
// to keep the library bundle small and to avoid pulling test-only files into
// composite builds. Tests should import helpers directly from their test paths.
