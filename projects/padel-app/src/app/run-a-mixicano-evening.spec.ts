/*
 * Mixicano at the DOM: the two surfaces the format needs, and an evening run through both.
 *
 * The engine already schedules Mixicano — the bench rotation, the partner search and the prefix
 * fairness are Americano's, with one more cost term (ADR-0010). What the app owes it is the
 * gender the scheduler pairs on, collected where a roster grows, and the mark that explains a
 * pairing the roster forced.
 *
 * Two things here are tested harder than they look.
 *
 *   - **The toggle has no default.** A guessed gender does not fail loudly: it silently produces
 *     a wrong pairing rule the schedule then honours all evening. So the untouched state is
 *     asserted directly — neither half pressed — as well as through the step it holds.
 *   - **The mixing choice costs courts, and the price is on screen before it is paid.** Strict
 *     mixing is what a Mixicano does unless the organizer says otherwise (ADR-0036), and on a
 *     skewed roster it plays fewer courts than were booked. So the count beside the toggle is
 *     asserted as the genders are typed, the roster it cannot seat at all is held at the step, and
 *     the evening that results names the court it left empty.
 *   - **The mark is derived, never stored.** The proof is a gender corrected in the document and
 *     the app opened again: a round played an hour ago re-marks, which a stored flag could not
 *     do. That correction is written through the repository rather than tapped, because the app
 *     has no screen for correcting a gender — the fact under test is where the mark comes from,
 *     not how a typo is fixed.
 *
 * Everything else goes through the harness the way every spec here does: tapped labels and
 * rendered text, with the repository read only for what no screen says out loud.
 */
import type { Gender } from 'padel-engine';
import { AppHarness } from './testing/app-harness';
import {
  createMixicanoSession,
  createSession,
  endSession,
  matchOn,
  score,
  showsScore,
  storedSession,
} from './testing/session-driver';
import type { MixicanoPlayer } from './testing/session-driver';
import type { Tier } from './layout/layout';

/** Two of each: every court can be filled with mixed pairs, so nothing is ever marked. */
const EVEN_FOUR: readonly MixicanoPlayer[] = [
  { name: 'Ana', gender: 'woman' },
  { name: 'Ben', gender: 'man' },
  { name: 'Cara', gender: 'woman' },
  { name: 'Dov', gender: 'man' },
];

/**
 * Three women and one man: under hybrid fill one same-gender pair is arithmetic rather than a
 * scheduling failure, and strict mixing refuses the roster outright (ADR-0036 §5).
 */
const SKEWED_FOUR: readonly MixicanoPlayer[] = [
  { name: 'Ana', gender: 'woman' },
  { name: 'Bea', gender: 'woman' },
  { name: 'Cara', gender: 'woman' },
  { name: 'Dov', gender: 'man' },
];

const EVEN_SIX: readonly MixicanoPlayer[] = [
  ...EVEN_FOUR,
  { name: 'Elin', gender: 'woman' },
  { name: 'Finn', gender: 'man' },
];

/**
 * Seven women and three men: the roster ADR-0036 §2 names. Strict mixing seats it on one of the
 * two courts booked and sits six people down, where hybrid fill would have seated eight.
 */
const SEVEN_AND_THREE: readonly MixicanoPlayer[] = [
  { name: 'Ana', gender: 'woman' },
  { name: 'Bea', gender: 'woman' },
  { name: 'Cara', gender: 'woman' },
  { name: 'Dana', gender: 'woman' },
  { name: 'Elin', gender: 'woman' },
  { name: 'Gina', gender: 'woman' },
  { name: 'Hana', gender: 'woman' },
  { name: 'Finn', gender: 'man' },
  { name: 'Gus', gender: 'man' },
  { name: 'Hal', gender: 'man' },
];

/** Four women and two men: one strict court, and a roster one departure from having none. */
const FOUR_AND_TWO: readonly MixicanoPlayer[] = [
  { name: 'Ana', gender: 'woman' },
  { name: 'Bea', gender: 'woman' },
  { name: 'Cara', gender: 'woman' },
  { name: 'Dana', gender: 'woman' },
  { name: 'Finn', gender: 'man' },
  { name: 'Gus', gender: 'man' },
];

/** Five women and one man, which is the roster nobody's evening divides evenly into. */
const LOPSIDED_SIX: readonly MixicanoPlayer[] = [
  { name: 'Ana', gender: 'woman' },
  { name: 'Bea', gender: 'woman' },
  { name: 'Cara', gender: 'woman' },
  { name: 'Dana', gender: 'woman' },
  { name: 'Elin', gender: 'woman' },
  { name: 'Finn', gender: 'man' },
];

