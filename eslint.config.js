import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import importPlugin from 'eslint-plugin-import'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const eslintrcPath = path.join(__dirname, '.eslintrc.json')
const baseConfig = JSON.parse(readFileSync(eslintrcPath, 'utf8'))
const baseRules = baseConfig.rules ?? {}

const tsRecommended = tsPlugin.configs['recommended-type-checked']

export default [
  {
    ignores: [
      'dist',
      'node_modules',
      'coverage',
      // Separate sub-projects with their own tsconfig/eslint setups
      'backend/**',
      'frontend/**',
      'my-neon-app/**',
      // Vendor files
      'public/vendor/**',
      // Standalone utility scripts and CLI tools not part of main app
      'cli/**',
      'scripts/grant-admin.ts',
      'scripts/grant-role.ts',
      // Root-level mjs utility scripts
      'test-neon-connection.mjs',
      'server/pdf-generate-leasing.mjs',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ...tsRecommended.languageOptions,
      parser: tsParser,
      parserOptions: {
        ...tsRecommended.languageOptions?.parserOptions,
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
      },
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...tsRecommended.rules,
      ...baseRules,
      'import/no-cycle': ['error', { maxDepth: 2 }],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      'import/no-cycle': 'error',
      'no-restricted-globals': ['error', 'chartColors', 'potenciaModulo'],
    },
  },
]
