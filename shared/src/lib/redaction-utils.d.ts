/**
 * PII Redaction Utilities
 * @fileoverview Utility functions for detecting and redacting personally identifiable information
 */
import { PIIField, RedactionConfig } from './types';
/**
 * Default PII field patterns for common sensitive data
 */
export declare const DEFAULT_PII_PATTERNS: PIIField[];
/**
 * Default redaction configuration
 */
export declare const DEFAULT_REDACTION_CONFIG: RedactionConfig;
/**
 * Redacts PII from a string value
 */
export declare function redactString(
  value: string,
  fieldName: string,
  config: RedactionConfig
): string;
/**
 * Recursively redacts PII from an object
 */
export declare function redactObject(
  obj: unknown,
  config?: RedactionConfig,
  visited?: WeakSet<object>
): unknown;
/**
 * Checks if a field name matches PII patterns
 */
export declare function isPIIField(
  fieldName: string,
  patterns?: PIIField[]
): boolean;
/**
 * Creates a safe version of an object for logging
 */
export declare function createSafeLogObject(
  obj: unknown,
  config?: RedactionConfig
): unknown;
