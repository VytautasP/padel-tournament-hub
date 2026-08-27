/*
 * Driving an evening through the app, for the specs that are about something else.
 *
 * Every spec here needs a session before it can test anything, and creating one means walking the
 * wizard: a mode, a roster typed name by name, Review, Create. Written out in each spec that is
 * forty lines of setup nobody reads, repeated with small variations that slowly stop matching.
 * So it lives here once, and a spec opens with the evening it is about rather than with the
 * wizard.
 *
 * These are drivers, not a second harness. Everything below goes through `AppHarness` — tapping
 * labels, typing into fields, reading rendered text — with one exception: the repository is read
 * to find out who the engine put on a court, because that is the one thing about a generated
 * schedule a test cannot spell out in advance, and it is what the score sheet's field labels are
 * going to say.
 */
import type { Gender, Match, MatchScore, Session } from 'padel-engine';
import { AppHarness } from './app-harness';
import type { NewPlayer } from '../session/session-store';

/**
 * A player on a Mixicano roster, as a spec spells one: the app's `NewPlayer` with the half that
 * is optional everywhere else answered.
 *
 * Not `MixedPlayer` — CONTEXT.md reserves *mixed* for a pair. A player has a gender; a pair is
 * mixed or same-gender, and a type that blurred the two would teach the wrong word to every spec
 * that reads it.
 */
export type MixicanoPlayer = NewPlayer & { readonly gender: Gender };

/** Who is on each side of a court, as the score sheet spells them: the sheet's two field labels. */
export interface Sides {
  readonly a: string;
  readonly b: string;
}

/** Create an Americano through the wizard, changing only what the caller asks to change. */
export async function createSession(
  names: readonly string[],
  courtCount = 1,
  targetScore = 24,
): Promise<AppHarness> {
  const app = await AppHarness.launch();
  await app.tap('New session');
  await app.tap('Americano');

  for (const name of names) {
    await app.type('Name', name);
    await app.tap('Add');
  }

  return await review(app, courtCount, targetScore);
}

/**
 * Create a Mixicano through the wizard: the same walk, plus the one thing this mode asks.
 *
 * A separate driver rather than an option on the one above, because the roster it takes is a
 * different shape — a Mixicano roster is names *and* genders, and there is no default the
 * wizard would fill in for a caller that left them out.
 */
export async function createMixicanoSession(
  players: readonly MixicanoPlayer[],
  courtCount = 1,
  targetScore = 24,
): Promise<AppHarness> {
  const app = await AppHarness.launch();
  await app.tap('New session');
  await app.tap('Mixicano');

  for (const player of players) {
    await app.type('Name', player.name);
    await app.tap('Add');
    await app.tap(`${player.name} is a ${player.gender}`);
  }

  return await review(app, courtCount, targetScore);
}

/**
 * A pair the organizer assigns on the pairing step, as a spec spells one.
 *
 * Two names rather than two ids, because ids do not exist yet: the pairing screen is walked before
 * the session it describes has been created, and the names are what is on screen to tap.
 */
export type DraftPair = readonly [string, string];

/**
 * Create a Team Americano through the wizard: the same walk, plus the step that pairs the roster.
 *
 * The roster is given as pairs rather than as names and a pairing, because in this format the two
 * are the same fact — there is no draw, so a Team Americano roster *is* a list of teams
 * (decision #2a).
 */
export async function createTeamAmericanoSession(
  pairs: readonly DraftPair[],
  courtCount = 1,
  targetScore = 24,
): Promise<AppHarness> {
  const app = await AppHarness.launch();
  await app.tap('New session');
  await app.tap('Team Americano');

  for (const name of pairs.flat()) {
    await app.type('Name', name);
    await app.tap('Add');
  }

  await app.tap('Next');
  for (const [first, second] of pairs) {
    await app.tap(`Pair ${first}`);
    await app.tap(`Pair ${second}`);
  }

  return await review(app, courtCount, targetScore);
}

/** The tail of every wizard walk: Next, whatever Review has to be told, Create. */
async function review(
  app: AppHarness,
  courtCount: number,
  targetScore: number,
): Promise<AppHarness> {
  await app.tap('Next');
  if (courtCount !== 1) {
    await app.setNumber('Courts', courtCount);
  }
  if (targetScore !== 24) {
    await app.setNumber('Target score', targetScore);
  }
  await app.tap('Create session');

  return app;
}

/**
 * End the evening the way the organizer does: from the Standings tab, through the confirmation.
 *
 * Both taps say `End session`, because both buttons do. Only one of them is on screen at a time —
 * the sheet hides everything behind it — which is what makes tapping by label unambiguous here.
 */
export async function endSession(app: AppHarness): Promise<void> {
  await app.tap('Standings');
  await app.tap('End session');
  await app.tap('End session');
}

/** Open the score sheet for one court of the round on screen. */
export async function openSheet(app: AppHarness, courtNumber = 1): Promise<Sides> {
  const sides = sidesOn(app, courtNumber);
  await app.tap(`Enter score for Court ${courtNumber}`);

  return sides;
}

/** Score one court of the round on screen, entering `points` for the side the engine put first. */
export async function score(app: AppHarness, points: number, courtNumber = 1): Promise<Sides> {
  const sides = await openSheet(app, courtNumber);
  await app.setNumber(sides.a, points);
  await app.tap('Save');

  return sides;
}

/** Who the engine put on each side of a court of the round on screen. */
export function sidesOn(app: AppHarness, courtNumber = 1): Sides {
  const session = storedSession(app);
  const match = matchOn(app, courtNumber);
  const nameOf = (id: string): string =>
    session.roster.find((entry) => entry.id === id)?.name ?? id;

  return {
    a: match.sideA.map(nameOf).join(' & '),
    b: match.sideB.map(nameOf).join(' & '),
  };
}

/** What the repository is holding for one court of the round on screen. */
export function matchOn(app: AppHarness, courtNumber = 1): Match {
  const roundNumber = shownRoundNumber(app);
  const round = storedSession(app).rounds.find((candidate) => candidate.number === roundNumber);
  const match = round?.matches.find((candidate) => candidate.courtNumber === courtNumber);
  if (match === undefined) {
    throw new Error(`Round ${roundNumber} has no court ${courtNumber}.`);
  }

  return match;
}

export function scoreOf(app: AppHarness, courtNumber = 1): MatchScore | undefined {
  return matchOn(app, courtNumber).score;
}

/**
 * Which round the organizer is looking at, read off the header they are looking at.
 *
 * Taken from the screen rather than from the store because every driver below is addressed to
 * "the court in front of me", and the screen is the only thing that knows which round that is.
 */
export function shownRoundNumber(app: AppHarness): number {
  const heading = /Round (\d+) of/.exec(app.text());
  if (heading === null) {
    throw new Error(`No round is on screen. On screen: ${app.text()}`);
  }

  return Number(heading[1]);
}

/**
 * The id the session gave one of its players.
 *
 * Every spec that says something about a named player has to cross from the name it typed to the
 * id the document holds, because identity is by id and never by name (decision #9).
 */
export function idOf(app: AppHarness, name: string): string {
  const entry = storedSession(app).roster.find((candidate) => candidate.name === name);
  if (entry === undefined) {
    throw new Error(`Nobody called ${name} is on the roster.`);
  }

  return entry.id;
}

export function storedSession(app: AppHarness): Session {
  const record = app.repository.activeRecord();
  if (record === null) {
    throw new Error('The repository holds no session.');
  }

  return record.session;
}
