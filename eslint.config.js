import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import importPlugin from 'eslint-plugin-import'

const projectRoot = new URL('.', import.meta.url)
const tsRecommended = tsPlugin.configs['recommended-type-checked']

const sharedRules = {
  eqeqeq: ['error', 'smart'],
  'no-implicit-coercion': 'error',
  'no-useless-escape': 'error',
  'no-redeclare': 'error',
  'no-unsafe-optional-chaining': 'error',
  'no-duplicate-imports': ['error', { includeExports: true }],
  'no-restricted-globals': [
    'error',
    { name: 'event', message: 'Use parâmetros de evento em vez do global implícito.' },
  ],
}

export default [
  {
    ignores: ['dist', 'node_modules', 'coverage'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ...tsRecommended.languageOptions,
      parser: tsParser,
      parserOptions: {
        ...tsRecommended.languageOptions?.parserOptions,
        project: './tsconfig.eslint.json',
        tsconfigRootDir: decodeURIComponent(projectRoot.pathname),
      },
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    rules: {
      ...tsRecommended.rules,
      ...sharedRules,
      '@typescript-eslint/no-use-before-define': [
        'error',
        { functions: false, classes: true, variables: true },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'as',
          objectLiteralTypeAssertions: 'allow-as-parameter',
        },
      ],
      'import/no-cycle': 'error',
      'no-use-before-define': 'off',
    },
  },
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/__tests__/**/*.{ts,tsx}',
      '**/__mocks__/**/*.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2021,
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      ...sharedRules,
      'import/no-cycle': 'error',
      'no-use-before-define': 'off',
      'no-shadow': ['error', { builtinGlobals: false, hoist: 'functions' }],
    },
  },
]