describe('running a Mixicano evening', () => {
  describe('the gender toggle', () => {
    it('is on every name row in Mixicano, and on none in Americano', async () => {
      const mixicano = await atPlayers('Mixicano', ['Ana', 'Ben']);
      const americano = await atPlayers('Americano', ['Ana', 'Ben']);

      for (const name of ['Ana', 'Ben']) {
        expect(mixicano.isOnScreen(`${name} is a woman`)).toBe(true);
        expect(mixicano.isOnScreen(`${name} is a man`)).toBe(true);
        expect(americano.isOnScreen(`${name} is a woman`)).toBe(false);
        expect(americano.isOnScreen(`${name} is a man`)).toBe(false);
      }
    });

    it('opens holding neither answer', async () => {
      const app = await atPlayers('Mixicano', ['Ana']);

      expect(app.isPressed('Ana is a woman')).toBe(false);
      expect(app.isPressed('Ana is a man')).toBe(false);
    });

    it('holds the chosen answer, and only that one', async () => {
      const app = await atPlayers('Mixicano', ['Ana']);

      await app.tap('Ana is a woman');

      expect(app.isPressed('Ana is a woman')).toBe(true);
      expect(app.isPressed('Ana is a man')).toBe(false);
    });

    it('changes its mind on the other half of the toggle', async () => {
      const app = await atPlayers('Mixicano', ['Ana']);

      await app.tap('Ana is a woman');
      await app.tap('Ana is a man');

      expect(app.isPressed('Ana is a man')).toBe(true);
      expect(app.isPressed('Ana is a woman')).toBe(false);
    });

    it('holds the Players step while any row is untouched, with the reason on screen', async () => {
      const app = await atPlayers('Mixicano', namesOf(EVEN_FOUR));

      for (const player of EVEN_FOUR.slice(0, 3)) {
        await app.tap(`${player.name} is a ${player.gender}`);
      }

      expect(app.canTap('Next')).toBe(false);
      expect(app.shows('Mixicano pairs across gender, so every player needs one.')).toBe(true);
    });

    it('lets the step through once the last row is answered, and says nothing more', async () => {
      const app = await atPlayers('Mixicano', namesOf(EVEN_FOUR));

      for (const player of EVEN_FOUR) {
        await app.tap(`${player.name} is a ${player.gender}`);
      }

      expect(app.canTap('Next')).toBe(true);
      expect(app.shows('Mixicano pairs across gender, so every player needs one.')).toBe(false);
    });

    it('asks nothing of an Americano roster', async () => {
      const app = await atPlayers('Americano', namesOf(EVEN_FOUR));

      expect(app.canTap('Next')).toBe(true);
    });

    it('drops the answers when the mode stops asking for them', async () => {
      const app = await atPlayers('Mixicano', namesOf(EVEN_FOUR));
      for (const player of EVEN_FOUR) {
        await app.tap(`${player.name} is a ${player.gender}`);
      }

      // Back to the mode step and out the other side: this is an Americano now, and a gender on
      // its roster would be an answer to a question the evening never put.
      await app.tap('Back');
      await app.tap('Americano');
      await app.tap('Next');
      await app.tap('Create session');

      expect([...gendersOf(app).values()]).toEqual([undefined, undefined, undefined, undefined]);
      app.expectStoredSessionValid();
    });

    it('puts what was tapped on the roster the session is built from', async () => {
      const app = await createMixicanoSession(EVEN_FOUR);

      expect(gendersOf(app)).toEqual(
        new Map(EVEN_FOUR.map((player) => [player.name, player.gender])),
      );
      app.expectStoredSessionValid();
    });
  });

  describe('a late arrival', () => {
    it('offers no Add until the arrival has a gender, and says why', async () => {
      const app = await createMixicanoSession(EVEN_SIX);
      await app.tap('Players');

      await app.type('Name', 'Gita');

      expect(app.isOnScreen('Add')).toBe(false);
      expect(app.shows('Mixicano pairs across gender, so a new player needs one.')).toBe(true);
    });

    it('offers it the moment the toggle is answered', async () => {
      const app = await createMixicanoSession(EVEN_SIX);
      await app.tap('Players');
      await app.type('Name', 'Gita');

      await app.tap('Woman');

      expect(app.canTap('Add')).toBe(true);
      expect(app.shows('Mixicano pairs across gender, so a new player needs one.')).toBe(false);
    });

    it('takes the arrival on with the gender that was chosen', async () => {
      const app = await createMixicanoSession(EVEN_SIX);
      await app.tap('Players');

      await app.type('Name', 'Gita');
      await app.tap('Man');
      await app.tap('Add');
      await app.tap('Add Gita');

      expect(gendersOf(app).get('Gita')).toBe('man');
      app.expectStoredSessionValid();
    });

    it('asks the question again from nothing for the next arrival', async () => {
      const app = await createMixicanoSession(EVEN_SIX);
      await app.tap('Players');
      await app.type('Name', 'Gita');
      await app.tap('Man');
      await app.tap('Add');
      await app.tap('Add Gita');

      expect(app.isPressed('Man')).toBe(false);
      expect(app.isPressed('Woman')).toBe(false);
      expect(app.isOnScreen('Add')).toBe(false);
    });

    it('asks nothing of a late arrival to an Americano evening', async () => {
      const app = await createSession(namesOf(EVEN_SIX));
      await app.tap('Players');

      await app.type('Name', 'Gita');

      expect(app.isOnScreen('Woman')).toBe(false);
      expect(app.canTap('Add')).toBe(true);
    });
  });

  describe('the same-gender mark', () => {
    it('marks the side the roster forced together, and explains it once', async () => {
      const app = await createMixicanoSession(SKEWED_FOUR, 'hybrid');

      const marked = markedSideNames(app);
      expect(marked).toHaveLength(1);
      expect(app.shows(`${marked[0]} *`)).toBe(true);
      expect(
        app.shows('* Same-gender pair: the roster left nobody of the other gender to partner.'),
      ).toBe(true);
    });

    it('marks nothing on an evening that divides evenly', async () => {
      const app = await createMixicanoSession(EVEN_FOUR);

      expect(markedSideNames(app)).toEqual([]);
      expect(app.shows('*')).toBe(false);
    });

    it('marks nothing in Americano, whatever the roster', async () => {
      const app = await createSession(namesOf(SKEWED_FOUR));

      expect(app.shows('*')).toBe(false);
    });

    it('explains the mark on the preview of a regenerated schedule too', async () => {
      const app = await createMixicanoSession(SKEWED_FOUR, 'hybrid');
      await app.tap('Players');

      await app.type('Name', 'Gita');
      await app.tap('Woman');
      await app.tap('Add');

      // Four women and one man: whoever the four on court are, one pair of them is forced. The
      // preview renders the same court card as the Round tab, so it owes the same explanation.
      expect(app.shows('The rest of the evening')).toBe(true);
      expect(
        app.shows('* Same-gender pair: the roster left nobody of the other gender to partner.'),
      ).toBe(true);
    });

    it('re-marks a round already played when a gender is corrected', async () => {
      const app = await createMixicanoSession(SKEWED_FOUR, 'hybrid');
      await score(app, 17);
      expect(markedSideNames(app)).toHaveLength(1);

      // Dov was typed as a man by mistake; the document is corrected and the app opened again.
      // Nothing about round 1 changes except the roster it is read against.
      const corrected = await reopenWith(app, 'Dov', 'woman');
      await corrected.tap('Previous round');

      // Four women now: two same-gender pairs where there was one, on a round that was played an
      // hour ago. A flag stored on the match could not have moved.
      expect(markedSideNames(corrected)).toHaveLength(2);
      expect(scoredSideOf(corrected)).toBe(17);
    });
  });

  describe('the mixing choice', () => {
    it('is offered by Mixicano only, and opens holding strict', async () => {
      const mixicano = await atPlayers('Mixicano', ['Ana']);
      const americano = await atPlayers('Americano', ['Ana']);
      const teams = await atPlayers('Team Americano', ['Ana']);

      expect(mixicano.isPressed('Strict mixing')).toBe(true);
      expect(mixicano.isPressed('Hybrid fill')).toBe(false);
      expect(americano.isOnScreen('Strict mixing')).toBe(false);
      expect(teams.isOnScreen('Strict mixing')).toBe(false);
    });

    it('takes the other rule when it is tapped, and says what that one does', async () => {
      const app = await atPlayers('Mixicano', ['Ana']);
      expect(app.shows('No pair shares a gender. Whoever is left over sits out.')).toBe(true);

      await app.tap('Hybrid fill');

      expect(app.isPressed('Hybrid fill')).toBe(true);
      expect(app.isPressed('Strict mixing')).toBe(false);
      expect(app.shows('No pair shares a gender. Whoever is left over sits out.')).toBe(false);
      expect(
        app.shows(
          'Every court filled. The same-gender pairs the roster forces are marked on the schedule.',
        ),
      ).toBe(true);
    });

    /*
     * The wizard is one centred column at every width (ADR-0022 §4), so what can be asserted is
     * that widening it does not produce a second control or drop the one there is — the same
     * question `walk-the-creation-wizard.spec.ts` asks of the steps themselves.
     */
    it('is the same one control at every width', async () => {
      for (const tier of ['phone', 'wide', 'desk'] as const satisfies readonly Tier[]) {
        const app = await atPlayers('Mixicano', namesOf(EVEN_FOUR), tier);
        for (const player of EVEN_FOUR) {
          await app.tap(`${player.name} is a ${player.gender}`);
        }

        expect(app.isPressed('Strict mixing')).toBe(true);
        expect(app.shows('Fills 1 of 1 court.')).toBe(true);
      }
    });

    it('counts the courts this roster fills as the genders are typed', async () => {
      const app = await atPlayers('Mixicano', namesOf(EVEN_FOUR));

      expect(app.shows('Fills 0 of 1 court.')).toBe(true);

      for (const player of EVEN_FOUR) {
        await app.tap(`${player.name} is a ${player.gender}`);
      }

      // Two women and two men staff the one court booked. Under hybrid fill the same four fill
      // it too — the roster has no surplus — so the number does not move, and the choice is
      // visibly free on this roster.
      expect(app.shows('Fills 1 of 1 court.')).toBe(true);
      await app.tap('Hybrid fill');
      expect(app.shows('Fills 1 of 1 court.')).toBe(true);
    });

    it('counts what strictness costs on a roster that has a surplus', async () => {
      const app = await atPlayers('Mixicano', namesOf(SEVEN_AND_THREE));
      for (const player of SEVEN_AND_THREE) {
        await app.tap(`${player.name} is a ${player.gender}`);
      }

      // Two courts booked on Review, then Back: three men staff one court strictly, and ten
      // players staff both under hybrid fill. That difference is the whole of the choice.
      await app.tap('Next');
      await app.setNumber('Courts', 2);
      await app.tap('Back');

      expect(app.shows('Fills 1 of 2 courts.')).toBe(true);
      await app.tap('Hybrid fill');
      expect(app.shows('Fills 2 of 2 courts.')).toBe(true);
    });

    it('holds the step on a roster strict mixing cannot seat, and says why', async () => {
      const app = await atPlayers('Mixicano', namesOf(SKEWED_FOUR));

      for (const player of SKEWED_FOUR) {
        await app.tap(`${player.name} is a ${player.gender}`);
      }

      expect(app.canTap('Next')).toBe(false);
      expect(app.shows('Strict mixing needs at least 2 women and 2 men.')).toBe(true);
    });

    it('lets that roster through the moment hybrid fill is chosen', async () => {
      const app = await atPlayers('Mixicano', namesOf(SKEWED_FOUR));
      for (const player of SKEWED_FOUR) {
        await app.tap(`${player.name} is a ${player.gender}`);
      }

      await app.tap('Hybrid fill');

      expect(app.canTap('Next')).toBe(true);
      expect(app.shows('Strict mixing needs at least 2 women and 2 men.')).toBe(false);
    });

    it('says nothing about the rule while a gender is still unanswered', async () => {
      const app = await atPlayers('Mixicano', namesOf(SKEWED_FOUR));

      for (const player of SKEWED_FOUR.slice(0, 3)) {
        await app.tap(`${player.name} is a ${player.gender}`);
      }

      // One question at a time: the roster cannot be judged against a rule until the app knows
      // who is on it, and the gender still outstanding is the sentence already on screen.
      expect(app.shows('Strict mixing needs at least 2 women and 2 men.')).toBe(false);
      expect(app.shows('Mixicano pairs across gender, so every player needs one.')).toBe(true);
    });

    it('restates the rule and its price on the screen that commits the evening', async () => {
      const app = await atPlayers('Mixicano', namesOf(SEVEN_AND_THREE));
      for (const player of SEVEN_AND_THREE) {
        await app.tap(`${player.name} is a ${player.gender}`);
      }

      await app.tap('Next');
      await app.setNumber('Courts', 2);

      expect(app.shows('Strict mixing')).toBe(true);
      expect(app.text()).toMatch(/Courts in play 1\b/);
    });

    it('writes the rule that was chosen onto the evening, either way', async () => {
      const strict = await createMixicanoSession(EVEN_FOUR);
      const hybrid = await createMixicanoSession(EVEN_FOUR, 'hybrid');

      expect(storedSession(strict).strictMixing).toBe(true);
      expect(storedSession(hybrid).strictMixing).toBe(false);
      strict.expectStoredSessionValid();
      hybrid.expectStoredSessionValid();
    });
  });

  describe('the court strict mixing leaves empty', () => {
    it('is named on the Round tab, with the rule that emptied it', async () => {
      const app = await createMixicanoSession(SEVEN_AND_THREE, 'strict', 2);

      expect(app.shows('Court 2 unused — strict mixing.')).toBe(true);
      expect(app.shows('Sitting out: ')).toBe(true);
      app.expectStoredSessionValid();
    });

    it('is not named on the same roster under hybrid fill, which fills it', async () => {
      const app = await createMixicanoSession(SEVEN_AND_THREE, 'hybrid', 2);

      expect(app.shows('unused')).toBe(false);
      app.expectStoredSessionValid();
    });

    it('does not blame the rule for a court no roster of this size could fill', async () => {
      // Six players on two courts play one court under every rule there is, so there is nothing
      // here that strict mixing did — and a note saying otherwise would teach the organizer to
      // blame the choice for the size of the room.
      const app = await createMixicanoSession(EVEN_SIX, 'strict', 2);

      expect(app.shows('unused')).toBe(false);
      app.expectStoredSessionValid();
    });

    it('carries the same line onto the preview of a roster change', async () => {
      const app = await createMixicanoSession(SEVEN_AND_THREE, 'strict', 2);
      await app.tap('Players');

      await app.type('Name', 'Ida');
      await app.tap('Woman');
      await app.tap('Add');

      expect(app.shows('The rest of the evening')).toBe(true);
      expect(app.shows('Court 2 unused — strict mixing.')).toBe(true);
    });

    it('previews the evening a departure would leave nobody able to play', async () => {
      const app = await createMixicanoSession(FOUR_AND_TWO);
      await app.tap('Players');

      // Gus is one of the two men, and without him no court can be staffed strictly. The app does
      // not quietly fall back to hybrid fill: it says so, and waits.
      await app.tap('Options for Gus');
      await app.tap('Went home');

      expect(app.shows('0 courts — nobody can play.')).toBe(true);
      // One sentence, not two: there is no rotation left to print, so there is no round under it
      // naming a court either.
      expect(app.shows('unused')).toBe(false);
    });

    it('commits nothing until the organizer causes it', async () => {
      const app = await createMixicanoSession(FOUR_AND_TWO);
      await app.tap('Players');
      await app.tap('Options for Gus');
      await app.tap('Went home');

      await app.tap("Don't change the roster");

      expect(app.shows('Went home')).toBe(false);
      expect(storedSession(app).roster.some((entry) => entry.leftAfterRound !== undefined)).toBe(
        false,
      );
      app.expectStoredSessionValid();
    });
  });

  describe('the whole evening', () => {
    it('runs create, score, page, a roster change, the ending and history', async () => {
      const app = await createMixicanoSession(EVEN_SIX);
      const roundCount = storedSession(app).rounds.length;

      const sides = await score(app, 17);
      await app.tap('Round 2 →');
      expect(app.shows(`Round 2 of ${roundCount}`)).toBe(true);
      await score(app, 13);

      await app.tap('Previous round');
      expect(showsScore(app, sides, { a: 17, b: 7 })).toBe(true);
      await app.tap('Back to current round');
      expect(app.shows(`Round 3 of ${roundCount}`)).toBe(true);
      app.expectStoredSessionValid();

      await app.tap('Players');
      await app.type('Name', 'Gita');
      await app.tap('Woman');
      await app.tap('Add');
      await app.tap('Add Gita');
      expect(gendersOf(app).get('Gita')).toBe('woman');
      app.expectStoredSessionValid();

      await endSession(app);
      app.expectEndedSessionValid();

      await app.tap('Done');
      expect(app.shows('Session history')).toBe(true);
      expect(app.shows('Mixicano · 7 players')).toBe(true);
    });

    it('runs a strict evening, courts short, from creation to history', async () => {
      const app = await createMixicanoSession(SEVEN_AND_THREE, 'strict', 2);

      // One court of the two, all evening, and the reason for it under the courts.
      expect(app.shows('Round 1 of')).toBe(true);
      expect(app.shows('Court 2 unused — strict mixing.')).toBe(true);
      expect(app.shows('*')).toBe(false);

      const sides = await score(app, 17);
      expect(showsScore(app, sides, { a: 17, b: 7 })).toBe(true);
      await app.tap('Round 2 →');
      expect(app.shows('Court 2 unused — strict mixing.')).toBe(true);
      app.expectStoredSessionValid();

      // A late arrival of the gender in short supply buys the second court back, which is the
      // choice paying out rather than costing.
      await app.tap('Players');
      await app.type('Name', 'Ivo');
      await app.tap('Man');
      await app.tap('Add');
      await app.tap('Add Ivo');
      await app.tap('Round');
      expect(app.shows('Court 2 unused — strict mixing.')).toBe(false);
      app.expectStoredSessionValid();

      await endSession(app);
      app.expectEndedSessionValid();

      await app.tap('Done');
      expect(app.shows('Mixicano · 11 players')).toBe(true);
    });

    it('schedules and renders a lopsided gender pool like any other evening', async () => {
      const app = await createMixicanoSession(LOPSIDED_SIX, 'hybrid');

      expect(app.shows('Round 1 of')).toBe(true);
      expect(markedSideNames(app)).toHaveLength(1);
      app.expectStoredSessionValid();

      const sides = await score(app, 17);

      expect(showsScore(app, sides, { a: 17, b: 7 })).toBe(true);
      app.expectStoredSessionValid();
    });
  });
});

