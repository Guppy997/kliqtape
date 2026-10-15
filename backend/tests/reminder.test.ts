import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// Versandlogik der Wochen-Erinnerung, direkt gegen eine eigene Wegwerf-
// Datenbank (nicht den Test-Server) und mit einem Ersatz-Versender — es geht
// nichts ins Netz.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'kliqtape-reminder-'));
process.env.MEDIA_DIR = join(process.env.DATA_DIR, 'media');

type Mod = typeof import('../src/routes/push.js');
let send: Mod['sendWeeklyReminders'];
let db: (typeof import('../src/db.js'))['db'];

const HOUR = 3_600_000;
const sent: string[] = [];
const stub = async (sub: { name: string }) => {
  sent.push(sub.name);
};

function sub(name: string) {
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, name, p256dh, auth, created_at) VALUES (?, ?, 'k', 'a', 0)`,
  ).run(`https://push.example.invalid/${name}`, name);
}

function week(id: string, releaseAt: number) {
  db.prepare(
    `INSERT INTO challenge_weeks (id, release_at, type, theme, set_by, created_at, demo) VALUES (?, ?, 'photo', '', 'K', 0, 0)`,
  ).run(id, releaseAt);
}

describe('Wochen-Erinnerung verschicken', () => {
  const now = Date.now();

  beforeAll(async () => {
    ({ sendWeeklyReminders: send } = await import('../src/routes/push.js'));
    ({ db } = await import('../src/db.js'));
    db.prepare(`INSERT INTO cassettes (id, name, created_by, created_at) VALUES ('c1', 'Runde', 'Ben', 0)`).run();
    db.prepare(`INSERT INTO cassettes (id, name, created_by, created_at) VALUES ('c2', 'Aus', 'Emil', 0)`).run();
    db.prepare(`UPDATE cassettes SET challenge_off = 1 WHERE id = 'c2'`).run();
    for (const [c, m, muted] of [
      ['c1', 'Ben', 0],
      ['c1', 'Dora', 1],
      ['c2', 'Emil', 0],
    ] as const) {
      db.prepare(
        `INSERT INTO cassette_members (cassette_id, member, added_by, joined_at, challenge_muted) VALUES (?, ?, 'Ben', 0, ?)`,
      ).run(c, m, muted);
    }
    for (const n of ['Ben', 'Dora', 'Emil', 'Cara']) sub(n);
  });

  it('Nur wer irgendwo mitspielt, und einmal pro aufgeloester Woche', async () => {
    week('w1', now - HOUR);
    expect(await send(now, stub)).toBe(1);
    // Dora ist ueberall stumm, Emils Runde hat die Challenge aus, Cara ist nirgends dabei.
    expect(sent).toEqual(['Ben']);
    expect(await send(now + 60_000, stub)).toBe(0);
  });

  it('Hoechstens eine Erinnerung pro Woche, auch bei einer zweiten Aufloesung', async () => {
    week('w2', now + HOUR);
    expect(await send(now + 2 * HOUR, stub)).toBe(0);
  });

  it('Alte Aufloesungen werden nicht nachgemeldet', async () => {
    week('w0', now - 3 * 86_400_000);
    expect(await send(now + 3 * HOUR, stub)).toBe(0);
  });

  it('Abgemeldete Adressen fallen weg', async () => {
    week('w3', now + 8 * 86_400_000);
    const gone = async () => {
      throw Object.assign(new Error('weg'), { statusCode: 410 });
    };
    expect(await send(now + 8 * 86_400_000 + HOUR, gone)).toBe(0);
    const left = db.prepare(`SELECT name FROM push_subscriptions WHERE name = 'Ben'`).get();
    expect(left).toBeUndefined();
  });
});
