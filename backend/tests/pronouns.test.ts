import { beforeAll, describe, expect, it } from 'vitest';
import { api, cassetteWith, nameOf } from './fixtures';

// Pronomen: freiwillig, Freitext. Sehen duerfen sie nur Mitglieder einer
// gemeinsamen Kassette, und zwar nur in der Mitgliederliste.

const ANNA = nameOf('anna');
const BEN = nameOf('ben');
const CARA = nameOf('cara');

describe('Pronomen', () => {
  let x: string;
  beforeAll(async () => {
    x = await cassetteWith('anna', ['ben'], 'Pronomen-Runde');
  });

  it('Niemand setzt oder liest sie fuer jemand anderen', async () => {
    expect((await api('PUT', '/api/me/pronouns', 'cara', { me: BEN, pronouns: 'xyz' })).status).toBe(401);
    expect((await api('PUT', '/api/me/pronouns', null, { me: BEN, pronouns: 'xyz' })).status).toBe(401);
    expect((await api('GET', `/api/me/pronouns?me=${BEN}`, 'cara')).status).toBe(401);
  });

  it('Setzen, lesen, leeren', async () => {
    expect((await api('GET', `/api/me/pronouns?me=${BEN}`, 'ben')).body).toEqual({ pronouns: null });
    const set = await api('PUT', '/api/me/pronouns', 'ben', { me: BEN, pronouns: '  er/\n ihm ' });
    expect(set.status).toBe(200);
    expect(set.body).toEqual({ pronouns: 'er/ ihm' });
    expect((await api('PUT', '/api/me/pronouns', 'ben', { me: BEN, pronouns: 'x'.repeat(31) })).status).toBe(400);
    expect((await api('PUT', '/api/me/pronouns', 'ben', { me: BEN, pronouns: 42 })).status).toBe(400);
    expect((await api('PUT', '/api/me/pronouns', 'ben', { me: BEN, pronouns: '' })).body).toEqual({ pronouns: null });
    await api('PUT', '/api/me/pronouns', 'ben', { me: BEN, pronouns: 'they/them' });
    expect((await api('GET', `/api/me/pronouns?me=${BEN}`, 'ben')).body).toEqual({ pronouns: 'they/them' });
  });

  it('Mitglieder sehen sie in der Mitgliederliste, Fremde nicht', async () => {
    const members = await api('GET', `/api/cassettes/${x}/members?me=${ANNA}`, 'anna');
    expect(members.status).toBe(200);
    expect(members.body.find((m: any) => m.name === BEN).pronouns).toBe('they/them');
    expect(members.body.find((m: any) => m.name === ANNA).pronouns).toBeNull();
    expect((await api('GET', `/api/cassettes/${x}/members?me=${CARA}`, 'cara')).status).toBe(403);
  });

  it('Die offene Profilliste verraet sie nicht', async () => {
    const all = await api('GET', '/api/profiles');
    const ben = all.body.find((p: any) => p.name === BEN);
    expect(ben).toBeDefined();
    expect(ben).not.toHaveProperty('pronouns');
    expect(JSON.stringify(all.body)).not.toContain('they/them');
  });

  it('Der Export enthaelt sie', async () => {
    expect((await api('GET', `/api/export?me=${BEN}`, 'ben')).body.profil.pronouns).toBe('they/them');
  });
});
