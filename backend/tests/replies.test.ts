import { beforeAll, describe, expect, it } from 'vitest';
import { api, cassetteWith, nameOf } from './fixtures';

// Antworten auf Seite-A-Beitraege sind die Nachrichten auf Seite B, die den
// Beitrag zitieren. Die Karte auf Seite A zeigt, wer geantwortet hat, und
// oeffnet auf Tipp alle Antworten (GET /api/posts/:id/replies).

const ANNA = nameOf('anna');
const BEN = nameOf('ben');
const CARA = nameOf('cara');

let cassette: string;
let photo: string;
let quiet: string;
let chatOnly: string;

async function post(as: 'anna' | 'ben', side: 'a' | 'b', body: string, quotedPostId?: string) {
  const res = await api('POST', '/api/posts', as, {
    cassetteId: cassette,
    side,
    author: nameOf(as),
    kind: 'text',
    body,
    ...(quotedPostId ? { quotedPostId } : {}),
  });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

beforeAll(async () => {
  cassette = await cassetteWith('anna', ['ben'], 'Antwortrunde');
  photo = await post('anna', 'a', 'Erster Abend auf dem Dach');
  quiet = await post('anna', 'a', 'Darauf antwortet niemand');
  await post('ben', 'b', 'Bestes Foto des Jahres', photo);
  await post('anna', 'b', 'Danke!', photo);
  await post('ben', 'b', 'Nächstes Mal mit Lichterkette', photo);
  chatOnly = await post('ben', 'b', 'Ganz normale Nachricht ohne Zitat');
});

describe('Antworten auf Seite-A-Beiträge', () => {
  it('Feed auf Seite A fasst die Antworten zusammen: wer, neueste zuerst', async () => {
    const feed = await api('GET', `/api/posts?cassette=${cassette}&side=a&me=${ANNA}`, 'anna');
    expect(feed.status).toBe(200);
    const withReplies = feed.body.find((p: { id: string }) => p.id === photo);
    expect(withReplies.replies).toEqual({
      count: 3,
      authors: [BEN, ANNA],
      latest: { author: BEN, kind: 'text', body: 'Nächstes Mal mit Lichterkette' },
    });
    const without = feed.body.find((p: { id: string }) => p.id === quiet);
    expect(without.replies).toBeNull();
  });

  it('Mitglied liest alle Antworten, aeltestes zuerst, ohne normale Chat-Nachrichten', async () => {
    const res = await api('GET', `/api/posts/${photo}/replies?me=${BEN}`, 'ben');
    expect(res.status).toBe(200);
    expect(res.body.map((r: { author: string; body: string }) => `${r.author}: ${r.body}`)).toEqual([
      `${BEN}: Bestes Foto des Jahres`,
      `${ANNA}: Danke!`,
      `${BEN}: Nächstes Mal mit Lichterkette`,
    ]);
  });

  it('Fremder darf die Antworten nicht lesen', async () => {
    const res = await api('GET', `/api/posts/${photo}/replies?me=${CARA}`, 'cara');
    expect(res.status).toBe(403);
  });

  it('Ohne Zugangscode keine Antworten', async () => {
    const res = await api('GET', `/api/posts/${photo}/replies?me=${ANNA}`, null);
    expect(res.status).toBe(401);
  });

  it('Seite-B-Nachrichten haben keine eigenen Antworten', async () => {
    const res = await api('GET', `/api/posts/${chatOnly}/replies?me=${ANNA}`, 'anna');
    expect(res.status).toBe(400);
  });
});
