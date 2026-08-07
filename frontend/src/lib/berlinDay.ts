/**
 * Kalendertag-Rechnung in Europe/Berlin — bewusst dupliziert zum
 * Backend-Gegenstück (server.ts), nicht als Shared-Package, weil frontend
 * und backend getrennte tsconfig.json ohne gemeinsamen Workspace-Root haben.
 * Bei einer Aenderung an der Logik: beide Seiten pflegen.
 */

const BERLIN_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function berlinCivilDay(ms: number): number {
  const parts = BERLIN_DAY.formatToParts(new Date(ms));
  const y = Number(parts.find((p) => p.type === 'year')!.value);
  const m = Number(parts.find((p) => p.type === 'month')!.value);
  const d = Number(parts.find((p) => p.type === 'day')!.value);
  return Date.UTC(y, m - 1, d);
}

/** Tape-Nummer eines Zeitpunkts relativ zur Kassettengründung — 1 = Gründungstag. */
export function tapeIndexOf(cassetteCreatedAt: number, ms: number): number {
  const days = Math.round((berlinCivilDay(ms) - berlinCivilDay(cassetteCreatedAt)) / 86_400_000);
  return days + 1;
}

/** Umgekehrte Richtung fürs Datumssprung-Feld: welcher Tag (als `Date`,
 *  Mitternacht Berlin) gehört zu einem gegebenen Tape. */
export function dateOfTapeIndex(cassetteCreatedAt: number, tapeIndex: number): Date {
  return new Date(berlinCivilDay(cassetteCreatedAt) + (tapeIndex - 1) * 86_400_000);
}

export function berlinDateLabel(ms: number): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(ms));
}

export function berlinTimeLabel(ms: number): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}
