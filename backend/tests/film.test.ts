import { beforeAll, describe, expect, it } from 'vitest';
import { api, cassetteWith, fetchMedia, nameOf, upload } from './fixtures';

// Entwickelter Film: bis Sonntagabend fuer niemanden sichtbar, auch nicht
// ueber /api/media/:id, danach fuer alle Mitglieder gleichzeitig.

const ANNA = nameOf('anna');
const BEN = nameOf('ben');
const CARA = nameOf('cara');

const berlin = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

describe('Entwickelter Film', () => {
  let cassette: string;
  let shotId: string;
  let mediaId: string;
  let developAt: number;

  beforeAll(async () => {
    cassette = await cassetteWith('anna', ['ben']);
    mediaId = (await upload('ben')).body.id;
    const res = await api('POST', `/api/cassettes/${cassette}/film`, 'ben', { author: BEN, mediaId });
    expect(res.status).toBe(201);
    shotId = res.body.id;
    developAt = res.body.developAt;
  });

  it('Freigabe ist der naechste Sonntag 19:00 Berliner Zeit', () => {
    expect(berlin.format(new Date(developAt))).toBe('Sun 19:00');
    expect(developAt).toBeGreaterThan(Date.now());
    expect(developAt - Date.now()).toBeLessThanOrEqual(7 * 86_400_000);
  });

  it('Fremder darf nicht belichten und sieht keinen Filmstand', async () => {
    const m = await upload('cara');
    expect(
      (await api('POST', `/api/cassettes/${cassette}/film`, 'cara', { author: CARA, mediaId: m.body.id })).status,
    ).toBe(403);
    expect((await api('GET', `/api/cassettes/${cassette}/film?me=${CARA}`, 'cara')).status).toBe(403);
  });

  it('Niemand belichtet im Namen eines Mitglieds', async () => {
    const m = await upload('cara');
    expect(
      (await api('POST', `/api/cassettes/${cassette}/film`, 'cara', { author: ANNA, mediaId: m.body.id })).status,
    ).toBe(401);
  });

  it('Vor der Freigabe liefert der Server das Bild an niemanden aus', async () => {
    expect(await fetchMedia(mediaId)).toBe(404);
    const feedBen = await api('GET', `/api/posts?side=a&cassette=${cassette}&me=${BEN}`, 'ben');
    const feedAnna = await api('GET', `/api/posts?side=a&cassette=${cassette}&me=${ANNA}`, 'anna');
    expect(feedBen.body.map((p: { id: string }) => p.id)).not.toContain(shotId);
    expect(feedAnna.body.map((p: { id: string }) => p.id)).not.toContain(shotId);
    const list = await api('GET', `/api/cassettes?me=${ANNA}`, 'anna');
    expect(list.body.find((c: { id: string }) => c.id === cassette).sideA).toBe(0);
  });

  it('Vor der Freigabe laesst sich nichts damit anfangen', async () => {
    const voice = await upload('anna', 'audio/webm');
    expect(
      (await api('POST', `/api/posts/${shotId}/react`, 'anna', { author: ANNA, mediaId: voice.body.id })).status,
    ).toBe(404);
    expect((await api('POST', '/api/reports', 'anna', { by: ANNA, postId: shotId, reason: 'spam' })).status).toBe(404);
  });

  it('Der Status verraet nur, ob man selbst schon belichtet hat', async () => {
    const ben = await api('GET', `/api/cassettes/${cassette}/film?me=${BEN}`, 'ben');
    const anna = await api('GET', `/api/cassettes/${cassette}/film?me=${ANNA}`, 'anna');
    expect(ben.body.iShot).toBe(true);
    expect(anna.body.iShot).toBe(false);
    expect(anna.body.developed).toBeNull();
  });

  it('Ein Film pro Person und Woche', async () => {
    const m = await upload('ben');
    expect(
      (await api('POST', `/api/cassettes/${cassette}/film`, 'ben', { author: BEN, mediaId: m.body.id })).status,
    ).toBe(409);
  });

  it('Ein Bild, das schon woanders haengt, laesst sich nicht als Film verstecken', async () => {
    const m = await upload('anna');
    await api('POST', '/api/posts', 'anna', {
      cassetteId: cassette,
      side: 'a',
      author: ANNA,
      kind: 'photo',
      mediaId: m.body.id,
    });
    expect(
      (await api('POST', `/api/cassettes/${cassette}/film`, 'anna', { author: ANNA, mediaId: m.body.id })).status,
    ).toBe(400);
    expect(await fetchMedia(m.body.id)).toBe(200);
  });

  it('Sofort entwickeln: nur die Gruenderin, Fremde gar nicht', async () => {
    expect((await api('POST', `/api/cassettes/${cassette}/film/develop-now`, 'cara', { by: CARA })).status).toBe(403);
    expect((await api('POST', `/api/cassettes/${cassette}/film/develop-now`, 'ben', { by: BEN })).status).toBe(403);
  });

  it('Nach der Freigabe sehen alle Mitglieder den Film', async () => {
    expect((await api('POST', `/api/cassettes/${cassette}/film/develop-now`, 'anna', { by: ANNA })).status).toBe(200);
    expect(await fetchMedia(mediaId)).toBe(200);
    const feed = await api('GET', `/api/posts?side=a&cassette=${cassette}&me=${ANNA}`, 'anna');
    const shot = feed.body.find((p: { id: string }) => p.id === shotId);
    expect(shot.source).toBe('film');
    expect(shot.takenAt).toBeTypeOf('number');
    const status = await api('GET', `/api/cassettes/${cassette}/film?me=${ANNA}`, 'anna');
    expect(status.body.developed.shots.map((s: { id: string }) => s.id)).toContain(shotId);
  });
});
