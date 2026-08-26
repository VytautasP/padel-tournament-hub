/*
 * A session document, rendered as text a human can read.
 *
 * Build-order step 1 asks for schedules to be printed and fairness eyeballed on awkward rosters,
 * and that is what this is for: `assertSessionValid` proves the invariants hold, but only a person
 * reading a printed schedule notices that a technically-fair evening still feels wrong — the same
 * two players facing each other on court 1 every round, or one player's partners all coming from
 * the same half of the roster.
 *
 * Two consequences follow from "for reading, not for asserting" (ADR-0005):
 *
 *   - No test asserts on the text, so the layout below is free to change.
 *   - Nothing here validates. It renders whatever session it is handed — half-generated, benched,
 *     or a shape the scheduler cannot produce yet — because a developer reaches for a printout
 *     precisely when a session is in a state they did not expect. Anomalies are shown, not fixed:
 *     a player who is not on the roster is labelled as such rather than throwing.
 *
 * It stays inside the engine boundary: a pure `Session -> string`, no I/O, no clock.
 */
import type { Match, PlayerId, Round, Session } from './model';
import { courtsInPlay } from './session-shape';

/** A session as readable text: a block per round, then a block per player. */
export function formatSchedule(session: Session): string {
  const render = renderer(session);
  const blocks = [
    render.header(),
    ...session.rounds.map((round) => render.round(round)),
    render.players(),
  ];

  return `${blocks.join('\n\n')}\n`;
}

/**
 * Everything the blocks need, worked out once: display names, the column the court lines align
 * on, and what each player's evening was. They are all functions of the whole session, so a
 * renderer that holds them keeps the per-block code down to layout.
 */
function renderer(session: Session): {
  header: () => string;
  round: (round: Round) => string;
  players: () => string;
} {
  const names = displayNames(session);
  const nameOf = (id: PlayerId): string => names.get(id) ?? id;
  const rosterOrder = new Map(session.roster.map((entry, index) => [entry.id, index]));
  const stats = tallies(session);

  const pairLabel = (pair: readonly [PlayerId, PlayerId]): string =>
    `${nameOf(pair[0])} & ${nameOf(pair[1])}`;

  // Court lines align on the widest pair in the session, so every round reads as one column.
  const pairColumn = Math.max(
    0,
    ...session.rounds.flatMap((round) =>
      round.matches.map((match) => pairLabel(match.sideA).length),
    ),
  );

  /** Names in count order, so anyone met more than once rises to the front and carries `x2`. */
  const namesByCount = (counts: ReadonlyMap<PlayerId, number>): string => {
    const rendered = [...counts.entries()]
      .sort(
        ([aId, aCount], [bId, bCount]) =>
          bCount - aCount || (rosterOrder.get(aId) ?? 0) - (rosterOrder.get(bId) ?? 0),
      )
      .map(([id, count]) => (count > 1 ? `${nameOf(id)} x${count}` : nameOf(id)));

    return rendered.length > 0 ? rendered.join(', ') : '—';
  };

  const header = (): string => {
    const generated = session.rounds.filter((round) => round.matches.length > 0).length;

    // Courts booked and courts staffed are different numbers once a roster benches, and the
    // reader needs to see both — an evening on "two courts" that only ever fills one is exactly
    // the sort of surprise a printout exists to surface.
    const inPlay = courtsInPlay(session);
    const courts =
      inPlay === session.courtCount
        ? `${session.courtCount} court(s)`
        : `${session.courtCount} court(s), ${inPlay} in play`;

    return [
      `${titleCase(session.mode)} — ${session.id}`,
      [
        `${session.roster.length} players`,
        courts,
        `${generated}/${session.rounds.length} rounds generated`,
        `first to ${session.targetScore}`,
      ].join(' · '),
    ].join('\n');
  };

  const round = (round: Round): string => {
    if (round.matches.length === 0) {
      return `Round ${round.number}\n  (not yet generated)`;
    }

    const lines = round.matches.map(
      (match) =>
        `  ${label(`Court ${match.courtNumber}`)}${pairLabel(match.sideA).padEnd(pairColumn)}` +
        `  vs  ${pairLabel(match.sideB)}`,
    );

    const benched = benchedIn(round, session);
    if (benched.length > 0) {
      lines.push(`  ${label('Bench')}${benched.map(nameOf).join(', ')}`);
    }

    return [`Round ${round.number}`, ...lines].join('\n');
  };

  /**
   * One block per player: how much they played, who with, and who against — with a repeat count
   * on anyone they met more than once, and the partners they are still owed. Those lines are
   * where an unfair-feeling schedule shows itself.
   */
  const players = (): string => {
    const blocks = session.roster.map((entry) => {
      const played = stats.get(entry.id) ?? emptyTally();
      const missing = session.roster
        .filter((other) => other.id !== entry.id && !played.partners.has(other.id))
        .map((other) => nameOf(other.id));

      const lines = [
        `${nameOf(entry.id)} — played ${played.matches}, benched ${played.benched}`,
        `  partners:  ${namesByCount(played.partners)}`,
        `  opponents: ${namesByCount(played.opponents)}`,
      ];
      if (missing.length > 0) {
        lines.push(`  never partnered: ${missing.join(', ')}`);
      }

      return lines.join('\n');
    });

    return ['Players', ...blocks].join('\n\n');
  };

  return { header, round, players };
}

