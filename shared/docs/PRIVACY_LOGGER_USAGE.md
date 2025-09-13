# Privacy Logger Usage Guide

## Overview

The Privacy-First Logger is a custom logging solution designed specifically for the Professional Licensing Verification Platform. It provides built-in PII redaction, audit capabilities, and HIPAA compliance features.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Basic Usage](#basic-usage)
3. [Advanced Configuration](#advanced-configuration)
4. [PII Redaction](#pii-redaction)
5. [Audit Logging](#audit-logging)
6. [Integration Examples](#integration-examples)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Quick Start

### Installation

The Privacy Logger is included in the shared library. Import it in your application:

```typescript
import { createPrivacyLogger, PrivacyLogger } from '@licensing-verification-platform/shared';
```

### Basic Setup

```typescript
// Create a logger instance
const logger = createPrivacyLogger({
  level: 'info',
  auditMode: true,
  environment: 'production',
});

// Use the logger
logger.info('Application started', { version: '1.0.0' });
```

## Basic Usage

### Standard Logging Methods

```typescript
import { createPrivacyLogger } from '@licensing-verification-platform/shared';

const logger = createPrivacyLogger();

// Info logging
logger.info('User login successful', {
  userId: 'user123',
  email: 'user@example.com', // Will be redacted
  organizationId: 'org456',
});

// Error logging
logger.error('Database connection failed', new Error('Connection timeout'), {
  database: 'credentials',
  retryCount: 3,
});

// Warning logging
logger.warn('Rate limit approaching', {
  userId: 'user123',
  currentRequests: 95,
  limit: 100,
});

// Debug logging
logger.debug('Processing verification request', {
  requestId: 'req789',
  credentialId: 'cred123',
});
```

### Verification-Specific Logging

```typescript
// Log verification events
logger.verification('req789', 'credential_verify', {
  requestId: 'req789',
  action: 'credential_verify',
  verified: true,
  organizationId: 'org456',
  credentialId: 'cred123',
  duration: 150,
  metadata: {
    verificationMethod: 'zkp',
    circuitVersion: '1.0.0',
  },
});
```

### API Request/Response Logging

```typescript
// Log API requests
logger.request('POST', '/api/v1/verify/credential', 'req789', {
  userAgent: 'Mozilla/5.0...',
  ipAddress: '192.168.1.1',
  contentLength: 1024,
});

// Log API responses
logger.response('POST', '/api/v1/verify/credential', 200, 'req789', {
  duration: 150,
  responseSize: 512,
});
```

## Advanced Configuration

### Custom Configuration

```typescript
import { PrivacyLogger, PrivacyLoggerConfig } from '@licensing-verification-platform/shared';

const config: PrivacyLoggerConfig = {
  level: 'debug',
  redactPaths: ['req.body.ssn', 'req.body.licenseNumber', 'req.body.email', 'req.body.phone', 'user.personalData', 'credential.sensitiveData', 'proof.privateInputs'],
  auditMode: true,
  environment: 'production',
  serviceName: 'verification-service',
  customRedactor: (obj) => {
    // Custom redaction logic
    if (obj.customField) {
      obj.customField = '[CUSTOM_REDACTED]';
    }
    return obj;
  },
};

const logger = new PrivacyLogger(config);
```

### Child Loggers

```typescript
// Create a child logger with additional context
const childLogger = logger.child({
  service: 'credential-service',
  version: '1.2.0',
});

// All logs from child logger will include the context
childLogger.info('Processing credential', {
  credentialId: 'cred123',
  userId: 'user456', // Will be redacted
});
```

### Runtime Configuration Updates

```typescript
// Update logger configuration at runtime
logger.updateConfig({
  level: 'warn', // Change log level
  redactPaths: [...logger.config.redactPaths, 'new.sensitive.field'],
});
```

## PII Redaction

### Automatic Redaction

The logger automatically redacts common PII patterns:

```typescript
// These fields will be automatically redacted
logger.info('User data', {
  ssn: '123-45-6789', // → '[REDACTED]'
  email: 'user@example.com', // → '[REDACTED]'
  phone: '555-123-4567', // → '[REDACTED]'
  licenseNumber: 'ABC123456', // → '[REDACTED]'
  address: '123 Main St', // → '[REDACTED]'
  password: 'secret123', // → '[REMOVED]'
});
```

### Custom Redaction Patterns

```typescript
import { DEFAULT_PII_PATTERNS, PIIField } from '@licensing-verification-platform/shared';

// Add custom PII patterns
const customPatterns: PIIField[] = [
  {
    pattern: /medicalRecordId/i,
    method: 'replace',
    replacement: '[MEDICAL_ID_REDACTED]',
  },
  {
    pattern: /barNumber/i,
    method: 'mask',
    replacement: '****-****',
  },
];

const allPatterns = [...DEFAULT_PII_PATTERNS, ...customPatterns];
```

### Manual Redaction

```typescript
import { createSafeLogObject } from '@licensing-verification-platform/shared';

// Manually create safe log objects
const sensitiveData = {
  userId: 'user123',
  ssn: '123-45-6789',
  email: 'user@example.com',
  metadata: {
    personalInfo: 'sensitive data',
  },
};

const safeData = createSafeLogObject(sensitiveData);
logger.info('User processed', safeData);
```

## Audit Logging

### HIPAA Compliance Logging

```typescript
// Audit logging for compliance
logger.audit('credential_verification', {
  eventType: 'credential_verification',
  timestamp: new Date().toISOString(),
  userId: 'user123',
  organizationId: 'org456',
  credentialId: 'cred123',
  verified: true,
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  requestId: 'req789',
  metadata: {
    verificationMethod: 'zkp',
    circuitVersion: '1.0.0',
    processingTime: 150,
  },
});
```

### Security Event Logging

```typescript
// Log security events
logger.security('failed_authentication', {
  userId: 'user123',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  attemptCount: 3,
  reason: 'invalid_credentials',
});

logger.security('suspicious_activity', {
  userId: 'user123',
  ipAddress: '192.168.1.1',
  activity: 'multiple_failed_verifications',
  threshold: 5,
  currentCount: 7,
});
```

### Performance Logging

```typescript
// Log performance metrics
logger.performance('credential_verification', 150, {
  requestId: 'req789',
  organizationId: 'org456',
  verificationMethod: 'zkp',
  circuitVersion: '1.0.0',
});

logger.performance('database_query', 25, {
  query: 'SELECT * FROM credentials',
  table: 'credentials',
  rowsReturned: 1,
});
```

## Integration Examples

### Express.js Middleware

```typescript
import express from 'express';
import { createPrivacyLogger } from '@licensing-verification-platform/shared';

const logger = createPrivacyLogger();
const app = express();

// Request logging middleware
app.use((req, res, next) => {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`;
  req.requestId = requestId;

  logger.request(req.method, req.url, requestId, {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
    contentLength: req.headers['content-length'],
  });

  next();
});

// Response logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.response(req.method, req.url, res.statusCode, req.requestId, {
      duration,
      responseSize: res.get('content-length'),
    });
  });

  next();
});
```

### Service Layer Integration

```typescript
import { createPrivacyLogger } from '@licensing-verification-platform/shared';

