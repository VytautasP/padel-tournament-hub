# 33. The dictionaries' parity check is a spec, because arity is not a fact about text

- **Status:** Accepted
- **Date:** 2026-09-09
- **Amends:** [ADR-0032 §1](0032-two-typed-dictionaries-and-switching-language-reloads.md)
- **Relates to:** §7 of [the settings spec](../specs/settings-theme-and-language.md)

## Context

ADR-0032 §1 says the dictionaries' parity check goes in `tools/verify-app-conventions.mjs`: *"gains
a parity check for the shape the type cannot see, and keeps its existing rule — no template writes
a word of its own — completely unchanged."* That was written before the check had been built, and
it named the file that already held the rules a type could not express. It was the obvious home.

Building it in #69 found that the file cannot hold this one. `verify-app-conventions.mjs` is a Node
script that reads source *text* with regular expressions — that is what its four rules need, because
a literal in a template and a hex colour in a class list are facts about characters in a file. The
two things the `Copy` type cannot see are not:

- **How many arguments a translated function declares.** TypeScript permits a function that takes
  fewer arguments than the one it replaces, everywhere in the language, so `(name: string) => string`
  satisfies `(name: string, team: string) => string` and a Lithuanian sentence quietly drops the
  team out of its own middle. `Function.length` answers this in one expression on a loaded module.
  Getting the same answer out of the source text means parsing TypeScript — destructured parameters,
  defaults, arrow bodies, generics — which is writing a second and worse compiler.
- **Whether the untranslatable words are the same words.** The mode names and the product name are
  one shared module (ADR-0032 §5), and the check worth having is object identity rather than string
  equality: equal strings are a thing somebody has to keep equal, and a shared import cannot drift.
  Identity is not visible in text at all.

## Decision

**The parity walk lives in `projects/padel-app/src/app/copy/dictionaries.spec.ts`**, and
`verify-app-conventions.mjs` is left exactly as it was — its four rules unchanged, its self-test
unchanged, its role unchanged. The dictionaries are imported, walked key by key, and every
disagreement about shape, kind or arity is reported by the path it happens at. The walker is shown
biting on a translation that dropped an argument and on an entry that stopped being a sentence,
which is the same bargain the convention checker makes with itself: a checker nobody has seen
reject anything is indistinguishable from one that always passes.

Nothing about the guarantee changes, and neither does when it is enforced. Both files run inside
`npm run verify`, one under `verify:conventions` and one under `test`, and a dictionary that has
drifted fails the same command it would have failed before.

## Consequences

- **Two files now hold "rules a type cannot express", split by what they read.**
  `verify-app-conventions.mjs` reads text, across every template and stylesheet in the app.
  `dictionaries.spec.ts` reads modules, and only the two. The line between them is legible, but it
  is a line, and a future check has to be placed on the right side of it rather than added to
  whichever file comes to mind.
- The parity check is now a test, so it can use the test runner's own vocabulary and its failures
  read as assertions rather than as a script's console output. It is also skippable by anybody who
  runs `verify:conventions` alone and calls that a check of the conventions, which it no longer
  entirely is.
- ADR-0032 §1's sentence is superseded on this one point only. Everything else it decided — two
  typed dictionaries rather than Transloco, `type Copy = typeof copyEn`, `satisfies` in every other
  dictionary, and the rule that no template writes a word of its own — stands exactly as written.
