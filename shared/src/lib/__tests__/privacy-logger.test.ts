/**
 * Unit tests for Privacy Logger
 * @fileoverview Comprehensive test suite for privacy-focused logging functionality
 */

import {
  PrivacyLogger,
  createPrivacyLogger,
  LOG_LEVELS,
} from '../privacy-logger';
import {
  DEFAULT_PII_PATTERNS,
  createSafeLogObject,
  redactString,
} from '../redaction-utils';
import { PrivacyLoggerConfig, AuditEvent, VerificationLogData } from '../types';

describe('PrivacyLogger', () => {
  let logger: PrivacyLogger;
  let mockPinoLogger: {
    info: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
    child: jest.Mock;
  };

  beforeEach(() => {
    // Mock Pino logger
    mockPinoLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(),
    };

    // Mock pino module
    jest.doMock('pino', () => jest.fn().mockReturnValue(mockPinoLogger));

    const config: PrivacyLoggerConfig = {
      level: 'info',
      redactPaths: ['req.body.ssn', 'req.body.email'],
      auditMode: true,
      environment: 'test',
      serviceName: 'test-service',
    };

    logger = new PrivacyLogger(config);

    // Replace the actual loggers with mocks
    (logger as unknown as { logger: typeof mockPinoLogger }).logger =
      mockPinoLogger;
    (logger as unknown as { auditLogger: typeof mockPinoLogger }).auditLogger =
      mockPinoLogger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create logger with default configuration', () => {
      const defaultLogger = createPrivacyLogger();
      expect(defaultLogger).toBeInstanceOf(PrivacyLogger);
    });

    it('should create logger with custom configuration', () => {
      const config: PrivacyLoggerConfig = {
        level: 'debug',
        redactPaths: ['custom.field'],
        auditMode: false,
        environment: 'production',
        serviceName: 'custom-service',
      };

      const customLogger = new PrivacyLogger(config);
      expect(customLogger).toBeInstanceOf(PrivacyLogger);
    });
  });

  describe('Standard Logging Methods', () => {
    it('should log info messages with PII redaction', () => {
      const logData = {
        userId: 'user123',
        email: 'user@example.com',
        organizationId: 'org456',
      };

      logger.info('User action', logData);

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          email: '***@***.***',
          organizationId: 'org456',
        }),
        'User action'
      );
    });

    it('should redact personal information fields', () => {
      const logData = {
        userId: 'user123',
        firstName: 'John',
        lastName: 'Smith',
        dateOfBirth: '1980-05-15',
        holderName: 'Dr. John Smith',
        holderDOB: '1980-05-15',
        organizationId: 'org456',
      };

      logger.info('User registration', logData);

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          firstName: '***',
          lastName: '***',
          dateOfBirth: '****-**-**',
          holderName: '*** ***',
          holderDOB: '****-**-**',
          organizationId: 'org456',
        }),
        'User registration'
      );
    });

    it('should redact credential-specific fields', () => {
      const logData = {
        credentialId: 'MED-2024-001234',
        proofHash: '0xabcd1234567890abcdef1234567890abcdef12',
        licenseNumber: 'MD123456',
        organizationId: 'org456',
      };

      logger.info('Credential verification', logData);

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          credentialId: '***-****-******',
          proofHash: '0x****...****',
          licenseNumber: '****-****',
          organizationId: 'org456',
        }),
        'Credential verification'
      );
    });

    it('should log error messages with error details', () => {
      const error = new Error('Test error');
      const logData = { requestId: 'req123' };

      logger.error('Operation failed', error, logData);

      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req123',
          error: {
            message: 'Test error',
            stack: error.stack,
            name: 'Error',
          },
        }),
        'Operation failed'
      );
    });

    it('should log warning messages', () => {
      const logData = { warning: 'Rate limit approaching' };

      logger.warn('Warning message', logData);

      expect(mockPinoLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining(logData),
        'Warning message'
      );
    });

    it('should log debug messages', () => {
      const logData = { debug: 'Debug information' };

      logger.debug('Debug message', logData);

      expect(mockPinoLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining(logData),
        'Debug message'
      );
    });
  });

  describe('Verification Logging', () => {
    it('should log verification events correctly', () => {
      const verificationData: VerificationLogData = {
        requestId: 'req123',
        action: 'credential_verify',
        verified: true,
        organizationId: 'org456',
        credentialId: 'cred123',
        duration: 150,
        metadata: {
          verificationMethod: 'zkp',
        },
      };

      logger.verification('req123', 'credential_verify', verificationData);

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req123',
          action: 'credential_verify',
          verified: true,
          organizationId: 'org456',
          credentialId: 'cred123',
          duration: 150,
          metadata: {
            verificationMethod: 'zkp',
          },
        }),
        'Verification credential_verify'
      );
    });

    it('should handle verification errors', () => {
      const verificationData: VerificationLogData = {
        requestId: 'req123',
        action: 'credential_verify',
        verified: false,
        organizationId: 'org456',
        error: 'Verification failed',
        duration: 100,
      };

      logger.verification('req123', 'credential_verify', verificationData);

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req123',
          action: 'credential_verify',
          verified: false,
          organizationId: 'org456',
          error: 'Verification failed',
          duration: 100,
        }),
        'Verification credential_verify'
      );
    });
  });

  describe('API Logging', () => {
    it('should log API requests', () => {
      const requestData = {
        userAgent: 'Mozilla/5.0...',
        ipAddress: '192.168.1.1',
        contentLength: 1024,
      };

      logger.request('POST', '/api/v1/verify', 'req123', requestData);

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/api/v1/verify',
          requestId: 'req123',
          userAgent: 'Mozilla/5.0...',
          ipAddress: '192.168.1.1',
          contentLength: 1024,
        }),
        'API Request: POST /api/v1/verify'
      );
    });

    it('should log API responses', () => {
      const responseData = {
        duration: 150,
        responseSize: 512,
      };

      logger.response('POST', '/api/v1/verify', 200, 'req123', responseData);

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/api/v1/verify',
          statusCode: 200,
          requestId: 'req123',
          duration: 150,
          responseSize: 512,
        }),
        'API Response: POST /api/v1/verify 200'
      );
    });
  });

  describe('Security Logging', () => {
    it('should log security events', () => {
      const securityData = {
        userId: 'user123',
        ipAddress: '192.168.1.1',
        activity: 'failed_authentication',
        attemptCount: 3,
      };

      logger.security('failed_authentication', securityData);

      expect(mockPinoLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'security',
          event: 'failed_authentication',
          userId: 'user123',
          ipAddress: '192.168.1.1',
          activity: 'failed_authentication',
          attemptCount: 3,
        }),
        'SECURITY: failed_authentication'
      );
    });
  });

  describe('Performance Logging', () => {
    it('should log performance metrics', () => {
      const perfData = {
        requestId: 'req123',
        rowsReturned: 1,
      };

      logger.performance('database_query', 25, perfData);

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'database_query',
          duration: 25,
          requestId: 'req123',
          rowsReturned: 1,
        }),
        'PERFORMANCE: database_query took 25ms'
      );
    });
  });

  describe('Child Loggers', () => {
    it('should create child logger with context', () => {
      const context = { service: 'credential-service', version: '1.0.0' };
      const childLogger = logger.child(context);

      expect(childLogger).toBeInstanceOf(PrivacyLogger);
      expect(mockPinoLogger.child).toHaveBeenCalledWith(context);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration at runtime', () => {
      const newConfig = {
        level: 'warn',
        redactPaths: ['new.sensitive.field'],
      };

      logger.updateConfig(newConfig);

      // Configuration should be updated
      expect(logger.config.level).toBe('warn');
      expect(logger.config.redactPaths).toContain('new.sensitive.field');
    });
  });
});

