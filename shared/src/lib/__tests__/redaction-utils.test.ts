/**
 * Unit tests for Redaction Utils
 * @fileoverview Test suite for PII redaction utility functions
 */

import {
  DEFAULT_PII_PATTERNS,
  redactString,
  createSafeLogObject,
  isPIIField,
  redactObject,
} from '../redaction-utils';
import { PIIField, RedactionConfig } from '../types';

describe('Redaction Utils', () => {
  describe('DEFAULT_PII_PATTERNS', () => {
    it('should contain expected PII patterns', () => {
      expect(DEFAULT_PII_PATTERNS).toBeDefined();
      expect(DEFAULT_PII_PATTERNS.length).toBeGreaterThan(0);

      // Check for common patterns
      const patterns = DEFAULT_PII_PATTERNS.map((p) => p.pattern);
      expect(
        patterns.some((p) =>
          typeof p === 'string' ? p.includes('ssn') : p.test('ssn')
        )
      ).toBe(true);
      expect(
        patterns.some((p) =>
          typeof p === 'string' ? p.includes('email') : p.test('email')
        )
      ).toBe(true);
      expect(
        patterns.some((p) =>
          typeof p === 'string' ? p.includes('phone') : p.test('phone')
        )
      ).toBe(true);
    });
  });

  describe('redactString', () => {
    const defaultConfig: RedactionConfig = {
      defaultMethod: 'replace',
      defaultReplacement: '[REDACTED]',
      customFields: DEFAULT_PII_PATTERNS,
      removeFields: false,
    };

    it('should redact email addresses', () => {
      const result = redactString('user@example.com', 'email', defaultConfig);
      expect(result).toBe('***@***.***');
    });

    it('should redact SSN patterns', () => {
      const result = redactString('123-45-6789', 'ssn', defaultConfig);
      expect(result).toBe('***-**-****');
    });

    it('should redact phone numbers', () => {
      const result = redactString('555-123-4567', 'phone', defaultConfig);
      expect(result).toBe('(***) ***-****');
    });

    it('should redact license numbers', () => {
      const result = redactString('ABC123456', 'licenseNumber', defaultConfig);
      expect(result).toBe('****-****');
    });

    it('should redact addresses', () => {
      const result = redactString('123 Main Street', 'address', defaultConfig);
      expect(result).toBe('[ADDRESS_REDACTED]');
    });

    it('should redact date of birth fields', () => {
      const result = redactString('1980-05-15', 'dateOfBirth', defaultConfig);
      expect(result).toBe('****-**-**');
    });

    it('should redact holder DOB fields', () => {
      const result = redactString('1980-05-15', 'holderDOB', defaultConfig);
      expect(result).toBe('****-**-**');
    });

    it('should redact first name fields', () => {
      const result = redactString('John', 'firstName', defaultConfig);
      expect(result).toBe('***');
    });

    it('should redact last name fields', () => {
      const result = redactString('Smith', 'lastName', defaultConfig);
      expect(result).toBe('***');
    });

    it('should redact holder name fields', () => {
      const result = redactString(
        'Dr. John Smith',
        'holderName',
        defaultConfig
      );
      expect(result).toBe('*** ***');
    });

    it('should redact credential ID fields', () => {
      const result = redactString(
        'MED-2024-001234',
        'credentialId',
        defaultConfig
      );
      expect(result).toBe('***-****-******');
    });

    it('should redact proof hash fields', () => {
      const result = redactString(
        '0xabcd1234567890abcdef1234567890abcdef12',
        'proofHash',
        defaultConfig
      );
      expect(result).toBe('0x****...****');
    });

    it('should remove password fields', () => {
      const result = redactString('secretpassword', 'password', defaultConfig);
      expect(result).toBe('[REMOVED]');
    });

    it('should hash sensitive data when method is hash', () => {
      const config: RedactionConfig = {
        ...defaultConfig,
        customFields: [{ pattern: /testField/i, method: 'hash' }],
      };

      const result = redactString('sensitive data', 'testField', config);
      expect(result).toMatch(/^\[HASHED_[a-z0-9]+\]$/);
    });

    it('should apply default redaction for unknown fields', () => {
      const result = redactString(
        'unknown sensitive data',
        'unknownField',
        defaultConfig
      );
      expect(result).toBe('[REDACTED]');
    });

    it('should handle empty strings', () => {
      const result = redactString('', 'email', defaultConfig);
      expect(result).toBe('');
    });

    it('should handle null and undefined values', () => {
      expect(
        redactString(null as unknown as string, 'email', defaultConfig)
      ).toBeNull();
      expect(
        redactString(undefined as unknown as string, 'email', defaultConfig)
      ).toBeUndefined();
    });

    it('should handle non-string values', () => {
      expect(
        redactString(123 as unknown as string, 'email', defaultConfig)
      ).toBe(123);
      expect(
        redactString({} as unknown as string, 'email', defaultConfig)
      ).toEqual({});
    });
  });

  describe('createSafeLogObject', () => {
    const defaultConfig: RedactionConfig = {
      defaultMethod: 'replace',
      defaultReplacement: '[REDACTED]',
      customFields: DEFAULT_PII_PATTERNS,
      removeFields: false,
    };

    it('should redact PII fields in flat objects', () => {
      const obj = {
        userId: 'user123',
        email: 'user@example.com',
        ssn: '123-45-6789',
        firstName: 'John',
        lastName: 'Smith',
        dateOfBirth: '1980-05-15',
        credentialId: 'MED-2024-001234',
        proofHash: '0xabcd1234567890abcdef1234567890abcdef12',
        normalField: 'not sensitive',
      };

      const safe = createSafeLogObject(obj, defaultConfig) as Record<
        string,
        unknown
      >;

      expect(safe.userId).toBe('user123');
      expect(safe.email).toBe('***@***.***');
      expect(safe.ssn).toBe('***-**-****');
      expect(safe.firstName).toBe('***');
      expect(safe.lastName).toBe('***');
      expect(safe.dateOfBirth).toBe('****-**-**');
      expect(safe.credentialId).toBe('***-****-******');
      expect(safe.proofHash).toBe('0x****...****');
      expect(safe.normalField).toBe('not sensitive');
    });

    it('should redact PII fields in nested objects', () => {
      const obj = {
        user: {
          email: 'user@example.com',
          personalData: {
            phone: '555-123-4567',
            address: '123 Main St',
          },
        },
        metadata: {
          normalField: 'not sensitive',
        },
      };

      const safe = createSafeLogObject(obj, defaultConfig) as Record<
        string,
        unknown
      >;

      expect((safe.user as Record<string, unknown>).email).toBe('***@***.***');
      expect(
        (
          (safe.user as Record<string, unknown>).personalData as Record<
            string,
            unknown
          >
        ).phone
      ).toBe('(***) ***-****');
      expect(
        (
          (safe.user as Record<string, unknown>).personalData as Record<
            string,
            unknown
          >
        ).address
      ).toBe('[ADDRESS_REDACTED]');
      expect((safe.metadata as Record<string, unknown>).normalField).toBe(
        'not sensitive'
      );
    });

    it('should handle arrays', () => {
      const obj = {
        users: [
          { email: 'user1@example.com', name: 'User 1' },
          { email: 'user2@example.com', name: 'User 2' },
        ],
      };

      const safe = createSafeLogObject(obj, defaultConfig) as Record<
        string,
        unknown
      >;

      expect(safe.users as unknown[]).toHaveLength(2);
      expect((safe.users as Record<string, unknown>[])[0].email).toBe(
        '***@***.***'
      );
      expect((safe.users as Record<string, unknown>[])[0].name).toBe('User 1');
      expect((safe.users as Record<string, unknown>[])[1].email).toBe(
        '***@***.***'
      );
      expect((safe.users as Record<string, unknown>[])[1].name).toBe('User 2');
    });

    it('should handle null and undefined values', () => {
      const obj = {
        nullValue: null,
        undefinedValue: undefined,
        normalValue: 'test',
      };

      const safe = createSafeLogObject(obj, defaultConfig) as Record<
        string,
        unknown
      >;

      expect(safe.nullValue).toBeNull();
      expect(safe.undefinedValue).toBeUndefined();
      expect(safe.normalValue).toBe('test');
    });

    it('should remove PII fields when removeFields is true', () => {
      const config: RedactionConfig = {
        ...defaultConfig,
        removeFields: true,
      };

      const obj = {
        email: 'user@example.com',
        normalField: 'not sensitive',
        ssn: '123-45-6789',
      };

      const safe = createSafeLogObject(obj, config) as Record<string, unknown>;

      expect(safe.email).toBeUndefined();
      expect(safe.ssn).toBeUndefined();
      expect(safe.normalField).toBe('not sensitive');
    });

    it('should handle empty objects', () => {
      const safe = createSafeLogObject({}, defaultConfig) as Record<
        string,
        unknown
      >;
      expect(safe).toEqual({});
    });

    it('should handle non-object values', () => {
      expect(createSafeLogObject('string', defaultConfig)).toBe('string');
      expect(createSafeLogObject(123, defaultConfig)).toBe(123);
      expect(createSafeLogObject(null, defaultConfig)).toBeNull();
      expect(createSafeLogObject(undefined, defaultConfig)).toBeUndefined();
    });
  });

  describe('isPIIField', () => {
    it('should identify PII fields correctly', () => {
      expect(isPIIField('email')).toBe(true);
      expect(isPIIField('ssn')).toBe(true);
      expect(isPIIField('phone')).toBe(true);
      expect(isPIIField('licenseNumber')).toBe(true);
      expect(isPIIField('password')).toBe(true);
      expect(isPIIField('dateOfBirth')).toBe(true);
      expect(isPIIField('holderDOB')).toBe(true);
      expect(isPIIField('firstName')).toBe(true);
      expect(isPIIField('lastName')).toBe(true);
      expect(isPIIField('holderName')).toBe(true);
      expect(isPIIField('credentialId')).toBe(true);
      expect(isPIIField('proofHash')).toBe(true);
    });

    it('should not identify non-PII fields', () => {
      expect(isPIIField('userId')).toBe(false);
      expect(isPIIField('organizationId')).toBe(false);
      expect(isPIIField('requestId')).toBe(false);
      expect(isPIIField('normalField')).toBe(false);
    });

    it('should handle case-insensitive matching', () => {
      expect(isPIIField('EMAIL')).toBe(true);
      expect(isPIIField('Email')).toBe(true);
      expect(isPIIField('eMaIl')).toBe(true);
    });

    it('should work with custom patterns', () => {
      const customPatterns: PIIField[] = [
        { pattern: /customField/i, method: 'replace' },
      ];

      expect(isPIIField('customField', customPatterns)).toBe(true);
      expect(isPIIField('customfield', customPatterns)).toBe(true);
      expect(isPIIField('CUSTOMFIELD', customPatterns)).toBe(true);
      expect(isPIIField('normalField', customPatterns)).toBe(false);
    });
  });

  describe('redactObject', () => {
    const defaultConfig: RedactionConfig = {
      defaultMethod: 'replace',
      defaultReplacement: '[REDACTED]',
      customFields: DEFAULT_PII_PATTERNS,
      removeFields: false,
    };

    it('should redact strings in objects', () => {
      const obj = {
        email: 'user@example.com',
        normalField: 'not sensitive',
      };

      const redacted = redactObject(obj, defaultConfig) as Record<
        string,
        unknown
      >;

      expect(redacted.email).toBe('***@***.***');
      expect(redacted.normalField).toBe('not sensitive');
    });

    it('should handle nested objects', () => {
      const obj = {
        user: {
          email: 'user@example.com',
          data: {
            phone: '555-123-4567',
          },
        },
      };

      const redacted = redactObject(obj, defaultConfig) as Record<
        string,
        unknown
      >;

      expect((redacted.user as Record<string, unknown>).email).toBe(
        '***@***.***'
      );
      expect(
        (
          (redacted.user as Record<string, unknown>).data as Record<
            string,
            unknown
          >
        ).phone
      ).toBe('(***) ***-****');
    });

    it('should handle arrays', () => {
      const obj = {
        emails: ['user1@example.com', 'user2@example.com'],
        phones: ['555-123-4567', '555-987-6543'],
      };

      const redacted = redactObject(obj, defaultConfig) as Record<
        string,
        unknown
      >;

      expect((redacted.emails as unknown[])[0]).toBe('user1@example.com');
      expect((redacted.emails as unknown[])[1]).toBe('user2@example.com');
      expect((redacted.phones as unknown[])[0]).toBe('555-123-4567');
      expect((redacted.phones as unknown[])[1]).toBe('555-987-6543');
    });

    it('should handle null and undefined values', () => {
      const obj = {
        nullValue: null,
        undefinedValue: undefined,
        normalValue: 'test',
      };

      const redacted = redactObject(obj, defaultConfig) as Record<
        string,
        unknown
      >;

      expect(redacted.nullValue).toBeNull();
      expect(redacted.undefinedValue).toBeUndefined();
      expect(redacted.normalValue).toBe('test');
    });

    it('should handle non-object values', () => {
      expect(redactObject('string', defaultConfig)).toBe('string');
      expect(redactObject(123, defaultConfig)).toBe(123);
      expect(redactObject(null, defaultConfig)).toBeNull();
      expect(redactObject(undefined, defaultConfig)).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    const defaultConfig: RedactionConfig = {
      defaultMethod: 'replace',
      defaultReplacement: '[REDACTED]',
      customFields: DEFAULT_PII_PATTERNS,
      removeFields: false,
    };

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const result = redactString(longString, 'email', defaultConfig);
      expect(result).toBe('***@***.***');
    });

    it('should handle special characters in strings', () => {
      const specialString = 'user+test@example-domain.co.uk';
      const result = redactString(specialString, 'email', defaultConfig);
      expect(result).toBe('***@***.***');
    });

    it('should handle empty arrays', () => {
      const obj = { emptyArray: [] };
      const safe = createSafeLogObject(obj, defaultConfig) as Record<
        string,
        unknown
      >;
      expect(safe.emptyArray).toEqual([]);
    });

    it('should handle deeply nested objects', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              level4: {
                email: 'user@example.com',
              },
            },
          },
        },
      };

      const safe = createSafeLogObject(obj, defaultConfig) as Record<
        string,
        unknown
      >;
      const level1 = safe.level1 as Record<string, unknown>;
      const level2 = level1.level2 as Record<string, unknown>;
      const level3 = level2.level3 as Record<string, unknown>;
      const level4 = level3.level4 as Record<string, unknown>;
      expect(level4.email).toBe('***@***.***');
    });

    it('should handle circular references gracefully', () => {
      const obj: Record<string, unknown> = { email: 'user@example.com' };
      obj.self = obj;

      // Should not throw an error
      expect(() => createSafeLogObject(obj, defaultConfig)).not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    const defaultConfig: RedactionConfig = {
      defaultMethod: 'replace',
      defaultReplacement: '[REDACTED]',
      customFields: DEFAULT_PII_PATTERNS,
      removeFields: false,
    };

    it('should handle large objects efficiently', () => {
      const largeObj: Record<string, unknown> = {};
      for (let i = 0; i < 1000; i++) {
        largeObj[`field${i}`] = i % 10 === 0 ? 'user@example.com' : `value${i}`;
      }

      const startTime = Date.now();
      const safe = createSafeLogObject(largeObj, defaultConfig);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete in less than 100ms
      expect(Object.keys(safe as Record<string, unknown>)).toHaveLength(1000);
    });

    it('should handle many PII fields efficiently', () => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < 100; i++) {
        obj[`email${i}`] = `user${i}@example.com`;
        obj[`ssn${i}`] = '123-45-6789';
        obj[`phone${i}`] = '555-123-4567';
      }

      const startTime = Date.now();
      const safe = createSafeLogObject(obj, defaultConfig);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50); // Should complete in less than 50ms
      expect((safe as Record<string, unknown>).email0).toBe(
        'user0@example.com'
      );
      expect((safe as Record<string, unknown>).ssn0).toBe('123-45-6789');
      expect((safe as Record<string, unknown>).phone0).toBe('555-123-4567');
    });
  });
});
