'use strict';
/**
 * Circuit-specific logger configuration
 * @fileoverview Logger setup for ZK-SNARK circuit operations with appropriate PII redaction
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.logger =
  exports.defaultCircuitLogger =
  exports.CircuitLogger =
  exports.circuitLogger =
    void 0;
exports.createCircuitLogger = createCircuitLogger;
const shared_1 = require('@licensing-verification-platform/shared');
/**
 * Circuit-specific redaction paths for ZK-SNARK operations
 */
const CIRCUIT_REDACTION_PATHS = [
  // Credential data
  'credential.holderName',
  'credential.holderDOB',
  'credential.licenseNumber',
  'credential.credentialId',
  'credential.proofHash',
  // Private inputs (must never be logged)
  'privateInputs.*',
  'witness.privateInputs',
  'witness.holderDateOfBirth',
  'witness.privateKey',
  'witness.holderSSN',
  // Proof data (contains sensitive information)
  'proof.pi_a',
  'proof.pi_b',
  'proof.pi_c',
  'proof.privateSignals',
  // Setup data
  'setup.privateKey',
  'setup.secret',
  'setup.randomness',
  // Input data
  'input.holderDOB',
  'input.privateKey',
  'input.holderSSN',
  'input.personalData',
  // Verification data
  'verification.privateInputs',
  'verification.sensitiveData',
  // Test data
  'testData.privateInputs',
  'testData.sensitiveData',
  'testData.personalData',
  // General PII patterns
  '*.pii',
  '*.personalData',
  '*.sensitiveData',
  '*.privateKey',
  '*.ssn',
  '*.dateOfBirth',
  '*.holderName',
  '*.licenseNumber',
];
/**
 * Circuit-specific logger configuration
 */
const CIRCUIT_LOGGER_CONFIG = {
  serviceName: 'circuits',
  level: process.env['CIRCUIT_LOG_LEVEL'] || 'info',
  redactPaths: CIRCUIT_REDACTION_PATHS,
  auditMode: true,
  environment: process.env['NODE_ENV'] || 'development',
  customRedactor: (object) => {
    // Additional circuit-specific redaction
    if (object && typeof object === 'object') {
      const redacted = { ...object };
      // Redact any field that might contain sensitive circuit data
      Object.keys(redacted).forEach((key) => {
        if (
          key.toLowerCase().includes('private') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('witness') ||
          key.toLowerCase().includes('proof')
        ) {
          redacted[key] = '[CIRCUIT_REDACTED]';
        }
      });
      return redacted;
    }
    return object;
  },
};
/**
 * Circuit logger instance
 */
exports.circuitLogger = (0, shared_1.createPrivacyLogger)(
  CIRCUIT_LOGGER_CONFIG
);
exports.logger = exports.circuitLogger;
/**
 * Create a child logger for specific circuit operations
 */
function createCircuitLogger(operation) {
  return exports.circuitLogger.child({
    operation,
    component: 'circuit',
    timestamp: new Date().toISOString(),
  });
}
/**
 * Circuit-specific logging utilities
 */
class CircuitLogger {
  constructor(operation) {
    this.logger = createCircuitLogger(operation);
  }
  /**
   * Standard info logging
   */
  info(message, data) {
    this.logger.info(message, data);
  }
  /**
   * Standard debug logging
   */
  debug(message, data) {
    this.logger.debug(message, data);
  }
  /**
   * Standard error logging
   */
  error(message, error, data) {
    this.logger.error(message, error, data);
  }
  /**
   * Standard warning logging
   */
  warn(message, data) {
    this.logger.warn(message, data);
  }
  /**
   * Log circuit compilation events
   */
  compilationStart(config) {
    this.logger.info('Circuit compilation started', {
      circuitName: config.circuitName,
      inputPath: config.inputPath,
      outputPath: config.outputPath,
    });
  }
  compilationComplete(result) {
    this.logger.info('Circuit compilation completed', {
      compilationTime: result.compilationTime,
      r1csSize: result.r1cs ? 'generated' : 'failed',
      wasmSize: result.wasm ? 'generated' : 'failed',
    });
  }
  compilationError(error, config) {
    this.logger.error('Circuit compilation failed', error, {
      circuitName: config.circuitName,
      inputPath: config.inputPath,
    });
  }
  /**
   * Log proof generation events
   */
  proofGenerationStart(credentialId) {
    this.logger.info('Proof generation started', {
      credentialId,
      operation: 'proof_generation',
    });
  }
  proofGenerationComplete(credentialId, duration) {
    this.logger.info('Proof generation completed', {
      credentialId,
      duration,
      operation: 'proof_generation',
    });
  }
  proofGenerationError(error, credentialId) {
    this.logger.error('Proof generation failed', error, {
      credentialId,
      operation: 'proof_generation',
    });
  }
  /**
   * Log proof verification events
   */
  proofVerificationStart(credentialId) {
    this.logger.info('Proof verification started', {
      credentialId,
      operation: 'proof_verification',
    });
  }
  proofVerificationComplete(credentialId, isValid, duration) {
    this.logger.info('Proof verification completed', {
      credentialId,
      isValid,
      duration,
      operation: 'proof_verification',
    });
  }
  proofVerificationError(error, credentialId) {
    this.logger.error('Proof verification failed', error, {
      credentialId,
      operation: 'proof_verification',
    });
  }
  /**
   * Log credential validation events
   */
  credentialValidationStart(credentialId) {
    this.logger.info('Credential validation started', {
      credentialId,
      operation: 'credential_validation',
    });
  }
  credentialValidationComplete(credentialId, isValid, errors) {
    this.logger.info('Credential validation completed', {
      credentialId,
      isValid,
      errorCount: errors.length,
      operation: 'credential_validation',
    });
  }
  credentialValidationError(error, credentialId) {
    this.logger.error('Credential validation failed', error, {
      credentialId,
      operation: 'credential_validation',
    });
  }
  /**
   * Log setup events
   */
  setupStart(setupType) {
    this.logger.info('Circuit setup started', {
      setupType,
      operation: 'circuit_setup',
    });
  }
  setupComplete(setupType, duration) {
    this.logger.info('Circuit setup completed', {
      setupType,
      duration,
      operation: 'circuit_setup',
    });
  }
  setupError(error, setupType) {
    this.logger.error('Circuit setup failed', error, {
      setupType,
      operation: 'circuit_setup',
    });
  }
  /**
   * Log performance metrics
   */
  performance(operation, duration, metadata) {
    this.logger.performance(operation, duration, metadata);
  }
  /**
   * Log security events
   */
  security(event, data) {
    this.logger.security(event, {
      ...data,
      component: 'circuit',
    });
  }
  /**
   * Log audit events for compliance
   */
  audit(event, data) {
    this.logger.audit(event, {
      ...data,
      component: 'circuit',
      timestamp: new Date().toISOString(),
    });
  }
}
exports.CircuitLogger = CircuitLogger;
/**
 * Default circuit logger instance
 */
exports.defaultCircuitLogger = new CircuitLogger('circuit-operations');
