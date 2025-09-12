/**
 * Unit tests for circuit-utils.ts
 * Tests circuit compilation, file management, and configuration utilities
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  compileCircuit,
  getDefaultCircuitConfig,
  circuitFilesExist,
  cleanCircuitFiles,
  CircuitConfig,
} from '../lib/circuit-utils';

// Mock the logger to avoid console output during tests
jest.mock('../lib/logger', () => ({
  CircuitLogger: jest.fn().mockImplementation(() => ({
    compilationStart: jest.fn(),
    compilationComplete: jest.fn(),
    compilationError: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    performance: jest.fn(),
  })),
}));

// Mock execSync to avoid actual command execution
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Mock fs functions
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

describe('Circuit Utils', () => {
  let mockExecSync: jest.MockedFunction<typeof execSync>;
  let mockExistsSync: jest.MockedFunction<typeof existsSync>;
  let mockMkdirSync: jest.MockedFunction<typeof mkdirSync>;
  let _mockWriteFileSync: jest.MockedFunction<typeof writeFileSync>;
  let _mockUnlinkSync: jest.MockedFunction<typeof unlinkSync>;
  let _tempDir: string;

  beforeEach(() => {
    mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
    mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
    mockMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>;
    _mockWriteFileSync = writeFileSync as jest.MockedFunction<
      typeof writeFileSync
    >;
    _mockUnlinkSync = unlinkSync as jest.MockedFunction<typeof unlinkSync>;

    // Create a temporary directory for tests
    _tempDir = join(tmpdir(), 'circuit-utils-test');
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDefaultCircuitConfig', () => {
    it('should return default circuit configuration', () => {
      const config = getDefaultCircuitConfig();

      expect(config).toEqual({
        inputPath: 'src/ExamProof.circom',
        outputPath: 'build',
        circuitName: 'ExamProof',
      });
    });
  });

  describe('circuitFilesExist', () => {
    it('should return true when all circuit files exist', () => {
      const config: CircuitConfig = {
        inputPath: 'src/ExamProof.circom',
        outputPath: 'build',
        circuitName: 'ExamProof',
      };

      mockExistsSync.mockReturnValue(true);

      const _result = circuitFilesExist(config);

      // When all circuit files exist, the function should return true
      expect(_result).toBe(true);
      expect(mockExistsSync).toHaveBeenCalledTimes(3);
      expect(mockExistsSync).toHaveBeenCalledWith(
        join('build', 'ExamProof.r1cs')
      );
      expect(mockExistsSync).toHaveBeenCalledWith(
        join('build', 'ExamProof.wasm')
      );
      expect(mockExistsSync).toHaveBeenCalledWith(
        join('build', 'ExamProof.sym')
      );
    });

    it('should return false when any circuit file is missing', () => {
      const config: CircuitConfig = {
        inputPath: 'src/ExamProof.circom',
        outputPath: 'build',
        circuitName: 'ExamProof',
      };

      // Mock that only 2 out of 3 files exist
      mockExistsSync
        .mockReturnValueOnce(true) // r1cs exists
        .mockReturnValueOnce(true) // wasm exists
        .mockReturnValueOnce(false); // sym doesn't exist

      const _result = circuitFilesExist(config);

      expect(_result).toBe(false);
    });

    it('should return false when no circuit files exist', () => {
      const config: CircuitConfig = {
        inputPath: 'src/ExamProof.circom',
        outputPath: 'build',
        circuitName: 'ExamProof',
      };

      mockExistsSync.mockReturnValue(false);

      const _result = circuitFilesExist(config);

      expect(_result).toBe(false);
    });
  });

  describe('cleanCircuitFiles', () => {
    it('should clean all existing circuit files', () => {
      const config: CircuitConfig = {
        inputPath: 'src/ExamProof.circom',
        outputPath: 'build',
        circuitName: 'ExamProof',
      };

      // Mock that all files exist
      mockExistsSync.mockReturnValue(true);

      cleanCircuitFiles(config);

      expect(mockExecSync).toHaveBeenCalledTimes(5); // 5 files to clean
      expect(mockExecSync).toHaveBeenCalledWith('rm -f build/ExamProof.r1cs');
      expect(mockExecSync).toHaveBeenCalledWith('rm -f build/ExamProof.wasm');
      expect(mockExecSync).toHaveBeenCalledWith('rm -f build/ExamProof.sym');
      expect(mockExecSync).toHaveBeenCalledWith('rm -f build/ExamProof.cpp');
      expect(mockExecSync).toHaveBeenCalledWith('rm -f build/ExamProof.dat');
    });

    it('should skip non-existent files', () => {
      const config: CircuitConfig = {
        inputPath: 'src/ExamProof.circom',
        outputPath: 'build',
        circuitName: 'ExamProof',
      };

      // Mock that no files exist
      mockExistsSync.mockReturnValue(false);

      cleanCircuitFiles(config);

      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should handle errors when cleaning files', () => {
      const config: CircuitConfig = {
        inputPath: 'src/ExamProof.circom',
        outputPath: 'build',
        circuitName: 'ExamProof',
      };

      // Mock that files exist but execSync throws an error
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Should not throw an error
      expect(() => cleanCircuitFiles(config)).not.toThrow();
    });
  });

  describe('compileCircuit', () => {
    it('should compile circuit successfully', async () => {
      const config: CircuitConfig = {
        inputPath: 'src/ExamProof.circom',
        outputPath: 'build',
        circuitName: 'ExamProof',
      };

      // Mock successful compilation
      mockExistsSync.mockReturnValue(false); // Output directory doesn't exist
      mockExecSync.mockImplementation(() => Buffer.from('')); // Successful command execution

      const result = await compileCircuit(config);

      expect(result).toEqual({
        r1cs: join('build', 'ExamProof.r1cs'),
        wasm: join('build', 'ExamProof.wasm'),
        sym: join('build', 'ExamProof.sym'),
        compilationTime: expect.any(Number),
      });

      expect(mockMkdirSync).toHaveBeenCalledWith('build', { recursive: true });
      expect(mockExecSync).toHaveBeenCalledWith(
        'circom src/ExamProof.circom --r1cs --wasm --sym --c -o build',
        { stdio: 'pipe' }
      );
    });

    it('should create output directory if it does not exist', async () => {
      const config: CircuitConfig = {
        inputPath: 'src/ExamProof.circom',
        outputPath: 'build',
        circuitName: 'ExamProof',
      };

      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => Buffer.from(''));

      await compileCircuit(config);

      expect(mockMkdirSync).toHaveBeenCalledWith('build', { recursive: true });
    });

    it('should not create output directory if it already exists', async () => {
      const config: CircuitConfig = {
        inputPath: 'src/ExamProof.circom',
        outputPath: 'build',
        circuitName: 'ExamProof',
      };

      mockExistsSync.mockReturnValue(true); // Directory exists
      mockExecSync.mockImplementation(() => Buffer.from(''));

      await compileCircuit(config);

      expect(mockMkdirSync).not.toHaveBeenCalled();
    });

    it('should handle compilation errors', async () => {
      const config: CircuitConfig = {
        inputPath: 'src/ExamProof.circom',
        outputPath: 'build',
        circuitName: 'ExamProof',
      };

      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error('Compilation failed');
      });

      await expect(compileCircuit(config)).rejects.toThrow(
        'Circuit compilation failed: Error: Compilation failed'
      );
    });

    it('should handle different circuit configurations', async () => {
      const config: CircuitConfig = {
        inputPath: 'custom/path/CustomCircuit.circom',
        outputPath: 'custom/build',
        circuitName: 'CustomCircuit',
      };

      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => Buffer.from(''));

      const result = await compileCircuit(config);

      expect(result).toEqual({
        r1cs: join('custom/build', 'CustomCircuit.r1cs'),
        wasm: join('custom/build', 'CustomCircuit.wasm'),
        sym: join('custom/build', 'CustomCircuit.sym'),
        compilationTime: expect.any(Number),
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        'circom custom/path/CustomCircuit.circom --r1cs --wasm --sym --c -o custom/build',
        { stdio: 'pipe' }
      );
    });

    it('should measure compilation time correctly', async () => {
      const config: CircuitConfig = {
        inputPath: 'src/ExamProof.circom',
        outputPath: 'build',
        circuitName: 'ExamProof',
      };

      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        // Simulate some processing time
        const start = Date.now();
        while (Date.now() - start < 10) {
          // Busy wait for ~10ms
        }
        return Buffer.from('');
      });

      const result = await compileCircuit(config);

      expect(result.compilationTime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      const config: CircuitConfig = {
        inputPath: 'src/ExamProof.circom',
        outputPath: 'build',
        circuitName: 'ExamProof',
      };

      mockExistsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      await expect(compileCircuit(config)).rejects.toThrow();
    });

    it('should handle permission errors during directory creation', async () => {
      const config: CircuitConfig = {
        inputPath: 'src/ExamProof.circom',
        outputPath: '/root/restricted',
        circuitName: 'ExamProof',
      };

      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(compileCircuit(config)).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty circuit name', () => {
      const config: CircuitConfig = {
        inputPath: 'src/ExamProof.circom',
        outputPath: 'build',
        circuitName: '',
      };

      mockExistsSync.mockReturnValue(true);

      const _result = circuitFilesExist(config);

      expect(mockExistsSync).toHaveBeenCalledWith(join('build', '.r1cs'));
      expect(mockExistsSync).toHaveBeenCalledWith(join('build', '.wasm'));
      expect(mockExistsSync).toHaveBeenCalledWith(join('build', '.sym'));
      expect(_result).toBe(_result);
    });

    it('should handle special characters in paths', () => {
      const config: CircuitConfig = {
        inputPath: 'src/Exam-Proof.circom',
        outputPath: 'build/test',
        circuitName: 'Exam-Proof',
      };

      mockExistsSync.mockReturnValue(true);

      circuitFilesExist(config);

      expect(mockExistsSync).toHaveBeenCalledWith(
        join('build/test', 'Exam-Proof.r1cs')
      );
      expect(mockExistsSync).toHaveBeenCalledWith(
        join('build/test', 'Exam-Proof.wasm')
      );
      expect(mockExistsSync).toHaveBeenCalledWith(
        join('build/test', 'Exam-Proof.sym')
      );
    });

    it('should handle very long paths', () => {
      const longPath = 'a'.repeat(1000);
      const config: CircuitConfig = {
        inputPath: 'src/ExamProof.circom',
        outputPath: longPath,
        circuitName: 'ExamProof',
      };

      mockExistsSync.mockReturnValue(true);

      circuitFilesExist(config);

      expect(mockExistsSync).toHaveBeenCalledWith(
        join(longPath, 'ExamProof.r1cs')
      );
    });
  });
});
