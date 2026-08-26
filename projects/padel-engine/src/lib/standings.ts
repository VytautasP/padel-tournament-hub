/*
 * The leaderboard, derived from the rounds and stored nowhere (decision #17).
 *
 * `computeStandings` reads the recorded scores every time it is asked. There is no standings
 * field on the session, so there is nothing to invalidate and nothing to drift: a score typed
 * into the wrong column and corrected a minute later recomputes for free, which is the whole
 * reason corrections are the ordinary path in `recordScore` rather than an exceptional one.
 *
 * Two rules decide the order, and both come from the same place — the bench.
 *
 *   - **Points per match played, not total points** (decision #4). A player who sat out a round
 *     scored nothing that round, and ranking on totals would charge them for it. Rate is what
 *     makes the bench free to rotate, which is what makes it possible to seat any roster at all.
 *   - **Ties are resolved on evidence and then stop** (decision #8). Total points, then
 *     head-to-head, and if two players are still level the standings say they are joint rather
 *     than inventing a separator. Roster order is not evidence.
 */
import { deepFreeze } from './freeze';
import type { Match, PlayerId, Session } from './model';
import { assertSessionShape } from './session-shape';

/**
 * One player's line in the table.
 *
 * `position` is the place itself, so a joint second is `2` for both players and the next player
 * is `4` — the places a joint position occupies are used up, not reassigned. `joint` says the
 * position is shared, which is what stops a reader treating the order inside it as a result:
 * players level after every tier are listed in roster order, and that order means nothing.
 */
export interface Standing {
  readonly playerId: PlayerId;
  readonly name: string;
  /** 1-based place, shared by everyone in a joint position. */
  readonly position: number;
  /** Whether this place is shared with another player. */
  readonly joint: boolean;
  /** Matches with a recorded score. A court still playing counts for nothing. */
  readonly matchesPlayed: number;
  /** Points scored across those matches. */
  readonly points: number;
  /** `points / matchesPlayed`, or 0 for a player who has not been on court yet. */
  readonly pointsPerMatch: number;
}

/** What a player has done so far: the raw pair every tier is computed from. */
interface Tally {
  readonly playerId: PlayerId;
  points: number;
  matchesPlayed: number;
}

/** The standings, ranked, one line per roster entry. Frozen, like every other engine result. */
export function computeStandings(session: Session): readonly Standing[] {
  assertSessionShape(session);

  const tallies = tallyPlayed(session);
  const ranked = rank([...tallies.values()], scoredMatches(session));

  const names = new Map(session.roster.map((entry) => [entry.id, entry.name]));

  return deepFreeze(
    ranked.flatMap((group, index) =>
      group.map((tally) => ({
        playerId: tally.playerId,
        name: names.get(tally.playerId) ?? tally.playerId,
        position: placeOf(ranked, index),
        joint: group.length > 1,
        matchesPlayed: tally.matchesPlayed,
        points: tally.points,
        pointsPerMatch: rateOf(tally),
      })),
    ),
  );
}

/**
 * Every roster entry's points and matches, counting only matches that carry a score.
 *
 * Keyed off the roster rather than off the matches, so a player who has not been on court gets a
 * line of zeroes instead of being missing, and a player id that appears in a match but not on the
 * roster is ignored rather than conjuring a competitor. Insertion order is roster order, which is
 * the tie-breaker of last resort below.
 */
function tallyPlayed(session: Session): Map<PlayerId, Tally> {
  const tallies = new Map<PlayerId, Tally>(
    session.roster.map((entry) => [entry.id, { playerId: entry.id, points: 0, matchesPlayed: 0 }]),
  );

  for (const match of scoredMatches(session)) {
    for (const [side, points] of sidesOf(match)) {
      for (const id of side) {
        const tally = tallies.get(id);
        if (tally) {
          tally.points += points;
          tally.matchesPlayed++;
        }
      }
    }
  }

  return tallies;
}

/**
 * The tallies in ranked order, grouped: each group is a set of players nothing could separate.
 *
 * The tiers are applied in order and each one only ever splits a group further, so a group that
 * survives to the end is a genuine joint position rather than a tier that was skipped.
 */
