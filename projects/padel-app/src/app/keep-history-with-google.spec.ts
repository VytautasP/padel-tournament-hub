/*
 * Linking an anonymous organizer to a Google account (decision #14, ADR-0028).
 *
 * The thing being tested is a loss that never announces itself. An anonymous uid is one browser:
 * clear its data, switch phone, or let iOS evict storage, and every evening that uid owns is
 * unreachable forever, because `ownerUid` cannot move (ADR-0024 §2) and nothing can prove the new
 * uid is the same person. Nothing breaks, nothing errors — the history is simply empty.
 *
 * So the spec that matters is the last one in this file, and it is the whole feature written down:
 * an evening is played, the account is linked, the browser is wiped, and the evening comes back.
 * Everything above it is the surface that makes that possible without lying on the way — the front
 * door saying which of the two states it is in, and the confirmation that has to be honest about
 * what a taken account costs, because that is the case where an organizer can lose something by
 * saying yes.
 *
 * The date in a history row cannot be written down in advance, so it is formatted here rather than
 * imported from the dictionary — the same line as the two specs next door.
 */
import { copy } from './copy/copy';
import { AppHarness } from './testing/app-harness';
import { createSession, createSessionOn, endSession } from './testing/session-driver';
import { FAKE_ACCOUNT, FAKE_UID } from './session/in-memory-session-repository';
import type { Identity, LinkOutcome } from './session/identity';

const FOUR = ['Ana', 'Ben', 'Cara', 'Dov'];

const today = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
}).format(new Date());

const ROW = `${today} · Americano · 4 players`;

/** An identity that can sign in and cannot reach Google: a blocked popup, or no signal. */
function googleRefusing(outcome: LinkOutcome): Identity {
  return {
    signIn: async () => FAKE_UID,
    durability: () => ({ kind: 'browser' }),
    linkGoogle: async () => outcome,
  };
}

describe('keeping history with a Google account', () => {
  it('says on the front door that history is browser-bound, and offers the one thing that changes it', async () => {
    const app = await AppHarness.launch();

    expect(app.shows(copy.identity.browserOnly)).toBe(true);
    expect(app.canTap(copy.identity.keep)).toBe(true);
  });

  /*
   * The whole of what linking is: the uid does not change, so nothing has to be moved and nothing
   * can be lost in the moving. An evening that was on the front door a moment ago is on it still.
   */
  it('links without disturbing the evenings this browser already owns', async () => {
    const app = await anEveningEnded();

    await app.tap(copy.identity.keep);

    expect(app.shows(ROW)).toBe(true);
    expect(app.shows(copy.identity.kept(FAKE_ACCOUNT))).toBe(true);
  });

  /* Nothing left to do, so nothing offered — absent rather than greyed, like everything else here. */
  it('stops offering to link once history is kept with an account', async () => {
    const app = await AppHarness.launch();

    await app.tap(copy.identity.keep);

    expect(app.isOnScreen(copy.identity.keep)).toBe(false);
    expect(app.shows(copy.identity.browserOnly)).toBe(false);
  });

  it('says so when Google cannot be reached, and stays browser-bound', async () => {
    const app = await AppHarness.launch({ identity: googleRefusing({ kind: 'unavailable' }) });

    await app.tap(copy.identity.keep);

    expect(app.shows(copy.identity.unavailable)).toBe(true);
    expect(app.shows(copy.identity.browserOnly)).toBe(true);
    expect(app.canTap(copy.identity.keep)).toBe(true);
  });

  /* Changing your mind is an answer. An app that called it a failure would be telling the
   * organizer they made a mistake by closing a window they opened on purpose. */
  it('says nothing at all when the organizer closes the Google window', async () => {
    const app = await AppHarness.launch({ identity: googleRefusing({ kind: 'dismissed' }) });

    await app.tap(copy.identity.keep);

    expect(app.shows(copy.identity.unavailable)).toBe(false);
    expect(app.shows(copy.identity.browserOnly)).toBe(true);
  });

  /*
   * The collision: the account is already somebody's uid. It is not an error and it is not rare —
   * it is exactly what a browser that lost its uid sees — so the app asks a question rather than
   * failing, and the question has to be honest about what saying yes costs (ADR-0028 §2).
   */
  describe('when the Google account already belongs to another browser', () => {
    it('names the evenings that would stay behind before signing in as it', async () => {
      const second = await aSecondBrowserWithAnEveningOfItsOwn();

      await second.tap(copy.identity.keep);

      expect(second.shows(copy.identity.adoptConfirm(FAKE_ACCOUNT, 1).lead)).toBe(true);
    });

    it('leaves this browser exactly as it was when the organizer declines', async () => {
      const second = await aSecondBrowserWithAnEveningOfItsOwn();

      await second.tap(copy.identity.keep);
      await second.tap(copy.confirm.cancel);

      expect(second.shows(ROW)).toBe(true);
      expect(second.shows(copy.identity.browserOnly)).toBe(true);
    });

    /*
     * The reason the whole feature was built before the spectator route. This is the evening
     * coming back from a browser that has never seen it, which nothing in this app could do
     * before: the uid it was written under is gone, and the account is the only thing that can
     * prove the new browser is the same organizer.
     */
    it('brings the account’s history back to a browser that lost its uid', async () => {
      const app = await anEveningEnded();
      await app.tap(copy.identity.keep);

      app.repository.clearSiteData();
      const fresh = await app.reload();
      expect(fresh.shows(ROW)).toBe(false);

      await fresh.tap(copy.identity.keep);
      await fresh.tap(copy.identity.adoptConfirm(FAKE_ACCOUNT, 0).action);

      expect(fresh.shows(ROW)).toBe(true);
      expect(fresh.shows(copy.identity.kept(FAKE_ACCOUNT))).toBe(true);
    });
  });
});

/** An evening played and ended, with the organizer back on the front door reading it. */
async function anEveningEnded(): Promise<AppHarness> {
  const app = await createSession(FOUR);
  await endSession(app);
  await app.tap(copy.session.done);

  return app;
}

/**
 * A second browser, with the account already linked from the first and an evening of its own on
 * it — the one case where adopting the account costs something.
 */
async function aSecondBrowserWithAnEveningOfItsOwn(): Promise<AppHarness> {
  const first = await AppHarness.launch();
  await first.tap(copy.identity.keep);
  first.repository.clearSiteData();

  const second = await createSessionOn(await first.reload(), FOUR);
  await endSession(second);
  await second.tap(copy.session.done);

  return second;
}
