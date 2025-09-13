const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx,js,jsx}',
    '!src/**/*.spec.{ts,tsx,js,jsx}',
    '!src/**/__tests__/**',
    '!src/**/test/**',
    '!src/**/tests/**',
    '!src/**/*.stories.{ts,tsx,js,jsx}',
    '!src/**/index.{ts,tsx,js,jsx}',
    '!src/**/main.{ts,tsx,js,jsx}',
    '!src/**/polyfills.{ts,tsx,js,jsx}',
  ],
  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'json'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  testEnvironment: 'node',
  setupFilesAfterEnv: [],
  moduleNameMapping: {},
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        isolatedModules: true,
      },
    ],
    '^.+\\.(js|jsx)$': [
      'babel-jest',
      {
        presets: ['@babel/preset-env'],
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js|jsx)',
    '**/*.(test|spec).(ts|tsx|js|jsx)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/tmp/',
    '/tmp-tsc/',
  ],
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|@nx|@nrwl))'],
};
