import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { api, cassetteWith, nameOf, upload } from './fixtures';

// Album-Export: nur Seite A, nichts Unentwickeltes, nichts von Leuten mit
// "Meine Beitraege nicht in Alben". Seite B und Hot Line duerfen fuer den
// Export-Code gar nicht erreichbar sein.

const ANNA = nameOf('anna');
const BEN = nameOf('ben');
const DORA = nameOf('dora');
const CARA = nameOf('cara');

async function pdf(path: string, as: 'anna' | 'cara') {
  const { inject } = await import('vitest');
  const { token } = await import('./fixtures');
  const res = await fetch(inject('baseUrl') + path, { headers: { 'X-Auth-Token': token(as) } });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get('content-type'), buf };
}

describe('Album-Export', () => {
  let cassette: string;

  beforeAll(async () => {
    cassette = await cassetteWith('anna', ['ben', 'dora']);
    const post = (as: 'anna' | 'ben' | 'dora', side: 'a' | 'b', body: string) =>
      api('POST', '/api/posts', as, { cassetteId: cassette, side, author: nameOf(as), kind: 'text', body });
    await post('anna', 'a', 'Archiv von Anna');
    await post('ben', 'a', 'Archiv von Ben');
    await post('dora', 'a', 'Archiv von Dora');
    await post('anna', 'b', 'GEHEIM aus dem Gruppenchat');
    await api('POST', '/api/hotlines/threads', 'anna', { from: ANNA, to: BEN, body: 'GEHEIM aus der Hot Line' });
    const film = await upload('ben');
    await api('POST', `/api/cassettes/${cassette}/film`, 'ben', { author: BEN, mediaId: film.body.id, caption: 'GEHEIM unentwickelt' });
    expect((await api('PUT', '/api/me/album', 'dora', { me: DORA, optOut: true })).status).toBe(200);
  });

  it('Fremder bekommt weder Vorschau noch PDF', async () => {
    expect((await api('GET', `/api/cassettes/${cassette}/album?me=${CARA}`, 'cara')).status).toBe(403);
    expect((await pdf(`/api/cassettes/${cassette}/album.pdf?me=${CARA}`, 'cara')).status).toBe(403);
  });

  it('Niemand stellt den Album-Schalter fuer jemand anderen um', async () => {
    expect((await api('PUT', '/api/me/album', 'cara', { me: ANNA, optOut: true })).status).toBe(401);
  });

  it('Nur Seite A, ohne Unentwickeltes, ohne ausgenommene Personen', async () => {
    const res = await api('GET', `/api/cassettes/${cassette}/album?me=${ANNA}`, 'anna');
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).toContain('Archiv von Anna');
    expect(text).toContain('Archiv von Ben');
    expect(text).not.toContain('Archiv von Dora');
    expect(text).not.toContain('GEHEIM');
  });

  it('Das PDF ist ein PDF', async () => {
    const res = await pdf(`/api/cassettes/${cassette}/album.pdf?me=${ANNA}`, 'anna');
    expect(res.status).toBe(200);
    expect(res.type).toBe('application/pdf');
    expect(res.buf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('Wer den Schalter zuruecknimmt, ist wieder im Album', async () => {
    await api('PUT', '/api/me/album', 'dora', { me: DORA, optOut: false });
    const res = await api('GET', `/api/cassettes/${cassette}/album?me=${ANNA}`, 'anna');
    expect(JSON.stringify(res.body)).toContain('Archiv von Dora');
  });

  it('Der Export-Code hat keinen Weg zu Seite B oder Hot Line', () => {
    // Statische Pruefung zusaetzlich zur Lint-Regel: die Druck-Module
    // importieren weder Datenbank noch Server und erwaehnen keine der
    // geschuetzten Tabellen.
    const dir = join(__dirname, '..', 'src', 'print');
    for (const f of readdirSync(dir)) {
      // Kommentare raus — die erklaeren gerade, was hier NICHT passiert.
      const src = readFileSync(join(dir, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(src, f).not.toMatch(/from ['"][^'"]*\/(db|server)(\.js)?['"]/);
      expect(src, f).not.toMatch(/better-sqlite3/);
      expect(src, f).not.toMatch(/hotline_|FROM posts|side = 'b'/i);
    }
  });
});
