# Padel Tournament Hub — Design Decisions

Outcome of the design interview. Each entry is a decision, not a suggestion.

## Product

| # | Decision | Consequence |
|---|---|---|
| 1 | **Organizer-driven.** One person runs the session and enters every score. Others open a read-only share link. | No player accounts in v1. Backend is write-by-one, read-by-many. |
| 2 | **Modes: Americano, Mixicano, Team Americano.** No Mexicano / King of the Court in v1. | All three schedules are precomputable. Dynamic-seeding modes deferred. |
| 3 | **Fixed point total per match** (default 24, configurable). Organizer enters one score, other is derived. | Invalid scores impossible by construction. One slider, not two fields. |
| 4 | **Any roster >= 4.** Bench rotates evenly. ~~Standings rank by **points per match played**.~~ Standings rank by **total points**, and a benched competitor is credited **half the target score** for the round they sat out ([ADR-0023](adr/0023-the-standings-rank-on-total-points-and-the-bench-is-paid-a-credit.md)). | Sitting out never costs or gains position — the bench is paid rather than divided out. |
| 5 | **Roster mutable mid-session.** Played rounds frozen; unplayed rounds regenerated from history. | Generator is `generateRemaining(roster, courts, history)`, not a one-shot pure function. |
| 6 | **Round count set by organizer**, default = complete rotation capped ~12, `+ add round` during play. | Schedule must be **fair at every prefix**, not only at completion. |
| 7 | **Mixicano unequal pools: hybrid fill.** Fill courts with mixed pairs; surplus play same-gender pairs, marked and rotated. | Same-gender pairing is a *soft cost* in the search, not a hard constraint. |
| 8 | **Ties:** ~~pts/match ->~~ total points -> head-to-head -> **declared joint position**. No invented separator. The pts/match tier went with the ranking figure ([ADR-0023](adr/0023-the-standings-rank-on-total-points-and-the-bench-is-paid-a-credit.md)); head-to-head keeps its own points-per-meeting rate. | Explicit `Finish session` freezes doc to `status: 'finished'` + podium screen. |
| 9 | **Players are names in the session document.** No cross-session profiles or lifetime stats. | Roster entries still carry a **stable id** (never index refs). `playerId` reserved for later. |
| 10 | **Privacy:** unlisted via unguessable code, first names only, hard delete available. | No emails, phones or photos anywhere in the model. `noindex` on spectator route. |
| 2a | **Team Americano: pairs formed manually.** Organizer assigns players to fixed pairs on a pairing screen at session creation. No random or seeded draw. | Requires an even roster. Adds a pairing UI surface, and an orphaned-partner state when one half of a pair is removed mid-session. |
| 2b | **Orphaned partner keeps a slot.** Removing one half of a pair leaves the other flagged `needs partner`; their team is skipped in regenerated rounds until repaired or removed. Repaired teams **keep their accumulated points**. | Points retention is automatic: standings are computed from matches that reference a team id. Voiding would need extra code and would corrupt other teams' pts/match. |
| 2c | **Odd team count byes at team level.** With 5 teams on 2 courts, a whole team sits out each round, rotating evenly. | Decision 4 (even bench, pts/match ranking) applies unchanged, one level up. |

## Architecture

