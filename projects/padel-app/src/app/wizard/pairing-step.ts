/*
 * Step three, and only in Team Americano: who plays with whom (decision #2a, ADR-0017 §1).
 *
 * There is no draw and no seeding here, and adding one would be inventing a decision the group
 * has already made. The pairs are the ones agreed in the car park, so the whole screen is one
 * gesture repeated: tap a name, tap their partner, they are a team.
 *
 * The list only ever offers players who are still on their own, which is what makes an impossible
 * pairing unconstructible rather than merely refused — nobody can be taken off one team and put
 * on another, leaving their old partner standing alone without anyone having said so. Breaking a
 * pair up is the way back, and it returns both names to the list they came from.
 *
 * The roster is even by the time this screen is reached: the Players step holds an odd one with
 * the reason inline (ADR-0017 §4), because a pairing screen with the ninth of nine standing on it
 * has nothing it can offer them.
 */
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { copy } from '../copy/copy';
import { WizardDraft } from './wizard-draft';

@Component({
  selector: 'app-pairing-step',
  templateUrl: './pairing-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PairingStep {
  readonly draft = input.required<WizardDraft>();

  /** The first half of a pair being made, while the second is still being chosen. */
  private readonly chosen = signal<string | null>(null);

  protected readonly copy = copy;

  /** The unpaired names, each carrying whether it is the one waiting for a partner. */
  protected readonly choices = computed(() => {
    const chosen = this.chosen();

    return this.draft()
      .unpaired()
      .map((player) => ({ ...player, waiting: player.id === chosen }));
  });

  /**
   * Tap a name: the first is held, the second makes the team.
   *
   * Tapping the held name again lets it go, so a mis-tap costs one tap rather than a pairing that
   * has to be broken up afterwards.
   */
  protected choose(playerId: string): void {
    const waiting = this.chosen();
    if (waiting === null) {
      this.chosen.set(playerId);

      return;
    }
    if (waiting === playerId) {
      this.chosen.set(null);

      return;
    }

    this.draft().pair(waiting, playerId);
    this.chosen.set(null);
  }

  /** Break a pair up. Neither half is left waiting: both go back to the list. */
  protected unpair(playerId: string): void {
    this.draft().unpair(playerId);
  }
}
