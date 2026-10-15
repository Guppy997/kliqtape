import { beforeAll, describe, expect, it } from 'vitest';
import { api, cassetteWith, fetchMedia, nameOf, upload, type Person } from './fixtures';

// Imposter-Woche als Typ der Wochen-Challenge: jede Runde ab vier
// Mitspielenden bekommt ihr eigenes Spiel, genau eine Person nur einen
// Hinweis, Beitraege bis Sonntagabend verborgen, dann tippen und aufloesen.
// Pro Woche ist man in hoechstens einer Runde Imposter.

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
    // Der Kanal plant die Woche — in der Demo laesst sie sich sofort starten.
    expect((await api('POST', '/api/challenge/demo', 'anna', { me: ANNA, type: 'imposter' })).status).toBe(201);
  });

  it('Unter vier Leuten setzt die Runde aus', async () => {
    const small = await cassetteWith('anna', ['ben']);
    const res = await api('GET', `/api/cassettes/${small}/imposter?me=${ANNA}`, 'anna');
    expect(res.status).toBe(200);
    expect(res.body.week).toBeNull();
  });

  it('Fremder sieht nichts; von Hand starten gibt es nicht mehr', async () => {
    expect((await api('GET', `/api/cassettes/${cassette}/imposter?me=${CARA}`, 'cara')).status).toBe(403);
    expect((await api('POST', `/api/cassettes/${cassette}/imposter`, 'anna', { by: ANNA })).status).toBe(404);
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

  it('Fremder darf nichts abgeben, nicht tippen, nicht aufloesen', async () => {
    const m = await upload('cara');
    const base = `/api/cassettes/${cassette}/imposter`;
    expect((await api('POST', `${base}/entry`, 'cara', { author: CARA, mediaId: m.body.id, body: 'x' })).status).toBe(
      403,
    );
    expect((await api('POST', `${base}/vote`, 'cara', { by: CARA, suspect: ANNA })).status).toBe(403);
    expect((await api('POST', `${base}/reveal`, 'cara', { by: CARA })).status).toBe(403);
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
    expect(
      (await api('POST', `/api/cassettes/${cassette}/imposter/entry`, 'anna', { author: ANNA, body: 'nochmal' }))
        .status,
    ).toBe(409);
    if (entryKind === 'photo') expect(await fetchMedia(mediaOf.anna!)).toBe(404);
    const feed = await api('GET', `/api/posts?side=a&cassette=${cassette}&me=${ANNA}`, 'anna');
    expect(feed.body.filter((p: { source: string }) => p.source === 'imposter')).toHaveLength(0);
    const status = await api('GET', `/api/cassettes/${cassette}/imposter?me=${ANNA}`, 'anna');
    expect(status.body.week.entries).toHaveLength(0);
  });

  it('Vor Sonntagabend wird nicht getippt', async () => {
    expect(
      (await api('POST', `/api/cassettes/${cassette}/imposter/vote`, 'ben', { by: nameOf('ben'), suspect: ANNA }))
        .status,
    ).toBe(409);
    // Demo: Sonntagabend vorziehen — fuer die ganze Challenge-Woche
    expect((await api('POST', '/api/challenge/demo/release', 'anna', { me: ANNA })).status).toBe(200);
  });

  it('Nach der Freigabe: alle Beitraege sichtbar, im Archiv noch ohne Aufloesung', async () => {
    const status = await api('GET', `/api/cassettes/${cassette}/imposter?me=${ANNA}`, 'anna');
    expect(status.body.week.phase).toBe('voting');
    expect(status.body.week.entries).toHaveLength(4);
    expect(status.body.week.result).toBeNull();
    // Wer schon getippt hat, verraet der Server nicht — das Feld bleibt nur
    // fuer aeltere App-Versionen da, und zwar leer.
    expect(status.body.week.voted).toEqual([]);
    if (entryKind === 'photo') expect(await fetchMedia(mediaOf.anna!)).toBe(200);
    const feed = await api('GET', `/api/posts?side=a&cassette=${cassette}&me=${ANNA}`, 'anna');
    const marks = feed.body
      .filter((p: { source: string }) => p.source === 'imposter')
      .map((p: { imposterMark: string }) => p.imposterMark);
    expect(marks).toEqual(['entry', 'entry', 'entry', 'entry']);
  });

  it('Tippen: nicht auf sich selbst, aufloesen erst wenn alle getippt haben', async () => {
    const other = PLAYERS.find((p) => p !== imposter)!;
    expect(
      (
        await api('POST', `/api/cassettes/${cassette}/imposter/vote`, other, {
          by: nameOf(other),
          suspect: nameOf(other),
        })
      ).status,
    ).toBe(400);
    for (const p of PLAYERS) {
      const suspect = p === imposter ? PLAYERS.find((q) => q !== imposter)! : imposter;
      expect(
        (await api('POST', `/api/cassettes/${cassette}/imposter/vote`, p, { by: nameOf(p), suspect: nameOf(suspect) }))
          .status,
      ).toBe(201);
      if (p === 'ben') {
        // ben ist kein Admin der Runde, und noch haben nicht alle getippt
        expect(
          (await api('POST', `/api/cassettes/${cassette}/imposter/reveal`, 'ben', { by: nameOf('ben') })).status,
        ).toBe(403);
      }
    }
    expect((await api('POST', `/api/cassettes/${cassette}/imposter/reveal`, 'ben', { by: nameOf('ben') })).status).toBe(
      200,
    );
  });

  it('Aufloesung: wer es war, ob die Runde richtig lag — keine Zahlen', async () => {
    const status = await api('GET', `/api/cassettes/${cassette}/imposter?me=${ANNA}`, 'anna');
    expect(status.body.week.phase).toBe('revealed');
    expect(status.body.week.result.imposter).toBe(nameOf(imposter));
    expect(status.body.week.result.caught).toBe(true);
    expect(Object.keys(status.body.week.result).sort()).toEqual(['caught', 'hint', 'imposter', 'revealedAt', 'task']);
    const feed = await api('GET', `/api/posts?side=a&cassette=${cassette}&me=${ANNA}`, 'anna');
    const mine = feed.body.find(
      (p: { author: string; source: string }) => p.source === 'imposter' && p.author === nameOf(imposter),
    );
    expect(mine.imposterMark).toBe('imposter');
  });
});

