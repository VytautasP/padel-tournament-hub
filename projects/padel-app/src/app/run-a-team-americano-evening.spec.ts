/*
 * Team Americano at the DOM: the format whose competitor is a pair, run through the app.
 *
 * The engine already schedules it — teams face teams, a whole team takes the bye, and the
 * standings are the same ladder handed teams instead of players (ADR-0011). What the app owes it
 * is three surfaces: the screen where the organizer assigns the pairs, the strip that names a team
 * on a bye rather than two loose players, and the flag on the half of a pair whose partner went
 * home, with the repair beside it (ADR-0012).
 *
 * Two things here are tested harder than they look.
 *
 *   - **The pairing is the organizer's.** There is no draw and no seeding, so the test taps the
 *     pairs it means and then asserts the document holds exactly those — a screen that quietly
 *     rearranged them would still produce a valid session, and nobody would notice until four
 *     people walked onto a court with the wrong partner.
 *   - **A repaired team keeps its points.** That is only observable across a repair, so the team
 *     under test is the one the schedule actually put on court in round 1: it is read off the
 *     document rather than assumed, because which teams meet first is the scheduler's business.
 *
 * Everything else goes through the harness the way every spec here does: tapped labels and
 * rendered text, with the repository read only for what no screen says out loud.
 */
import type { Match, Session, Team } from 'padel-engine';
import { AppHarness } from './testing/app-harness';
import {
  createTeamAmericanoSession,
  endSession,
  matchOn,
  score,
  storedSession,
} from './testing/session-driver';
import type { NamedPair } from './testing/session-driver';

/** Two teams: one court, nobody on a bye, and the smallest evening this format can be. */
const TWO_TEAMS: readonly NamedPair[] = [
  ['Ana', 'Ben'],
  ['Cara', 'Dov'],
];

/** Three teams on one court: two play, one takes the bye, and a team can afford to lose a half. */
const THREE_TEAMS: readonly NamedPair[] = [
  ['Ana', 'Ben'],
  ['Cara', 'Dov'],
  ['Elin', 'Finn'],
];

