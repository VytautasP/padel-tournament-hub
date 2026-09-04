/**
 * Proves the three conventions padel-app cannot enforce with a type (decision #20, ADR-0018 and
 * ADR-0021).
 *
 * All three are the kind of rule that holds perfectly for a month and then quietly stops: someone
 * adds a heading, someone reaches for `text-red-500` to make an error look like an error, someone
 * writes `text-sm` because the line looked big, and none of it shows up in a diff review because
 * none of it is wrong in any local sense. So they are checked here, over the app's templates and
 * component styles:
 *
 *   1. **No visible string is written in a template.** Every word the organizer reads comes from
 *      the copy dictionary through an interpolation or a binding (decision #20).
 *   2. **No component names a colour.** Colour is expressed only as tokens defined in
 *      `styles.css`, which is the one file exempt from the rule because it is where the tokens
 *      live (ADR-0018).
 *   3. **No component names a type size.** Type is expressed only as the named roles defined in
 *      `styles.css` — `text-header`, `text-name`, `text-meta` — never Tailwind's default
 *      measurement scale (`text-sm`, `text-2xl`), an arbitrary `text-[17px]`, or a raw
 *      `font-size`. This is rule 2's argument applied to the axis that would drift next: the
 *      canvas needs sizes Tailwind's scale does not carry, and a role decides the face and the
 *      tracking as well as the size, so a component that reaches for a measurement gets a third
 *      of the answer and silently drops the rest (ADR-0021 §4).
 *
 * Like `verify-engine-boundary.mjs`, this script also checks itself: it runs every rule over
 * deliberate violations and over deliberate near-misses, and fails if a rule lets a violation
 * through or trips on something legitimate. A convention checker nobody has seen reject anything
 * is indistinguishable from one that always passes.
 */
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appSource = path.join(repoRoot, 'projects', 'padel-app', 'src');

/**
 * Attributes whose value is read out loud or shown on screen. A literal in any of these is a
 * visible string wearing a different hat.
 */
const VISIBLE_ATTRIBUTES = ['placeholder', 'aria-label', 'aria-description', 'title', 'alt'];

/** Tailwind's built-in palette. Naming any of these is naming a colour rather than a token. */
const PALETTE =
  'slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white';

const COLOUR_UTILITY = new RegExp(
  `(?:^|[\\s"'])(?:hover:|focus:|active:|disabled:|dark:|sm:|md:|lg:)*` +
    `(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|placeholder|accent|caret|shadow|decoration)-` +
    `(?:${PALETTE})(?:-\\d{2,3})?(?:/\\d+)?(?:$|[\\s"'])`,
);

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|color-mix)\s*\(/;

/**
 * Tailwind's default font-size scale. Naming one of these is naming a measurement rather than a
 * role — and unlike the colour rule, a denylist is the right shape here. `text-` is a namespace
 * three unrelated things share: colour tokens (`text-ink`), the type roles (`text-header`) and
 * alignment (`text-center`). A rule that tried to describe what a role looks like would have to
 * reject the other two as well.
 */
const TYPE_SCALE = 'xs|sm|base|lg|xl|[2-9]xl';

/*
 * Any variant may precede the utility, matched as a shape rather than as a list. The colour rule
 * above names its variants one by one, which is a list somebody has to remember to grow —
 * `2xl:text-sm` is a size the app can already write, and `group-hover:` is one Tailwind adds
 * without asking. A size behind a variant is still a size.
 */
const TYPE_UTILITY = new RegExp(
  `(?:^|[\\s"'])(?:[a-z0-9@-]+(?:\\[[^\\]]*\\])?:)*` +
    `text-(?:(?:${TYPE_SCALE})(?:/\\S+)?|\\[[^\\]]*\\])(?:$|[\\s"'])`,
);

/**
 * A raw `font-size`: the same measurement wearing CSS's hat. Written as an inline style
 * (`font-size:`) or as the Angular binding that produces one (`[style.font-size]`).
 */
const TYPE_LITERAL = /font-size\s*(?::|\])/;

/**
 * The visible text a template writes for itself, after everything that is not visible text has
 * been taken out: tags and their attributes, comments, interpolations, and the control-flow
 * syntax that surrounds them.
 *
 * The order matters. Attributes are removed with their tags, so the attribute rule is checked
 * separately against the tags themselves rather than against what survives here.
 */
