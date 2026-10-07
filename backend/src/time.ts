/*
 * Zeitlogik in Europe/Berlin. Gespiegelt in frontend/src/lib/berlinDay.ts —
 * bei einer Aenderung beide Seiten pflegen; tests/time.test.ts prueft, dass
 * beide dasselbe rechnen.
 */

export const BERLIN_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Kalendertag in Europe/Berlin als UTC-Mitternacht — bewusst NICHT der
 *  rohe Zeitstempel, sonst driftet die Differenz an DST-Umstellungstagen
 *  (23h/25h statt 24h) und Tagesgrenzen landen an der falschen Stelle. */
export function berlinCivilDay(ms: number): number {
  const parts = BERLIN_DAY.formatToParts(new Date(ms));
  const y = Number(parts.find((p) => p.type === 'year')!.value);
  const m = Number(parts.find((p) => p.type === 'month')!.value);
  const d = Number(parts.find((p) => p.type === 'day')!.value);
  return Date.UTC(y, m - 1, d);
}

/** Tape-Nummer: 1 = Gruendungstag der Kassette, danach ein Tape pro
 *  Kalendertag, unabhaengig davon ob gepostet wurde. */
export function tapeIndexOf(cassetteCreatedAt: number, postedAt: number): number {
  const days = Math.round((berlinCivilDay(postedAt) - berlinCivilDay(cassetteCreatedAt)) / 86_400_000);
  return days + 1;
}

const BERLIN_CLOCK = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Wie weit Berliner Ortszeit zu diesem Zeitpunkt vor UTC liegt (1 h / 2 h). */
function berlinOffsetMs(ms: number): number {
  const parts = BERLIN_CLOCK.formatToParts(new Date(ms));
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Berliner Ortszeit (Kalendertag als UTC-Mitternacht + Stunde) → echter
 *  Zeitpunkt. Zweimal korrigiert, damit es auch am Umstellungstag stimmt. */
export function berlinWallClock(civilDay: number, hour: number): number {
  const wall = civilDay + hour * 3_600_000;
  const first = wall - berlinOffsetMs(wall);
  return wall - berlinOffsetMs(first);
}

/** Sonntagabend: dann wird der Film der Woche fuer alle zugleich entwickelt
 *  (Spiegel in frontend/src/lib/berlinDay.ts). */
export const FILM_RELEASE_HOUR = 19;

/** Naechste Film-Freigabe NACH `ms` — Sonntag 19:00 Europe/Berlin. Wer
 *  Sonntag um 19:01 belichtet, landet im Film der folgenden Woche. */
export function filmReleaseAfter(ms: number): number {
  const today = berlinCivilDay(ms);
  const weekday = new Date(today).getUTCDay(); // 0 = Sonntag
  let release = berlinWallClock(today + ((7 - weekday) % 7) * 86_400_000, FILM_RELEASE_HOUR);
  if (release <= ms) release = berlinWallClock(today + (((7 - weekday) % 7) + 7) * 86_400_000, FILM_RELEASE_HOUR);
  return release;
}

/** Uhrzeit und Datum fuer Druckstuecke (Album, Brief). UTC_DATE formatiert
 *  einen Kalendertag, der schon als UTC-Mitternacht vorliegt (berlinCivilDay). */
export const BERLIN_HM = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
});
export const UTC_DATE = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