describe('running a Team Americano evening', () => {
  describe('the pairing step', () => {
    it('is reached in Team Americano and in no other mode', async () => {
      const team = await atPairing(THREE_TEAMS);
      const americano = await atPlayers('Americano', namesOf(THREE_TEAMS));
      await americano.tap('Next');

      expect(team.shows('Who plays with whom?')).toBe(true);
      expect(americano.shows('Who plays with whom?')).toBe(false);
      expect(americano.shows('Review & create')).toBe(true);
    });

    it('holds the Players step on an odd roster, with the reason on screen', async () => {
      // Five rather than three: a roster of three is *too few*, which is a different sentence
      // about a different problem, and the step says one thing at a time.
      const app = await atPlayers('Team Americano', ['Ana', 'Ben', 'Cara', 'Dov', 'Elin']);

      expect(app.canTap('Next')).toBe(false);
      expect(
        app.shows('Team Americano plays in fixed pairs, so the roster needs an even number.'),
      ).toBe(true);
    });

    it('lets an even roster through, saying nothing more', async () => {
      const app = await atPlayers('Team Americano', ['Ana', 'Ben', 'Cara', 'Dov']);

      expect(app.canTap('Next')).toBe(true);
      expect(
        app.shows('Team Americano plays in fixed pairs, so the roster needs an even number.'),
      ).toBe(false);
    });

    it('says nothing about pairs to an odd Americano roster', async () => {
      const app = await atPlayers('Americano', ['Ana', 'Ben', 'Cara', 'Dov', 'Elin']);

      expect(app.canTap('Next')).toBe(true);
    });

    it('makes a team out of the two names that were tapped', async () => {
      const app = await atPairing(THREE_TEAMS);

      await app.tap('Pair Ana');
      await app.tap('Pair Ben');

      expect(app.shows('Ana & Ben')).toBe(true);
      expect(app.isOnScreen('Pair Ana')).toBe(false);
      expect(app.isOnScreen('Pair Cara')).toBe(true);
    });

    it('withholds Next until nobody is standing on their own', async () => {
      const app = await atPairing(THREE_TEAMS);
      await app.tap('Pair Ana');
      await app.tap('Pair Ben');

      expect(app.canTap('Next')).toBe(false);
      expect(app.shows('Every player needs a partner before the evening can be created.')).toBe(
        true,
      );

      await pairEveryone(app, THREE_TEAMS.slice(1));

      expect(app.canTap('Next')).toBe(true);
    });

    it('returns both names to the list when a pair is broken up', async () => {
      const app = await atPairing(THREE_TEAMS);
      await app.tap('Pair Ana');
      await app.tap('Pair Ben');

      await app.tap('Break up Ana & Ben');

      expect(app.shows('Ana & Ben')).toBe(false);
      expect(app.isOnScreen('Pair Ana')).toBe(true);
      expect(app.isOnScreen('Pair Ben')).toBe(true);
    });

    it('offers no draw and no seeding — the pairs are the ones that were tapped', async () => {
      const app = await createTeamAmericanoSession(THREE_TEAMS);

      expect(pairedNames(app)).toEqual([
        ['Ana', 'Ben'],
        ['Cara', 'Dov'],
        ['Elin', 'Finn'],
      ]);
      app.expectStoredSessionValid();
    });
  });

  describe('the round', () => {
    it('puts teams on court against teams', async () => {
      const app = await createTeamAmericanoSession(THREE_TEAMS);

      const match = matchOn(app);
      expect(sideNamesOf(app, match)).toEqual([
        teamNamed(app, match.teams?.sideA ?? ''),
        teamNamed(app, match.teams?.sideB ?? ''),
      ]);
    });

    it('names the team on a bye, not two loose players', async () => {
      const app = await createTeamAmericanoSession(THREE_TEAMS);

      expect(app.shows(`Bye: ${byeTeamName(app)}`)).toBe(true);
      expect(app.shows('Sitting out')).toBe(false);
    });

    it('carries no team labelling on a court card beyond the four names', async () => {
      const app = await createTeamAmericanoSession(TWO_TEAMS);
      const [sideA, sideB] = sideNamesOf(app, matchOn(app));

      expect(app.shows(`Court 1 ${sideA} v ${sideB} No score yet`)).toBe(true);
    });
  });

  describe('the standings', () => {
    it('ranks teams rather than players', async () => {
      const app = await createTeamAmericanoSession(TWO_TEAMS);
      await score(app, 17);

      await app.tap('Standings');

      expect(teamRowsOnScreen(app)).toEqual(['Ana & Ben', 'Cara & Dov']);
    });

    it('suggests a round count that is a rotation of teams, not of partnerships', async () => {
      const app = await createTeamAmericanoSession(THREE_TEAMS);

      // Three teams have three fixtures and one court plays one of them a round. Counting the
      // fifteen partnerships six players hold would plan an evening five times too long.
      expect(storedSession(app).rounds).toHaveLength(3);
    });

    it('renders a joint position the way it does for players', async () => {
      const app = await createTeamAmericanoSession(TWO_TEAMS);

      // Half the target each: the two teams are level on points per match, on total points and on
      // the head-to-head, so the engine declares them joint first and the app does not break it.
      await score(app, 12);
      await app.tap('Standings');

      expect(app.shows('1 Ana & Ben 12.0')).toBe(true);
      expect(app.shows('1 Cara & Dov 12.0')).toBe(true);
    });
  });

  describe('losing half a pair', () => {
    it('flags the other half where the organizer is looking', async () => {
      const app = await createTeamAmericanoSession(THREE_TEAMS);
      await sendHalfHome(app);

      expect(app.shows('Needs partner')).toBe(true);
      expect(app.canTap(`Assign partner to ${orphanedTeamName(app)}`)).toBe(true);
      app.expectStoredSessionValid();
    });

    it('schedules the orphaned team into no later round', async () => {
      const app = await createTeamAmericanoSession(THREE_TEAMS);
      const { teamId } = await sendHalfHome(app);

      expect(teamsScheduledFrom(app, 1)).not.toContain(teamId);
      app.expectStoredSessionValid();
    });

    it('offers the stranded player a picker of players who are not on a team', async () => {
      const app = await createTeamAmericanoSession(THREE_TEAMS);
      await sendHalfHome(app);

      await app.tap(`Assign partner to ${orphanedTeamName(app)}`);

      expect(app.shows('Assign a partner')).toBe(true);
      expect(app.shows('Everyone here already has a partner, so a new name joins the team.')).toBe(
        true,
      );
    });

    it('repairs the team through the regeneration preview', async () => {
      const app = await createTeamAmericanoSession(THREE_TEAMS);
      const { teamId } = await sendHalfHome(app);
      const team = orphanedTeamName(app);

      await app.tap(`Assign partner to ${team}`);
      await app.type('Name', 'Gita');
      await app.tap('Add');

      expect(app.shows('The rest of the evening')).toBe(true);

      await app.tap(`Gita joins ${team}`);

      expect(app.shows('Needs partner')).toBe(false);
      expect(teamsScheduledFrom(app, 1)).toContain(teamId);
      app.expectStoredSessionValid();
    });

    it('keeps every point the repaired team had already won', async () => {
      const app = await createTeamAmericanoSession(THREE_TEAMS);
      await score(app, 17);
      const { teamId, partner } = await sendHalfHome(app, playedFirst(app));

      await repair(app, 'Gita');

      await app.tap('Standings');
      expect(app.shows(`${partner} & Gita 17.0`)).toBe(true);
      expect(pointsOf(app, teamId)).toBe(17);
      app.expectStoredSessionValid();
    });

    it('takes the team with the stranded player when they go home too', async () => {
      const app = await createTeamAmericanoSession(THREE_TEAMS);
      const { teamId, partner } = await sendHalfHome(app);

      await goHome(app, partner);

      expect(teamsScheduledFrom(app, 1)).not.toContain(teamId);
      expect(app.shows('Needs partner')).toBe(false);
      app.expectStoredSessionValid();
    });

    it('offers nobody the door once a departure would leave one team standing', async () => {
      const app = await createTeamAmericanoSession(TWO_TEAMS);
      await app.tap('Players');

      expect(app.isOnScreen('Options for Ana')).toBe(false);
      // The reason is the one that applies: four players is not the number this evening is short
      // of, and it has eight of them once a third team turns up.
      expect(
        app.shows('A round needs 2 teams with both their players, so nobody can go home'),
      ).toBe(true);
      expect(app.shows('A session needs at least 4 players')).toBe(false);
    });

    it('offers the last full half of a third team no door either', async () => {
      const app = await createTeamAmericanoSession(THREE_TEAMS);
      const { partner } = await sendHalfHome(app);

      // Two full teams and one orphan: the stranded half can still leave, because their team is
      // taking no court anyway, and nobody else can without emptying the courts.
      expect(app.canTap(`Options for ${partner}`)).toBe(true);
      expect(app.isOnScreen('Options for Cara')).toBe(false);
    });
  });

  describe('a late arrival', () => {
    it('offers no lone arrival, and says where the one this format has lives', async () => {
      const app = await createTeamAmericanoSession(THREE_TEAMS);

      await app.tap('Players');

      expect(app.hasField('Name')).toBe(false);
      expect(app.isOnScreen('Add')).toBe(false);
      expect(
        app.shows(
          'Team Americano plays in fixed pairs, so a new player joins a team that needs a partner.',
        ),
      ).toBe(true);
    });
  });

  describe('the whole evening', () => {
    it('runs create, pair, score, page, orphan, repair, the ending and history', async () => {
      const app = await createTeamAmericanoSession(THREE_TEAMS);
      const roundCount = storedSession(app).rounds.length;

      await score(app, 17);
      await app.tap('Round 2 →');
      expect(app.shows(`Round 2 of ${roundCount}`)).toBe(true);
      await score(app, 13);

      await app.tap('Previous round');
      expect(app.shows('17 – 7')).toBe(true);
      await app.tap('Back to current round');
      app.expectStoredSessionValid();

      const { partner } = await sendHalfHome(app);
      expect(app.shows('Needs partner')).toBe(true);
      await repair(app, 'Gita');
      expect(app.shows('Needs partner')).toBe(false);
      app.expectStoredSessionValid();

      await app.tap('Standings');
      expect(app.shows(`${partner} & Gita`)).toBe(true);

      await endSession(app);
      app.expectEndedSessionValid();

      await app.tap('Done');
      expect(app.shows('Session history')).toBe(true);
      expect(app.shows('Team Americano · 7 players')).toBe(true);
    });
  });
});

