/*
 * The sessions the app is holding, and the only thing in it that calls the engine (decision #17).
 *
 * Screens read signals off this store and call methods on it; none of them calls an engine
 * operation of its own. That is what keeps the engine's surface reviewable — every rule the app
 * exercises passes through this one file — and what makes a screen testable by rendering it.
 * Reading the engine's *types* is not a call, and happens wherever a session is rendered.
 *
 * Three facts about sessions live here, and ADR-0013 is all three:
 *
 *   - **At most one evening is in progress.** The store enforces that, not the repository: there
 *     is one `record` signal, and ending or discarding is the only way to empty it. The repository
 *     stays addressed by id (ADR-0013 §5) so the Firestore swap in step 3 is a swap rather than a
 *     rewrite, which means it cannot be the thing that counts.
 *   - **Every ended evening is kept.** Ending moves the record out of the active slot and into
 *     history in one method, so there is no moment at which an evening is in neither.
 *   - **One of them is on screen.** `openId` names it and the record itself is derived, which is
 *     what puts a score landing on the active session onto the screen showing it with nothing to
 *     keep in step — and what closes a screen whose session has just been discarded or deleted.
 *
 * The store also owns the fact that reading a session is asynchronous. `restore()` runs once at
 * startup; until it settles, `ready()` is false and the app renders nothing rather than flashing
 * a landing page at an organizer who has an evening in progress.
 */
import { computed, inject, Injectable, signal } from '@angular/core';
import {
  addPlayer,
  addRound,
  computeStandings,
  assignPartner,
  computeTeamStandings,
  createSession,
  finishSession,
  generateRemaining,
  recordScore,
  removePlayer,
  teamsNeedingPartner,
  type Gender,
  type OrphanedTeam,
  type PlayerId,
  type RosterEntry,
  type ScoreEntry,
  type Session,
  type SessionMode,
  type Team,
  type TeamId,
} from 'padel-engine';
import { rowsOfPlayers, rowsOfTeams } from '../standings/standing-row';
import type { StandingRow } from '../standings/standing-row';
import { currentRoundNumber } from './current-round';
import { teamNameOf } from './teams';
import type { SessionRecord } from './session-record';
import { SESSION_REPOSITORY } from './session-repository';
import { summarise } from './session-summary';
import type { SessionSummary } from './session-summary';

/**
 * A player as a screen hands them over: what they are called, and — where the mode pairs across
 * gender — which side of that pairing they are on (ADR-0010).
 *
 * The id is deliberately absent. Roster ids are derived from the session and the order names
 * arrived in (see `rosterEntry` below), which is what keeps a schedule reproducible from the
 * document; a screen that supplied one could break that without ever looking wrong.
 */
export interface NewPlayer {
  readonly name: string;
  /** Required by Mixicano and by nothing else. The engine refuses a Mixicano roster missing one. */
  readonly gender?: Gender;
}

/**
 * A player, with the gender question left off entirely where it was never asked.
 *
 * Written once because three screens' worth of callers would otherwise each decide what an
 * unanswered question serialises as. `{ gender: undefined }` survives `JSON.stringify` as a
 * missing key anyway, so the engine cannot tell the difference — but the debugger can, and
 * "asked and left blank" is not what happened on an Americano roster (ADR-0010: it carries none).
 *
 * `null` is accepted alongside `undefined` because that is what an unanswered toggle holds: a
 * screen should not have to translate its own empty state on the way here.
 */
export function newPlayer(name: string, gender?: Gender | null): NewPlayer {
  return { name, ...(gender == null ? {} : { gender }) };
}

/**
 * One team the organizer paired, as two positions in the draft's roster (decision #2a).
 *
 * Positions rather than ids for the same reason `NewPlayer` carries no id: roster ids are derived
 * here from the session id and the order the names arrived in, and a screen that supplied them
 * could break the reproducibility that derivation exists for. A pairing screen knows who it put
 * together, and where they are standing in the list is the only way it can say so.
 */
export type DraftPairing = readonly [number, number];

