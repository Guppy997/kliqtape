import { beforeAll, describe, expect, it } from 'vitest';
import { api, cassetteWith, fetchMedia, nameOf, upload } from './fixtures';

// Wochen-Challenge: eine pro Woche fuer alle Kassetten, geplant vom
// Kliqtape-Kanal. Man macht sie einmal und legt sie in mehrere eigene
// Kassetten; bis Sonntagabend sieht niemand etwas, auch man selbst nicht.

const ANNA = nameOf('anna');
const BEN = nameOf('ben');
const CARA = nameOf('cara');
const DORA = nameOf('dora');
const EMIL = nameOf('emil');
const KANAL = nameOf('kanal');

describe('Wochen-Challenge', () => {
  let one: string;
  let two: string;
  let releaseAt: number;
  let benMedia: string;

  beforeAll(async () => {
    one = await cassetteWith('anna', ['ben', 'dora'], 'Challenge eins');
    two = await cassetteWith('emil', ['ben'], 'Challenge zwei');
  });

  it('Planen darf nur der Kliqtape-Kanal', async () => {
    expect((await api('GET', `/api/challenges?me=${ANNA}`, 'anna')).status).toBe(403);
    expect((await api('GET', `/api/challenges?me=${KANAL}`, null)).status).toBe(401);
    const plan = await api('GET', `/api/challenges?me=${KANAL}`, 'kanal');
    expect(plan.status).toBe(200);
    expect(plan.body.weeks).toHaveLength(8);
    releaseAt = plan.body.weeks[0].releaseAt;
    const put = await api('PUT', `/api/challenges/${releaseAt}`, 'anna', { me: ANNA, type: 'photo', theme: 'x' });
    expect(put.status).toBe(403);
  });

  it('Der Kanal plant die laufende Woche, alle sehen dieselbe', async () => {
    const put = await api('PUT', `/api/challenges/${releaseAt}`, 'kanal', {
      me: KANAL,
      type: 'photo',
      theme: 'Etwas Rotes',
    });
    expect(put.status).toBe(200);
    for (const who of ['anna', 'emil'] as const) {
      const res = await api('GET', `/api/challenge?me=${nameOf(who)}`, who);
      expect(res.body.current).toMatchObject({ type: 'photo', theme: 'Etwas Rotes', releaseAt });
      expect(res.body.mine).toBeNull();
    }
    // Nur Sonntage 19 Uhr der naechsten Wochen
    expect((await api('PUT', `/api/challenges/${releaseAt + 1}`, 'kanal', { me: KANAL, type: 'photo' })).status).toBe(
      400,
    );
  });

  it('Mitmachen: einmal pro Woche', async () => {
    const shot = await upload('ben');
    benMedia = shot.body.id;
    const entry = await api('POST', '/api/challenge/entry', 'ben', { me: BEN, mediaId: benMedia, caption: 'rot' });
    expect(entry.status).toBe(201);
    const again = await api('POST', '/api/challenge/entry', 'ben', { me: BEN, mediaId: (await upload('ben')).body.id });
    expect(again.status).toBe(409);
    expect((await api('POST', '/api/challenge/entry', null, { me: BEN, mediaId: benMedia })).status).toBe(401);
  });

  it('Ein Bild, das schon woanders haengt, wird abgelehnt', async () => {
    const m = await upload('dora');
    const post = await api('POST', '/api/posts', 'dora', {
      cassetteId: one,
      side: 'a',
      author: DORA,
      kind: 'photo',
      mediaId: m.body.id,
    });
    expect(post.status).toBe(201);
    const res = await api('POST', '/api/challenge/entry', 'dora', { me: DORA, mediaId: m.body.id });
    expect(res.status).toBe(400);
  });

  it('Fremder darf nichts hineinlegen oder herausnehmen', async () => {
    expect((await api('POST', `/api/cassettes/${one}/challenge/share`, 'cara', { me: CARA })).status).toBe(403);
    expect((await api('DELETE', `/api/cassettes/${one}/challenge/share?me=${CARA}`, 'cara')).status).toBe(403);
    expect((await api('GET', `/api/cassettes/${one}/challenge?me=${CARA}`, 'cara')).status).toBe(403);
  });

  it('Einmal gemacht, in zwei Kassetten gelegt — bis Sonntag fuer niemanden sichtbar', async () => {
    expect((await api('POST', `/api/cassettes/${one}/challenge/share`, 'ben', { me: BEN })).status).toBe(201);
    expect((await api('POST', `/api/cassettes/${two}/challenge/share`, 'ben', { me: BEN })).status).toBe(201);
    expect((await api('POST', `/api/cassettes/${one}/challenge/share`, 'ben', { me: BEN })).status).toBe(409);

    expect(await fetchMedia(benMedia)).toBe(404);
    const feed = await api('GET', `/api/posts?side=a&cassette=${one}&me=${ANNA}`, 'anna');
    expect(feed.body.some((p: any) => p.source === 'challenge')).toBe(false);

    const mine = await api('GET', `/api/challenge?me=${BEN}`, 'ben');
    expect(mine.body.mine.cassetteIds.sort()).toEqual([one, two].sort());
  });

  it('Der Status verraet nur den eigenen Stand', async () => {
    const res = await api('GET', `/api/cassettes/${one}/challenge?me=${ANNA}`, 'anna');
    expect(res.status).toBe(200);
    expect(res.body.mine).toEqual({ entry: null, sharedHere: false });
    expect(res.body.developed).toBeNull();
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(BEN);
    expect(text).not.toMatch(/count|anzahl|streak/i);
  });

  it('Nach dem ersten Beitrag laesst sich die Woche nicht mehr umplanen', async () => {
    const res = await api('PUT', `/api/challenges/${releaseAt}`, 'kanal', { me: KANAL, type: 'photo', theme: 'neu' });
    expect(res.status).toBe(409);
  });

  it('Herausnehmen vor Sonntag: Beitrag bleibt, laesst sich neu ablegen', async () => {
    const m = await upload('emil');
    expect((await api('POST', '/api/challenge/entry', 'emil', { me: EMIL, mediaId: m.body.id })).status).toBe(201);
    expect((await api('POST', `/api/cassettes/${two}/challenge/share`, 'emil', { me: EMIL })).status).toBe(201);
    expect((await api('DELETE', `/api/cassettes/${two}/challenge/share?me=${EMIL}`, 'emil')).status).toBe(204);
    const status = await api('GET', `/api/cassettes/${two}/challenge?me=${EMIL}`, 'emil');
    expect(status.body.mine.sharedHere).toBe(false);
    expect(status.body.mine.entry).not.toBeNull();
  });

  it('Sonntag vorziehen (Demo): in beiden Kassetten sichtbar', async () => {
    expect((await api('POST', '/api/challenge/demo/release', null, { me: ANNA })).status).toBe(401);
    expect((await api('POST', '/api/challenge/demo/release', 'anna', { me: ANNA })).status).toBe(200);
    expect(await fetchMedia(benMedia)).toBe(200);
    for (const [cassette, who] of [
      [one, 'anna'],
      [two, 'emil'],
    ] as const) {
      const feed = await api('GET', `/api/posts?side=a&cassette=${cassette}&me=${nameOf(who)}`, who);
      const post = feed.body.find((p: any) => p.source === 'challenge');
      expect(post).toMatchObject({
        author: BEN,
        mediaId: benMedia,
        challenge: { type: 'photo', theme: 'Etwas Rotes' },
      });
    }
    const status = await api('GET', `/api/cassettes/${one}/challenge?me=${ANNA}`, 'anna');
    expect(status.body.developed.shots.map((s: any) => s.author)).toEqual([BEN]);
  });

  it('Einen geteilten Beitrag loeschen laesst das Bild in der anderen Kassette stehen', async () => {
    const feed = await api('GET', `/api/posts?side=a&cassette=${one}&me=${BEN}`, 'ben');
    const post = feed.body.find((p: any) => p.source === 'challenge' && p.author === BEN);
    expect((await api('DELETE', `/api/posts/${post.id}?me=${BEN}`, 'ben')).status).toBe(204);
    expect(await fetchMedia(benMedia)).toBe(200);
    const other = await api('GET', `/api/posts?side=a&cassette=${two}&me=${EMIL}`, 'emil');
    expect(other.body.some((p: any) => p.mediaId === benMedia)).toBe(true);
  });

  it('Demo-Woche anlegen braucht eine Anmeldung', async () => {
    expect((await api('POST', '/api/challenge/demo', null, { me: ANNA, type: 'photo' })).status).toBe(401);
    expect((await api('POST', '/api/challenge/demo', 'anna', { me: ANNA, type: 'quatsch' })).status).toBe(400);
  });
});

