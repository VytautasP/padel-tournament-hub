// @ts-check
const { defineConfig } = require('eslint/config');
const rootConfig = require('../../eslint.config.js');

/**
 * padel-engine is a pure client-side TypeScript library (decision #11): no Angular,
 * no Firebase, no I/O. The rules below are that boundary, enforced mechanically —
 * reaching for an Angular or Firebase import in here fails `ng lint` rather than
 * being discovered months later.
 *
 * `tools/verify-engine-boundary.mjs` proves the rules actually bite.
 */
module.exports = defineConfig([
  ...rootConfig,
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@angular', '@angular/*', '@angular/*/**'],
              message:
                'padel-engine must not import Angular (decision #11) — it is a pure TypeScript library. Keep framework code in the Angular app.',
            },
            {
              group: ['firebase', 'firebase/*', '@firebase/*', '@angular/fire', '@angular/fire/*'],
              message:
                'padel-engine must not import Firebase (decision #11) — persistence lives behind SessionRepository in the Angular app (decision #19).',
            },
            {
              group: ['node:*'],
              message:
                'padel-engine must not import Node built-ins — it runs in the browser and does no I/O (decision #11).',
            },
          ],
        },
      ],
    },
  },
]);
