# 10. Mixicano is one cost term, and its mark is derived

- **Status:** Accepted
- **Date:** 2026-08-26
- **Relates to:** decisions #2, #7 and #9 in [docs/DECISIONS.md](../DECISIONS.md), and
  [ADR-0006](0006-fairness-is-a-cost-function.md)

## Context

Mixicano is Americano with mixed-gender pairs. Decision #7 already settles the hard part: on an
unequal roster the courts fill with mixed pairs first and the surplus plays same-gender —
**hybrid fill** — so that seven women and three men produce an evening rather than a refusal.
Same-gender pairing is therefore a soft cost, not a hard constraint.

Ticket #10 asks for the two things that follow from calling it a cost. Such pairs must be held to
the minimum the roster forces, and they must rotate across players rather than falling on the same
two people all evening. Three questions had to be answered to build that.

**How the mode enters the scheduler.** A separate Mixicano generator would be a second place for
bench rotation, partner variety and prefix fairness to be got right, and the second place is the
one that drifts.

**Whether the mark is stored.** The schedule marks same-gender pairs so the organizer can explain
a pairing to the player who asks. That mark could be a field on the match, the way a score is
(ADR-0007).

**What partner variety means here.** The existing rule — no partnership repeats while any player
still has an unplayed partner — reads a woman's empty column under another woman as a debt. In a
mixed-pairing format it never is: by the fourth round of a four-and-four evening everyone has
partnered every man once, and the fifth round would be a violation the format itself forced.

## Decision

**1. Mixicano is one more term in the cost function, not a second scheduler.** `MixedPairing` —
"are these two the same gender, and how many same-gender pairs do these players on court force?" —
is threaded from `generateRemaining` into `planRound` and priced there. A mode that does not pair
across gender answers "no" and "none" to every question, so both modes run the same code and
Americano is unchanged. This is ADR-0006 applied again: fairness is a cost, and a new fairness
axis is a new term rather than a new search.

**2. The cost terms are ordered by magnitude, not tuned against each other.** A same-gender pair
outprices every repeat a round could hold; a starving repeat outprices the rotation term; rotation
outprices ordinary repeats. The gaps are wide enough that each term is only ever a tie-break among
plans equal on everything above it, which is what lets the referee assert them one at a time — a
round can never buy a cheaper repeat with an extra same-gender pair. The rotation term is a rank
within a gender rather than a raw count, so its total is bounded by the roster size and cannot
creep into the band above it however long the evening runs.

**3. The referee measures the minimum against the players on court; the scheduler beats that.**
A round of `w` women and `m` men forces `|w - m| / 2` same-gender pairs, and the referee throws on
any round that makes more. It does not hold a round to the minimum the whole roster could have
reached, because **bench fairness comes first and is never traded for mixing**. Ten players
benching two spend the first four rounds free to bench whoever mixes best; by round five the only
two players still owed a bench may both be men, and a round of seven women and one man is then
what the evening has to schedule. Pricing the gender term above bench fairness would break the
spread rule decision #4 makes structural, so the referee's invariant is the one about the round
that was actually played. Fewer than the forced number is arithmetically impossible, so throwing
on "more" is throwing on everything there is.

The scheduler is held to the stronger claim instead. `planRound` tries every bench the spread rule
admits and keeps the cheapest round, and since a same-gender pair outprices everything below it,
the bench it settles on is the bench-fair one that mixes best. That is a property of the search
rather than of the document, so it is covered where properties of the search are covered — by a
test with an oracle that re-derives the minimum over all bench-fair benches from the roster alone
(`mixicano-schedule.spec.ts`), rather than by a referee that would have to re-run the bench search
to check it.

**4. Which players carry the compromise is rotated the way the bench is.** It goes to whoever has
carried it least, counted within their own gender — a woman is in the queue with the other women,
because the men were never candidates. A late arrival joins that queue at its floor, exactly as
they join the bench queue at its floor: arriving late neither owes a compromise nor puts you first
in line for the next one. The referee checks it at every prefix: nobody is in a same-gender pair
while a player of their gender is on court, out of one, and has been in fewer.

**5. The mark is derived, never stored.** `sameGenderSides(session, match)` reads the roster's
genders and the pair. A stored flag would be a second copy of a fact the document already holds,
and correcting a gender typo mid-session would leave every earlier round marked wrong. This is
ADR-0008's reasoning, not ADR-0007's: a score is a number nobody can recompute, while a
same-gender pair is a lookup.

**6. Partner variety is judged against eligible partners.** In Mixicano that is the other gender.
Same-gender pairs are exempt from the repeat rule entirely — they answer to minimisation and
rotation instead, being a compromise the roster forced rather than a partnership anyone chose.
Americano's rule is untouched, because there every other player is eligible.

**7. Gender is required by Mixicano and by nothing else, but checked in both modes.**
`RosterEntry.gender` is optional on the type and mandatory at the shape check for
`mode: 'mixicano'` — on creation and on `addPlayer` alike. An Americano roster may carry none, and
a session written before Mixicano existed reads back unchanged. A *value* the engine does not
understand is refused in either mode, because it is a defect in either: the field survives a
roster carried between sessions, and a session whose mode is changed must not start scheduling
around a typo.

## Consequences

- `Gender` has two values, because the thing being modelled is the pairing rule rather than the
  person: a Mixicano pair is mixed or it is not. A roster that wants a third answer wants a
  different format, and that is a product decision rather than a schema one.
- A Mixicano session cannot be created from a roster with a gender missing anywhere, so the app's
  create screen has to collect it — there is no "unspecified" the engine will schedule around.
- Same-gender pairs can repeat the same two players where the roster is skewed enough to force it;
  the ordinary repeat cost discourages it but nothing forbids it, and the referee does not check
  it. Nine women and one man is an evening of compromises however they are dealt.
- The printout marks starred pairs and carries the legend once in its header. No test asserts on
  that text (ADR-0005), so the layout stays free to change.
