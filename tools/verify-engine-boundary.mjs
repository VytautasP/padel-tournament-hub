/**
 * Proves the padel-engine import boundary (decision #11) actually bites.
 *
 * The lint rules in projects/padel-engine/eslint.config.js are only worth having if
 * they fail on the imports they claim to forbid. This script feeds deliberate
 * violations at the boundary and fails if any of them passes — so the boundary is
 * demonstrated, not assumed.
 *
 * It checks two different things, because either alone would leave a hole:
 *
 *   1. The rules reject what they claim to (and nothing more), via the ESLint API.
 *   2. `ng lint padel-engine` — the command anyone actually runs — exits non-zero on
 *      a real file containing an Angular import. Without this, the rules could be
 *      correct but unwired from the lint target in angular.json.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engineRoot = path.join(repoRoot, 'projects', 'padel-engine');
const probePath = path.join(engineRoot, 'src', 'boundary-probe.ts');
const RULE = '@typescript-eslint/no-restricted-imports';
const PURITY_RULES = ['no-restricted-globals', 'no-restricted-properties'];

const ANGULAR_PROBE = `import { Injectable } from '@angular/core';\nexport const probe: unknown = Injectable;\n`;

/** Sources that MUST be rejected by the boundary rule. */
const forbidden = [
  ['an Angular import', ANGULAR_PROBE],
  [
    'an Angular type-only import',
    `import type { Signal } from '@angular/core';\nexport type Probe = Signal<number>;\n`,
  ],
  [
    'an Angular submodule import',
    `import { TestBed } from '@angular/core/testing';\nexport const probe: unknown = TestBed;\n`,
  ],
  [
    'a Firebase import',
    `import { getFirestore } from 'firebase/firestore';\nexport const probe: unknown = getFirestore;\n`,
  ],
  [
    'an AngularFire import',
    `import { Firestore } from '@angular/fire/firestore';\nexport type Probe = Firestore;\n`,
  ],
  [
    'a Node built-in import',
    `import { readFileSync } from 'node:fs';\nexport const probe: unknown = readFileSync;\n`,
  ],
];

/**
 * Impurities that MUST be rejected. The engine reads no clock and has no random source: generation
 * is deterministic, so the same input schedules identically every run (decision #6).
 */
const impure = [
  [
    'a random source',
    `export const probe = Math.random();
`,
  ],
  [
    'a clock read',
    `export const probe = new Date().getTime();
`,
  ],
  [
    'a timestamp read',
    `export const probe = Date.now();
`,
  ],
];

/** Sources that MUST still be allowed — the rule has to be a boundary, not a wall. */
const allowed = [
  ['a relative import', `import { thing } from './thing';\nexport const probe: unknown = thing;\n`],
];

const failures = [];

// 1. The rules themselves, linted in memory under a path inside the engine.
const eslint = new ESLint({
  cwd: repoRoot,
  overrideConfigFile: path.join(engineRoot, 'eslint.config.js'),
});

const restrictionIn = async (source) => {
  const [result] = await eslint.lintText(source, { filePath: probePath });
  return result.messages.find((message) => message.ruleId === RULE);
};

for (const [label, source] of forbidden) {
  const hit = await restrictionIn(source);
  if (hit) {
    console.log(`  ok      ${label} is rejected — ${hit.message.split('.')[0]}.`);
  } else {
    failures.push(`${label} lints clean inside padel-engine — the boundary is not enforced.`);
  }
}

for (const [label, source] of impure) {
  const [result] = await eslint.lintText(source, { filePath: probePath });
  const hit = result.messages.find((message) => PURITY_RULES.includes(message.ruleId));
  if (hit) {
    console.log(`  ok      ${label} is rejected — ${hit.message.split('—')[0].trim()}`);
  } else {
    failures.push(`${label} lints clean inside padel-engine — the engine is not provably pure.`);
  }
}

for (const [label, source] of allowed) {
  if (await restrictionIn(source)) {
    failures.push(`${label} is rejected inside padel-engine — the boundary is too broad.`);
  } else {
    console.log(`  ok      ${label} is allowed.`);
  }
}

// 2. The wiring: a real file, and the real command.
fs.writeFileSync(probePath, ANGULAR_PROBE);
try {
  const lint = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, 'node_modules', '@angular', 'cli', 'bin', 'ng.js'),
      'lint',
      'padel-engine',
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  const output = `${lint.stdout ?? ''}${lint.stderr ?? ''}`;
  if (lint.status !== 0 && output.includes(RULE)) {
    console.log('  ok      `ng lint padel-engine` fails on a real file with an Angular import.');
  } else {
    failures.push(
      `\`ng lint padel-engine\` exited ${lint.status} on a file importing @angular/core — the engine's lint config is not wired into the lint target.`,
    );
  }
} finally {
  fs.rmSync(probePath, { force: true });
}

if (failures.length > 0) {
  console.error('\npadel-engine boundary check FAILED:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `\npadel-engine boundary holds: ${forbidden.length} forbidden and ${allowed.length} allowed imports, plus ${impure.length} impurities, behaved as specified, and ng lint fails on the real thing.`,
);
