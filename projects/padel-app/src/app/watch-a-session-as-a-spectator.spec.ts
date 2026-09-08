/*
 * The other end of a share code: `/s/:code`, opened by somebody who is not running the evening
 * (ADR-0026).
 *
 * Every spec here runs the wizard first and then opens the spectator's route on the evening that
 * produced, because what has to be true is that the code the organizer reads off their phone is
 * the code that opens this page. A spec that wrote a session straight into the repository would be
 * testing a rendering rather than the feature.
 *
 * **Only one app is alive at a time.** The harness resets the testing module on every launch, so
 * the organizer's app is gone by the time the spectator's is up — and that is the right shape
 * anyway: the two are on different phones and share nothing but the store between them. What
 * reaches a spectator is therefore written the way it reaches them in the field, as a document
 * landing in the session they are both looking at, through the two drivers at the bottom of this
 * file.
 *
 * The address is built with `spectatorPath` rather than spelled out, for the reason
 * `share-the-session.spec.ts` builds its link with `shareLink`: a hard-coded `/s/...` in a spec is
 * a second opinion about a route, and the first one to change would be silently right.
 *
 * Read-only is asserted as an absence of controls rather than as disabled ones, because that is
 * what ADR-0026 §2 asks for: not a button that refuses, a screen with no button on it.
 */
import { copy } from './copy/copy';
import { spectatorPath } from './share/share-link';
import { AppHarness } from './testing/app-harness';
import type { SessionRecord } from './session/session-record';
import { createSession, endSession, score, sidesOn, storedSession } from './testing/session-driver';

const FOUR = ['Ana', 'Ben', 'Cara', 'Dov'];

/** An evening somebody else ran, and the app of somebody watching it by its code. */
async function watching(organizer: AppHarness): Promise<AppHarness> {
  return await AppHarness.launch({
    repository: organizer.repository,
    at: spectatorPath(codeOf(organizer)),
  });
}

/** The share code of the evening in front of the organizer, which is its id (ADR-0024 §1). */
function codeOf(organizer: AppHarness): string {
  return storedSession(organizer).id;
}

