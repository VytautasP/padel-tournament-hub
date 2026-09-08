/*
 * The address a share code has on the web (ADR-0026 §1).
 *
 * `/s/:code` is the spectator route, and this file is the one expression of it anywhere: the
 * router's table names the pattern below and the share sheet builds its link out of the function
 * below that, so the square a spectator scans and the route that answers it cannot drift apart.
 *
 * The link is a pure function of the origin and the code rather than a method on anything, because
 * a link is a fact about two strings — what needs injecting is the origin, and that is the
 * caller's problem in the one file that has a document to read it from.
 *
 * Exported so the spec can build the same link rather than spelling one out: the tests do not know
 * what origin they are being run on, and a hard-coded `http://localhost` in a spec is a test of
 * the test runner's configuration.
 */

/** The router's pattern for the spectator view. Relative, because a `Routes` entry is. */
export const SPECTATOR_ROUTE = 's/:code';

/** Where a spectator goes on this origin — the path half of the link, and what a test navigates. */
export function spectatorPath(code: string): string {
  return `/s/${code}`;
}

/** Where a spectator goes: the origin the organizer is on, and the code as the path. */
export function shareLink(origin: string, code: string): string {
  return `${origin}${spectatorPath(code)}`;
}
