// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');

/**
 * Workspace-wide lint baseline. Angular-specific rules belong to whichever project
 * actually contains Angular code — padel-engine, by design, never will (decision #11),
 * and its own config adds the import restrictions that keep it that way.
 */
module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, tseslint.configs.recommended, tseslint.configs.stylistic],
  },
]);