describe('watching a session as a spectator', () => {
  it('opens the evening at the share code, on the round being played', async () => {
    const organizer = await createSession(FOUR);
    const sides = sidesOn(organizer);
    const rounds = storedSession(organizer).rounds.length;

    const spectator = await watching(organizer);

    expect(spectator.shows(copy.round.heading(1, rounds))).toBe(true);
    expect(spectator.shows(sides.a)).toBe(true);
    expect(spectator.shows(sides.b)).toBe(true);
  });

  /*
   * The three tabs of ADR-0016, which is what makes a QR worth scanning: the round to find your
   * court, the table to find out how it is going, and the roster to find out whether you are out.
   */
  it('shows the same three tabs the organizer has', async () => {
    const organizer = await createSession(FOUR);
    const spectator = await watching(organizer);

    await spectator.tap(copy.session.standings);
    expect(spectator.shows(FOUR[0])).toBe(true);

    await spectator.tap(copy.session.players);
    expect(spectator.shows(FOUR[3])).toBe(true);
  });

  /*
   * The listener, which is the whole point of this being a route rather than a page somebody
   * refreshes (ADR-0025 §3). The score is entered on the organizer's app before this one exists,
   * rewound out of the store, and then landed again while the spectator is standing there — which
   * is the shape of what arrives over a network, with nothing tapped in between.
   */
  it('follows the evening as scores land', async () => {
    const organizer = await createSession(FOUR);
    const unscored = recordOf(organizer);
    await score(organizer, 15);
    const scored = recordOf(organizer);
    await organizer.repository.saveActive(unscored);

    const spectator = await watching(organizer);
    expect(spectator.shows(copy.round.noScore)).toBe(true);

    await organizerWrote(spectator, scored);

    expect(spectator.shows(copy.round.noScore)).toBe(false);
    expect(spectator.shows('15')).toBe(true);
  });

  /*
   * Read-only, structurally. Every control the organizer's session screen carries is asked for by
   * name, because "there are no buttons" is not a thing a screen can be asked once — each of these
   * is a different branch in a different component, and each of them would arrive on its own.
   */
  it('offers nothing that could change the evening', async () => {
    const organizer = await createSession(FOUR);
    const spectator = await watching(organizer);

    expect(spectator.isOnScreen(copy.share.open)).toBe(false);
    expect(spectator.isOnScreen(copy.round.addRound.action)).toBe(false);
    expect(spectator.isOnScreen(copy.round.enterScore(copy.round.courtName(1)))).toBe(false);

    await spectator.tap(copy.session.standings);
    expect(spectator.isOnScreen(copy.standings.end)).toBe(false);

    await spectator.tap(copy.session.players);
    expect(spectator.isOnScreen(copy.players.options(FOUR[0]))).toBe(false);
    expect(spectator.hasField(copy.players.placeholder)).toBe(false);
  });

  /*
   * Paging is not editing. A spectator asked "who am I with in round six?" has to be able to
   * answer it, which is the whole of ADR-0016 §2 — and the page past the last round, where the
   * organizer is offered one more, is nowhere at all for them.
   */
  it('pages through the rounds and stops at the last one', async () => {
    const organizer = await createSession(FOUR);
    const rounds = storedSession(organizer).rounds.length;
    const spectator = await watching(organizer);

    await spectator.tap(copy.round.next);
    expect(spectator.shows(copy.round.heading(2, rounds))).toBe(true);

    for (let page = 2; page < rounds; page += 1) {
      await spectator.tap(copy.round.next);
    }

    expect(spectator.shows(copy.round.heading(rounds, rounds))).toBe(true);
    expect(spectator.canTap(copy.round.next)).toBe(false);
    expect(spectator.isOnScreen(copy.round.addRound.action)).toBe(false);
  });

  /*
   * An evening that has ended is still watchable: the code is the same code, and the final table
   * is exactly the thing somebody scans a QR for after the last court. Ending moves the record out
   * of the active slot into history, so this is also what proves a code finds it there.
   */
  it('keeps showing an evening that has ended', async () => {
    const organizer = await createSession(FOUR);
    await score(organizer, 17);
    const code = codeOf(organizer);
    await endSession(organizer);

    const spectator = await AppHarness.launch({
      repository: organizer.repository,
      at: spectatorPath(code),
    });

    await spectator.tap(copy.session.standings);
    expect(spectator.shows(copy.standings.podium)).toBe(true);
    expect(spectator.isOnScreen(copy.standings.end)).toBe(false);
  });

  /*
   * Decision #10's hard delete, seen from the other end. The acceptance criterion of this slice is
   * that it is a sentence rather than a permission error or an empty round card — and a code that
   * never named anything reads the same, because from here the two are one non-answer.
   */
  it('says the evening is gone when the code opens nothing', async () => {
    const organizer = await createSession(FOUR);

    const spectator = await AppHarness.launch({
      repository: organizer.repository,
      at: spectatorPath('NOSUCHCODE'),
    });

    expect(spectator.shows(copy.spectator.gone.heading)).toBe(true);
    expect(spectator.shows(copy.spectator.gone.lead)).toBe(true);
  });

  /*
   * The same delete, arriving while somebody is watching. A page that kept rendering the last
   * round it saw would be showing an evening that no longer exists to somebody standing on the
   * court it was played on.
   */
  it('turns into the gone screen when the evening is deleted underneath it', async () => {
    const organizer = await createSession(FOUR);
    const spectator = await watching(organizer);
    expect(spectator.shows(copy.spectator.gone.heading)).toBe(false);

    await organizerDiscarded(spectator);

    expect(spectator.shows(copy.spectator.gone.heading)).toBe(true);
  });

  /*
   * The desk wears the rail and the aside, exactly as the organizer's shell does (ADR-0022 §2):
   * the spectator's route is the same shell with the controls gone, not a second design. Standings
   * is on screen without being a destination, which is the whole of that tier's argument.
   */
  it('wears the desk arrangement at the desk', async () => {
    const organizer = await createSession(FOUR);

    const spectator = await AppHarness.launch({
      repository: organizer.repository,
      at: spectatorPath(codeOf(organizer)),
      tier: 'desk',
    });

    expect(spectator.isOnScreen(copy.session.standings)).toBe(false);
    expect(spectator.shows(copy.session.standings)).toBe(true);
    expect(spectator.shows(copy.appName)).toBe(true);
  });

  /* The organizer's front door is still the front door: the router did not move anything else. */
  it('leaves the organizer at the address they had', async () => {
    const app = await AppHarness.launch();

    expect(app.isOnScreen(copy.landing.newSession)).toBe(true);
  });
});

/** What the store is holding for the evening in front of the organizer. */
function recordOf(organizer: AppHarness): SessionRecord {
  const record = organizer.repository.activeRecord();
  if (record === null) {
    throw new Error('The repository holds no session.');
  }

  return record;
}

/**
 * A write by the organizer, seen from the phone watching it.
 *
 * The one thing in these specs that does not go through a screen, and it is deliberate: the
 * organizer is on another phone, and what crosses to a spectator is a document rather than a tap.
 * Driving a second app instead would mean a second injector the test bed does not have.
 */
async function organizerWrote(spectator: AppHarness, record: SessionRecord): Promise<void> {
  await spectator.repository.saveActive(record);
  await spectator.catchUp();
}

/** The organizer discarding the evening — decision #10's hard delete, from the other end. */
async function organizerDiscarded(spectator: AppHarness): Promise<void> {
  await spectator.repository.clearActive();
  await spectator.catchUp();
}