export class CredentialVerificationService {
  private logger = createPrivacyLogger({
    serviceName: 'credential-verification-service',
  });

  async verifyCredential(request: VerificationRequest): Promise<VerificationResult> {
    const startTime = Date.now();

    this.logger.info('Starting credential verification', {
      requestId: request.requestId,
      organizationId: request.organizationId,
      credentialId: request.credentialId,
    });

    try {
      const result = await this.performVerification(request);
      const duration = Date.now() - startTime;

      this.logger.verification(request.requestId, 'credential_verify', {
        requestId: request.requestId,
        action: 'credential_verify',
        verified: result.verified,
        organizationId: request.organizationId,
        credentialId: request.credentialId,
        duration,
        metadata: {
          verificationMethod: 'zkp',
          circuitVersion: result.circuitVersion,
        },
      });

      // Audit log for compliance
      this.logger.audit('credential_verification', {
        eventType: 'credential_verification',
        timestamp: new Date().toISOString(),
        userId: request.userId,
        organizationId: request.organizationId,
        credentialId: request.credentialId,
        verified: result.verified,
        requestId: request.requestId,
        metadata: {
          verificationMethod: 'zkp',
          processingTime: duration,
        },
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Credential verification failed', error, {
        requestId: request.requestId,
        organizationId: request.organizationId,
        credentialId: request.credentialId,
        duration,
      });

      throw error;
    }
  }
}
```

### Error Handling Integration

```typescript
import { createPrivacyLogger } from '@licensing-verification-platform/shared';

