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
import { mixedPairingIn } from './mixed-pairing';
import type { Match, PlayerId, RosterEntry, Round, Session } from './model';
import { hasLeft, isAvailableIn, joinedAtRound, leftAfterRound } from './roster-availability';
import { courtsInPlay } from './session-shape';
import { teamLineupIn, teamPlayIn, teamsAvailableIn, teamsNeedingPartner } from './teams';

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
  const mixed = mixedPairingIn(session);
  const play = teamPlayIn(session);
  const rosterOrder = new Map(session.roster.map((entry, index) => [entry.id, index]));
  const stats = tallies(session);
  // Who is flagged `needs partner` (decision #2b) — the one state a Team Americano session can be
  // in that a reader cannot work out from the courts, because it shows up as an absence.
  const stranded = new Set(teamsNeedingPartner(session).map((orphan) => orphan.playerId));

  // A same-gender pair is marked where it is read, so the organizer standing in front of the
  // player who asks why can point at the line rather than remember (decision #7). The mark is
  // derived from the roster on the way out, never stored (ADR-0010).
  const pairLabel = (pair: readonly [PlayerId, PlayerId]): string =>
    `${nameOf(pair[0])} & ${nameOf(pair[1])}${mixed.sameGender(pair[0], pair[1]) ? ' *' : ''}`;

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
    // the sort of surprise a printout exists to surface. Read off the last round, because that is
    // the roster the session has now: people arrive and leave while it runs.
    const inPlay = courtsInPlay(session, session.rounds.length);
    const courts =
      inPlay === session.courtCount
        ? `${session.courtCount} court(s)`
        : `${session.courtCount} court(s), ${inPlay} in play`;

    // A finished session is said so out loud: the counts above look the same either way, and
    // whether the evening is still open is the first thing a reader of a printout wants to know.
    const finishedNote = session.status === 'finished' ? ['finished'] : [];

    // The legend for the marked pairs, once at the top rather than under every round that has
    // one — on a skewed roster that is every round, and a note repeated eleven times stops
    // being read. Absent when nothing is marked, which is the whole of Americano.
    const compromised = session.rounds.some((round) =>
      round.matches.some((match) =>
        [match.sideA, match.sideB].some((pair) => mixed.sameGender(pair[0], pair[1])),
      ),
    );

    return [
      `${titleCase(session.mode)} — ${session.id}`,
      [
        `${session.roster.length} players`,
        courts,
        `${generated}/${session.rounds.length} rounds generated`,
        `first to ${session.targetScore}`,
        ...finishedNote,
      ].join(' · '),
      ...(compromised ? ['* same-gender pair — the roster left nobody to mix with'] : []),
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
      // Only players this one could have been partnered with: someone who left before they
      // arrived was never a partner they could have had, and in Mixicano nor was anyone of the
      // same gender — that column is empty by design rather than by neglect. In Team Americano
      // the whole line is: a player has one partner all evening and is owed no others.
      const missing = play.plays
        ? []
        : session.roster
            .filter(
              (other) =>
                other.id !== entry.id &&
                !played.partners.has(other.id) &&
                !mixed.sameGender(entry.id, other.id) &&
                overlaps(entry, other),
            )
            .map((other) => nameOf(other.id));

      const lines = [
        `${nameOf(entry.id)}${genderNote(entry)}${windowNote(entry)}` +
          `${stranded.has(entry.id) ? ' (needs partner)' : ''} — played ${played.matches}, ` +
          `benched ${played.benched}`,
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

/**
 * Who sat this round out: on the roster, in the session for that round, able to be scheduled into
 * it, and off court. Someone who had not arrived yet, or had already gone home, is not on the
 * bench — they are not here. Nor is somebody whose partner has gone home: no bye fell on them,
 * there was simply no team for them to play in (decision #2b).
 */
function benchedIn(round: Round, session: Session): PlayerId[] {
  const playing = new Set(round.matches.flatMap(playersOf));
  const play = teamPlayIn(session);
  const onCall = new Set(
    teamsAvailableIn(session, round.number).flatMap((team) =>
      teamLineupIn(team, session.roster, round.number),
    ),
  );

  return session.roster
    .filter(
      (entry) =>
        isAvailableIn(entry, round.number) &&
        !playing.has(entry.id) &&
        (!play.plays || onCall.has(entry.id)),
    )
    .map((entry) => entry.id);
}

/** How a Mixicano roster shows the field it pairs across; empty where the mode has no use for it. */
function genderNote(entry: RosterEntry): string {
  return entry.gender === undefined ? '' : ` [${entry.gender}]`;
}

/** How a player who did not have the whole evening is labelled: `(from round 4)`, `(left after 6)`. */
function windowNote(entry: RosterEntry): string {
  const notes = [
    ...(joinedAtRound(entry) > 1 ? [`from round ${joinedAtRound(entry)}`] : []),
    ...(hasLeft(entry) ? [`left after round ${entry.leftAfterRound}`] : []),
  ];

  return notes.length > 0 ? ` (${notes.join(', ')})` : '';
}

/** Were these two ever in the session at the same time, and so ever able to be partners? */
function overlaps(a: RosterEntry, b: RosterEntry): boolean {
  return joinedAtRound(a) <= leftAfterRound(b) && joinedAtRound(b) <= leftAfterRound(a);
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

/** `team-americano` reads as `Team Americano`: a mode is a name, not an identifier, to a reader. */
function titleCase(value: string): string {
  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