describe('Wochen-Challenge abschalten', () => {
  let x: string;

  beforeAll(async () => {
    x = await cassetteWith('anna', ['ben', 'dora', 'emil'], 'Schalterrunde');
    // Eine frische Woche, unabhaengig davon, was andere Tests schon aufgeloest haben.
    expect((await api('POST', '/api/challenge/demo', 'anna', { me: ANNA, type: 'photo' })).status).toBe(201);
  });

  it('Fremder darf nichts umschalten', async () => {
    expect((await api('PUT', `/api/cassettes/${x}/challenge`, 'cara', { me: CARA, off: true })).status).toBe(403);
    expect((await api('PUT', `/api/cassettes/${x}/challenge/mute`, 'cara', { me: CARA, muted: true })).status).toBe(
      403,
    );
    expect(
      (await api('PUT', `/api/cassettes/${x}/members/${BEN}/admin`, 'cara', { me: CARA, admin: true })).status,
    ).toBe(403);
  });

  it('Abschalten duerfen nur Admins — die Gruenderin und wen sie ernennt', async () => {
    expect((await api('PUT', `/api/cassettes/${x}/challenge`, 'ben', { me: BEN, off: true })).status).toBe(403);
    expect(
      (await api('PUT', `/api/cassettes/${x}/members/${DORA}/admin`, 'ben', { me: BEN, admin: true })).status,
    ).toBe(403);
    // Gegenprobe: die Gruenderin ernennt Ben, dann darf er
    expect(
      (await api('PUT', `/api/cassettes/${x}/members/${BEN}/admin`, 'anna', { me: ANNA, admin: true })).status,
    ).toBe(200);
    const members = await api('GET', `/api/cassettes/${x}/members?me=${DORA}`, 'dora');
    expect(members.body.find((m: any) => m.name === BEN).admin).toBe(true);
    expect(members.body.find((m: any) => m.name === ANNA).admin).toBe(true);
    expect((await api('PUT', `/api/cassettes/${x}/challenge`, 'ben', { me: BEN, off: false })).status).toBe(200);
  });

  it('Die Gruenderin bleibt Admin', async () => {
    const res = await api('PUT', `/api/cassettes/${x}/members/${ANNA}/admin`, 'ben', { me: BEN, admin: false });
    expect(res.status).toBe(400);
  });

  it('Abschalten zieht ausstehende Beitraege zurueck und sperrt neue', async () => {
    const m = await upload('dora');
    expect((await api('POST', '/api/challenge/entry', 'dora', { me: DORA, mediaId: m.body.id })).status).toBe(201);
    expect((await api('POST', `/api/cassettes/${x}/challenge/share`, 'dora', { me: DORA })).status).toBe(201);

    const off = await api('PUT', `/api/cassettes/${x}/challenge`, 'anna', { me: ANNA, off: true });
    expect(off.body).toEqual({ off: true, withdrawn: 1 });
    const status = await api('GET', `/api/cassettes/${x}/challenge?me=${DORA}`, 'dora');
    expect(status.body).toMatchObject({ off: true, mine: { sharedHere: false } });
    expect(status.body.mine.entry).not.toBeNull();
    expect((await api('POST', `/api/cassettes/${x}/challenge/share`, 'dora', { me: DORA })).status).toBe(409);

    expect((await api('PUT', `/api/cassettes/${x}/challenge`, 'anna', { me: ANNA, off: false })).status).toBe(200);
  });

  it('Stummschalten gilt nur fuer einen selbst', async () => {
    const m = await upload('emil');
    expect((await api('POST', '/api/challenge/entry', 'emil', { me: EMIL, mediaId: m.body.id })).status).toBe(201);
    expect((await api('PUT', `/api/cassettes/${x}/challenge/mute`, 'emil', { me: EMIL, muted: true })).status).toBe(
      200,
    );
    expect((await api('POST', `/api/cassettes/${x}/challenge/share`, 'emil', { me: EMIL })).status).toBe(409);
    const global = await api('GET', `/api/challenge?me=${EMIL}`, 'emil');
    expect(global.body.openCassetteIds).not.toContain(x);
    // Die anderen legen weiter hinein
    expect((await api('POST', `/api/cassettes/${x}/challenge/share`, 'dora', { me: DORA })).status).toBe(201);
    // Niemand sieht, wer stumm ist: der Status anderer kennt nur den eigenen Schalter
    const dora = await api('GET', `/api/cassettes/${x}/challenge?me=${DORA}`, 'dora');
    expect(dora.body.muted).toBe(false);
    expect(JSON.stringify(dora.body)).not.toContain(EMIL);
  });
});

