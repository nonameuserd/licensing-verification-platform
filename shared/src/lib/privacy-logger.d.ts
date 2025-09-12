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
} from './types';
/**
 * Privacy-First Logger class with built-in PII redaction and audit capabilities
 */
export declare class PrivacyLogger {
  private logger;
  private auditLogger;
  config: PrivacyLoggerConfig;
  private redactionConfig;
  constructor(config: PrivacyLoggerConfig);
  /**
   * Standard info logging with automatic PII redaction
   */
  info(message: string, data?: unknown): void;
  /**
   * Standard error logging with automatic PII redaction
   */
  error(message: string, error?: Error | unknown, data?: unknown): void;
  /**
   * Standard warning logging with automatic PII redaction
   */
  warn(message: string, data?: unknown): void;
  /**
   * Standard debug logging with automatic PII redaction
   */
  debug(message: string, data?: unknown): void;
  /**
   * Audit logging for compliance (HIPAA requirement)
   * This creates immutable audit trails for all verification events
   */
  audit(event: string, data: AuditEvent): void;
  /**
   * Verification-specific logging with automatic PII redaction
   */
  verification(
    requestId: string,
    action: string,
    result: VerificationLogData
  ): void;
  /**
   * API request logging with automatic PII redaction
   */
  request(method: string, url: string, requestId: string, data?: unknown): void;
  /**
   * API response logging with automatic PII redaction
   */
  response(
    method: string,
    url: string,
    statusCode: number,
    requestId: string,
    data?: unknown
  ): void;
  /**
   * Security event logging (failed authentication, suspicious activity, etc.)
   */
  security(event: string, data: unknown): void;
  /**
   * Performance logging for monitoring and optimization
   */
  performance(operation: string, duration: number, data?: unknown): void;
  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): PrivacyLogger;
  /**
   * Get the underlying Pino logger for advanced usage
   */
  getPinoLogger(): pino.Logger;
  /**
   * Get the audit Pino logger for advanced usage
   */
  getAuditLogger(): pino.Logger;
  /**
   * Update logger configuration at runtime
   */
  updateConfig(newConfig: Partial<PrivacyLoggerConfig>): void;
}
/**
 * Default logger instance for the platform
 */
export declare function createPrivacyLogger(
  config?: Partial<PrivacyLoggerConfig>
): PrivacyLogger;
/**
 * Log levels enum for type safety
 */
export declare const LOG_LEVELS: LogLevel;