/** Everything the wizard has collected by the time the organizer taps Create. */
export interface SessionDraft {
  readonly mode: SessionMode;
  /** The roster in the order it was typed. Ids are the store's business, not the wizard's. */
  readonly players: readonly NewPlayer[];
  /** The pairing, in Team Americano and in no other mode — the engine refuses it elsewhere. */
  readonly teams?: readonly DraftPairing[];
  readonly courtCount: number;
  /** What each court is called, in court-number order. Blanks are allowed and mean `Court N`. */
  readonly courtNames: readonly string[];
  readonly targetScore: number;
  readonly roundCount: number;
}

/**
 * A roster change in hand but not made: the evening as it would be, and the evening it came from.
 *
 * ADR-0015 puts a preview in front of every roster change, which means the app holds two sessions
 * for the length of the interaction and must write neither until the organizer says so. This is
 * that pair, and it is the only thing `commitRosterChange` will store — a screen cannot hand the
 * store a session it built itself.
 */
export interface RosterChange {
  /**
   * The evening as it would be: played rounds carried through, everything after them planned
   * again for the amended roster. Never written unless it is confirmed.
   */
  readonly candidate: Session;
  /**
   * The evening it was planned against.
   *
   * Kept so that committing can refuse a candidate whose session has moved on underneath it. The
   * preview covers the screen while it is open, so this should never happen — and a score silently
   * thrown away by a stale candidate is not a thing to find out about later.
   */
  readonly plannedAgainst: Session;
  /**
   * The first round the preview renders: the round the evening is on.
   *
   * The rounds behind it are frozen and identical in both sessions, so showing them would be
   * showing the organizer what they already know. The current round is shown because it is where
   * they are standing, whether or not the change redraws it.
   */
  readonly fromRound: number;
}

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly repository = inject(SESSION_REPOSITORY);
  private readonly record = signal<SessionRecord | null>(null);
  private readonly endedRecords = signal<readonly SessionRecord[]>([]);
  private readonly openId = signal<string | null>(null);
  private readonly restored = signal(false);

  /** False until the repository has been read once. */
  readonly ready = this.restored.asReadonly();

  readonly activeSession = computed<Session | null>(() => this.record()?.session ?? null);

  /**
   * The round the evening in progress is on — what the Resume card names.
   *
   * Asked of the active session rather than of the session on screen, because the Resume card is
   * on the landing page, where no session is on screen at all.
   */
  readonly activeRoundNumber = computed(() => {
    const session = this.activeSession();

    return session === null ? null : currentRoundNumber(session);
  });

  /**
   * Every ended evening as a history row reads it, most recently ended first (ADR-0013 §4).
   *
   * Ordered by `endedAt` rather than by the order the repository handed them over. That is what
   * the field is for: a list that leaned on insertion order would be correct today and would be a
   * bug the first time a store returns its documents in an order of its own, which is exactly what
   * the Firestore implementation of step 3 is free to do.
   */
  readonly history = computed<readonly SessionSummary[]>(() =>
    [...this.endedRecords()]
      .sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''))
      .map((record) => summarise(record, this.tableOf(record.session))),
  );

  /**
   * The session the organizer has open: the evening in progress, or one read out of history.
   *
   * Derived from an id rather than held as a second record, so that a score landing on the active
   * session reaches the screen showing it with nothing to keep in step — and so that discarding or
   * deleting whatever is open closes it rather than leaving a screen reading a record the app no
   * longer holds.
   */
  private readonly openRecord = computed<SessionRecord | null>(() => {
    const id = this.openId();
    if (id === null) {
      return null;
    }

    const active = this.record();
    if (active !== null && active.session.id === id) {
      return active;
    }

    return this.endedRecords().find((held) => held.session.id === id) ?? null;
  });

  readonly openSession = computed<Session | null>(() => this.openRecord()?.session ?? null);

  /**
   * Whether the session on screen is a record rather than an evening.
   *
   * The engine refuses every changing operation on a finished session (ADR-0009) and would refuse
   * these too; this is the app reading the same status so that it does not offer what would be
   * refused. It is the one flag that turns the session screen read-only, which is what ADR-0013's
   * "accepts no edits of any kind" amounts to in the UI.
   */
  readonly ended = computed(() => this.openSession()?.status === 'finished');

  /**
   * What the organizer calls each court of the session on screen (ADR-0017 §6).
   *
   * Empty where there is no session, which `courtNameFor` reads as "nobody named this one" and
   * renders as `Court N`. A stored record always carries the names: one written before courts
   * could be named is a version the repository refuses.
   */
  readonly courtNames = computed<readonly string[]>(() => this.openRecord()?.courtNames ?? []);

  /**
   * The round the session on screen is on: the lowest-numbered generated round still holding an
   * unscored match (ADR-0016). Derived from the scores on every read and never stored, so
   * correcting a typo can move it backwards.
   */
  readonly currentRoundNumber = computed(() => {
    const session = this.openSession();

    return session === null ? null : currentRoundNumber(session);
  });

  /**
   * The table, recomputed on every read and stored nowhere (decision #17).
   *
   * There is no invalidation here and nothing to keep in step: a corrected score changes the
   * session, the session is a signal, and the table is whatever the engine says about it now. A
   * finished session is read exactly the same way — freezing the document froze the matches the
   * table is computed from, so the table needs no freezing of its own (ADR-0009 §4).
   *
   * One table for every mode, because there is one ladder (ADR-0011): Team Americano hands it
   * teams where the others hand it players, and `tableOf` is the single line that knows which.
   */
  readonly standings = computed<readonly StandingRow[]>(() => {
    const session = this.openSession();

    return session === null ? [] : this.tableOf(session);
  });

  /**
   * The teams that are one player short, and the half of each still here (decision #2b).
   *
   * Read off the session on every call, like the table above and for the same reason: `needs
   * partner` is a team's line-up seen against the roster rather than a field anybody stores, so a
   * repair clears the flag by being made and a departure raises it the same way.
   */
  readonly teamsNeedingPartner = computed<readonly OrphanedTeam[]>(() => {
    const session = this.openSession();

    return session === null || session.mode !== 'team-americano'
      ? []
      : teamsNeedingPartner(session);
  });

  async restore(): Promise<void> {
    this.record.set(await this.repository.loadActive());
    this.endedRecords.set(await this.repository.loadHistory());
    this.restored.set(true);
  }

  /** Put the session with this id on screen: the active one, or one out of history. */
  open(sessionId: string): void {
    this.openId.set(sessionId);
  }

  /**
   * Put nothing on screen. Only a session that has ended offers a way out (ADR-0016).
   *
   * Named for leaving the screen rather than closing the session, because *closing* is one of the
   * words CONTEXT.md reserves — a session is **ended**, and this is not that.
   */
  leave(): void {
    this.openId.set(null);
  }

  /**
   * Build the evening the wizard describes, generate its schedule and open it.
   *
   * The schedule is generated here rather than round by round during play because decision #6
   * needs a whole rotation to be fair at every prefix — a schedule built one round at a time
   * cannot see the rounds it has not planned yet.
   *
   * Creating opens the session, because the last tap of the wizard has nowhere else to go.
   */
  async create(draft: SessionDraft): Promise<void> {
    const id = newSessionId();
    const players = draft.players.map((player, index) => rosterEntry(id, index, player));
    const session = generateRemaining(
      createSession({
        id,
        mode: draft.mode,
        players,
        // Absent rather than empty where the mode pairs nobody: the engine reads a `teams` key at
        // all as a claim that this session has teams, and refuses one from a mode that has none.
        ...(draft.teams ? { teams: draft.teams.map(pairedTeam(id, players)) } : {}),
        courtCount: draft.courtCount,
        targetScore: draft.targetScore,
        roundCount: draft.roundCount,
      }),
    );

    const record: SessionRecord = {
      session,
      createdAt: new Date().toISOString(),
      courtNames: draft.courtNames,
    };
    await this.repository.saveActive(record);
    this.record.set(record);
    this.open(id);
  }

  /**
   * Append one more round to the evening and generate it (decision #6).
   *
   * The engine plans the added round against everything already played rather than against the
   * round count the session was created with, so nothing behind it moves and the round it adds is
   * the one the schedule would have held all along had the organizer asked at the start.
   */
  async addRound(): Promise<void> {
    await this.change('add a round to', (session) => addRound(session));
  }

  /**
   * Record one side's points for one match, replacing whatever was there.
   *
   * One number crosses this line and the engine derives the other (decision #3, ADR-0014), which
   * is why there is nothing to validate here: a scoreline that does not sum to the target is not
   * something this method could be asked for.
   */
  async score(entry: ScoreEntry): Promise<void> {
    await this.change('score', (session) => recordScore(session, entry));
  }

  /**
   * The evening as it would be with one more player on it, written nowhere (ADR-0015).
   *
   * The engine schedules them from the first round nobody has played and into none behind it, and
   * hands back a whole session — so planning the change costs the same as making it, and the only
   * difference between the two is whether anybody stores the answer.
   */
  planArrival(player: NewPlayer): RosterChange {
    return this.plan((session) => addPlayer(session, this.arriving(session, player)));
  }

  /**
   * The evening as it would be with this player gone home (decision #5).
   *
   * They keep their entry, their played matches and their standings line; what closes is the
   * stretch of the evening they are here for. The engine refuses a departure that would leave a
   * round it cannot staff, which is why the Players tab does not offer one.
   */
  planGoingHome(playerId: PlayerId): RosterChange {
    return this.plan((session) => removePlayer(session, playerId));
  }

  /**
   * The evening as it would be with a new partner on an orphaned team (decision #2b, ADR-0012).
   *
   * Repairing a team is a roster change, so it is planned and previewed like the other two rather
   * than written where it is tapped (ADR-0015). The team keeps its id, and with it every point it
   * has already won — that is the engine's doing, not the app's, and the app's part is only to
   * hand it a player it has never seen.
   */
  planPartner(teamId: TeamId, player: NewPlayer): RosterChange {
    return this.plan((session) => assignPartner(session, teamId, this.arriving(session, player)));
  }

  /**
   * Store a change the organizer has read and confirmed. This is the only write a roster change
   * makes, and it happens after the preview rather than before it.
   */
  async commitRosterChange(change: RosterChange): Promise<void> {
    await this.change('change the roster of', (session) => {
      if (session !== change.plannedAgainst) {
        throw new Error('The evening has moved since this roster change was planned.');
      }

      return change.candidate;
    });
  }

  /**
   * End the evening: freeze it, and move it into history in the same breath.
   *
   * The two belong together. `finishSession` is what makes the document refuse every later change
   * (ADR-0009); moving it is what makes the landing page offer New session again. An evening that
   * was frozen but left in the active slot would be a session in progress that nothing can
   * progress, and the landing page would go on offering to resume it.
   *
   * The record stays open afterwards, because the organizer is standing in front of the table it
   * has just made final.
   */
  async end(): Promise<void> {
    const current = this.record();
    if (current === null) {
      throw new Error('There is no active session to end.');
    }

    const record: SessionRecord = {
      ...current,
      session: finishSession(current.session),
      endedAt: new Date().toISOString(),
    };
    await this.repository.addToHistory(record);
    await this.repository.clearActive();
    this.endedRecords.update((held) => [record, ...held]);
    this.record.set(null);
    this.open(record.session.id);
  }

  /**
   * Throw the evening away: the only way past a session that stopped without an ending.
   *
   * It does not go to history. History is every session that was *ended* (ADR-0013 §2), and an
   * evening that fell apart in round 3 is not a result anybody wants kept — which is why this is
   * the other door out rather than a second kind of ending.
   */
  async discard(): Promise<void> {
    await this.repository.clearActive();
    this.record.set(null);
    this.leave();
  }

  /** Forget an ended evening, permanently. This is decision #10's hard delete. */
  async deleteFromHistory(sessionId: string): Promise<void> {
    await this.repository.deleteFromHistory(sessionId);
    this.endedRecords.update((held) => held.filter((record) => record.session.id !== sessionId));
  }

  /**
   * Put one roster operation in hand: run it against the evening in progress and keep the pair.
   *
   * Shared by both changes because the difference between somebody arriving and somebody leaving
   * is one engine call — everything else about them, including the fact that neither is stored
   * yet, is the same interaction.
   */
  /**
   * The table for one session: the ladder its mode ranks, as rows the screens can render.
   *
   * The mode is read here and nowhere else. Team Americano ranks teams and every other mode ranks
   * players (ADR-0011), the engine refuses the wrong question of either, and a screen asking both
   * and picking one would be this check in a second place.
   */
  private tableOf(session: Session): readonly StandingRow[] {
    return session.mode === 'team-americano'
      ? rowsOfTeams(computeTeamStandings(session), (teamId) => teamNameOf(session, teamId))
      : rowsOfPlayers(computeStandings(session));
  }

  private plan(apply: (session: Session) => Session): RosterChange {
    const current = this.record();
    if (current === null || this.openSession() !== current.session) {
      // Always the evening in progress, and only while it is the evening on screen. A session read
      // out of history is finished and the engine would refuse it — but it would be refused after
      // a preview had been built from it, which is a screen offering a change that cannot happen.
      throw new Error('The session on screen is not an evening in progress.');
    }

    return {
      candidate: apply(current.session),
      plannedAgainst: current.session,
      fromRound: currentRoundNumber(current.session),
    };
  }

  /**
   * The entry a late arrival joins on.
   *
   * The id is derived from the roster's length rather than from a count of who is still here,
   * because nobody ever leaves the roster — a player who has gone home keeps their entry — so the
   * length only ever grows and the id it produces has never been handed out. It reads the same way
   * creation's do (decision #9), which is what keeps a schedule reproducible from the document.
   */
  private arriving(session: Session, player: NewPlayer): RosterEntry {
    return rosterEntry(
      session.id,
      session.roster.length,
      newPlayer(player.name.trim(), player.gender),
    );
  }

  /**
   * Hand the evening in progress to an engine operation and keep what comes back.
   *
   * Every change goes through here, so "there is no session" is written once rather than once per
   * operation. It is always the active record: a session opened out of history is finished, and
   * the engine would refuse it even if a screen asked.
   */
  private async change(operation: string, apply: (session: Session) => Session): Promise<void> {
    const current = this.record();
    if (current === null) {
      throw new Error(`There is no active session to ${operation}.`);
    }

    const updated: SessionRecord = { ...current, session: apply(current.session) };
    await this.repository.saveActive(updated);
    this.record.set(updated);
  }
}

