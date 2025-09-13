/**
 * Type definitions for the Privacy-First Logger
 * @fileoverview TypeScript interfaces and types for privacy-focused logging
 */
export interface PrivacyLoggerConfig {
    /** Log level (error, warn, info, debug) */
    level: string;
    /** Paths to redact in log objects */
    redactPaths: string[];
    /** Whether to enable audit logging */
    auditMode: boolean;
    /** Custom redaction function */
    customRedactor?: (obj: unknown) => unknown;
    /** Environment (development, staging, production) */
    environment?: string;
    /** Service name for log identification */
    serviceName?: string;
}
export interface AuditEvent {
    /** Event type identifier */
    eventType: string;
    /** ISO timestamp */
    timestamp: string;
    /** User ID (if applicable) */
    userId?: string;
    /** Organization ID */
    organizationId?: string;
    /** Request ID for tracing */
    requestId?: string;
    /** IP address (may be redacted) */
    ipAddress?: string;
    /** User agent (may be redacted) */
    userAgent?: string;
    /** Additional event data */
    metadata?: Record<string, unknown>;
}
export interface VerificationLogData {
    /** Unique request identifier */
    requestId: string;
    /** Verification action performed */
    action: string;
    /** Verification result */
    verified: boolean;
    /** Organization ID */
    organizationId: string;
    /** Credential ID (may be redacted) */
    credentialId?: string;
    /** Processing duration in milliseconds */
    duration?: number;
    /** Error message if verification failed */
    error?: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}
export interface LogLevel {
    ERROR: 'error';
    WARN: 'warn';
    INFO: 'info';
    DEBUG: 'debug';
}
export interface PIIField {
    /** Field name pattern to match */
    pattern: string | RegExp;
    /** Redaction method */
    method: 'replace' | 'remove' | 'hash' | 'mask';
    /** Custom replacement value */
    replacement?: string;
}
export interface RedactionConfig {
    /** Default redaction method */
    defaultMethod: 'replace' | 'remove' | 'hash' | 'mask';
    /** Default replacement value */
    defaultReplacement: string;
    /** Custom PII field definitions */
    customFields: PIIField[];
    /** Whether to remove fields entirely */
    removeFields: boolean;
}
export interface LogEntry {
    /** Log level */
    level: string;
    /** Log message */
    message: string;
    /** Timestamp */
    timestamp: string;
    /** Service name */
    service?: string;
    /** Request ID for tracing */
    requestId?: string;
    /** Additional data */
    data?: Record<string, unknown>;
}
