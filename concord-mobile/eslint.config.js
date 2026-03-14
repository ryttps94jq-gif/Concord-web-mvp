const tseslint = require('typescript-eslint');

module.exports = [
  {
    ignores: ['node_modules/', 'coverage/', 'android/', 'ios/', 'native/'],
  },
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ['src/**/*.ts', 'src/**/*.tsx'],
  })),
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
