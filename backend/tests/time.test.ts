import { describe, expect, it } from 'vitest';
import * as frontend from '../../frontend/src/lib/berlinDay';
import { FILM_RELEASE_HOUR, filmReleaseAfter, tapeIndexOf } from '../src/time';

// Zeitlogik in Europe/Berlin — Tage, Tapes und der Sonntagabend fuer Film
// und Imposter-Woche. Unit-Tests ohne Server; Zeitpunkte bewusst in UTC
// angegeben, damit der Test nicht von der Zeitzone der Maschine abhaengt.

const utc = (iso: string) => Date.parse(iso);
const berlin = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const show = (ms: number) => berlin.format(new Date(ms));

describe('filmReleaseAfter — Sonntag 19:00 Berlin', () => {
  it('Mitte der Woche: der kommende Sonntag', () => {
    // Mi 07.10.2026 12:00 MESZ
    expect(show(filmReleaseAfter(utc('2026-10-07T10:00:00Z')))).toBe('Sun 11/10, 19:00');
  });

  it('Sonntag kurz vor 19 Uhr: noch am selben Abend', () => {
    expect(filmReleaseAfter(utc('2026-10-11T16:59:00Z'))).toBe(utc('2026-10-11T17:00:00Z'));
  });

  it('Sonntag ab 19 Uhr: erst der naechste Sonntag', () => {
    expect(filmReleaseAfter(utc('2026-10-11T17:00:00Z'))).toBe(utc('2026-10-18T17:00:00Z'));
    expect(filmReleaseAfter(utc('2026-10-11T17:01:00Z'))).toBe(utc('2026-10-18T17:00:00Z'));
  });

  it('Woche mit Umstellung auf Winterzeit (25.10.2026): 19 Uhr MEZ', () => {
    expect(filmReleaseAfter(utc('2026-10-22T10:00:00Z'))).toBe(utc('2026-10-25T18:00:00Z'));
  });

  it('Woche mit Umstellung auf Sommerzeit (29.03.2026): 19 Uhr MESZ', () => {
    expect(filmReleaseAfter(utc('2026-03-26T10:00:00Z'))).toBe(utc('2026-03-29T17:00:00Z'));
  });

  it('Samstagnacht nach Mitternacht Berlin gehoert schon zum Sonntag', () => {
    // So 11.10. 00:30 MESZ = Sa 22:30 UTC
    expect(filmReleaseAfter(utc('2026-10-10T22:30:00Z'))).toBe(utc('2026-10-11T17:00:00Z'));
  });
});

describe('tapeIndexOf — ein Tape pro Berliner Kalendertag', () => {
  const created = utc('2026-10-24T21:30:00Z'); // Sa 24.10. 23:30 MESZ

  it('Gruendungstag ist Tape 1, nach Mitternacht Berlin Tape 2', () => {
    expect(tapeIndexOf(created, utc('2026-10-24T21:45:00Z'))).toBe(1);
    expect(tapeIndexOf(created, utc('2026-10-24T22:10:00Z'))).toBe(2); // So 00:10 MESZ
  });

  it('Der 25-Stunden-Tag der Zeitumstellung verschiebt nichts', () => {
    expect(tapeIndexOf(created, utc('2026-10-25T22:59:00Z'))).toBe(2); // So 23:59 MEZ
    expect(tapeIndexOf(created, utc('2026-10-25T23:01:00Z'))).toBe(3); // Mo 00:01 MEZ
  });
});

describe('Backend und Frontend rechnen gleich', () => {
  it('Tape-Nummern stimmen ueber zwei Monate inklusive Zeitumstellung ueberein', () => {
    const created = utc('2026-09-30T08:00:00Z');
    for (let t = created; t < utc('2026-12-01T00:00:00Z'); t += 37 * 60_000) {
      expect(frontend.tapeIndexOf(created, t)).toBe(tapeIndexOf(created, t));
    }
  });

  it('Gleiche Freigabestunde fuer den Film', () => {
    expect(frontend.FILM_RELEASE_HOUR).toBe(FILM_RELEASE_HOUR);
  });

  it('Das Altern der Kassette folgt denselben Kalendertagen', () => {
    const created = utc('2026-10-01T10:00:00Z');
    expect(frontend.ageStageOf(created, utc('2026-10-10T21:59:00Z'))).toBe(0); // 10.10. 23:59 MESZ
    expect(frontend.ageStageOf(created, utc('2026-10-10T22:01:00Z'))).toBe(1); // 11.10. 00:01 MESZ
    expect(frontend.ageStageOf(created, utc('2027-06-01T10:00:00Z'))).toBe(frontend.AGE_MAX_STAGE);
  });
});