describe('Super-8 und Damals', () => {
  let x: string;
  const YEAR = 365 * 86_400_000;

  beforeAll(async () => {
    x = await cassetteWith('dora', ['emil'], 'Typenrunde');
  });

  it('Super-8: nur ein Clip, hoechstens 10 Sekunden', async () => {
    expect((await api('POST', '/api/challenge/demo', 'dora', { me: DORA, type: 'super8' })).status).toBe(201);
    const photo = await upload('dora');
    expect((await api('POST', '/api/challenge/entry', 'dora', { me: DORA, mediaId: photo.body.id })).status).toBe(400);
    const long = await upload('dora', 'video/webm', 12_000);
    expect((await api('POST', '/api/challenge/entry', 'dora', { me: DORA, mediaId: long.body.id })).status).toBe(400);
    const clip = await upload('dora', 'video/webm', 9_000);
    const ok = await api('POST', '/api/challenge/entry', 'dora', { me: DORA, mediaId: clip.body.id });
    expect(ok.status).toBe(201);
    expect(ok.body.kind).toBe('video');
  });

  it('Damals: mindestens ein Jahr alt, das Datum steht dann am Abzug', async () => {
    expect((await api('POST', '/api/challenge/demo', 'emil', { me: EMIL, type: 'damals' })).status).toBe(201);
    const m = await upload('emil');
    const young = await api('POST', '/api/challenge/entry', 'emil', {
      me: EMIL,
      mediaId: m.body.id,
      takenAt: Date.now() - 30 * 86_400_000,
    });
    expect(young.status).toBe(400);
    expect((await api('POST', '/api/challenge/entry', 'emil', { me: EMIL, mediaId: m.body.id })).status).toBe(400);

    const then = Date.now() - 3 * YEAR;
    const ok = await api('POST', '/api/challenge/entry', 'emil', { me: EMIL, mediaId: m.body.id, takenAt: then });
    expect(ok.status).toBe(201);
    expect((await api('POST', `/api/cassettes/${x}/challenge/share`, 'emil', { me: EMIL })).status).toBe(201);
    expect((await api('POST', '/api/challenge/demo/release', 'emil', { me: EMIL })).status).toBe(200);
    const feed = await api('GET', `/api/posts?side=a&cassette=${x}&me=${DORA}`, 'dora');
    const post = feed.body.find((p: any) => p.source === 'challenge');
    expect(post).toMatchObject({ takenAt: then, challenge: { type: 'damals' } });
  });
});

