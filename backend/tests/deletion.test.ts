import { describe, expect, inject, it } from 'vitest';
import { api, fetchMedia, nameOf, upload } from './fixtures';

// "Alles löschen" darf den Namen nirgends stehen lassen: keine leere Kassette
// mit ihm als "angelegt von", kein "eingeladen von", keine offene Einladung.

const ANNA = nameOf('anna');
const BEN = nameOf('ben');
const DORA = nameOf('dora');
const GONE = 'Loeschprobe';

async function as(tok: string, method: string, path: string, body?: unknown) {
  const res = await fetch(inject('baseUrl') + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': tok },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

describe('Konto löschen', () => {
  it('räumt Kassetten, Einladungen und Namen auf', async () => {
    const claim = await api('POST', '/api/auth/claim', null, { name: GONE });
    expect(claim.status).toBe(201);
    const tok = claim.body.token as string;

    // Eine eigene Kassette: Ben war kurz dabei, hat ein Foto dagelassen und
    // ist wieder gegangen. Danach ist die Person allein auf dem Band.
    const alone = await as(tok, 'POST', '/api/cassettes', { name: 'Allein', by: GONE });
    expect(alone.status).toBe(201);
    const toBen = await as(tok, 'POST', `/api/cassettes/${alone.body.id}/invites`, { by: GONE, invitee: BEN });
    expect((await api('POST', `/api/invites/${toBen.body.id}/accept`, 'ben', { me: BEN })).status).toBe(200);
    const photo = (await upload('ben')).body.id;
    const post = await api('POST', '/api/posts', 'ben', {
      author: BEN,
      cassetteId: alone.body.id,
      side: 'a',
      kind: 'photo',
      mediaId: photo,
      source: 'camera',
    });
    expect(post.status).toBe(201);
    expect(
      (await api('DELETE', `/api/cassettes/${alone.body.id}/members/${encodeURIComponent(BEN)}?by=${BEN}`, 'ben'))
        .status,
    ).toBe(204);
    expect(await fetchMedia(photo)).toBe(200);

    // Bei Anna Mitglied, dort Dora eingeladen (angenommen) und Ben (offen)
    const shared = (await api('POST', '/api/cassettes', 'anna', { name: 'Mit Anna', by: ANNA })).body.id as string;
    const inv = await api('POST', `/api/cassettes/${shared}/invites`, 'anna', { by: ANNA, invitee: GONE });
    expect((await as(tok, 'POST', `/api/invites/${inv.body.id}/accept`, { me: GONE })).status).toBe(200);
    const toDora = await as(tok, 'POST', `/api/cassettes/${shared}/invites`, { by: GONE, invitee: DORA });
    expect((await api('POST', `/api/invites/${toDora.body.id}/accept`, 'dora', { me: DORA })).status).toBe(200);
    expect((await as(tok, 'POST', `/api/cassettes/${shared}/invites`, { by: GONE, invitee: BEN })).status).toBe(201);

    expect((await as(tok, 'DELETE', `/api/me?me=${GONE}`)).status).toBe(200);

    // Die leere Kassette ist samt dem, was noch darin lag, weg
    expect(await fetchMedia(photo)).toBe(404);
    // Annas Kassette bleibt, nennt den Namen aber nicht mehr
    const rest = await api('GET', `/api/cassettes/${shared}/members?me=${ANNA}`, 'anna');
    expect(rest.status).toBe(200);
    expect(JSON.stringify(rest.body)).not.toContain(GONE);
    expect(rest.body.find((m: any) => m.name === DORA).addedBy).toBe('(gelöscht)');
    // Bens offene Einladung von der geloeschten Person ist verfallen
    const invites = await api('GET', `/api/invites?me=${BEN}`, 'ben');
    expect(JSON.stringify(invites.body)).not.toContain(GONE);
    // Der Name ist wieder frei
    expect((await api('POST', '/api/auth/claim', null, { name: GONE })).status).toBe(201);
  });
});
