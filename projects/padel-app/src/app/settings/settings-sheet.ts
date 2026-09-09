/*
 * The app's first settings surface, and so far the whole of it (ADR-0031 §1).
 *
 * A sheet through `Sheets` rather than a route, because settings is a detour rather than a
 * departure: a page would be a screen the organizer navigates away from mid-evening, and the gear
 * that opens this is on screen *during* a round. It knows nothing about width — a bottom sheet
 * under the thumb on a phone, a centered dialog at the desk, decided in one file for every focused
 * surface in the app (ADR-0022 §4).
 *
 * There is no Save. A theme is applied the instant it is chosen and there is nothing to confirm,
 * so Done is a dismiss rather than a commit — the organizer can see the answer behind the sheet
 * while they are still holding it.
 */
import { ChangeDetectionStrategy, Component, inject, Injectable } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { copy } from '../copy/copy';
import { Preferences } from '../preference/preferences';
import { THEMES } from '../preference/theme';
import type { Theme } from '../preference/theme';
import { Sheets } from '../sheet/sheets';

@Component({
  selector: 'app-settings-sheet',
  templateUrl: './settings-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSheet {
  private readonly preferences = inject(Preferences);
  private readonly sheetRef = inject<DialogRef<void>>(DialogRef);

  protected readonly copy = copy;
  protected readonly themes = THEMES;
  protected readonly chosen = this.preferences.theme;

  /** What one segment of the control says, from the dictionary rather than from the value. */
  protected themeLabel(theme: Theme): string {
    return copy.settings.theme.answers[theme];
  }

  protected chooseTheme(theme: Theme): void {
    this.preferences.chooseTheme(theme);
  }

  protected close(): void {
    this.sheetRef.close();
  }
}

/**
 * Opening the sheet, from whichever header carries the gear.
 *
 * A service for the same reason `Share` and `Confirm` are: a header offers settings, and knowing
 * how a focused surface is opened is not part of offering it.
 */
@Injectable({ providedIn: 'root' })
export class Settings {
  private readonly sheets = inject(Sheets);

  async open(): Promise<void> {
    await this.sheets.open<void, void>(SettingsSheet, undefined);
  }
}