/**
 * Roster ids derived from the session id and the order the names were typed.
 *
 * Derived rather than random because the engine seeds its tie-breaking from session data
 * (decision #6): ids that read the same way every time are what make a schedule reproducible from
 * the document alone when somebody disputes it. They are still stable ids and never indices —
 * decision #9's rule is that a roster change may not reassign anyone's results, and appending or
 * removing a name never renumbers the ids already handed out.
 */
function rosterEntry(sessionId: string, index: number, player: NewPlayer): RosterEntry {
  return { id: `${sessionId}:p${index + 1}`, ...newPlayer(player.name, player.gender) };
}

/**
 * The team a pairing names: an id of the session's own, and the two roster entries it pairs.
 *
 * Ids are derived from the session id and the order the pairs were made, exactly as roster ids
 * are and for the same reason (decision #9) — a schedule has to be reproducible from the document
 * when somebody disputes it, and a team is what a Team Americano schedule is made of.
 */
function pairedTeam(
  sessionId: string,
  players: readonly RosterEntry[],
): (pairing: DraftPairing, index: number) => Team {
  return (pairing, index) => ({
    id: `${sessionId}:t${index + 1}`,
    playerIds: [players[pairing[0]].id, players[pairing[1]].id],
  });
}

function newSessionId(): string {
  return crypto.randomUUID();
}
