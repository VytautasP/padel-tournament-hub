/*
 * A court number, turned into the word on the screen (ADR-0017 §6).
 *
 * The rule is one line and it is the whole of the feature's forgiveness: a name the organizer
 * typed wins, and anything else — a blank field, a court the stored names do not reach, a record
 * written before names existed — falls back to `Court N`. None of those is a mistake anybody has
 * made, so none of them may render as an empty label on a card four people are walking towards.
 *
 * It is a function rather than a field on the record because the fallback has to survive whatever
 * is in storage. Resolving at write time would bake today's answer into a document that outlives
 * it; resolving at read time means a blank stays blank in the document and reads as `Court 1`
 * every time it is rendered.
 */
import { copy } from '../copy/copy';

/** What court `courtNumber` is called, given the names the organizer set at creation. */
export function courtNameFor(courtNames: readonly string[], courtNumber: number): string {
  return (courtNames[courtNumber - 1] ?? '').trim() || copy.round.courtName(courtNumber);
}