/** Walk the wizard to the Players step in one mode, with these names typed in. */
async function atPlayers(mode: string, names: readonly string[]): Promise<AppHarness> {
  const app = await AppHarness.launch();
  await app.tap('New session');
  await app.tap(mode);

  for (const name of names) {
    await app.type('Name', name);
    await app.tap('Add');
  }

  return app;
}

/** Walk the wizard to the pairing step, with the roster typed in and nobody paired yet. */
async function atPairing(pairs: readonly NamedPair[]): Promise<AppHarness> {
  const app = await atPlayers('Team Americano', namesOf(pairs));
  await app.tap('Next');

  return app;
}

async function pairEveryone(app: AppHarness, pairs: readonly NamedPair[]): Promise<void> {
  for (const [first, second] of pairs) {
    await app.tap(`Pair ${first}`);
    await app.tap(`Pair ${second}`);
  }
}

function namesOf(pairs: readonly NamedPair[]): readonly string[] {
  return pairs.flat();
}

/** The pairing the document holds, as names, in the order the teams were made. */
function pairedNames(app: AppHarness): string[][] {
  const session = storedSession(app);

  return (session.teams ?? []).map((team) => team.playerIds.map((id) => nameOf(session, id)));
}

/** The two sides of a match, spelled the way a court card spells them. */
function sideNamesOf(app: AppHarness, match: Match): string[] {
  const session = storedSession(app);

  return [match.sideA, match.sideB].map((side) =>
    side.map((id) => nameOf(session, id)).join(' & '),
  );
}

