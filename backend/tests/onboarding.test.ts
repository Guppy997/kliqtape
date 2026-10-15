import { describe, expect, it } from 'vitest';
import { api, nameOf } from './fixtures';

// Onboarding: abgeschlossen erst mit Mindestalter und Rechtstexten. Jede
// Person stellt nur ihre eigenen Haken.

const EMIL = nameOf('emil');

describe('Onboarding', () => {
  it('Niemand bestaetigt fuer jemand anderen', async () => {
    expect((await api('GET', `/api/me/onboarding?me=${EMIL}`, 'cara')).status).toBe(401);
    expect((await api('PUT', '/api/me/onboarding', 'cara', { me: EMIL, ageConfirmed: true })).status).toBe(401);
    expect((await api('PUT', '/api/me/onboarding', null, { me: EMIL, done: true })).status).toBe(401);
  });

  it('Abschliessen geht erst mit Alter und Rechtstexten', async () => {
    const fresh = await api('GET', `/api/me/onboarding?me=${EMIL}`, 'emil');
    expect(fresh.body).toMatchObject({ onboardedAt: null, ageConfirmedAt: null, termsAcceptedAt: null });
    expect((await api('PUT', '/api/me/onboarding', 'emil', { me: EMIL, done: true })).status).toBe(409);
    expect((await api('PUT', '/api/me/onboarding', 'emil', { me: EMIL, ageConfirmed: true })).status).toBe(200);
    expect((await api('PUT', '/api/me/onboarding', 'emil', { me: EMIL, done: true })).status).toBe(409);
    const ok = await api('PUT', '/api/me/onboarding', 'emil', { me: EMIL, termsAccepted: true, done: true });
    expect(ok.status).toBe(200);
    expect(ok.body.onboardedAt).toBeGreaterThan(0);
    expect(ok.body.termsVersion).toBe(ok.body.currentTermsVersion);
  });

  it('Der Export enthaelt die Bestaetigungen', async () => {
    const res = await api('GET', `/api/export?me=${EMIL}`, 'emil');
    expect(res.body.profil.ageConfirmedAt).toBeGreaterThan(0);
    expect(res.body.profil.termsAcceptedAt).toBeGreaterThan(0);
  });
});
