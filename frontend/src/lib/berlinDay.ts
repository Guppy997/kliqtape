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

/* --- Entwickelter Film ------------------------------------------------------
 * Spiegel zu filmReleaseAfter() in backend/src/server.ts. Der Server liefert
 * den Freigabezeitpunkt mit (GET /api/cassettes/:id/film) und ist die
 * Wahrheit; hier wird nur gerechnet, um Daten lesbar zu machen. */

/** Sonntagabend, an dem der Film der Woche fuer alle zugleich entwickelt wird. */
export const FILM_RELEASE_HOUR = 19;

const BERLIN_WEEKDAY = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long' });
const BERLIN_SHORT_DATE = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  day: '2-digit',
  month: '2-digit',
});

/** "Sonntag, 11.10. um 19 Uhr" — fuer Freigabe-Hinweise. */
export function filmReleaseLabel(ms: number): string {
  const d = new Date(ms);
  return `${BERLIN_WEEKDAY.format(d)}, ${BERLIN_SHORT_DATE.format(d)} um ${FILM_RELEASE_HOUR} Uhr`;
}

/** "Mi, 14:32" — wann ein Filmbild belichtet wurde. */
export function takenLabel(ms: number): string {
  const d = new Date(ms);
  const wd = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short' }).format(d).replace('.', '');
  return `${wd}, ${berlinTimeLabel(ms)}`;
}

/** Datumsaufdruck wie bei einer Einwegkamera: "'26 10 07". */
export function filmStampLabel(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));
  const v = (t: string) => parts.find((p) => p.type === t)!.value;
  return `'${v('year')} ${v('month')} ${v('day')}`;
}

/* --- Kassette altert --------------------------------------------------------
 * Alle 10 Berliner Kalendertage seit Gruendung eine Stufe abgenutzter,
 * nach 90 Tagen ist das Maximum erreicht. Rein optisch, deshalb nur hier und
 * nicht im Backend — die Tageszaehlung ist dieselbe wie bei tapeIndexOf(). */

export const AGE_STEP_DAYS = 10;
export const AGE_MAX_STAGE = 9;

export function ageStageOf(cassetteCreatedAt: number, now = Date.now()): number {
  const days = Math.round((berlinCivilDay(now) - berlinCivilDay(cassetteCreatedAt)) / 86_400_000);
  return Math.max(0, Math.min(AGE_MAX_STAGE, Math.floor(days / AGE_STEP_DAYS)));
}