| # | Decision | Consequence |
|---|---|---|
| 11 | **Engine is a pure client-side TS library.** | Server needs zero padel knowledge -> a BaaS is sufficient, not a compromise. Works offline. |
| 12 | **Firebase: Hosting + Firestore + Anonymous Auth.** No custom backend. | Security rules *are* the authorization layer. Free tier, no cold starts (unlike Render/Supabase idle-pause). |
| 13 | **One Firestore document per session.** | Spectator listener = 1 read per change, not N. ~30 KB typical vs 1 MiB limit. |
| 14 | **Anonymous Auth + optional Google linking** (`linkWithCredential`, same uid). | Zero-friction start; durable history once linked. Build the link path now, not later. |
| 15 | **Full PWA + offline.** Service worker app shell + Firestore offline persistence. | Home-screen icon, no app stores. Needs `SwUpdate` prompt and an iOS "Add to Home Screen" hint. |
| 16 | **Tailwind + Angular CDK.** No Material. Identity is *Court at dusk* ([ADR-0021](adr/0021-the-identity-is-court-at-dusk-and-verdana-carries-the-text.md)); ~~dark mode follows the OS with no in-app toggle~~ theme is a **preference** with three answers — system, light, dark ([ADR-0031](adr/0031-the-app-has-a-settings-sheet-and-a-preference-belongs-to-the-browser.md)). | Own visual identity; CDK supplies accessible behavior only. The app has a settings sheet, and a preference belongs to the browser rather than to the account. |
| 17 | **Standalone components + signals + service store, zoneless.** No NgRx. | Standings are `computed()` from rounds — derived, never stored, so corrections recompute free. |
| 18 | **Buildable `padel-engine` library** in the Angular workspace. | Build-level boundary enforcement. Also publishable / server-reusable later. |
| 19 | **`SessionRepository` interface**; `FirestoreSessionRepository` is the only file importing the Firebase SDK. | Vendor swap stays real. In-memory fake makes tests trivial. |
| 20 | ~~**English-only UI**~~, all strings in a typed dictionary. No hardcoded template text. The UI is **English and Lithuanian**, as two typed dictionaries rather than Transloco ([ADR-0032](adr/0032-two-typed-dictionaries-and-switching-language-reloads.md)). | Adding Transloco later is wiring, not template archaeology — and the bet paid: the second language was a file and a review, not template archaeology. English wording now costs two files. |

## Process

| # | Decision | Consequence |
|---|---|---|
| 21 | **Example-based unit tests** (no property-based testing). | **Mitigation:** invariants live in one `assertSessionValid(session)` helper, called at the end of every test. |
| 22 | **Manual `firebase deploy`.** No CI. | Use `firebase hosting:channel:deploy preview` for on-device iOS PWA testing (needs real HTTPS). |
| 23 | **Build order:** engine -> local-only app -> Firebase -> extra modes. | Step 2 is genuinely usable; run a real padel night on it before touching Firestore. |

## Invariants the engine must uphold

`assertSessionValid(session)` checks, at **every** round prefix:

- No player appears on two courts in the same round; benched players appear in no match
- Every match has exactly 4 distinct players
- Bench counts across players never differ by more than 1
- No partnership repeats while any player still has an unplayed partner
- Every recorded score pair sums to the session target
- After regeneration, all completed rounds are byte-identical to before
- Mixicano: same-gender pairs are minimised, and rotated across players
- Team Americano: every active player belongs to exactly one team; `needs partner` players appear in no match; team bench spread <= 1

## Build order

1. `padel-engine` + tests, no UI. Print schedules, eyeball fairness for awkward cases (11 players / 2 courts).
2. Angular app, `localStorage` only. Create -> generate -> score -> standings -> finish. **Run a real session on it.**
3. Firestore repository, anon auth, security rules, share code, QR, spectator view.
4. Mixicano + Team Americano, PWA polish, Google linking, delete.

## Open questions

- Number of courts: assumed organizer-set at creation; court naming/numbering convention undecided.
- ~~Visual identity: colours, typography, dark mode — undecided.~~ Settled by
  [ADR-0021](adr/0021-the-identity-is-court-at-dusk-and-verdana-carries-the-text.md); the widths it
  is drawn at are [ADR-0022](adr/0022-three-tiers-and-only-the-navigation-knows-about-width.md).
- ~~Verify current Firebase Spark free-tier limits before relying on the numbers discussed.~~
  Checked 2026-09-07: Firestore 50K reads / 20K writes / 20K deletes per day and 1 GiB stored;
  Hosting 10 GB stored but only **360 MB/day transfer**. The binding constraint on this project is
  Hosting bandwidth — roughly 700 cold loads a day at a ~500 KB bundle — not Firestore reads, which
  one document per session (#13) keeps at about 500 for a twenty-spectator evening. Cloud Storage
  moved to Blaze-only in February 2026 and is unused here (#10 keeps photos out of the model).
- ~~`git init` — this is not yet a repository.~~ Done; the tracker is GitHub Issues on
  `VytautasP/padel-tournament-hub`.
- Decision #22's **manual deploy** stands. Its **no CI** half is reopened as issue #62 — `npm run
  verify` currently runs only when someone remembers to.
