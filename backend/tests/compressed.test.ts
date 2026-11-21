import { gzipSync } from 'node:zlib';
import { describe, expect, inject, it } from 'vitest';
import { token } from './fixtures';

// GHSA-27r3-jxmh-p828: Ein gepackter Body mit Restbytes liess body-parser
// < 1.20.9 den Prozess nach der Antwort abstuerzen, ohne Anmeldung und vor
// jedem Routing. Die App schickt nie gepackte Bodies, deshalb lehnt der Server
// sie ganz ab (inflate: false) statt sie zu entpacken.

const base = () => inject('baseUrl');
const withTrailing = (raw: Buffer) => Buffer.concat([gzipSync(raw), Buffer.from('restbytes')]);
const alive = async () => (await fetch(base() + '/api/health')).status;

describe('Gepackte Request-Bodies', () => {
  it('JSON mit Content-Encoding wird abgelehnt, der Server laeuft weiter', async () => {
    const res = await fetch(base() + '/api/auth/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
      body: withTrailing(Buffer.from(JSON.stringify({ name: 'Gepackt' }))),
    });
    expect(res.status).toBe(415);
    // Der Absturz kam erst NACH der Antwort, deshalb kurz warten.
    await new Promise((r) => setTimeout(r, 200));
    expect(await alive()).toBe(200);
  });

  it('Upload mit Content-Encoding wird abgelehnt, der Server laeuft weiter', async () => {
    const res = await fetch(base() + '/api/media', {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg', 'Content-Encoding': 'gzip', 'X-Auth-Token': token('anna') },
      body: withTrailing(Buffer.from('bild')),
    });
    expect(res.status).toBe(415);
    await new Promise((r) => setTimeout(r, 200));
    expect(await alive()).toBe(200);
  });

  it('Kaputtes JSON ist ein Fehler der Anfrage (400), kein Serverfehler', async () => {
    const res = await fetch(base() + '/api/auth/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{kaputt',
    });
    expect(res.status).toBe(400);
  });

  it('Gegenprobe: ungepacktes JSON klappt weiter', async () => {
    const res = await fetch(base() + '/api/auth/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ungepackt' }),
    });
    expect(res.status).toBe(201);
  });
});