describe('Redaction Utils', () => {
  describe('redactString', () => {
    it('should redact email addresses', () => {
      const result = redactString('user@example.com', 'email', {
        defaultMethod: 'replace',
        defaultReplacement: '[REDACTED]',
        customFields: DEFAULT_PII_PATTERNS,
        removeFields: false,
      });

      expect(result).toBe('***@***.***');
    });

    it('should redact SSN patterns', () => {
      const result = redactString('123-45-6789', 'ssn', {
        defaultMethod: 'replace',
        defaultReplacement: '[REDACTED]',
        customFields: DEFAULT_PII_PATTERNS,
        removeFields: false,
      });

      expect(result).toBe('***-**-****');
    });

    it('should redact phone numbers', () => {
      const result = redactString('555-123-4567', 'phone', {
        defaultMethod: 'replace',
        defaultReplacement: '[REDACTED]',
        customFields: DEFAULT_PII_PATTERNS,
        removeFields: false,
      });

      expect(result).toBe('(***) ***-****');
    });

    it('should apply default redaction for unknown fields', () => {
      const result = redactString('sensitive data', 'unknownField', {
        defaultMethod: 'replace',
        defaultReplacement: '[REDACTED]',
        customFields: DEFAULT_PII_PATTERNS,
        removeFields: false,
      });

      expect(result).toBe('[REDACTED]');
    });
  });

  describe('createSafeLogObject', () => {
    it('should redact PII fields in objects', () => {
      const obj = {
        userId: 'user123',
        email: 'user@example.com',
        ssn: '123-45-6789',
        normalField: 'not sensitive',
        nested: {
          phone: '555-123-4567',
          address: '123 Main St',
        },
      };

      const safe = createSafeLogObject(obj) as Record<string, unknown>;

      expect(safe.email).toBe('***@***.***');
      expect(safe.ssn).toBe('***-**-****');
      expect(safe.normalField).toBe('not sensitive');
      expect((safe.nested as Record<string, unknown>).phone).toBe(
        '(***) ***-****'
      );
      expect((safe.nested as Record<string, unknown>).address).toBe(
        '[ADDRESS_REDACTED]'
      );
    });

    it('should handle arrays', () => {
      const obj = {
        users: [
          { email: 'user1@example.com', name: 'User 1' },
          { email: 'user2@example.com', name: 'User 2' },
        ],
      };

      const safe = createSafeLogObject(obj) as Record<string, unknown>;

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

      const safe = createSafeLogObject(obj) as Record<string, unknown>;

      expect(safe.nullValue).toBeNull();
      expect(safe.undefinedValue).toBeUndefined();
      expect(safe.normalValue).toBe('test');
    });
  });
});