/** Walk the wizard to the Players step in one mode, with these names typed in. */
async function atPlayers(mode: string, names: readonly string[], tier?: Tier): Promise<AppHarness> {
  const app = await AppHarness.launch({ tier });
  await app.tap('New session');
  await app.tap(mode);

  for (const name of names) {
    await app.type('Name', name);
    await app.tap('Add');
  }

  return app;
}

function namesOf(players: readonly MixicanoPlayer[]): readonly string[] {
  return players.map((player) => player.name);
}

/** The gender the document holds for each player, by name. */
function gendersOf(app: AppHarness): Map<string, Gender | undefined> {
  return new Map(storedSession(app).roster.map((entry) => [entry.name, entry.gender]));
}

/**
 * The sides of court 1 that are same-gender pairs, spelled the way the card spells them.
 *
 * Derived here from the roster the document holds rather than read off the screen, because that
 * is the claim under test: the screen is then checked against it. Court 1 is enough — these
 * rosters are one court wide.
 */
function markedSideNames(app: AppHarness): readonly string[] {
  const session = storedSession(app);
  const genderOf = (id: string): Gender | undefined =>
    session.roster.find((entry) => entry.id === id)?.gender;
  const nameOf = (id: string): string =>
    session.roster.find((entry) => entry.id === id)?.name ?? id;
  const match = matchOn(app);

  return [match.sideA, match.sideB]
    .filter((pair) => genderOf(pair[0]) === genderOf(pair[1]))
    .map((pair) => pair.map(nameOf).join(' & '));
}

/** Side A's points on court 1 of the round on screen, or `null` while it is unscored. */
function scoredSideOf(app: AppHarness): number | null {
  return matchOn(app).score?.sideA ?? null;
}

/**
 * Correct one player's gender in the stored document and open the app again.
 *
 * The app has no screen for this — a gender is answered where a roster grows and nowhere else —
 * so the correction is made where it would be made, on the document. What is being asked is
 * whether the mark is read off the roster on every render, which is a question about the app and
 * not about how the typo was reached.
 *
 * It comes back resumed, on the round the evening is on — which is the round *after* the one
 * under test, because that one has been played.
 */
async function reopenWith(app: AppHarness, name: string, gender: Gender): Promise<AppHarness> {
  const record = app.repository.activeRecord();
  if (record === null) {
    throw new Error('The repository holds no session to correct.');
  }

  await app.repository.saveActive({
    ...record,
    session: {
      ...record.session,
      roster: record.session.roster.map((entry) =>
        entry.name === name ? { ...entry, gender } : entry,
      ),
    },
  });

  const reopened = await app.reload();
  await reopened.tap('Resume');

  return reopened;
}
