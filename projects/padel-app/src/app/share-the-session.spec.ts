/*
 * Getting the share code off the organizer's phone and onto everybody else's (ADR-0026 §4).
 *
 * The share code already exists — it is the session's id and has since ADR-0024 — so nothing here
 * is about generating one. What is being tested is the moment it becomes readable by a human for
 * the first time: a QR to scan, the ten characters to read out across a court when the QR will not
 * scan, and a link to paste into whatever the group actually talks in.
 *
 * Three ways out of one sheet, and the specs below are one per way, because they fail
 * independently: a camera that cannot see the QR is a different evening from a clipboard the
 * browser refuses, and the code as text is the fallback that has to survive both.
 *
 * The link is built here rather than spelled out, because a spec cannot know the origin the tests
 * happen to run on — `shareLink` is the one thing both the sheet and this file are allowed to
 * agree on, exactly as `CROCKFORD_ALPHABET` is for the code itself.
 */
import { copy } from './copy/copy';
import { shareLink } from './share/share-link';
import { AppHarness } from './testing/app-harness';
import {
  createSession,
  createSessionOn,
  endSession,
  storedSession,
} from './testing/session-driver';

const FOUR = ['Ana', 'Ben', 'Cara', 'Dov'];

/** The evening on screen, with the sheet open — where every spec below starts. */
async function anEveningBeingShared(app: AppHarness): Promise<string> {
  await app.tap(copy.share.open);

  return storedSession(app).id;
}

describe('sharing a session', () => {
  it('opens the share sheet from the session header', async () => {
    const app = await createSession(FOUR);

    const code = await anEveningBeingShared(app);

    expect(app.shows(copy.share.heading)).toBe(true);
    expect(app.shows(code)).toBe(true);
  });

  /*
   * The QR is the whole reason the sheet exists: nobody types ten characters when a camera is in
   * their hand. It is read here as a picture with a name, which is what a screen reader gets and
   * the only thing about an SVG a DOM seam can honestly assert.
   */
  it('draws the link as a QR nobody has to type', async () => {
    const app = await createSession(FOUR);

    await anEveningBeingShared(app);

    expect(app.hasImage(copy.share.qr)).toBe(true);
  });

  it('copies the link the QR points at', async () => {
    const app = await createSession(FOUR);
    const code = await anEveningBeingShared(app);

    await app.tap(copy.share.copyLink);

    expect(app.clipboard.lastCopied).toBe(shareLink(location.origin, code));
    expect(app.shows(copy.share.copied)).toBe(true);
  });

  /*
   * A clipboard is a permission, and a permission can be refused. The code is on screen either
   * way, which is what makes this a sentence rather than a dead end.
   */
  it('says so when the browser will not copy, and leaves the code on screen', async () => {
    const app = await createSession(FOUR);
    app.clipboard.refuse();
    const code = await anEveningBeingShared(app);

    await app.tap(copy.share.copyLink);

    expect(app.shows(copy.share.copyFailed)).toBe(true);
    expect(app.shows(copy.share.copied)).toBe(false);
    expect(app.shows(code)).toBe(true);
  });

  /*
   * The QR is lazily loaded, which means it is the one thing on this sheet that can fail to
   * arrive — a phone at a court with no signal, opening the sheet for the first time. The code is
   * still the credential and still works, so the sheet says that rather than showing a hole.
   */
  it('falls back to the code when the QR cannot be drawn', async () => {
    const app = await AppHarness.launch({ qrCode: () => Promise.reject(new Error('offline')) });
    await createSessionOn(app, FOUR);

    const code = await anEveningBeingShared(app);

    expect(app.hasImage(copy.share.qr)).toBe(false);
    expect(app.shows(copy.share.qrUnavailable)).toBe(true);
    expect(app.shows(code)).toBe(true);
  });

  /*
   * An ended session is a record being read rather than an evening being run, and its final table
   * is exactly the thing somebody asks to be sent. The header keeps its one control.
   */
  it('shares an evening that has already ended', async () => {
    const app = await createSession(FOUR);
    // Read before the ending: an ended evening leaves the active slot for history, and its code
    // is the id it had all along (ADR-0024 §1).
    const code = storedSession(app).id;
    await endSession(app);

    await app.tap(copy.share.open);

    expect(app.shows(code)).toBe(true);
  });

  /* Nothing to share from the front door: there is no session in front of the organizer there. */
  it('offers nothing to share outside a session', async () => {
    const app = await AppHarness.launch();

    expect(app.isOnScreen(copy.share.open)).toBe(false);
  });

  /*
   * The sheet is a sheet under a thumb and a dialog on a desk, like every other focused surface
   * in this app (ADR-0022 §4). It is asserted once, here, because sharing is the newest of them.
   */
  it('opens where the tier puts a focused surface', async () => {
    const app = await createSession(FOUR, 1, 24, 'desk');

    await anEveningBeingShared(app);

    expect(app.sheetPosition()).toBe('centered');
  });
});
