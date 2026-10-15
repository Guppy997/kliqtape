import { describe, expect, it } from 'vitest';
import { api, nameOf } from './fixtures';

// Wochen-Erinnerung: jede Person meldet nur ihre eigenen Geraete an und ab.

const BEN = nameOf('ben');
const CARA = nameOf('cara');
const SUB = {
  endpoint: 'https://push.example.invalid/ben-geraet',
  keys: { p256dh: 'BPk3w9H0Q', auth: 'x7AbC' },
};

describe('Wochen-Erinnerung anmelden', () => {
  it('Der oeffentliche Schluessel ist abrufbar', async () => {
    const res = await api('GET', '/api/push/key', null);
    expect(res.status).toBe(200);
    expect(res.body.publicKey.length).toBeGreaterThan(40);
  });

  it('Niemand meldet ein Geraet fuer jemand anderen an', async () => {
    expect((await api('POST', '/api/push/subscriptions', 'cara', { me: BEN, subscription: SUB })).status).toBe(401);
    expect((await api('POST', '/api/push/subscriptions', null, { me: BEN, subscription: SUB })).status).toBe(401);
  });

  it('Nur echte Push-Adressen', async () => {
    const bad = { ...SUB, endpoint: 'http://unsicher.example/x' };
    expect((await api('POST', '/api/push/subscriptions', 'ben', { me: BEN, subscription: bad })).status).toBe(400);
  });

  it('Anmelden und Abmelden — fremde Geraete bleiben unberuehrt', async () => {
    expect((await api('POST', '/api/push/subscriptions', 'ben', { me: BEN, subscription: SUB })).status).toBe(201);
    expect((await api('GET', `/api/push/subscriptions?me=${BEN}`, 'ben')).body.subscribed).toBe(true);
    const url = `/api/push/subscriptions?me=${CARA}&endpoint=${encodeURIComponent(SUB.endpoint)}`;
    expect((await api('DELETE', url, 'cara')).status).toBe(204);
    expect((await api('GET', `/api/push/subscriptions?me=${BEN}`, 'ben')).body.subscribed).toBe(true);
    expect((await api('DELETE', `/api/push/subscriptions?me=${BEN}`, 'ben')).status).toBe(204);
    expect((await api('GET', `/api/push/subscriptions?me=${BEN}`, 'ben')).body.subscribed).toBe(false);
  });
});
