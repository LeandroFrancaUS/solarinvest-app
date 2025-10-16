module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-use-before-define': [
      'error',
      { functions: false, classes: true, variables: true },
    ],
    'no-use-before-define': 'off',
    'import/no-cycle': 'error',
  },
  env: {
    browser: true,
    es2021: true,
  },
  ignorePatterns: ['dist', 'node_modules'],
}
