// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier');

// Convenciones de naming del Backend: docs/00-metodologia-y-calidad.md y docs/04-persistencia-de-datos.md
// (camelCase en todo el código TypeScript; snake_case queda confinado a las columnas de PostgreSQL,
// mapeadas por TypeORM y nunca reflejadas en un identificador de código).
module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'property', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['PascalCase'] },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
      ],
    },
  },
  prettier,
  {
    ignores: ['dist/', 'node_modules/'],
  },
);
