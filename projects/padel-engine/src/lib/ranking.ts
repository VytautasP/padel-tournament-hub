/*
 * The ladder every leaderboard in this engine is ranked by, whoever is standing on it.
 *
 * Americano ranks players and Team Americano ranks teams (decision #2c), and the rules are not
 * merely similar — they are the same rules, applied to a different competitor. Total points, so
 * that the number the table shows is the number the evening was played in, with the bench paid a
 * credit rather than divided out (ADR-0023). Ties resolved on head-to-head, and then declared
 * joint rather than separated by something that is not evidence (decision #8). Writing that twice
 * would be writing two subtly different tie-breaks, so it is written here once and given
 * competitors to rank.
 *
 * What a competitor *is* stays with the caller: this file is handed ids, names, the results they
 * earned and the credits they are owed, and never asks whether an id belongs to a person or to a
 * pair. Nothing here reads a session, so nothing here can disagree with what the session says a
 * result was — including *which* rounds owe a credit, which is a question about the document and
 * is answered before anything gets here.
 */

/** Somebody being ranked: a player, or a team. */
export interface Entrant {
  readonly id: string;
  readonly name: string;
}

/**
 * One played result, from one competitor's side of it: what was scored, by whom, against whom.
 *
 * `ids` is a list because a player-level result belongs to the two players on the side; a
 * team-level one belongs to the single team they were playing as. `against` is what the
 * head-to-head tier reads, and it is in the same currency — teams are faced by teams, players by
 * players. `opponentPoints` is what makes the result a win, a tie or a loss; the comparison is
 * made here rather than by the caller so that both levels say the same thing by construction.
 */
export interface Result {
  readonly ids: readonly string[];
  readonly points: number;
  readonly opponentPoints: number;
  readonly against: readonly string[];
}

/**
 * One round a competitor sat out, and what that round pays them (ADR-0023 §2).
 *
 * A credit is one round rather than one sum, because the count of them is a figure the table
 * shows: it is the term that explains why a record of matches does not add up to a total of
 * points. Whether a round owes one at all — complete, and a bench rather than an absence — is
 * settled by the caller, which is the half of this that needs a session to answer.
 */
export interface Credit {
  readonly id: string;
  readonly points: number;
}

/** One competitor's line in the table, before the caller names its id field. */
export interface Placing {
  readonly id: string;
  readonly name: string;
  /** 1-based place, shared by everyone in a joint position. */
  readonly position: number;
  /** Whether this place is shared with another competitor. */
  readonly joint: boolean;
  /** Results with a recorded score. A court still playing counts for nothing. */
  readonly matchesPlayed: number;
  /** Points scored across those results, plus every bench credit earned. The ranking figure. */
  readonly points: number;
  /** Matches whose other side scored fewer points. */
  readonly won: number;
  /** Matches that ended level, which an odd target score makes impossible. */
  readonly tied: number;
  /** Matches whose other side scored more points. */
  readonly lost: number;
  /** Rounds sat out and paid for. Neither a match played nor any of the three above. */
  readonly benched: number;
}

/**
 * What a competitor has done across some set of results: the raw tally every tier is computed from.
 *
 * The same shape answers two different questions — the whole session for the ranking, and the
 * results inside a tied group for the head-to-head tier — which is why one fold builds both and
 * one comparison orders both. The head-to-head reading is asked of results only, so the record and
 * the credits on it come along for the ride and nothing reads them.
 */
interface Tally {
  readonly id: string;
  readonly name: string;
  points: number;
  matchesPlayed: number;
  won: number;
  tied: number;
  lost: number;
  benched: number;
}

/** The competitors, ranked: one line each, in table order. */
export function placings(
  entrants: readonly Entrant[],
  results: readonly Result[],
  credits: readonly Credit[] = [],
): readonly Placing[] {
  const ranked = rank(tally(entrants, results, credits), results);

  return ranked.flatMap((group, index) =>
    group.map((entry) => ({
      id: entry.id,
      name: entry.name,
      position: placeOf(ranked, index),
      joint: group.length > 1,
      matchesPlayed: entry.matchesPlayed,
      points: entry.points,
      won: entry.won,
      tied: entry.tied,
      lost: entry.lost,
      benched: entry.benched,
    })),
  );
}

/**
 * Fold results and credits into one tally per competitor, in the order the competitors were given.
 *
 * Seeded from a list of entrants rather than discovered from the results, so a competitor who has
 * not been on court gets a line of zeroes instead of being missing, and an id that appears in a
 * result but not in the seed is ignored rather than conjuring a rival. `counts` decides whether a
 * result belongs in the tally, which is the only thing the head-to-head tier needs to say
 * differently: it counts a result only where it was earned against the tied group, and it is
 * handed no credits at all, because a credit was earned against nobody.
 */
