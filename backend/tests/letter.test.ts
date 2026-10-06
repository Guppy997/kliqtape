import { inject } from 'vitest';
import { beforeAll, describe, expect, it } from 'vitest';
import { api, cassetteWith, nameOf, token, type Person } from './fixtures';

// Einladung als Brief: Token einmal gueltig, nur fuer diese Kassette, und
// dabei ist man erst nach dem normalen Zustimmen.

const ANNA = nameOf('anna');
const CARA = nameOf('cara');
const EMIL = nameOf('emil');

async function letter(cassette: string, as: Person, by: string) {
  const res = await fetch(inject('baseUrl') + `/api/cassettes/${cassette}/letter.pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token(as) },
    body: JSON.stringify({ by }),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const url = res.headers.get('x-letter-url');
  return { status: res.status, type: res.headers.get('content-type'), buf, token: url ? new URL(url).searchParams.get('brief') : null };
}

describe('Einladung als Brief', () => {
  let cassette: string;
  let brief: string;

  beforeAll(async () => {
    cassette = await cassetteWith('anna', ['ben']);
  });

  it('Fremder darf keinen Brief fuer eine fremde Kassette drucken', async () => {
    expect((await letter(cassette, 'cara', CARA)).status).toBe(403);
    expect((await letter(cassette, 'cara', ANNA)).status).toBe(401);
  });

  it('Mitglied bekommt ein PDF mit Token', async () => {
    const res = await letter(cassette, 'anna', ANNA);
    expect(res.status).toBe(200);
    expect(res.type).toBe('application/pdf');
    expect(res.buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.token).toBeTruthy();
    brief = res.token!;
  });

  it('Einloesen braucht einen Zugangscode', async () => {
    expect((await api('POST', '/api/letters/redeem', null, { me: CARA, token: brief })).status).toBe(401);
    expect((await api('POST', '/api/letters/redeem', 'cara', { me: CARA, token: 'erfunden' })).status).toBe(404);
  });

  it('Wer schon auf dem Band ist, verbraucht den Brief nicht', async () => {
    expect((await api('POST', '/api/letters/redeem', 'ben', { me: nameOf('ben'), token: brief })).status).toBe(409);
  });

  it('Einloesen macht eine normale Einladung — erst Zustimmen macht zum Mitglied', async () => {
    const res = await api('POST', '/api/letters/redeem', 'cara', { me: CARA, token: brief });
    expect(res.status).toBe(201);
    expect(res.body.invitedBy).toBe(ANNA);
    expect((await api('GET', `/api/posts?side=a&cassette=${cassette}&me=${CARA}`, 'cara')).status).toBe(403);
    const invites = await api('GET', `/api/invites?me=${CARA}`, 'cara');
    const invite = invites.body.find((i: { cassetteId: string }) => i.cassetteId === cassette);
    expect(invite).toBeTruthy();
    expect((await api('POST', `/api/invites/${invite.id}/accept`, 'cara', { me: CARA })).status).toBe(200);
    expect((await api('GET', `/api/posts?side=a&cassette=${cassette}&me=${CARA}`, 'cara')).status).toBe(200);
  });

  it('Ein Brief gilt nur einmal', async () => {
    expect((await api('POST', '/api/letters/redeem', 'emil', { me: EMIL, token: brief })).status).toBe(410);
  });

  it('Ein Brief fuehrt nur auf seine eigene Kassette', async () => {
    const other = await cassetteWith('ben', []);
    const res = await letter(other, 'ben', nameOf('ben'));
    const r = await api('POST', '/api/letters/redeem', 'emil', { me: EMIL, token: res.token });
    expect(r.status).toBe(201);
    const invites = await api('GET', `/api/invites?me=${EMIL}`, 'emil');
    expect(invites.body.map((i: { cassetteId: string }) => i.cassetteId)).toEqual([other]);
  });
});
