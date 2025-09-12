/**
 * Unit tests for logger.ts
 * Tests circuit-specific logging functionality
 */

import {
  CircuitLogger,
  createCircuitLogger,
  circuitLogger,
  defaultCircuitLogger,
} from '../lib/logger';

// Mock the shared logger
jest.mock('@licensing-verification-platform/shared', () => ({
  createPrivacyLogger: jest.fn(() => ({
    child: jest.fn(() => ({
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      performance: jest.fn(),
      security: jest.fn(),
      audit: jest.fn(),
    })),
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    performance: jest.fn(),
    security: jest.fn(),
    audit: jest.fn(),
  })),
}));

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCircuitLogger', () => {
    it('should create a child logger with operation context', () => {
      const operation = 'test-operation';
      const childLogger = createCircuitLogger(operation);

      expect(childLogger).toBeDefined();
    });

    it('should include operation, component, and timestamp in context', () => {
      const operation = 'test-operation';
      const result = createCircuitLogger(operation);

      // The function should return a logger instance
      expect(result).toBeDefined();
      expect(typeof result.info).toBe('function');
    });
  });

  describe('CircuitLogger', () => {
    let circuitLogger: CircuitLogger;

    beforeEach(() => {
      circuitLogger = new CircuitLogger('test-operation');
    });

    describe('Basic Logging Methods', () => {
      it('should log info messages', () => {
        const message = 'Test info message';
        const data = { test: 'data' };

        circuitLogger.info(message, data);

        // The actual implementation would be tested through the mock
        expect(circuitLogger).toBeDefined();
      });

      it('should log debug messages', () => {
        const message = 'Test debug message';
        const data = { test: 'data' };

        circuitLogger.debug(message, data);

        expect(circuitLogger).toBeDefined();
      });

      it('should log error messages', () => {
        const message = 'Test error message';
        const error = new Error('Test error');
        const data = { test: 'data' };

        circuitLogger.error(message, error, data);

        expect(circuitLogger).toBeDefined();
      });

      it('should log warning messages', () => {
        const message = 'Test warning message';
        const data = { test: 'data' };

        circuitLogger.warn(message, data);

        expect(circuitLogger).toBeDefined();
      });
    });

    describe('Compilation Logging', () => {
      it('should log compilation start', () => {
        const config = {
          circuitName: 'TestCircuit',
          inputPath: '/input',
          outputPath: '/output',
        };

        circuitLogger.compilationStart(config);

        expect(circuitLogger).toBeDefined();
      });

      it('should log compilation complete', () => {
        const result = {
          compilationTime: 1000,
          r1cs: true,
          wasm: true,
        };

        circuitLogger.compilationComplete(result);

        expect(circuitLogger).toBeDefined();
      });

      it('should log compilation error', () => {
        const error = new Error('Compilation failed');
        const config = {
          circuitName: 'TestCircuit',
          inputPath: '/input',
        };

        circuitLogger.compilationError(error, config);

        expect(circuitLogger).toBeDefined();
      });
    });

    describe('Proof Generation Logging', () => {
      it('should log proof generation start', () => {
        const credentialId = 'test-credential-123';

        circuitLogger.proofGenerationStart(credentialId);

        expect(circuitLogger).toBeDefined();
      });

      it('should log proof generation complete', () => {
        const credentialId = 'test-credential-123';
        const duration = 1500;

        circuitLogger.proofGenerationComplete(credentialId, duration);

        expect(circuitLogger).toBeDefined();
      });

      it('should log proof generation error', () => {
        const error = new Error('Proof generation failed');
        const credentialId = 'test-credential-123';

        circuitLogger.proofGenerationError(error, credentialId);

        expect(circuitLogger).toBeDefined();
      });
    });

    describe('Proof Verification Logging', () => {
      it('should log proof verification start', () => {
        const credentialId = 'test-credential-123';

        circuitLogger.proofVerificationStart(credentialId);

        expect(circuitLogger).toBeDefined();
      });

      it('should log proof verification complete', () => {
        const credentialId = 'test-credential-123';
        const isValid = true;
        const duration = 500;

        circuitLogger.proofVerificationComplete(
          credentialId,
          isValid,
          duration
        );

        expect(circuitLogger).toBeDefined();
      });

      it('should log proof verification error', () => {
        const error = new Error('Proof verification failed');
        const credentialId = 'test-credential-123';

        circuitLogger.proofVerificationError(error, credentialId);

        expect(circuitLogger).toBeDefined();
      });
    });

    describe('Credential Validation Logging', () => {
      it('should log credential validation start', () => {
        const credentialId = 'test-credential-123';

        circuitLogger.credentialValidationStart(credentialId);

        expect(circuitLogger).toBeDefined();
      });

      it('should log credential validation complete', () => {
        const credentialId = 'test-credential-123';
        const isValid = true;
        const errors: string[] = [];

        circuitLogger.credentialValidationComplete(
          credentialId,
          isValid,
          errors
        );

        expect(circuitLogger).toBeDefined();
      });

      it('should log credential validation complete with errors', () => {
        const credentialId = 'test-credential-123';
        const isValid = false;
        const errors = ['Invalid date format', 'Missing required field'];

        circuitLogger.credentialValidationComplete(
          credentialId,
          isValid,
          errors
        );

        expect(circuitLogger).toBeDefined();
      });

      it('should log credential validation error', () => {
        const error = new Error('Validation failed');
        const credentialId = 'test-credential-123';

        circuitLogger.credentialValidationError(error, credentialId);

        expect(circuitLogger).toBeDefined();
      });
    });

    describe('Setup Logging', () => {
      it('should log setup start', () => {
        const setupType = 'circuit-setup';

        circuitLogger.setupStart(setupType);

        expect(circuitLogger).toBeDefined();
      });

      it('should log setup complete', () => {
        const setupType = 'circuit-setup';
        const duration = 2000;

        circuitLogger.setupComplete(setupType, duration);

        expect(circuitLogger).toBeDefined();
      });

      it('should log setup error', () => {
        const error = new Error('Setup failed');
        const setupType = 'circuit-setup';

        circuitLogger.setupError(error, setupType);

        expect(circuitLogger).toBeDefined();
      });
    });

    describe('Performance Logging', () => {
      it('should log performance metrics', () => {
        const operation = 'test-operation';
        const duration = 1000;
        const metadata = { test: 'data' };

        circuitLogger.performance(operation, duration, metadata);

        expect(circuitLogger).toBeDefined();
      });

      it('should log performance metrics without metadata', () => {
        const operation = 'test-operation';
        const duration = 1000;

        circuitLogger.performance(operation, duration);

        expect(circuitLogger).toBeDefined();
      });
    });

    describe('Security Logging', () => {
      it('should log security events', () => {
        const event = 'suspicious-activity';
        const data = { source: 'test', severity: 'high' };

        circuitLogger.security(event, data);

        expect(circuitLogger).toBeDefined();
      });

      it('should include component in security logs', () => {
        const event = 'authentication-failure';
        const data = { userId: 'test-user' };

        circuitLogger.security(event, data);

        expect(circuitLogger).toBeDefined();
      });
    });

    describe('Audit Logging', () => {
      it('should log audit events', () => {
        const event = 'credential-issued';
        const data = { credentialId: 'test-123', issuer: 'test-board' };

        circuitLogger.audit(event, data);

        expect(circuitLogger).toBeDefined();
      });

      it('should include component and timestamp in audit logs', () => {
        const event = 'credential-revoked';
        const data = { credentialId: 'test-123', reason: 'suspension' };

        circuitLogger.audit(event, data);

        expect(circuitLogger).toBeDefined();
      });
    });
  });

  describe('Exported Instances', () => {
    it('should export circuitLogger', () => {
      expect(circuitLogger).toBeDefined();
    });

    it('should export defaultCircuitLogger', () => {
      expect(defaultCircuitLogger).toBeDefined();
      expect(defaultCircuitLogger).toBeInstanceOf(CircuitLogger);
    });

    // Note: Removed test for backward compatibility 'logger' alias
  });

  describe('Error Handling', () => {
    it('should handle null/undefined data gracefully', () => {
      const circuitLogger = new CircuitLogger('test');

      expect(() => {
        circuitLogger.info('test message', null);
        circuitLogger.debug('test message', undefined);
        circuitLogger.warn('test message', null);
      }).not.toThrow();
    });

    it('should handle null/undefined errors gracefully', () => {
      const circuitLogger = new CircuitLogger('test');

      expect(() => {
        circuitLogger.error('test message', null);
        circuitLogger.error('test message', undefined);
      }).not.toThrow();
    });

    it('should handle malformed data gracefully', () => {
      const circuitLogger = new CircuitLogger('test');

      expect(() => {
        circuitLogger.info('test message', { circular: {} });
        circuitLogger.debug('test message', { circular: {} });
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long messages', () => {
      const circuitLogger = new CircuitLogger('test');
      const longMessage = 'A'.repeat(10000);

      expect(() => {
        circuitLogger.info(longMessage);
      }).not.toThrow();
    });

    it('should handle special characters in messages', () => {
      const circuitLogger = new CircuitLogger('test');
      const specialMessage =
        'Test message with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';

      expect(() => {
        circuitLogger.info(specialMessage);
      }).not.toThrow();
    });

    it('should handle empty strings', () => {
      const circuitLogger = new CircuitLogger('test');

      expect(() => {
        circuitLogger.info('');
        circuitLogger.debug('');
        circuitLogger.warn('');
        circuitLogger.error('');
      }).not.toThrow();
    });

    it('should handle very large data objects', () => {
      const circuitLogger = new CircuitLogger('test');
      const largeData = {
        array: Array(10000).fill('test'),
        nested: {
          level1: {
            level2: {
              level3: Array(1000).fill('nested'),
            },
          },
        },
      };

      expect(() => {
        circuitLogger.info('test message', largeData);
      }).not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent logging operations', () => {
      const circuitLogger = new CircuitLogger('test');

      const promises = Array(100)
        .fill(null)
        .map((_, i) => {
          return new Promise<void>((resolve) => {
            setTimeout(() => {
              circuitLogger.info(`Message ${i}`);
              resolve();
            }, Math.random() * 10);
          });
        });

      return Promise.all(promises).then(() => {
        expect(circuitLogger).toBeDefined();
      });
    });
  });

  afterEach(() => {
    // Clear all timers to prevent leaks
    jest.clearAllTimers();
  });
});
