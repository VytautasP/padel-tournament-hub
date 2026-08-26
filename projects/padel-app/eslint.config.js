// @ts-check
const { defineConfig } = require('eslint/config');
const angular = require('angular-eslint');
const rootConfig = require('../../eslint.config.js');

/**
 * padel-app is the only project in this workspace that contains Angular code, so the Angular
 * rules live here rather than at the root (see the note in ../../eslint.config.js).
 *
 * The engine's boundary is one-directional: the app may import padel-engine, and does so only
 * through its published entry point. Reaching into `dist/padel-engine/...` or up into
 * `projects/padel-engine/src` would bypass the public API that ADR-0001 exists to protect, so
 * both are restricted here.
 */
module.exports = defineConfig([
  ...rootConfig,
  {
    files: ['**/*.ts'],
    extends: [angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['padel-engine/*', '**/padel-engine/src/**', '**/dist/padel-engine/**'],
              message:
                "padel-engine is consumed through its public entry point only (ADR-0001) — import from 'padel-engine'.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
]);
