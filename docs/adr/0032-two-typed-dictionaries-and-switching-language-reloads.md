# 32. Two typed dictionaries, and switching language reloads

- **Status:** Accepted
- **Date:** 2026-09-09
- **Relates to:** decision #15 in [docs/DECISIONS.md](../DECISIONS.md),
  [ADR-0025](0025-firestore-is-the-only-source-of-truth.md),
  [ADR-0029](0029-the-spectator-watches-one-document-and-signs-in-to-nothing.md),
  [ADR-0030](0030-a-missing-chunk-is-a-404-and-a-stale-tab-reloads.md)
- **Reverses:** decision #20 in [docs/DECISIONS.md](../DECISIONS.md), "English-only UI"
- **Depends on:** [ADR-0031](0031-the-app-has-a-settings-sheet-and-a-preference-belongs-to-the-browser.md)
  for the sheet, the storage and the pre-paint script

## Context

Decision #20 said the UI was English-only and `copy/copy.ts` said it *"will stay that way"*. Both
were wrong about the destination and exactly right about the road: the decision's stated
consequence was *"adding Transloco later is wiring, not template archaeology"*, and the file it
produced delivers that. 695 lines, 183 entries, not one word written in a template, and
`tools/verify-app-conventions.mjs` proving it. The archaeology this ADR would otherwise have had to
do was done two decisions ago.

So the question is not whether the strings can be found. It is what replaces the one dictionary,
and what happens to the screen when the answer changes.

## Decision

**1. Two typed dictionaries: `copy.en.ts` and `copy.lt.ts`, not Transloco.** Decision #20 named
Transloco before `copy.ts` existed, and the file that resulted is better than what Transloco wants.
36 of those 183 entries are *typed functions* whose arguments the compiler checks —
`resumeSummary(mode, playerCount, roundNumber)`, `heading(roundNumber, roundCount)`. Flattening
those into JSON throws the type checking away and turns a missing Lithuanian string into a runtime
key-echo on a phone at a court.

`type Copy = typeof copyEn` and `copyLt satisfies Copy` instead. A missing entry, a renamed one, or
a Lithuanian function that forgot an argument is a **build error**. `verify-app-conventions.mjs`
gains a parity check for the shape the type cannot see, and keeps its existing rule — no template
writes a word of its own — completely unchanged. That rule is what makes all of this possible and
it is not being relaxed.

`@angular/localize` was the third option and is the one that is actually excluded rather than
merely rejected: it translates at build time, which means two builds, two URLs and two service
workers, and decision #15 and the share link both assume one of each.

**2. English on first run. No `navigator.language` sniffing.** A Lithuanian phone opens the app in
English until somebody says otherwise. Sniffing would put more people in the right language on
day one, and it would also mean a browser can silently change the language of a product an
organizer has already learned, on a phone whose OS language is not always the language its owner
wants software in. The switch is one tap from the front door, and a language somebody chose is
worth more than a language something guessed.

**3. Switching language reloads the app.** The alternative is making the dictionary a signal, which
turns all 136 `copy.…` reads across 26 templates into `copy().…`, permanently, in nearly every file
in the app. Reload is a `location.reload()` after the write, and not one of those reads changes.

Three things make it safe rather than merely cheap. ADR-0030 already established that this app
reloads itself deliberately, so it is not a new idea in the codebase. ADR-0025 puts every byte of
session state in Firestore, so a reload costs a re-fetch and never an in-flight score. And the
pre-paint script of ADR-0031 §5 is already reading the preference on the way back up, so the app
that returns is in the new language before it paints.

**4. `Intl.PluralRules` carries the plurals.** Lithuanian has three forms where English has two —
`1 raundas`, `3 raundai`, `11 raundų` — and the rule is not the one an English speaker would guess:
11 through 19 take the third form while 21 takes the first. Hand-written modulo arithmetic is the
version that looks finished and is wrong at 111. `Intl.PluralRules` is in every browser this PWA
targets, needs no dependency, and is the difference between a translation that reads as written by
somebody and one that reads as generated.

**5. Mode names and the product name are not translated. Dates are.** *Americano*, *Mixicano* and
*Team Americano* are the sport's proper nouns and *Padel Tournament Hub* is the product's; a
translated mode name would be a format nobody could ask for by name at a club. The `en-GB`
`Intl.DateTimeFormat` in `copy.ts` is the opposite case and becomes locale-driven — English weekday
names down a Lithuanian organizer's own history is the most visible possible tell that the
translation is a veneer over an English app.

**6. The spectator gets a language toggle and nothing else.** ADR-0029 gives the spectator page no
chrome and no identity, and §2 above means a spectator who has never opened the app arrives in
English — which is most of the people who ever open a share link, since a spectator arrives once
and never installs anything. A read-only page whose one flaw is being in a language you do not read
is worth two words in a corner. It gets no theme control and no sheet.

The toggle writes the same `localStorage` key and reloads, exactly as the organizer's does. It has
to: with §3, a toggle that stored nothing would revert on the reload it triggers. The consequence
is that a browser can acquire a language preference from a page that has no settings — which is
harmless, and means a spectator who later runs their own evening keeps the language they chose.

## Consequences

- **Every English wording change now costs two files, forever.** That is the standing price of
  reversing decision #20 and it is paid on every future copy tweak, not once here. The parity check
  is what stops the second file being forgotten; nothing stops it being neglected.
- **The reload flashes.** A switch that blanks the screen looks broken even when it is working
  perfectly. This is the most likely thing to come back as "can we make it instant", and the answer
  at that point is the 136-read refactor §3 declined — which should be taken on its own merits
  then, not smuggled in as a bug fix.
- The Lithuanian is drafted by an agent and reviewed by a native speaker before it merges. Padel
  has club vernacular that a dictionary translates and a player never says: **bench**, **needs
  partner**, and above all **went home**, which `CONTEXT.md` defines as explicitly not a deletion
  and whose Lithuanian has to keep that softness.
- Adding a third language is now a file and a review, with the compiler listing what is missing.
  That was decision #20's real bet and it paid.
