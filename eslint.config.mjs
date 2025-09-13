import nx from '@nx/eslint-plugin';
import pluginJest from 'eslint-plugin-jest';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  // Register plugins for flat config so rules like "jest/expect-expect" resolve.
  {
    plugins: { jest: pluginJest },
  },
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
  {
    // Allow explicit `any` in test files
    files: [
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.js',
      '**/*.test.js',
      '**/*.e2e-spec.ts',
      '**/*.e2e.ts',
      '**/__tests__/**',
      'test/**',
      '**/*.spec.cjs',
      '**/*.spec.mjs',
      '**/*.test.cjs',
      '**/*.test.mjs',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
