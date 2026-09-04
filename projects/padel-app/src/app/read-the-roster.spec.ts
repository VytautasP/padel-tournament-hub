/*
 * The Players tab read rather than driven: what one row actually says about one person.
 *
 * `change-the-roster.spec.ts` owns every way a roster *moves* — the preview, the dismissal, the
 * departure that keeps a standings line. This one owns the line itself, because the row is where
 * an organizer finds out what is true of somebody without asking them, and a row that says the
 * wrong thing is wrong long before anybody taps it.
 *
 * What is worth writing down is which of the things true of somebody the row actually says. In
 * Team Americano the pairing is what the tab is useless without — who plays with whom is exactly
 * what an organizer cannot work out from a column of names — so it survives a bye, which is only
 * true of one round. What it does not survive is `Went home` or `Needs partner`: those are not one
 * more fact about a player, they are the whole of what the row is now reporting, and a pairing set
 * beside either dilutes the one line on the screen that has to be noticed.
 *
 * The fixtures are chosen for whether anybody is on a bye, which is the only thing that varies the
 * answer: four teams on two courts when the bye would be noise, three on one when it is the point.
 */
import { createSession, createTeamAmericanoSession, storedSession } from './testing/session-driver';
import type { AppHarness } from './testing/app-harness';
import type { NamedPair } from './testing/session-driver';

const SIX = ['Ana', 'Ben', 'Cara', 'Dov', 'Elin', 'Finn'];

/** Four teams on two courts: everybody plays every round, and a team can afford to lose a half. */
const FOUR_TEAMS: readonly NamedPair[] = [
  ['Ana', 'Ben'],
  ['Cara', 'Dov'],
  ['Elin', 'Finn'],
  ['Gus', 'Hana'],
];

/** Three teams on one court: two play and one takes the bye, which is the badge under test. */
const THREE_TEAMS: readonly NamedPair[] = FOUR_TEAMS.slice(0, 3);

const TWO_COURTS = 2;

describe('reading the roster', () => {
  it('says which screen it is', async () => {
    const app = await createSession(SIX);

    await app.tap('Players');

    expect(app.shows('Players')).toBe(true);
  });

  it('says nothing about pairings in a mode that rotates partners, because there are none', async () => {
    const app = await createSession(SIX);

    await app.tap('Players');

    expect(app.shows(' & ')).toBe(false);
  });

  describe('in Team Americano', () => {
    it('names the team each player plays for, on their own row', async () => {
      const app = await createTeamAmericanoSession(FOUR_TEAMS, TWO_COURTS);

      await app.tap('Players');

      expect(app.shows('Ana Ana & Ben')).toBe(true);
      expect(app.shows('Ben Ana & Ben')).toBe(true);
      expect(app.shows('Hana Gus & Hana')).toBe(true);
    });

    it('goes on naming it while the team is on a bye', async () => {
      // The pairing holds all evening and the bye holds this round, so the row says both. Losing
      // the pairing for a whole team every round would empty the tab of the one thing it is for
      // in this format, on a rotation, for a reason that has nothing to do with pairs.
      const app = await createTeamAmericanoSession(THREE_TEAMS);
      const [first, second] = teamOnTheBye(app);

      await app.tap('Players');

      expect(app.shows(`${first} ${first} & ${second} Sitting out`)).toBe(true);
      expect(app.shows(`${second} ${first} & ${second} Sitting out`)).toBe(true);
    });

    it('says the flag instead, on the half of a pair whose partner went home', async () => {
      const app = await createTeamAmericanoSession(FOUR_TEAMS, TWO_COURTS);
      const { left, stayed } = await halfOfTheFirstTeamGoesHome(app);

      expect(app.shows(`${stayed} Needs partner`)).toBe(true);
      expect(app.shows(`${stayed} ${left} & ${stayed}`)).toBe(false);
    });

    it('keeps the player who left in the list, saying what happened rather than nothing', async () => {
      const app = await createTeamAmericanoSession(FOUR_TEAMS, TWO_COURTS);
      const { left } = await halfOfTheFirstTeamGoesHome(app);

      expect(app.shows(`${left} Went home`)).toBe(true);
    });

    it('goes back to naming the team once the pair is repaired', async () => {
      const app = await createTeamAmericanoSession(FOUR_TEAMS, TWO_COURTS);
      const { left, stayed } = await halfOfTheFirstTeamGoesHome(app);
      const orphaned = `${left} & ${stayed}`;

      await app.tap(`Assign partner to ${orphaned}`);
      await app.type('Name', 'Iris');
      await app.tap('Add');
      await app.tap(`Iris joins ${orphaned}`);

      expect(app.shows('Needs partner')).toBe(false);
      expect(app.shows(`${stayed} ${stayed} & Iris`)).toBe(true);
      expect(app.shows(`Iris ${stayed} & Iris`)).toBe(true);
    });
  });
});

/**
 * The names of the pair round 1 leaves off the court, in the order their team holds them.
 *
 * Read off the schedule rather than assumed, for the reason the badge itself is derived: which
 * team rests first is the scheduler's business, and a test that named one would be asserting its
 * own guess about a decision it does not make.
 */
function teamOnTheBye(app: AppHarness): readonly string[] {
  const session = storedSession(app);
  const playing = (session.rounds[0]?.matches ?? []).flatMap((match) => [
    match.teams?.sideA,
    match.teams?.sideB,
  ]);
  const resting = (session.teams ?? []).find((team) => !playing.includes(team.id));
  if (resting === undefined) {
    throw new Error('Every team is on a court in round 1.');
  }

  return resting.playerIds.map((id) => session.roster.find((entry) => entry.id === id)?.name ?? id);
}

/**
 * Send the first half of the first team home, and say who that was and who is left standing.
 *
 * The pairing is read off the document rather than assumed, for the reason the Team Americano spec
 * gives: which pair the wizard's taps became is the app's answer, and a test that guessed it would
 * be asserting its own guess.
 */
async function halfOfTheFirstTeamGoesHome(
  app: AppHarness,
): Promise<{ left: string; stayed: string }> {
  const session = storedSession(app);
  const [leaving, staying] = (session.teams ?? [])[0].playerIds;
  const nameOf = (id: string): string =>
    session.roster.find((entry) => entry.id === id)?.name ?? id;
  const left = nameOf(leaving);
  const stayed = nameOf(staying);

  await app.tap('Players');
  await app.tap(`Options for ${left}`);
  await app.tap('Went home');
  await app.tap(`${left} went home`);

  return { left, stayed };
}