function tally(
  entrants: readonly Entrant[],
  results: readonly Result[],
  credits: readonly Credit[],
  counts: (against: readonly string[]) => boolean = () => true,
): Tally[] {
  const tallies = new Map<string, Tally>(
    entrants.map((entrant) => [
      entrant.id,
      {
        id: entrant.id,
        name: entrant.name,
        points: 0,
        matchesPlayed: 0,
        won: 0,
        tied: 0,
        lost: 0,
        benched: 0,
      },
    ]),
  );

  for (const result of results) {
    if (!counts(result.against)) {
      continue;
    }
    for (const id of result.ids) {
      const entry = tallies.get(id);
      if (entry) {
        entry.points += result.points;
        entry.matchesPlayed++;
        record(entry, result);
      }
    }
  }

  for (const credit of credits) {
    const entry = tallies.get(credit.id);
    if (entry) {
      entry.points += credit.points;
      entry.benched++;
    }
  }

  return [...tallies.values()];
}

/** Which of the three a result was, read from the side that earned it. */
function record(entry: Tally, result: Result): void {
  if (result.points > result.opponentPoints) {
    entry.won++;
  } else if (result.points < result.opponentPoints) {
    entry.lost++;
  } else {
    entry.tied++;
  }
}

/**
 * The tallies in ranked order, grouped: each group is a set of competitors nothing could separate.
 *
 * The tiers are applied in order and each one only ever splits a group further, so a group that
 * survives to the end is a genuine joint position rather than a tier that was skipped.
 */
function rank(tallies: readonly Tally[], results: readonly Result[]): Tally[][] {
  const byPoints = runsOf([...tallies].sort(comparePoints), comparePoints);

  return byPoints.flatMap((group) => splitByHeadToHead(group, results));
}

/**
 * A group tied on total points, split by what its members did to each other.
 *
 * Head-to-head only speaks where there is something to hear: every competitor in the group needs
 * at least one result against another member, or the tier would be ranking a record against no
 * record at all. A field too big to fit a complete round-robin makes that ordinary rather than
 * exotic, so where one member never met the group the tier declines for the whole group and the
 * tie stands as joint — half a tier is not a tier.
 *
 * Where it does apply, a head-to-head standing is a *rate* — points per meeting — even though the
 * ranking above it is not, because members of the group need not have met the same number of
 * times and there is no credit to level that up with (ADR-0023 §6). One number per competitor is
 * also what orders three of them who beat each other in a circle, where comparing them in pairs
 * would not.
 */
function splitByHeadToHead(group: readonly Tally[], results: readonly Result[]): Tally[][] {
  if (group.length === 1) {
    return [[...group]];
  }

  const meetings = headToHead(group, results);
  if (meetings.some((entry) => entry.meeting.matchesPlayed === 0)) {
    return [[...group]];
  }

  const compare = (a: Meeting, b: Meeting): number => compareRate(a.meeting, b.meeting);

  return runsOf([...meetings].sort(compare), compare).map((run) =>
    run.map((entry) => entry.overall),
  );
}

/** A tied competitor's whole-session record, alongside what they did against the rest of the group. */
interface Meeting {
  readonly overall: Tally;
  readonly meeting: Tally;
}

/** Each member of the group, paired with their record from the results where they met another. */
function headToHead(group: readonly Tally[], results: readonly Result[]): Meeting[] {
  const members = new Set(group.map((entry) => entry.id));
  const meetings = tally(group, results, [], (against) => against.some((id) => members.has(id)));

  // `tally` returns one entry per competitor given, in the order given, so the lists line up.
  return group.map((overall, index) => ({ overall, meeting: meetings[index] }));
}

/** Higher rate first. Compared as a fraction, so two whole tallies never disagree by a rounding. */
function compareRate(a: Tally, b: Tally): number {
  if (a.matchesPlayed === 0 || b.matchesPlayed === 0) {
    return rateOf(b) - rateOf(a);
  }

  return b.points * a.matchesPlayed - a.points * b.matchesPlayed;
}

/** Higher total first — the ranking itself (ADR-0023 §1). */
function comparePoints(a: Tally, b: Tally): number {
  return b.points - a.points;
}

function rateOf(tally: Tally): number {
  return tally.matchesPlayed === 0 ? 0 : tally.points / tally.matchesPlayed;
}

/**
 * Split a sorted list into runs: consecutive entries `compare` cannot tell apart.
 *
 * The list is already in order, so neighbours are all that need asking — everything that compares
 * equal to the entry that opened the run belongs in it.
 */
function runsOf<T>(sorted: readonly T[], compare: (a: T, b: T) => number): T[][] {
  const runs: T[][] = [];

  for (const entry of sorted) {
    const last = runs.at(-1);
    if (last && compare(last[0], entry) === 0) {
      last.push(entry);
    } else {
      runs.push([entry]);
    }
  }

  return runs;
}

/** The place a group occupies: one past everyone above it, so joint positions use their places up. */
function placeOf(groups: readonly Tally[][], index: number): number {
  return groups.slice(0, index).reduce((places, group) => places + group.length, 1);
}