/** One team, named by the pair it fields now. */
function teamNamed(app: AppHarness, teamId: string): string {
  const session = storedSession(app);

  return teamOf(session, teamId)
    .playerIds.map((id) => nameOf(session, id))
    .join(' & ');
}

/** The team the round on screen leaves off the court, named as the strip names it. */
function byeTeamName(app: AppHarness): string {
  const session = storedSession(app);
  const match = matchOn(app);
  const playing = [match.teams?.sideA, match.teams?.sideB];
  const resting = (session.teams ?? []).find((team) => !playing.includes(team.id));
  if (resting === undefined) {
    throw new Error('Every team is on a court.');
  }

  return teamNamed(app, resting.id);
}

/** The teams the schedule holds from this round onwards — every round nobody has played yet. */
function teamsScheduledFrom(app: AppHarness, fromRound: number): string[] {
  return storedSession(app)
    .rounds.filter((round) => round.number > fromRound)
    .flatMap((round) =>
      round.matches.flatMap((match) => (match.teams ? [match.teams.sideA, match.teams.sideB] : [])),
    );
}

/** The team that took the first court of round 1 — the one with points to keep across a repair. */
function playedFirst(app: AppHarness): string {
  const teamId = matchOn(app, 1).teams?.sideA;
  if (teamId === undefined) {
    throw new Error('The match on screen was played by nobody.');
  }

  return teamId;
}

/**
 * Send one half of a team home, and say which team it was and who is left.
 *
 * The team defaults to the first one the document holds, because for most of these tests any team
 * will do — what matters is that a pair loses a half, not which pair.
 */
async function sendHalfHome(
  app: AppHarness,
  teamId?: string,
): Promise<{ teamId: string; partner: string }> {
  const session = storedSession(app);
  const team = teamOf(session, teamId ?? (session.teams ?? [])[0].id);
  const [leaving, staying] = team.playerIds;

  await goHome(app, nameOf(session, leaving));

  return { teamId: team.id, partner: nameOf(session, staying) };
}

/** Record that a player went home, from the row that says so, through the preview. */
async function goHome(app: AppHarness, name: string): Promise<void> {
  await app.tap('Players');
  await app.tap(`Options for ${name}`);
  await app.tap('Went home');
  await app.tap(`${name} went home`);
}

/** Repair whichever team is short a player, with a partner of this name. */
async function repair(app: AppHarness, name: string): Promise<void> {
  await app.tap('Players');
  const team = orphanedTeamName(app);
  await app.tap(`Assign partner to ${team}`);
  await app.type('Name', name);
  await app.tap('Add');
  await app.tap(`${name} joins ${team}`);
}

/** The team that is one player short, named by the pair it still fields. */
function orphanedTeamName(app: AppHarness): string {
  const session = storedSession(app);
  const short = (session.teams ?? []).find(
    (team) => team.playerIds.filter((id) => isHere(session, id)).length === 1,
  );
  if (short === undefined) {
    throw new Error('No team is short a player.');
  }

  return teamNamed(app, short.id);
}

/** The team names the Standings tab has on screen, in the order the document holds the teams. */
function teamRowsOnScreen(app: AppHarness): string[] {
  const session = storedSession(app);

  return (session.teams ?? [])
    .map((team) => teamNamed(app, team.id))
    .filter((name) => app.shows(name));
}

/** The points one team has, read off the matches the document holds. */
function pointsOf(app: AppHarness, teamId: string): number {
  return storedSession(app)
    .rounds.flatMap((round) => round.matches)
    .reduce((total, match) => {
      if (match.score === undefined || match.teams === undefined) {
        return total;
      }
      if (match.teams.sideA === teamId) {
        return total + match.score.sideA;
      }

      return match.teams.sideB === teamId ? total + match.score.sideB : total;
    }, 0);
}

function teamOf(session: Session, teamId: string): Team {
  const team = (session.teams ?? []).find((candidate) => candidate.id === teamId);
  if (team === undefined) {
    throw new Error(`This session has no team "${teamId}".`);
  }

  return team;
}

function nameOf(session: Session, playerId: string): string {
  return session.roster.find((entry) => entry.id === playerId)?.name ?? playerId;
}

function isHere(session: Session, playerId: string): boolean {
  const entry = session.roster.find((candidate) => candidate.id === playerId);

  return entry !== undefined && entry.leftAfterRound === undefined;
}
