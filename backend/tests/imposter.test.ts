import { beforeAll, describe, expect, it } from 'vitest';
import { api, cassetteWith, fetchMedia, nameOf, upload, type Person } from './fixtures';

// Imposter-Woche: nur ab vier Leuten, genau eine Person bekommt nur einen
// Hinweis, Beitraege bis Sonntagabend verborgen, dann tippen und aufloesen.

const ANNA = nameOf('anna');
const CARA = nameOf('cara');
const PLAYERS: Person[] = ['anna', 'ben', 'dora', 'emil'];

interface Card {
  imposter: boolean;
  text: string;
}

describe('Imposter-Woche', () => {
  let cassette: string;
  let imposter: Person;
  let entryKind: 'photo' | 'text';
  const mediaOf: Partial<Record<Person, string>> = {};

  beforeAll(async () => {
    cassette = await cassetteWith('anna', ['ben', 'dora', 'emil']);
  });

  it('Unter vier Leuten gibt es keine Imposter-Woche', async () => {
    const small = await cassetteWith('anna', ['ben']);
    expect((await api('POST', `/api/cassettes/${small}/imposter`, 'anna', { by: ANNA })).status).toBe(400);
  });

  it('Fremder darf nicht starten und sieht nichts', async () => {
    expect((await api('POST', `/api/cassettes/${cassette}/imposter`, 'cara', { by: CARA })).status).toBe(403);
    expect((await api('GET', `/api/cassettes/${cassette}/imposter?me=${CARA}`, 'cara')).status).toBe(403);
  });

  it('Start klappt einmal, ein zweiter Start waehrend der Woche nicht', async () => {
    expect((await api('POST', `/api/cassettes/${cassette}/imposter`, 'anna', { by: ANNA })).status).toBe(201);
    expect((await api('POST', `/api/cassettes/${cassette}/imposter`, 'ben', { by: nameOf('ben') })).status).toBe(409);
  });

  it('Genau eine Person ist Imposter und bekommt nur den Hinweis', async () => {
    const cards: [Person, Card][] = [];
    for (const p of PLAYERS) {
      const res = await api('GET', `/api/cassettes/${cassette}/imposter?me=${nameOf(p)}`, p);
      expect(res.body.week.phase).toBe('playing');
      cards.push([p, res.body.week.card]);
      entryKind = res.body.week.entryKind;
    }
    const imposters = cards.filter(([, c]) => c.imposter);
    expect(imposters).toHaveLength(1);
    imposter = imposters[0]![0];
    const tasks = new Set(cards.filter(([, c]) => !c.imposter).map(([, c]) => c.text));
    expect(tasks.size).toBe(1);
    expect(tasks.has(imposters[0]![1].text)).toBe(false);
  });

  it('Fremder darf nichts abgeben, nicht tippen, nicht aufloesen, nicht vorziehen', async () => {
    const m = await upload('cara');
    const base = `/api/cassettes/${cassette}/imposter`;
    expect((await api('POST', `${base}/entry`, 'cara', { author: CARA, mediaId: m.body.id, body: 'x' })).status).toBe(403);
    expect((await api('POST', `${base}/vote`, 'cara', { by: CARA, suspect: ANNA })).status).toBe(403);
    expect((await api('POST', `${base}/reveal`, 'cara', { by: CARA })).status).toBe(403);
    expect((await api('POST', `${base}/now`, 'cara', { by: CARA })).status).toBe(403);
  });

  it('Beitraege bleiben bis Sonntagabend verborgen, auch die Bilder', async () => {
    for (const p of PLAYERS) {
      const payload: Record<string, string> = { author: nameOf(p) };
      if (entryKind === 'photo') {
        const m = await upload(p);
        mediaOf[p] = m.body.id;
        payload.mediaId = m.body.id;
      } else {
        payload.body = `Beitrag von ${nameOf(p)}`;
      }
      expect((await api('POST', `/api/cassettes/${cassette}/imposter/entry`, p, payload)).status).toBe(201);
    }
    // Zweite Abgabe geht nicht
    expect((await api('POST', `/api/cassettes/${cassette}/imposter/entry`, 'anna', { author: ANNA, body: 'nochmal' })).status).toBe(409);
    if (entryKind === 'photo') expect(await fetchMedia(mediaOf.anna!)).toBe(404);
    const feed = await api('GET', `/api/posts?side=a&cassette=${cassette}&me=${ANNA}`, 'anna');
    expect(feed.body.filter((p: { source: string }) => p.source === 'imposter')).toHaveLength(0);
    const status = await api('GET', `/api/cassettes/${cassette}/imposter?me=${ANNA}`, 'anna');
    expect(status.body.week.entries).toHaveLength(0);
  });

  it('Vor Sonntagabend wird nicht getippt; vorziehen darf nur die Gruenderin', async () => {
    expect((await api('POST', `/api/cassettes/${cassette}/imposter/vote`, 'ben', { by: nameOf('ben'), suspect: ANNA })).status).toBe(409);
    expect((await api('POST', `/api/cassettes/${cassette}/imposter/now`, 'ben', { by: nameOf('ben') })).status).toBe(403);
    expect((await api('POST', `/api/cassettes/${cassette}/imposter/now`, 'anna', { by: ANNA })).status).toBe(200);
  });

  it('Nach der Freigabe: alle Beitraege sichtbar, im Archiv noch ohne Aufloesung', async () => {
    const status = await api('GET', `/api/cassettes/${cassette}/imposter?me=${ANNA}`, 'anna');
    expect(status.body.week.phase).toBe('voting');
    expect(status.body.week.entries).toHaveLength(4);
    expect(status.body.week.result).toBeNull();
    if (entryKind === 'photo') expect(await fetchMedia(mediaOf.anna!)).toBe(200);
    const feed = await api('GET', `/api/posts?side=a&cassette=${cassette}&me=${ANNA}`, 'anna');
    const marks = feed.body.filter((p: { source: string }) => p.source === 'imposter').map((p: { imposterMark: string }) => p.imposterMark);
    expect(marks).toEqual(['entry', 'entry', 'entry', 'entry']);
  });

  it('Tippen: nicht auf sich selbst, aufloesen erst wenn alle getippt haben', async () => {
    const other = PLAYERS.find((p) => p !== imposter)!;
    expect((await api('POST', `/api/cassettes/${cassette}/imposter/vote`, other, { by: nameOf(other), suspect: nameOf(other) })).status).toBe(400);
    for (const p of PLAYERS) {
      const suspect = p === imposter ? PLAYERS.find((q) => q !== imposter)! : imposter;
      expect((await api('POST', `/api/cassettes/${cassette}/imposter/vote`, p, { by: nameOf(p), suspect: nameOf(suspect) })).status).toBe(201);
      if (p === 'ben') {
        // ben hat nicht gestartet, und noch haben nicht alle getippt
        expect((await api('POST', `/api/cassettes/${cassette}/imposter/reveal`, 'ben', { by: nameOf('ben') })).status).toBe(403);
      }
    }
    expect((await api('POST', `/api/cassettes/${cassette}/imposter/reveal`, 'ben', { by: nameOf('ben') })).status).toBe(200);
  });

  it('Aufloesung: wer es war, ob die Runde richtig lag — keine Zahlen', async () => {
    const status = await api('GET', `/api/cassettes/${cassette}/imposter?me=${ANNA}`, 'anna');
    expect(status.body.week.phase).toBe('revealed');
    expect(status.body.week.result.imposter).toBe(nameOf(imposter));
    expect(status.body.week.result.caught).toBe(true);
    expect(Object.keys(status.body.week.result).sort()).toEqual(['caught', 'hint', 'imposter', 'revealedAt', 'task']);
    const feed = await api('GET', `/api/posts?side=a&cassette=${cassette}&me=${ANNA}`, 'anna');
    const mine = feed.body.find((p: { author: string; source: string }) => p.source === 'imposter' && p.author === nameOf(imposter));
    expect(mine.imposterMark).toBe('imposter');
  });
});