export class ErrorHandler {
  private logger = createPrivacyLogger();

  handleError(error: Error, context?: any): void {
    this.logger.error('Application error occurred', error, {
      ...context,
      stack: error.stack,
      name: error.name,
    });

    // Log security-related errors
    if (error.name === 'AuthenticationError') {
      this.logger.security('authentication_error', {
        error: error.message,
        ...context,
      });
    }
  }
}
```

## Best Practices

### 1. Log Levels

```typescript
// Use appropriate log levels
logger.error('Critical system failure', error); // System errors
logger.warn('Rate limit approaching', data); // Warnings
logger.info('User action completed', data); // Important events
logger.debug('Processing step completed', data); // Debug information
```

### 2. Structured Logging

```typescript
// Good: Structured data
logger.info('User login', {
  userId: 'user123',
  organizationId: 'org456',
  loginMethod: 'oauth',
  timestamp: new Date().toISOString(),
});

// Avoid: Unstructured strings
logger.info(`User ${userId} logged in via ${method}`);
```

### 3. Request Tracing

```typescript
// Always include requestId for tracing
logger.info('Processing request', {
  requestId: 'req789',
  action: 'verify_credential',
  organizationId: 'org456',
});
```

### 4. Performance Monitoring

```typescript
// Log performance metrics
const startTime = Date.now();
// ... perform operation ...
const duration = Date.now() - startTime;

logger.performance('operation_name', duration, {
  requestId: 'req789',
  additionalContext: 'value',
});
```

### 5. Security Logging

```typescript
// Log all security-relevant events
logger.security('suspicious_activity', {
  userId: 'user123',
  activity: 'multiple_failed_attempts',
  ipAddress: '192.168.1.1',
  threshold: 5,
  currentCount: 7,
});
```

## Troubleshooting

### Common Issues

1. **PII Not Being Redacted**

   ```typescript
   // Check if field names match patterns
   logger.info('Test', { email: 'test@example.com' }); // Should be redacted

   // Check custom redaction configuration
   const logger = createPrivacyLogger({
     redactPaths: ['custom.emailField'], // Add custom paths
   });
   ```

2. **Audit Logs Not Appearing**

   ```typescript
   // Ensure audit mode is enabled
   const logger = createPrivacyLogger({
     auditMode: true,
   });

   // Use audit method specifically
   logger.audit('event_name', auditData);
   ```

3. **Performance Issues**

   ```typescript
   // Use appropriate log levels in production
   const logger = createPrivacyLogger({
     level: 'info', // Avoid 'debug' in production
   });

   // Use child loggers for context
   const childLogger = logger.child({ service: 'specific-service' });
   ```

### Debug Mode

```typescript
// Enable debug logging
const logger = createPrivacyLogger({
  level: 'debug',
  environment: 'development',
});

// Check logger configuration
console.log('Logger config:', logger.config);
```

### Testing

```typescript
// Test PII redaction
import { createSafeLogObject } from '@licensing-verification-platform/shared';

const testData = {
  email: 'test@example.com',
  ssn: '123-45-6789',
  normalField: 'not sensitive',
};

const safeData = createSafeLogObject(testData);
console.log('Redacted data:', safeData);
// Should show: { email: '[REDACTED]', ssn: '[REDACTED]', normalField: 'not sensitive' }
```

## Conclusion

The Privacy-First Logger provides a comprehensive logging solution that ensures HIPAA compliance while maintaining powerful debugging and monitoring capabilities. By following these guidelines and best practices, you can implement secure, privacy-focused logging throughout your application.

For additional support or questions, refer to the main documentation or contact the development team.
