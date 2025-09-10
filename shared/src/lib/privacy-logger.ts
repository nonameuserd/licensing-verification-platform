/**
 * Privacy-First Logger Implementation
 * @fileoverview Custom logger with built-in PII redaction and audit capabilities for HIPAA compliance
 */

import pino from 'pino';
import {
  PrivacyLoggerConfig,
  AuditEvent,
  VerificationLogData,
  LogLevel,
  RedactionConfig,
} from './types';
import {
  DEFAULT_REDACTION_CONFIG,
  createSafeLogObject,
  redactObject,
} from './redaction-utils';

/**
 * Privacy-First Logger class with built-in PII redaction and audit capabilities
 */
export class PrivacyLogger {
  private logger: pino.Logger;
  private auditLogger: pino.Logger;
  public config: PrivacyLoggerConfig;
  private redactionConfig: RedactionConfig;

  constructor(config: PrivacyLoggerConfig) {
    this.config = {
      environment: 'development',
      serviceName: 'licensing-verification-platform',
      ...config,
    };

    this.redactionConfig = {
      ...DEFAULT_REDACTION_CONFIG,
      customFields: [
        ...DEFAULT_REDACTION_CONFIG.customFields,
        ...this.config.redactPaths.map((path) => ({
          pattern: path,
          method: 'replace' as const,
          replacement: '[REDACTED]',
        })),
      ],
    };

    // Main logger with PII redaction
    this.logger = pino({
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
            return this.config.customRedactor(object) as Record<
              string,
              unknown
            >;
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
    this.auditLogger = pino({
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
          redactObject(object, this.redactionConfig) as Record<string, unknown>,
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
  info(message: string, data?: unknown): void {
    const safeData = data
      ? createSafeLogObject(data, this.redactionConfig)
      : undefined;
    this.logger.info(safeData, message);
  }

  /**
   * Standard error logging with automatic PII redaction
   */
  error(message: string, error?: Error | unknown, data?: unknown): void {
    const safeData = data
      ? createSafeLogObject(data, this.redactionConfig)
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

    this.logger.error({ ...(safeData as object), ...errorData }, message);
  }

  /**
   * Standard warning logging with automatic PII redaction
   */
  warn(message: string, data?: unknown): void {
    const safeData = data
      ? createSafeLogObject(data, this.redactionConfig)
      : undefined;
    this.logger.warn(safeData, message);
  }

  /**
   * Standard debug logging with automatic PII redaction
   */
  debug(message: string, data?: unknown): void {
    const safeData = data
      ? createSafeLogObject(data, this.redactionConfig)
      : undefined;
    this.logger.debug(safeData, message);
  }

  /**
   * Audit logging for compliance (HIPAA requirement)
   * This creates immutable audit trails for all verification events
   */
  audit(event: string, data: AuditEvent): void {
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
  verification(
    requestId: string,
    action: string,
    result: VerificationLogData
  ): void {
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
  request(
    method: string,
    url: string,
    requestId: string,
    data?: unknown
  ): void {
    const logData = {
      method,
      url,
      requestId,
      timestamp: new Date().toISOString(),
      ...(data as object),
    };

    this.logger.info(logData, `API Request: ${method} ${url}`);
  }

  /**
   * API response logging with automatic PII redaction
   */
  response(
    method: string,
    url: string,
    statusCode: number,
    requestId: string,
    data?: unknown
  ): void {
    const logData = {
      method,
      url,
      statusCode,
      requestId,
      timestamp: new Date().toISOString(),
      duration: (data as { duration?: number })?.duration,
      ...(data as object),
    };

    this.logger.info(logData, `API Response: ${method} ${url} ${statusCode}`);
  }

  /**
   * Security event logging (failed authentication, suspicious activity, etc.)
   */
  security(event: string, data: unknown): void {
    const securityData = {
      eventType: 'security',
      event,
      timestamp: new Date().toISOString(),
      ...(data as object),
    };

    this.logger.warn(securityData, `SECURITY: ${event}`);
  }

  /**
   * Performance logging for monitoring and optimization
   */
  performance(operation: string, duration: number, data?: unknown): void {
    const perfData = {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      ...(data as object),
    };

    this.logger.info(perfData, `PERFORMANCE: ${operation} took ${duration}ms`);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): PrivacyLogger {
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
  getPinoLogger(): pino.Logger {
    return this.logger;
  }

  /**
   * Get the audit Pino logger for advanced usage
   */
  getAuditLogger(): pino.Logger {
    return this.auditLogger;
  }

  /**
   * Update logger configuration at runtime
   */
  updateConfig(newConfig: Partial<PrivacyLoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Recreate loggers with new configuration
    this.logger = pino({
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

/**
 * Default logger instance for the platform
 */
export function createPrivacyLogger(
  config?: Partial<PrivacyLoggerConfig>
): PrivacyLogger {
  const defaultConfig: PrivacyLoggerConfig = {
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
export const LOG_LEVELS: LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
};
