/*
 * One round, turned from ids into the words on the screen.
 *
 * The engine's document is all `PlayerId`s, because identity is by id and never by name
 * (decision #9). The screen is all names, because four people walking to a court do not know
 * their ids. This is that translation, and it is a plain function so the shape of a round can be
 * checked without rendering one.
 *
 * The bench is derived rather than read: the engine stores who is playing, and whoever the round
 * does not name is sitting out. Deriving it is what keeps it honest when a roster changes under
 * an already-generated round.
 */
import type { PlayerId, Session } from 'padel-engine';

export interface CourtView {
  readonly courtNumber: number;
  readonly sideA: readonly string[];
  readonly sideB: readonly string[];
  /** Absent while the court is still playing, or its result has not reached the organizer. */
  readonly score?: { readonly sideA: number; readonly sideB: number };
}

export interface RoundView {
  readonly number: number;
  readonly courts: readonly CourtView[];
  /** The players this round does not put on a court. Empty when the roster fits exactly. */
  readonly bench: readonly string[];
}

export function roundView(session: Session, roundNumber: number): RoundView | null {
  const round = session.rounds.find((candidate) => candidate.number === roundNumber);
  if (round === undefined || round.matches.length === 0) {
    return null;
  }

  const nameOf = (id: PlayerId): string =>
    session.roster.find((entry) => entry.id === id)?.name ?? id;

  const playing = new Set(
    round.matches.flatMap((match) => [...match.sideA, ...match.sideB]) as PlayerId[],
  );

  return {
    number: round.number,
    courts: round.matches.map((match) => ({
      courtNumber: match.courtNumber,
      sideA: match.sideA.map(nameOf),
      sideB: match.sideB.map(nameOf),
      ...(match.score ? { score: match.score } : {}),
    })),
    bench: session.roster
      .filter((entry) => !playing.has(entry.id))
      .filter((entry) =>
        isPlayingThisEvening(entry.leftAfterRound, entry.joinedAtRound, roundNumber),
      )
      .map((entry) => entry.name),
  };
}

/**
 * Whether a roster entry counts as benched in this round rather than simply not here yet, or
 * gone home. Someone who left after round 3 is not "sitting out" round 5 — they are at home, and
 * naming them on the bench strip would send somebody looking for them.
 */
function isPlayingThisEvening(
  leftAfterRound: number | undefined,
  joinedAtRound: number | undefined,
  roundNumber: number,
): boolean {
  return (joinedAtRound ?? 1) <= roundNumber && roundNumber <= (leftAfterRound ?? Infinity);
}