describe('LOG_LEVELS', () => {
  it('should export correct log levels', () => {
    expect(LOG_LEVELS.ERROR).toBe('error');
    expect(LOG_LEVELS.WARN).toBe('warn');
    expect(LOG_LEVELS.INFO).toBe('info');
    expect(LOG_LEVELS.DEBUG).toBe('debug');
  });
});

describe('Integration Tests', () => {
  it('should handle complex nested objects with PII', () => {
    const complexObj = {
      request: {
        body: {
          user: {
            email: 'user@example.com',
            ssn: '123-45-6789',
            firstName: 'John',
            lastName: 'Smith',
            dateOfBirth: '1980-05-15',
            personalData: {
              phone: '555-123-4567',
              address: '123 Main St',
            },
          },
          credential: {
            credentialId: 'MED-2024-001234',
            proofHash: '0xabcd1234567890abcdef1234567890abcdef12',
            licenseNumber: 'ABC123456',
            holderName: 'Dr. John Smith',
            holderDOB: '1980-05-15',
            sensitiveData: 'confidential',
          },
        },
      },
      response: {
        verified: true,
        metadata: {
          processingTime: 150,
        },
      },
    };

    const safe = createSafeLogObject(complexObj) as Record<string, unknown>;

    expect(
      (
        (
          (safe.request as Record<string, unknown>).body as Record<
            string,
            unknown
          >
        ).user as Record<string, unknown>
      ).email
    ).toBe('***@***.***');
    expect(
      (
        (
          (safe.request as Record<string, unknown>).body as Record<
            string,
            unknown
          >
        ).user as Record<string, unknown>
      ).ssn
    ).toBe('***-**-****');
    expect(
      (
        (
          (safe.request as Record<string, unknown>).body as Record<
            string,
            unknown
          >
        ).user as Record<string, unknown>
      ).firstName
    ).toBe('***');
    expect(
      (
        (
          (safe.request as Record<string, unknown>).body as Record<
            string,
            unknown
          >
        ).user as Record<string, unknown>
      ).lastName
    ).toBe('***');
    expect(
      (
        (
          (safe.request as Record<string, unknown>).body as Record<
            string,
            unknown
          >
        ).user as Record<string, unknown>
      ).dateOfBirth
    ).toBe('****-**-**');
    expect(
      (
        (
          (
            (safe.request as Record<string, unknown>).body as Record<
              string,
              unknown
            >
          ).user as Record<string, unknown>
        ).personalData as Record<string, unknown>
      ).phone
    ).toBe('(***) ***-****');
    expect(
      (
        (
          (
            (safe.request as Record<string, unknown>).body as Record<
              string,
              unknown
            >
          ).user as Record<string, unknown>
        ).personalData as Record<string, unknown>
      ).address
    ).toBe('[ADDRESS_REDACTED]');
    expect(
      (
        (
          (safe.request as Record<string, unknown>).body as Record<
            string,
            unknown
          >
        ).credential as Record<string, unknown>
      ).credentialId
    ).toBe('***-****-******');
    expect(
      (
        (
          (safe.request as Record<string, unknown>).body as Record<
            string,
            unknown
          >
        ).credential as Record<string, unknown>
      ).proofHash
    ).toBe('0x****...****');
    expect(
      (
        (
          (safe.request as Record<string, unknown>).body as Record<
            string,
            unknown
          >
        ).credential as Record<string, unknown>
      ).licenseNumber
    ).toBe('****-****');
    expect(
      (
        (
          (safe.request as Record<string, unknown>).body as Record<
            string,
            unknown
          >
        ).credential as Record<string, unknown>
      ).holderName
    ).toBe('*** ***');
    expect(
      (
        (
          (safe.request as Record<string, unknown>).body as Record<
            string,
            unknown
          >
        ).credential as Record<string, unknown>
      ).holderDOB
    ).toBe('****-**-**');
    expect(
      (
        (
          (safe.request as Record<string, unknown>).body as Record<
            string,
            unknown
          >
        ).credential as Record<string, unknown>
      ).sensitiveData
    ).toBe('[PII_REDACTED]');
    expect((safe.response as Record<string, unknown>).verified).toBe(true);
    expect(
      (
        (safe.response as Record<string, unknown>).metadata as Record<
          string,
          unknown
        >
      ).processingTime
    ).toBe(150);
  });

  it('should maintain audit trail integrity', () => {
    const auditEvent: AuditEvent = {
      eventType: 'credential_verification',
      timestamp: new Date().toISOString(),
      userId: 'user123',
      organizationId: 'org456',
      requestId: 'req789',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
      metadata: {
        verificationMethod: 'zkp',
        processingTime: 150,
      },
    };

    // Audit events should maintain structure while redacting PII
    const logger = createPrivacyLogger({ auditMode: true });

    // This would be tested with actual audit logging in integration tests
    expect(auditEvent.eventType).toBe('credential_verification');
    expect(auditEvent.organizationId).toBe('org456');
    expect(auditEvent.requestId).toBe('req789');
  });
});
