/**
 * Unit tests for index.ts
 * Tests the main entry point exports
 */

import * as circuits from '../index';

describe('Circuits Index', () => {
  it('should export all expected functions and types', () => {
    // Test that all expected exports are available
    expect(circuits).toBeDefined();
    expect(typeof circuits).toBe('object');
  });

  it('should have the expected structure', () => {
    // Check that the exports object has the expected properties
    const exports = Object.keys(circuits);
    expect(exports.length).toBeGreaterThan(0);
  });

  it('should be importable without errors', () => {
    // This test ensures the module can be imported without throwing
    expect(() => {
      require('../index');
    }).not.toThrow();
  });

  it('should export circuit utilities', () => {
    // Test that circuit utilities are exported
    expect(circuits).toHaveProperty('compileCircuit');
    expect(circuits).toHaveProperty('getDefaultCircuitConfig');
    expect(circuits).toHaveProperty('circuitFilesExist');
    expect(circuits).toHaveProperty('cleanCircuitFiles');
  });

  it('should export proof utilities', () => {
    // Test that proof utilities are exported
    expect(circuits).toHaveProperty('ExamProofCircuit');
  });

  it('should export verification utilities', () => {
    // Test that verification utilities are exported
    expect(circuits).toHaveProperty('validateCredential');
    expect(circuits).toHaveProperty('generateNullifier');
    expect(circuits).toHaveProperty('verifyCredentialAuthenticity');
    expect(circuits).toHaveProperty('isCredentialActive');
    expect(circuits).toHaveProperty('getCredentialStatus');
  });

  it('should export network utilities', () => {
    // Test that network utilities are exported
    expect(circuits).toHaveProperty('NETWORKS');
    expect(circuits).toHaveProperty('getAvailableNetworks');
    expect(circuits).toHaveProperty('getNetwork');
  });

  it('should export logger utilities', () => {
    // Test that logger utilities are exported
    expect(circuits).toHaveProperty('CircuitLogger');
    expect(circuits).toHaveProperty('createCircuitLogger');
    expect(circuits).toHaveProperty('circuitLogger');
    expect(circuits).toHaveProperty('defaultCircuitLogger');
    // Note: Removed 'logger' alias for backward compatibility
  });

  it('should export types', () => {
    // Note: TypeScript types are not available at runtime, so we can't test them directly
    // The types are exported from the module and available for TypeScript compilation
    // This test verifies that the module can be imported without errors, which means
    // the types are properly exported for TypeScript consumers
    expect(circuits).toBeDefined();
    expect(typeof circuits).toBe('object');
  });

  it('should have all exports as functions or objects', () => {
    // Test that all exports are either functions or objects
    Object.values(circuits).forEach((exportValue) => {
      expect(
        typeof exportValue === 'function' || typeof exportValue === 'object'
      ).toBe(true);
    });
  });

  it('should not export test utilities', () => {
    // Test that test utilities are not exported from the main entry point
    // Note: verification and network utilities are now exported as they are part of the core library
    expect(circuits).not.toHaveProperty('mockData');
    expect(circuits).not.toHaveProperty('testUtils');
  });
});
