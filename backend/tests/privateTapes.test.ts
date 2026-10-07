import { beforeAll, describe, expect, it } from 'vitest';
import { api, cassetteWith, fetchMedia, nameOf, upload } from './fixtures';

// Eigene, private Tapes im Profil: gehoeren genau einer Person. Fremde
// bekommen dasselbe 404 wie bei einem Tape, das es nicht gibt.

const ANNA = nameOf('anna');
const BEN = nameOf('ben');

async function newTape(title = 'Tagebuch') {
  const res = await api('POST', '/api/me/tapes', 'anna', { me: ANNA, title });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

async function addPhoto(tapeId: string) {
  const m = await upload('anna');
  const res = await api('POST', `/api/me/tapes/${tapeId}/items`, 'anna', {
    me: ANNA,
    kind: 'photo',
    mediaId: m.body.id,
    source: 'upload',
  });
  expect(res.status).toBe(201);
  return { itemId: res.body.id as string, mediaId: m.body.id as string };
}

describe('Eigene Tapes', () => {
  let tape: string;

  beforeAll(async () => {
    tape = await newTape();
  });

  it('Ohne Zugangscode geht nichts', async () => {
    expect((await api('GET', `/api/me/tapes?me=${ANNA}`, null)).status).toBe(401);
    expect((await api('POST', '/api/me/tapes', null, { me: ANNA, title: 'x' })).status).toBe(401);
  });

  it('Fremde sehen das Tape weder in ihrer Liste noch einzeln', async () => {
    const list = await api('GET', `/api/me/tapes?me=${BEN}`, 'ben');
    expect(list.status).toBe(200);
    expect(list.body.some((t: any) => t.id === tape)).toBe(false);
    expect((await api('GET', `/api/me/tapes/${tape}/items?me=${BEN}`, 'ben')).status).toBe(404);
    // Gegenprobe
    const own = await api('GET', `/api/me/tapes?me=${ANNA}`, 'anna');
    expect(own.body.some((t: any) => t.id === tape)).toBe(true);
    expect((await api('GET', `/api/me/tapes/${tape}/items?me=${ANNA}`, 'anna')).status).toBe(200);
  });

  it('Fremder darf nicht umbenennen', async () => {
    expect((await api('PATCH', `/api/me/tapes/${tape}`, 'ben', { me: BEN, title: 'Gekapert' })).status).toBe(404);
    const ok = await api('PATCH', `/api/me/tapes/${tape}`, 'anna', { me: ANNA, title: 'Sommer 26', colorIndex: 3 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ title: 'Sommer 26', colorIndex: 3 });
  });

  it('Fremder darf nichts einkleben', async () => {
    const res = await api('POST', `/api/me/tapes/${tape}/items`, 'ben', { me: BEN, kind: 'text', body: 'Hallo' });
    expect(res.status).toBe(404);
    const ok = await api('POST', `/api/me/tapes/${tape}/items`, 'anna', {
      me: ANNA,
      kind: 'text',
      body: 'Erster Abend am See',
      noteStyle: 'pin',
    });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ kind: 'text', body: 'Erster Abend am See', noteStyle: 'pin' });
  });

  it('Fremder darf keinen Eintrag entfernen', async () => {
    const { itemId, mediaId } = await addPhoto(tape);
    expect((await api('DELETE', `/api/me/tapes/${tape}/items/${itemId}?me=${BEN}`, 'ben')).status).toBe(404);
    expect(await fetchMedia(mediaId)).toBe(200);
    // Gegenprobe: die Besitzerin entfernt ihn, das Medium verschwindet mit.
    expect((await api('DELETE', `/api/me/tapes/${tape}/items/${itemId}?me=${ANNA}`, 'anna')).status).toBe(204);
    expect(await fetchMedia(mediaId)).toBe(404);
  });

  it('Fremder darf das Tape nicht loeschen', async () => {
    const doomed = await newTape('Wegwerfband');
    const { mediaId } = await addPhoto(doomed);
    expect((await api('DELETE', `/api/me/tapes/${doomed}?me=${BEN}`, 'ben')).status).toBe(404);
    expect((await api('DELETE', `/api/me/tapes/${doomed}?me=${ANNA}`, 'anna')).status).toBe(204);
    expect(await fetchMedia(mediaId)).toBe(404);
    expect((await api('GET', `/api/me/tapes/${doomed}/items?me=${ANNA}`, 'anna')).status).toBe(404);
  });

  it('Ein Medium, das schon anderswo haengt, wird abgelehnt', async () => {
    const cassette = await cassetteWith('anna', [], 'Medienrunde');
    const m = await upload('anna');
    const post = await api('POST', '/api/posts', 'anna', {
      cassetteId: cassette,
      side: 'a',
      author: ANNA,
      kind: 'photo',
      mediaId: m.body.id,
    });
    expect(post.status).toBe(201);
    const res = await api('POST', `/api/me/tapes/${tape}/items`, 'anna', {
      me: ANNA,
      kind: 'photo',
      mediaId: m.body.id,
    });
    expect(res.status).toBe(409);
  });

  it('Unbekannte Art und leere Zettel werden abgelehnt', async () => {
    const tapeKind = await api('POST', `/api/me/tapes/${tape}/items`, 'anna', { me: ANNA, kind: 'tape', body: 'x' });
    expect(tapeKind.status).toBe(400);
    const empty = await api('POST', `/api/me/tapes/${tape}/items`, 'anna', { me: ANNA, kind: 'text', body: '   ' });
    expect(empty.status).toBe(400);
  });

  it('Der Datenexport enthaelt die eigenen Tapes samt Eintraegen', async () => {
    const res = await api('GET', `/api/export?me=${ANNA}`, 'anna');
    expect(res.status).toBe(200);
    const mine = res.body.eigeneTapes.find((t: any) => t.id === tape);
    expect(mine.title).toBe('Sommer 26');
    expect(mine.eintraege.some((e: any) => e.body === 'Erster Abend am See')).toBe(true);
    const bens = await api('GET', `/api/export?me=${BEN}`, 'ben');
    expect(bens.body.eigeneTapes.some((t: any) => t.id === tape)).toBe(false);
  });
});
