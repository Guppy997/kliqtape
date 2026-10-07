import { beforeAll, describe, expect, it } from 'vitest';
import { api, cassetteWith, nameOf, upload } from './fixtures';

// Das eigene Regal im Profil: Tapes aus den eigenen Kassetten, selbst
// beschriftet. Die Beschriftung ist privat — die Runde sieht sie nie.

const ANNA = nameOf('anna');
const BEN = nameOf('ben');
const CARA = nameOf('cara');

describe('Eigenes Regal', () => {
  let cassette: string;
  let photoId: string;

  beforeAll(async () => {
    cassette = await cassetteWith('anna', ['ben'], 'Regalrunde');
    const m = await upload('anna');
    photoId = m.body.id;
    const post = await api('POST', '/api/posts', 'anna', {
      cassetteId: cassette,
      side: 'a',
      author: ANNA,
      kind: 'photo',
      mediaId: photoId,
      source: 'camera',
    });
    expect(post.status).toBe(201);
  });

  it('Fremder darf nicht ins Regal legen oder beschriften', async () => {
    const res = await api('POST', `/api/cassettes/${cassette}/tapes/1/favorite`, 'cara', { by: CARA, label: 'Meins' });
    expect(res.status).toBe(403);
  });

  it('Gegenprobe: Mitglied legt ein Tape mit eigener Beschriftung ins Regal', async () => {
    const res = await api('POST', `/api/cassettes/${cassette}/tapes/1/favorite`, 'ben', {
      by: BEN,
      label: '  Der erste Abend  ',
    });
    expect(res.status).toBe(201);
    const shelf = await api('GET', `/api/me/shelf?me=${BEN}`, 'ben');
    expect(shelf.status).toBe(200);
    const entry = shelf.body.find((e: any) => e.cassetteId === cassette);
    expect(entry).toMatchObject({ tapeIndex: 1, label: 'Der erste Abend', cassetteName: 'Regalrunde' });
    expect(entry.previewMediaId).toBe(photoId);
  });

  it('Umbeschriften behaelt den Platz im Regal, leer heisst ohne Beschriftung', async () => {
    await api('POST', `/api/cassettes/${cassette}/tapes/1/favorite`, 'ben', { by: BEN, label: '' });
    const shelf = await api('GET', `/api/me/shelf?me=${BEN}`, 'ben');
    const entries = shelf.body.filter((e: any) => e.cassetteId === cassette);
    expect(entries).toHaveLength(1);
    expect(entries[0].label).toBeNull();
    await api('POST', `/api/cassettes/${cassette}/tapes/1/favorite`, 'ben', { by: BEN, label: 'Der erste Abend' });
  });

  it('Die Beschriftung sieht nur man selbst', async () => {
    const tapes = await api('GET', `/api/cassettes/${cassette}/tapes?me=${ANNA}`, 'anna');
    expect(tapes.status).toBe(200);
    expect(JSON.stringify(tapes.body)).not.toContain('Der erste Abend');
    // Auch nicht, DASS jemand gesammelt hat: kein Zaehler, und das Tape taucht
    // fuer Anna nicht einmal als Eintrag auf (niemand hat es benannt).
    expect(JSON.stringify(tapes.body)).not.toMatch(/favoriteCount/);
    expect(tapes.body.find((t: any) => t.tapeIndex === 1)).toBeUndefined();
    const annasShelf = await api('GET', `/api/me/shelf?me=${ANNA}`, 'anna');
    expect(JSON.stringify(annasShelf.body)).not.toContain('Der erste Abend');
  });

  it('Fremdes Regal ist nicht abrufbar', async () => {
    expect((await api('GET', `/api/me/shelf?me=${BEN}`, 'cara')).status).toBe(401);
    expect((await api('GET', `/api/me/shelf?me=${BEN}`, null)).status).toBe(401);
  });

  it('Nach dem Verlassen der Kassette verschwinden ihre Tapes aus dem Regal', async () => {
    const left = await api('DELETE', `/api/cassettes/${cassette}/members/${BEN}?by=${BEN}`, 'ben');
    expect(left.status).toBe(204);
    const shelf = await api('GET', `/api/me/shelf?me=${BEN}`, 'ben');
    expect(shelf.body.some((e: any) => e.cassetteId === cassette)).toBe(false);
  });
});