function literalTextIn(template) {
  const withoutComments = template.replace(/<!--[\s\S]*?-->/g, ' ');
  const withoutInterpolations = withoutComments.replace(/\{\{[\s\S]*?\}\}/g, ' ');
  const withoutTags = withoutInterpolations.replace(/<[^>]*>/g, ' ');
  const withoutBlocks = stripBlockHeaders(withoutTags).replace(/[{}]/g, ' ');

  return withoutBlocks
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /[a-zA-Z]/.test(line));
}

/**
 * Remove `@if (...)`, `@for (...; track ...)`, `@else` and friends, parentheses and all.
 *
 * A regular expression cannot do this: `@if (session(); as active)` holds parentheses inside its
 * own, and a lazy match stops at the first closing one and leaves `; as active)` behind looking
 * exactly like a literal string. So the parentheses are matched by counting them.
 *
 * `@else if` is matched as one block name rather than two, because `@else` alone would stop
 * at the space and leave `if (pastTheLastRound())` standing there looking exactly like a
 * sentence the organizer can read.
 */
function stripBlockHeaders(text) {
  let out = '';
  let index = 0;

  while (index < text.length) {
    const block = /^@(?:else\s+if|[a-zA-Z]+)/.exec(text.slice(index));
    if (block === null) {
      out += text[index];
      index += 1;
      continue;
    }

    index += block[0].length;
    const afterName = index + (/^\s*/.exec(text.slice(index))?.[0].length ?? 0);
    if (text[afterName] !== '(') {
      out += ' ';
      continue;
    }

    let depth = 0;
    index = afterName;
    while (index < text.length) {
      if (text[index] === '(') depth += 1;
      if (text[index] === ')') depth -= 1;
      index += 1;
      if (depth === 0) break;
    }
    out += ' ';
  }

  return out;
}

/** Literal values given to attributes the organizer can read. A bound attribute has no literal. */
function literalAttributesIn(template) {
  const found = [];
  for (const attribute of VISIBLE_ATTRIBUTES) {
    const pattern = new RegExp(`(?<![[(\\w-])${attribute}\\s*=\\s*"([^"]*)"`, 'g');
    for (const match of template.matchAll(pattern)) {
      if (/[a-zA-Z]/.test(match[1])) {
        found.push(`${attribute}="${match[1]}"`);
      }
    }
  }

  return found;
}

function typeSizesIn(template) {
  const found = [];
  for (const line of template.split('\n')) {
    if (TYPE_UTILITY.test(line) || TYPE_LITERAL.test(line)) {
      found.push(line.trim());
    }
  }

  return found;
}

function colourNamesIn(source) {
  const found = [];
  for (const line of source.split('\n')) {
    if (COLOUR_LITERAL.test(line) || COLOUR_UTILITY.test(line)) {
      found.push(line.trim());
    }
  }

  return found;
}

/** Every file under `src` with one of these extensions, except the token file itself. */
function sourceFiles(root, extensions) {
  const found = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      found.push(...sourceFiles(full, extensions));
    } else if (extensions.includes(path.extname(entry.name))) {
      found.push(full);
    }
  }

  return found;
}

const failures = [];
const checkedFiles = { templates: 0, styles: 0 };

for (const file of sourceFiles(appSource, ['.html'])) {
  const relative = path.relative(repoRoot, file);
  // index.html is the document the app boots into, not a component template. Its <title> is
  // browser chrome — a bookmark and a tab, present before any Angular code runs — so it is the
  // one visible string in the project that cannot come from the dictionary.
  if (relative.endsWith(path.join('src', 'index.html'))) {
    continue;
  }

  const template = fs.readFileSync(file, 'utf8');
  checkedFiles.templates += 1;

  for (const literal of literalTextIn(template)) {
    failures.push(`${relative} writes the literal text "${literal}" — it belongs in copy.ts.`);
  }
  for (const literal of literalAttributesIn(template)) {
    failures.push(`${relative} writes a literal ${literal} — bind it to copy.ts instead.`);
  }
  for (const colour of colourNamesIn(template)) {
    failures.push(`${relative} names a colour: "${colour}" — use a token from styles.css.`);
  }
  for (const size of typeSizesIn(template)) {
    failures.push(`${relative} names a type size: "${size}" — use a role from styles.css.`);
  }
}