describe('Imposter ueber mehrere Runden', () => {
  const FOUR: Person[] = ['anna', 'ben', 'dora', 'emil'];
  let one: string;
  let two: string;

  beforeAll(async () => {
    one = await cassetteWith('anna', ['ben', 'dora', 'emil'], 'Runde eins');
    two = await cassetteWith('ben', ['anna', 'dora', 'emil'], 'Runde zwei');
  });

  async function cards(cassette: string): Promise<Map<Person, Card>> {
    const out = new Map<Person, Card>();
    for (const p of FOUR) {
      const res = await api('GET', `/api/cassettes/${cassette}/imposter?me=${nameOf(p)}`, p);
      out.set(p, res.body.week.card);
    }
    return out;
  }

  it('Niemand ist zweimal Imposter, und kein Imposter sieht seine Aufgabe anderswo', async () => {
    // Mehrere Wochen hintereinander, weil Aufgabe und Imposter zufaellig gezogen werden.
    for (let round = 0; round < 6; round++) {
      expect((await api('POST', '/api/challenge/demo', 'anna', { me: ANNA, type: 'imposter' })).status).toBe(201);
      const a = await cards(one);
      const b = await cards(two);
      for (const p of FOUR) expect(a.get(p)!.imposter && b.get(p)!.imposter).toBe(false);
      for (const [mine, other] of [
        [a, b],
        [b, a],
      ] as const) {
        const imposter = [...mine.entries()].find(([, c]) => c.imposter)![0];
        const task = [...mine.values()].find((c) => !c.imposter)!.text;
        // Was der Imposter in der anderen Runde sieht, ist nie die Aufgabe von hier.
        expect(other.get(imposter)!.text).not.toBe(task);
      }
    }
  });

  it('Wer stumm ist, spielt nicht mit — und bekommt keine Karte', async () => {
    const five = await cassetteWith('emil', ['anna', 'ben', 'dora', 'cara'], 'Fuenferrunde');
    expect((await api('PUT', `/api/cassettes/${five}/challenge/mute`, 'cara', { me: CARA, muted: true })).status).toBe(
      200,
    );
    expect((await api('POST', '/api/challenge/demo', 'emil', { me: nameOf('emil'), type: 'imposter' })).status).toBe(
      201,
    );
    const muted = await api('GET', `/api/cassettes/${five}/imposter?me=${CARA}`, 'cara');
    expect(muted.body.week.card).toBeNull();
    const entry = await api('POST', `/api/cassettes/${five}/imposter/entry`, 'cara', { author: CARA, body: 'x' });
    expect(entry.status).toBe(409);

    // Mit einer stummen Person sind es nur noch drei — die Runde setzt aus.
    const four = await cassetteWith('dora', ['anna', 'ben', 'cara'], 'Viererrunde');
    await api('PUT', `/api/cassettes/${four}/challenge/mute`, 'cara', { me: CARA, muted: true });
    expect((await api('GET', `/api/cassettes/${four}/imposter?me=${ANNA}`, 'anna')).body.week).toBeNull();
  });

  it('Eine abgeschaltete Runde spielt nicht mit', async () => {
    const off = await cassetteWith('anna', ['ben', 'dora', 'emil'], 'Ruhige Runde');
    expect((await api('PUT', `/api/cassettes/${off}/challenge`, 'anna', { me: ANNA, off: true })).status).toBe(200);
    expect((await api('GET', `/api/cassettes/${off}/imposter?me=${ANNA}`, 'anna')).body.week).toBeNull();
  });
});
