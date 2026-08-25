/*
 * The engine's referee.
 *
 * `assertSessionValid` encodes the invariant list in `docs/DECISIONS.md` and ships as production
 * code, not as a test helper (decision #21): the app can hand it any session — one it built, one
 * it loaded from storage — and find out whether it is playable.
 *
 * Every check runs at **every round prefix**, not only over the finished session, because a
 * session that is fair only after its last round is unfair to the evening that stops early
 * (decision #6). The prefix walk is what actually tests that.
 *
 * It throws on the first violation with a message naming the round and the players involved,
 * because a fairness bug is only useful if you can see what it did.
 */
import type { Match, PlayerId, Round, Session } from './model';
import { PairTally } from './pair-tally';
import { assertSessionShape, PLAYERS_PER_COURT } from './session-shape';

export function assertSessionValid(session: Session): void {
  assertSessionShape(session);

  const names = new Map(session.roster.map((entry) => [entry.id, entry.name]));
  const nameOf = (id: PlayerId): string => names.get(id) ?? id;

  assertMatchIdsUnique(session);
  assertGeneratedRoundsComeFirst(session);

  const partnerCounts = new PairTally();
  const benchCounts = new Map<PlayerId, number>(session.roster.map((entry) => [entry.id, 0]));

  for (const round of session.rounds) {
    if (round.matches.length === 0) {
      continue;
    }

    assertRoundStructure(round, session, nameOf);
    countBench(round, session, benchCounts);

    // Everything from here down is a prefix check: it holds after this round, given every
    // round before it, so a session truncated at any point is still valid.
    assertBenchSpread(round, benchCounts, nameOf);
    assertPartnerVariety(round, session, partnerCounts, nameOf);
  }
}

function assertMatchIdsUnique(session: Session): void {
  const seen = new Set<string>();
  for (const round of session.rounds) {
    for (const match of round.matches) {
      if (seen.has(match.id)) {
        throw new Error(`Duplicate match id "${match.id}".`);
      }
      seen.add(match.id);
    }
  }
}

/** An unplayed round is a slot still to be filled, so nothing may be scheduled after one. */
function assertGeneratedRoundsComeFirst(session: Session): void {
  const firstUnplayed = session.rounds.findIndex((round) => round.matches.length === 0);
  if (firstUnplayed === -1) {
    return;
  }

  const laterGenerated = session.rounds
    .slice(firstUnplayed + 1)
    .find((round) => round.matches.length > 0);
  if (laterGenerated) {
    throw new Error(
      `Round ${laterGenerated.number} is scheduled while round ${firstUnplayed + 1} is unplayed.`,
    );
  }
}

function assertRoundStructure(
  round: Round,
  session: Session,
  nameOf: (id: PlayerId) => string,
): void {
  if (round.matches.length !== session.courtCount) {
    throw new Error(
      `Round ${round.number} fills ${round.matches.length} of ${session.courtCount} court(s) — ` +
        'every court hosts a match.',
    );
  }

  const courtNumbers = round.matches.map((match) => match.courtNumber);
  const expectedCourts = Array.from({ length: session.courtCount }, (_, index) => index + 1);
  if (courtNumbers.join(',') !== expectedCourts.join(',')) {
    throw new Error(
      `Round ${round.number} uses court numbers ${courtNumbers.join(', ')} — expected ` +
        `${expectedCourts.join(', ')}.`,
    );
  }

  const rosterIds = new Set(session.roster.map((entry) => entry.id));
  const playing = new Set<PlayerId>();

  for (const match of round.matches) {
    const players = playersOf(match);

    for (const id of players) {
      if (!rosterIds.has(id)) {
        throw new Error(`Match ${match.id} schedules "${id}", who is not on the roster.`);
      }
    }

    if (new Set(players).size !== PLAYERS_PER_COURT) {
      throw new Error(`Match ${match.id} must have four distinct players.`);
    }

    for (const id of players) {
      if (playing.has(id)) {
        throw new Error(`Round ${round.number} schedules ${nameOf(id)} on two courts.`);
      }
      playing.add(id);
    }
  }
}

function countBench(round: Round, session: Session, benchCounts: Map<PlayerId, number>): void {
  const playing = new Set(round.matches.flatMap(playersOf));
  for (const entry of session.roster) {
    if (!playing.has(entry.id)) {
      benchCounts.set(entry.id, (benchCounts.get(entry.id) ?? 0) + 1);
    }
  }
}

/** Bench counts across players never differ by more than one — at every prefix. */
function assertBenchSpread(
  round: Round,
  benchCounts: Map<PlayerId, number>,
  nameOf: (id: PlayerId) => string,
): void {
  const counts = [...benchCounts.values()];
  const spread = Math.max(...counts) - Math.min(...counts);
  if (spread <= 1) {
    return;
  }

  const most = [...benchCounts.entries()].reduce((a, b) => (b[1] > a[1] ? b : a));
  throw new Error(
    `After round ${round.number} bench counts differ by ${spread} — ${nameOf(most[0])} has sat ` +
      `out ${most[1]} time(s).`,
  );
}

/**
 * No partnership repeats while either player still has an unplayed partner. Generalised past the
 * first full rotation: a partnership played `n` times requires both players to have partnered
 * everyone else at least `n - 1` times.
 */
function assertPartnerVariety(
  round: Round,
  session: Session,
  partnerCounts: PairTally,
  nameOf: (id: PlayerId) => string,
): void {
  const repeated: Pairing[] = [];

  for (const match of round.matches) {
    for (const side of [match.sideA, match.sideB]) {
      const count = partnerCounts.increment(side[0], side[1]);
      if (count > 1) {
        repeated.push({ a: side[0], b: side[1], count });
      }
    }
  }

  for (const { a, b, count } of repeated) {
    for (const player of [a, b]) {
      const unplayed = session.roster.find(
        (entry) => entry.id !== player && partnerCounts.count(entry.id, player) < count - 1,
      );

      if (unplayed) {
        throw new Error(
          `Round ${round.number} partners ${nameOf(a)} with ${nameOf(b)} for the ${count} time(s) ` +
            `while ${nameOf(player)} has partnered ${nameOf(unplayed.id)} fewer times than that.`,
        );
      }
    }
  }
}

interface Pairing {
  readonly a: PlayerId;
  readonly b: PlayerId;
  readonly count: number;
}

function playersOf(match: Match): PlayerId[] {
  return [...match.sideA, ...match.sideB];
}