for (const file of sourceFiles(appSource, ['.css'])) {
  const relative = path.relative(repoRoot, file);
  if (relative.endsWith(path.join('src', 'styles.css'))) {
    continue;
  }

  const stylesheet = fs.readFileSync(file, 'utf8');
  checkedFiles.styles += 1;

  for (const colour of colourNamesIn(stylesheet)) {
    failures.push(`${relative} names a colour: "${colour}" — use a token from styles.css.`);
  }
  for (const size of typeSizesIn(stylesheet)) {
    failures.push(`${relative} names a type size: "${size}" — use a role from styles.css.`);
  }
}

// The rules have to reject these, or they are not rules.
const violations = [
  ['a bare heading', 'template', '<h1>Round 1</h1>'],
  ['a literal placeholder', 'template', '<input placeholder="Name" />'],
  ['a literal aria-label', 'template', '<button aria-label="Remove player"></button>'],
  ['a palette utility', 'template', '<p class="text-red-500">{{ copy.thing }}</p>'],
  ['a hex colour', 'style', '.warning { color: #ff0000; }'],
  ['an rgb colour', 'style', '.warning { color: rgb(255 0 0); }'],
  ['a scale type size', 'template', '<p class="text-sm text-ink-muted">{{ x }}</p>'],
  ['a large scale type size', 'template', '<h1 class="text-2xl">{{ x }}</h1>'],
  ['a responsive type size', 'template', '<p class="md:text-lg">{{ x }}</p>'],
  ['a type size behind an unlisted variant', 'template', '<p class="2xl:text-sm">{{ x }}</p>'],
  ['an arbitrary type size', 'template', '<p class="text-[17px]">{{ x }}</p>'],
  ['an inline font-size', 'template', '<p style="font-size: 17px">{{ x }}</p>'],
  ['a bound font-size', 'template', '<p [style.font-size]="x">{{ y }}</p>'],
  ['a stylesheet font-size', 'style', '.score { font-size: 30px; }'],
];

// ...and allow these, or they are a wall rather than a rule.
const allowances = [
  [
    'an interpolated heading',
    'template',
    '<h1 class="text-ink">{{ copy.round.heading(1, 5) }}</h1>',
  ],
  ['a bound placeholder', 'template', '<input [placeholder]="copy.wizard.players.placeholder" />'],
  ['a bound aria-label', 'template', '<button [attr.aria-label]="copy.remove(name)"></button>'],
  [
    'token utilities',
    'template',
    '<p class="bg-surface-raised text-ink-muted border-line">{{ x }}</p>',
  ],
  [
    'control flow around interpolations',
    'template',
    '@if (a()) {\n  <p>{{ b }}</p>\n} @else {\n  <p>{{ c }}</p>\n}',
  ],
  ['a self-closing component', 'template', '<app-round-tab />'],
  ['a type role', 'template', '<h1 class="text-header font-bold text-ink">{{ x }}</h1>'],
  ['a role behind a variant', 'template', '<p class="text-meta md:text-lead">{{ x }}</p>'],
  ['alignment and wrapping', 'template', '<p class="text-center text-pretty">{{ x }}</p>'],
  ['a colour token in the same namespace', 'template', '<p class="text-ink-muted">{{ x }}</p>'],
  ['a token-valued style', 'style', '.card { background: var(--color-surface); }'],
];

const rejects = (kind, source) =>
  kind === 'template'
    ? literalTextIn(source).length > 0 ||
      literalAttributesIn(source).length > 0 ||
      colourNamesIn(source).length > 0 ||
      typeSizesIn(source).length > 0
    : colourNamesIn(source).length > 0 || typeSizesIn(source).length > 0;

for (const [label, kind, source] of violations) {
  if (rejects(kind, source)) {
    console.log(`  ok      ${label} is rejected.`);
  } else {
    failures.push(`${label} passes the convention check — the rule does not bite.`);
  }
}

for (const [label, kind, source] of allowances) {
  if (rejects(kind, source)) {
    failures.push(`${label} is rejected — the convention check is too broad.`);
  } else {
    console.log(`  ok      ${label} is allowed.`);
  }
}

if (failures.length > 0) {
  console.error('\npadel-app convention check FAILED:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `\npadel-app conventions hold: ${checkedFiles.templates} template(s) and ${checkedFiles.styles} ` +
    `component stylesheet(s) write no visible string and name no colour or type size of their ` +
    `own, and the three rules were shown to reject ${violations.length} violations without ` +
    `tripping on ${allowances.length} legitimate ones.`,
);
