'use strict';
/**
 * Privacy-First Logger Implementation
 * @fileoverview Custom logger with built-in PII redaction and audit capabilities for HIPAA compliance
 */
const __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.LOG_LEVELS = exports.PrivacyLogger = void 0;
exports.createPrivacyLogger = createPrivacyLogger;
const pino_1 = __importDefault(require('pino'));
const redaction_utils_1 = require('./redaction-utils');
/**
 * Privacy-First Logger class with built-in PII redaction and audit capabilities
 */
class PrivacyLogger {
  constructor(config) {
    this.config = {
      environment: 'development',
      serviceName: 'licensing-verification-platform',
      ...config,
    };
    this.redactionConfig = {
      ...redaction_utils_1.DEFAULT_REDACTION_CONFIG,
      customFields: [
        ...redaction_utils_1.DEFAULT_REDACTION_CONFIG.customFields,
        ...this.config.redactPaths.map((path) => ({
          pattern: path,
          method: 'replace',
          replacement: '[REDACTED]',
        })),
      ],
    };
    // Main logger with PII redaction
    this.logger = (0, pino_1.default)({
      level: this.config.level,
      redact: {
        paths: this.config.redactPaths,
        censor: '[REDACTED]',
        remove: true,
      },
      formatters: {
        level: (label) => ({ level: label }),
        log: (object) => {
          // Additional custom redaction
          if (this.config.customRedactor) {
            return this.config.customRedactor(object);
          }
          return object;
        },
      },
      base: {
        service: this.config.serviceName,
        environment: this.config.environment,
      },
    });
    // Separate audit logger for compliance (HIPAA requirement)
    this.auditLogger = (0, pino_1.default)({
      level: 'info',
      redact: {
        paths: [
          'user.pii',
          'credential.sensitiveData',
          'proof.privateInputs',
          '*.personalData',
          '*.sensitiveData',
        ],
        censor: '[AUDIT_REDACTED]',
        remove: false, // Keep structure for audit trails
      },
      formatters: {
        level: (label) => ({ level: label }),
        log: (object) =>
          (0, redaction_utils_1.redactObject)(object, this.redactionConfig),
      },
      base: {
        service: this.config.serviceName,
        environment: this.config.environment,
        loggerType: 'audit',
      },
    });
  }
  /**
   * Standard info logging with automatic PII redaction
   */
  info(message, data) {
    const safeData = data
      ? (0, redaction_utils_1.createSafeLogObject)(data, this.redactionConfig)
      : undefined;
    this.logger.info(safeData, message);
  }
  /**
   * Standard error logging with automatic PII redaction
   */
  error(message, error, data) {
    const safeData = data
      ? (0, redaction_utils_1.createSafeLogObject)(data, this.redactionConfig)
      : undefined;
    const errorData = error
      ? {
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : 'UnknownError',
          },
        }
      : undefined;
    this.logger.error({ ...safeData, ...errorData }, message);
  }
  /**
   * Standard warning logging with automatic PII redaction
   */
  warn(message, data) {
    const safeData = data
      ? (0, redaction_utils_1.createSafeLogObject)(data, this.redactionConfig)
      : undefined;
    this.logger.warn(safeData, message);
  }
  /**
   * Standard debug logging with automatic PII redaction
   */
  debug(message, data) {
    const safeData = data
      ? (0, redaction_utils_1.createSafeLogObject)(data, this.redactionConfig)
      : undefined;
    this.logger.debug(safeData, message);
  }
  /**
   * Audit logging for compliance (HIPAA requirement)
   * This creates immutable audit trails for all verification events
   */
  audit(event, data) {
    const auditData = {
      ...data,
      eventType: event,
      timestamp: new Date().toISOString(),
    };
    this.auditLogger.info(auditData, `AUDIT: ${event}`);
  }
  /**
   * Verification-specific logging with automatic PII redaction
   */
  verification(requestId, action, result) {
    const logData = {
      requestId,
      action,
      verified: result.verified,
      organizationId: result.organizationId,
      credentialId: result.credentialId,
      duration: result.duration,
      error: result.error,
      metadata: result.metadata,
    };
    this.logger.info(logData, `Verification ${action}`);
  }
  /**
   * API request logging with automatic PII redaction
   */
  request(method, url, requestId, data) {
    const logData = {
      method,
      url,
      requestId,
      timestamp: new Date().toISOString(),
      ...data,
    };
    this.logger.info(logData, `API Request: ${method} ${url}`);
  }
  /**
   * API response logging with automatic PII redaction
   */
  response(method, url, statusCode, requestId, data) {
    const logData = {
      method,
      url,
      statusCode,
      requestId,
      timestamp: new Date().toISOString(),
      duration: data?.duration,
      ...data,
    };
    this.logger.info(logData, `API Response: ${method} ${url} ${statusCode}`);
  }
  /**
   * Security event logging (failed authentication, suspicious activity, etc.)
   */
  security(event, data) {
    const securityData = {
      eventType: 'security',
      event,
      timestamp: new Date().toISOString(),
      ...data,
    };
    this.logger.warn(securityData, `SECURITY: ${event}`);
  }
  /**
   * Performance logging for monitoring and optimization
   */
  performance(operation, duration, data) {
    const perfData = {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      ...data,
    };
    this.logger.info(perfData, `PERFORMANCE: ${operation} took ${duration}ms`);
  }
  /**
   * Create a child logger with additional context
   */
  child(context) {
    const childConfig = {
      ...this.config,
      serviceName: `${this.config.serviceName}-${
        context['service'] || 'child'
      }`,
    };
    const childLogger = new PrivacyLogger(childConfig);
    // Add context to both loggers
    childLogger.logger = this.logger.child(context);
    childLogger.auditLogger = this.auditLogger.child(context);
    return childLogger;
  }
  /**
   * Get the underlying Pino logger for advanced usage
   */
  getPinoLogger() {
    return this.logger;
  }
  /**
   * Get the audit Pino logger for advanced usage
   */
  getAuditLogger() {
    return this.auditLogger;
  }
  /**
   * Update logger configuration at runtime
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    // Recreate loggers with new configuration
    this.logger = (0, pino_1.default)({
      level: this.config.level,
      redact: {
        paths: this.config.redactPaths,
        censor: '[REDACTED]',
        remove: true,
      },
      base: {
        service: this.config.serviceName,
        environment: this.config.environment,
      },
    });
  }
}
exports.PrivacyLogger = PrivacyLogger;
/**
 * Default logger instance for the platform
 */
function createPrivacyLogger(config) {
  const defaultConfig = {
    level: process.env['LOG_LEVEL'] || 'info',
    redactPaths: [
      'req.body.ssn',
      'req.body.licenseNumber',
      'req.body.email',
      'req.body.phone',
      'req.body.address',
      'req.body.password',
      'req.body.dateOfBirth',
      'req.body.firstName',
      'req.body.lastName',
      'req.body.holderName',
      'req.body.holderDOB',
      'req.headers.authorization',
      'user.personalData',
      'user.pii',
      'credential.sensitiveData',
      'credential.personalData',
      'credential.holderName',
      'credential.holderDOB',
      'credential.dateOfBirth',
      'credential.firstName',
      'credential.lastName',
      'proof.privateInputs',
      '*.pii',
      '*.personalData',
      '*.sensitiveData',
    ],
    auditMode: true,
    environment: process.env['NODE_ENV'] || 'development',
    serviceName:
      process.env['SERVICE_NAME'] || 'licensing-verification-platform',
  };
  return new PrivacyLogger({ ...defaultConfig, ...config });
}
/**
 * Log levels enum for type safety
 */
exports.LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
};