function rank(tallies: readonly Tally[], played: readonly Match[]): Tally[][] {
  const compare = (a: Tally, b: Tally): number => compareRate(a, b) || comparePoints(a, b);
  const byPoints = groupBy([...tallies].sort(compare), compare);

  return byPoints.flatMap((group) => splitByHeadToHead(group, played));
}

/**
 * A group tied on rate and on total points, split by what the players did to each other.
 *
 * Head-to-head only speaks where there is something to hear: every player in the group needs at
 * least one match against another member, or the tier would be comparing a record against no
 * record at all. Where it applies, a player's head-to-head standing is again a rate — points per
 * meeting — because members of the group need not have met the same number of times, and the
 * same reasoning that rules out total points at the top rules them out here.
 */
function splitByHeadToHead(group: readonly Tally[], played: readonly Match[]): Tally[][] {
  if (group.length === 1) {
    return [[...group]];
  }

  const meetings = headToHead(group, played);
  const evidence = (tally: Tally): Tally => meetings.get(tally.playerId) ?? tally;
  if (group.some((tally) => evidence(tally).matchesPlayed === 0)) {
    return [[...group]];
  }

  const compare = (a: Tally, b: Tally): number => compareRate(evidence(a), evidence(b));

  return groupBy([...group].sort(compare), compare);
}

/** Each member's points and matches from the matches where they faced another member. */
function headToHead(group: readonly Tally[], played: readonly Match[]): Map<PlayerId, Tally> {
  const members = new Set(group.map((tally) => tally.playerId));
  const meetings = new Map<PlayerId, Tally>(
    group.map((tally) => [
      tally.playerId,
      { playerId: tally.playerId, points: 0, matchesPlayed: 0 },
    ]),
  );

  for (const match of played) {
    const [[sideA, pointsA], [sideB, pointsB]] = sidesOf(match);
    const facesAMember = (opponents: readonly PlayerId[]): boolean =>
      opponents.some((id) => members.has(id));

    for (const [side, points, opponents] of [
      [sideA, pointsA, sideB],
      [sideB, pointsB, sideA],
    ] as const) {
      if (!facesAMember(opponents)) {
        continue;
      }
      for (const id of side) {
        const meeting = meetings.get(id);
        if (meeting) {
          meeting.points += points;
          meeting.matchesPlayed++;
        }
      }
    }
  }

  return meetings;
}

/** Higher rate first. Compared as a fraction, so two whole tallies never disagree by a rounding. */
function compareRate(a: Tally, b: Tally): number {
  if (a.matchesPlayed === 0 || b.matchesPlayed === 0) {
    return rateOf(b) - rateOf(a);
  }

  return b.points * a.matchesPlayed - a.points * b.matchesPlayed;
}

/** Higher total first. */
function comparePoints(a: Tally, b: Tally): number {
  return b.points - a.points;
}

function rateOf(tally: Tally): number {
  return tally.matchesPlayed === 0 ? 0 : tally.points / tally.matchesPlayed;
}

/**
 * Split a sorted list wherever `compare` says two neighbours differ.
 *
 * The list is already in order, so neighbours are all that need asking: everything that compares
 * equal to its predecessor belongs in the same group.
 */
function groupBy(sorted: readonly Tally[], compare: (a: Tally, b: Tally) => number): Tally[][] {
  const groups: Tally[][] = [];

  for (const tally of sorted) {
    const last = groups.at(-1);
    if (last && compare(last[0], tally) === 0) {
      last.push(tally);
    } else {
      groups.push([tally]);
    }
  }

  return groups;
}

/** The place a group occupies: one past everyone above it, so joint positions use their places up. */
function placeOf(groups: readonly Tally[][], index: number): number {
  return groups.slice(0, index).reduce((places, group) => places + group.length, 1);
}

/** Every match that has been played — a match without a score is a court that has not finished. */
function scoredMatches(session: Session): Match[] {
  return session.rounds.flatMap((round) => round.matches).filter((match) => match.score);
}

/** Both sides of a played match, each with the points it scored. */
function sidesOf(
  match: Match,
): readonly [readonly [readonly PlayerId[], number], readonly [readonly PlayerId[], number]] {
  const score = match.score ?? { sideA: 0, sideB: 0 };

  return [
    [match.sideA, score.sideA],
    [match.sideB, score.sideB],
  ];
}