/** An accumulator, like `PairTally`: built during the walk over the rounds, then read. */
interface PlayerTally {
  matches: number;
  benched: number;
  partners: Map<PlayerId, number>;
  opponents: Map<PlayerId, number>;
}

/** What each player's evening was, in one walk over the generated rounds. */
function tallies(session: Session): ReadonlyMap<PlayerId, PlayerTally> {
  const byPlayer = new Map<PlayerId, PlayerTally>(
    everyoneIn(session).map((id) => [id, emptyTally()]),
  );
  const statsFor = (id: PlayerId): PlayerTally => byPlayer.get(id) ?? emptyTally();

  for (const round of session.rounds) {
    if (round.matches.length === 0) {
      continue;
    }

    for (const match of round.matches) {
      for (const [own, facing] of [
        [match.sideA, match.sideB],
        [match.sideB, match.sideA],
      ] as const) {
        for (const player of own) {
          const stats = statsFor(player);
          stats.matches++;
          // A side that names the same player twice is shown partnering themselves rather than
          // quietly dropped — a printout's job is to make a malformed match visible.
          countOne(stats.partners, own.find((id) => id !== player) ?? player);
          for (const opponent of facing) {
            countOne(stats.opponents, opponent);
          }
        }
      }
    }

    for (const id of benchedIn(round, session)) {
      statsFor(id).benched++;
    }
  }

  return byPlayer;
}

function benchedIn(round: Round, session: Session): PlayerId[] {
  const playing = new Set(round.matches.flatMap(playersOf));

  return session.roster.map((entry) => entry.id).filter((id) => !playing.has(id));
}

/**
 * Display names, keyed by id. Identity is by id, never by name (decision #9), so two players
 * called Ana are told apart by their ids rather than silently merged in the reader's head.
 */
function displayNames(session: Session): ReadonlyMap<PlayerId, string> {
  const timesUsed = new Map<string, number>();
  for (const entry of session.roster) {
    timesUsed.set(entry.name, (timesUsed.get(entry.name) ?? 0) + 1);
  }

  const names = new Map<PlayerId, string>(
    session.roster.map((entry) => [
      entry.id,
      (timesUsed.get(entry.name) ?? 0) > 1 ? `${entry.name} (${entry.id})` : entry.name,
    ]),
  );

  // Anyone scheduled but off the roster is shown by id — a printout's job is to expose that.
  for (const id of everyoneIn(session)) {
    if (!names.has(id)) {
      names.set(id, `${id} (not on the roster)`);
    }
  }

  return names;
}

/** Every player the session mentions: the roster, plus anyone a match schedules off it. */
function everyoneIn(session: Session): PlayerId[] {
  return [
    ...new Set([
      ...session.roster.map((entry) => entry.id),
      ...session.rounds.flatMap((round) => round.matches.flatMap(playersOf)),
    ]),
  ];
}

function emptyTally(): PlayerTally {
  return { matches: 0, benched: 0, partners: new Map(), opponents: new Map() };
}

function countOne(counts: Map<PlayerId, number>, id: PlayerId): void {
  counts.set(id, (counts.get(id) ?? 0) + 1);
}

function playersOf(match: Match): PlayerId[] {
  return [...match.sideA, ...match.sideB];
}

/** The left-hand gutter every round line starts with: `Court 1`, `Bench`. */
function label(text: string): string {
  return text.padEnd(9);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
