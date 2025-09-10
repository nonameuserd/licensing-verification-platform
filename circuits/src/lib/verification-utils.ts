/**
 * Verification utilities for credential verification
 * Provides helper functions for credential validation and verification
 */

import { CircuitLogger } from './logger';

export interface Credential {
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

export interface VerificationResult {
  verified: boolean;
  credential?: Credential;
  error?: string;
  timestamp: string;
}

/**
 * Validate credential data
 */
export function validateCredential(credential: Credential): {
  valid: boolean;
  errors: string[];
} {
  const logger = new CircuitLogger('credential-validation');

  logger.credentialValidationStart(credential.credentialId);

  const errors: string[] = [];

  // Check required fields
  if (!credential.holderName) errors.push('Holder name is required');
  if (!credential.licenseNumber) errors.push('License number is required');
  if (!credential.examId) errors.push('Exam ID is required');
  if (!credential.achievementLevel)
    errors.push('Achievement level is required');
  if (!credential.issuedDate) errors.push('Issued date is required');
  if (!credential.expiryDate) errors.push('Expiry date is required');
  if (!credential.issuer) errors.push('Issuer is required');
  if (!credential.holderDOB) errors.push('Holder date of birth is required');

  // Check date formats
  if (credential.issuedDate && !isValidDate(credential.issuedDate)) {
    errors.push('Invalid issued date format');
  }
  if (credential.expiryDate && !isValidDate(credential.expiryDate)) {
    errors.push('Invalid expiry date format');
  }
  if (credential.holderDOB && !isValidDate(credential.holderDOB)) {
    errors.push('Invalid holder date of birth format');
  }

  // Check if credential is expired
  if (credential.expiryDate && isExpired(credential.expiryDate)) {
    errors.push('Credential has expired');
  }

  // Check achievement level
  if (
    credential.achievementLevel &&
    !isValidAchievementLevel(credential.achievementLevel)
  ) {
    errors.push('Invalid achievement level');
  }

  const isValid = errors.length === 0;

  logger.credentialValidationComplete(credential.credentialId, isValid, errors);

  if (!isValid) {
    logger.debug('Credential validation failed', {
      credentialId: credential.credentialId,
      errorCount: errors.length,
      errors: errors.slice(0, 5), // Log first 5 errors to avoid overwhelming logs
    });
  }

  return {
    valid: isValid,
    errors,
  };
}

/**
 * Check if a date string is valid
 */
function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Check if a credential is expired
 */
function isExpired(expiryDate: string): boolean {
  const expiry = new Date(expiryDate);
  const now = new Date();
  return expiry <= now;
}

/**
 * Check if achievement level is valid
 */
function isValidAchievementLevel(level: string): boolean {
  const validLevels = [
    'Passed',
    'Failed',
    'Pending',
    'Under Review',
    'Conditional',
  ];
  return validLevels.includes(level);
}

/**
 * Generate nullifier for replay attack prevention
 */
export function generateNullifier(
  credential: Credential,
  timestamp: number = Date.now()
): string {
  const logger = new CircuitLogger('nullifier-generation');

  try {
    logger.debug('Generating nullifier', {
      credentialId: credential.credentialId,
      timestamp,
    });

    // This would typically use a cryptographic hash function
    // For now, we'll use a simple hash-like function
    const data = `${credential.licenseNumber}-${credential.credentialId}-${timestamp}`;
    const nullifier = `0x${Buffer.from(data)
      .toString('hex')
      .padStart(40, '0')}`;

    logger.debug('Nullifier generated successfully', {
      credentialId: credential.credentialId,
      nullifierLength: nullifier.length,
    });

    return nullifier;
  } catch (error) {
    logger.error('Failed to generate nullifier', error as Error, {
      credentialId: credential.credentialId,
      timestamp,
    });
    throw error;
  }
}

/**
 * Verify credential authenticity
 */
export function verifyCredentialAuthenticity(
  credential: Credential,
  expectedIssuer: string
): boolean {
  const logger = new CircuitLogger('credential-authenticity');

  try {
    logger.debug('Verifying credential authenticity', {
      credentialId: credential.credentialId,
      expectedIssuer,
      actualIssuer: credential.issuer,
    });

    // Check if the credential was issued by the expected issuer
    const isAuthentic = credential.issuer === expectedIssuer;

    logger.debug('Credential authenticity verification completed', {
      credentialId: credential.credentialId,
      isAuthentic,
      expectedIssuer,
      actualIssuer: credential.issuer,
    });

    return isAuthentic;
  } catch (error) {
    logger.error('Failed to verify credential authenticity', error as Error, {
      credentialId: credential.credentialId,
      expectedIssuer,
    });
    throw error;
  }
}

/**
 * Check if credential is active (not suspended or revoked)
 */
export function isCredentialActive(credential: Credential): boolean {
  const logger = new CircuitLogger('credential-status-check');

  const activeLevels = ['Passed', 'Pending'];
  const isActive = activeLevels.includes(credential.achievementLevel);

  logger.debug('Credential status check', {
    credentialId: credential.credentialId,
    achievementLevel: credential.achievementLevel,
    isActive,
  });

  return isActive;
}

/**
 * Get credential status
 */
export function getCredentialStatus(credential: Credential): string {
  const logger = new CircuitLogger('credential-status-determination');

  let status: string;

  if (isExpired(credential.expiryDate)) {
    status = 'Expired';
  } else if (!isCredentialActive(credential)) {
    status = credential.achievementLevel;
  } else {
    status = 'Active';
  }

  logger.debug('Credential status determined', {
    credentialId: credential.credentialId,
    status,
    expiryDate: credential.expiryDate,
    achievementLevel: credential.achievementLevel,
  });

  return status;
}
