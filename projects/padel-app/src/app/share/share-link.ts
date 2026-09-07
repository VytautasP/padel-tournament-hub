/*
 * The address a share code has on the web (ADR-0026 §1).
 *
 * `/s/:code` is the spectator route, and this is the one expression of it in the organizer's half
 * of the app. It is a pure function of the origin and the code rather than a method on anything,
 * because a link is a fact about two strings — what needs injecting is the origin, and that is the
 * caller's problem in the one file that has a document to read it from.
 *
 * Exported so the spec can build the same link rather than spelling one out: the tests do not know
 * what origin they are being run on, and a hard-coded `http://localhost` in a spec is a test of
 * the test runner's configuration.
 */

/** Where a spectator goes: the origin the organizer is on, and the code as the path. */
export function shareLink(origin: string, code: string): string {
  return `${origin}/s/${code}`;
}