describe('Mixtape-Challenge', () => {
  let x: string;
  let roundTape: string;
  let draft: string;

  beforeAll(async () => {
    x = await cassetteWith('ben', ['anna'], 'Mixtaperunde');
    expect((await api('POST', '/api/challenge/demo', 'ben', { me: BEN, type: 'mixtape' })).status).toBe(201);
    const t = await api('POST', '/api/mixtapes', 'ben', { from: BEN, forRound: true, title: 'Herbst' });
    expect(t.status).toBe(201);
    expect(t.body.to).toBe('');
    roundTape = t.body.id;
    await api('POST', `/api/mixtapes/${roundTape}/tracks`, 'ben', { me: BEN, title: 'Autumn Leaves', artist: 'Chet' });
    expect((await api('POST', `/api/mixtapes/${roundTape}/seal`, 'ben', { me: BEN })).status).toBe(200);
    draft = (await api('POST', '/api/mixtapes', 'ben', { from: BEN, forRound: true, title: 'Entwurf' })).body.id;
  });

  it('Fremdes Tape oder ein Entwurf geht nicht', async () => {
    expect((await api('POST', '/api/challenge/entry', 'cara', { me: CARA, tapeId: roundTape })).status).toBe(403);
    expect((await api('POST', '/api/challenge/entry', 'ben', { me: BEN, tapeId: draft })).status).toBe(400);
  });

  it('Ein Tape fuer die Runde landet nach der Aufloesung im Band', async () => {
    const entry = await api('POST', '/api/challenge/entry', 'ben', { me: BEN, tapeId: roundTape });
    expect(entry.status).toBe(201);
    expect(entry.body).toMatchObject({ kind: 'tape', tapeId: roundTape });
    expect((await api('POST', `/api/cassettes/${x}/challenge/share`, 'ben', { me: BEN })).status).toBe(201);
    expect((await api('POST', '/api/challenge/demo/release', 'ben', { me: BEN })).status).toBe(200);
    const feed = await api('GET', `/api/posts?side=a&cassette=${x}&me=${ANNA}`, 'anna');
    const post = feed.body.find((p: any) => p.source === 'challenge');
    expect(post).toMatchObject({ kind: 'tape', tapeId: roundTape, tape: { title: 'Herbst' } });
  });

  it('Ein geteiltes Tape laesst sich nicht mehr loeschen (409 statt Absturz)', async () => {
    expect((await api('DELETE', `/api/mixtapes/${roundTape}?me=${BEN}`, 'ben')).status).toBe(409);
    expect((await api('DELETE', `/api/mixtapes/${draft}?me=${BEN}`, 'ben')).status).toBe(204);
  });
});
