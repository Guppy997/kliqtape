import { Router } from 'express';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import webpush from 'web-push';
import { requireIdentity } from '../access.js';
import { DATA_DIR, DEMO_TOOLS, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT } from '../config.js';
import { db } from '../db.js';
import { HttpError } from '../http.js';

/* -------------------------------------------------------------------------
 * Wochen-Erinnerung per Web-Push — hoechstens eine pro Woche: wenn die
 * Wochen-Challenge aufgeloest ist. Gefragt wird erst nach dem ersten
 * Beitritt (App), gespeichert nur die Push-Adresse des Geraets. Der Text
 * laeuft ueber den Push-Dienst von Apple bzw. Google und enthaelt nie
 * Inhalte, nur einen Satz.
 *
 * VAPID-Schluessel: aus der Umgebung, sonst einmal erzeugt und im
 * Datenordner abgelegt — damit es auch ohne Konfiguration laeuft.
 * ---------------------------------------------------------------------- */

export const pushRouter = Router();

/** Wie lange mindestens zwischen zwei Erinnerungen an dieselbe Adresse. */
const MIN_GAP_MS = 6 * 86_400_000;
/** Aeltere Aufloesungen werden nicht mehr nachgemeldet. */
const STALE_MS = 24 * 3_600_000;

function vapidKeys(): { publicKey: string; privateKey: string } {
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) return { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY };
  const file = join(DATA_DIR, 'vapid.json');
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as { publicKey: string; privateKey: string };
  const keys = webpush.generateVAPIDKeys();
  writeFileSync(file, JSON.stringify(keys), { mode: 0o600 });
  return keys;
}

const KEYS = vapidKeys();
webpush.setVapidDetails(VAPID_SUBJECT, KEYS.publicKey, KEYS.privateKey);

interface SubscriptionRow {
  endpoint: string;
  name: string;
  p256dh: string;
  auth: string;
  last_sent_at: number | null;
}

pushRouter.get('/api/push/key', (_req, res) => {
  res.json({ publicKey: KEYS.publicKey });
});

pushRouter.get('/api/push/subscriptions', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  requireIdentity(req, me);
  const n = db.prepare(`SELECT COUNT(*) AS n FROM push_subscriptions WHERE name = ?`).get(me) as { n: number };
  res.json({ subscribed: n.n > 0 });
});

pushRouter.post('/api/push/subscriptions', (req, res) => {
  const me = String(req.body?.me ?? '').trim();
  requireIdentity(req, me);
  const sub = req.body?.subscription;
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : '';
  const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : '';
  const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : '';
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) throw new HttpError(400, 'Ungültige Push-Adresse');
  // Dasselbe Geraet mit neuem Konto: die Adresse wandert mit.
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, name, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET name = excluded.name, p256dh = excluded.p256dh, auth = excluded.auth`,
  ).run(endpoint, me, p256dh, auth, Date.now());
  res.status(201).json({ subscribed: true });
});

pushRouter.delete('/api/push/subscriptions', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  requireIdentity(req, me);
  const endpoint = String(req.query.endpoint ?? '');
  // Ohne Adresse: alle eigenen Geraete abmelden. Fremde Adressen nie.
  if (endpoint) db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ? AND name = ?`).run(endpoint, me);
  else db.prepare(`DELETE FROM push_subscriptions WHERE name = ?`).run(me);
  res.status(204).end();
});

/* --- Versand --------------------------------------------------------------- */

export type PushSender = (sub: SubscriptionRow, payload: string) => Promise<void>;

const realSender: PushSender = async (sub, payload) => {
  await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
    TTL: 12 * 3600,
  });
};

/**
 * Ist eine Challenge-Woche frisch aufgeloest, bekommt jede angemeldete Adresse
 * eine Erinnerung — aber nur, wer in mindestens einer Runde mitspielt (dort
 * nicht aus, fuer sich nicht stumm), und hoechstens eine pro Woche. Laeuft
 * alle paar Minuten (server.ts) und nach "Sonntag vorziehen" in der Demo.
 */
export async function sendWeeklyReminders(
  now = Date.now(),
  send: PushSender = realSender,
  ignoreGap = false,
): Promise<number> {
  const week = db
    .prepare(
      `SELECT id FROM challenge_weeks
        WHERE notified_at IS NULL AND release_at <= ? AND release_at > ?
        ORDER BY release_at DESC LIMIT 1`,
    )
    .get(now, now - STALE_MS) as { id: string } | undefined;
  if (!week) return 0;
  db.prepare(`UPDATE challenge_weeks SET notified_at = ? WHERE id = ?`).run(now, week.id);

  const subs = db
    .prepare(
      `SELECT s.* FROM push_subscriptions s
        WHERE EXISTS (SELECT 1 FROM cassette_members m JOIN cassettes c ON c.id = m.cassette_id
                       WHERE m.member = s.name AND m.challenge_muted = 0 AND c.challenge_off = 0)
          AND (s.last_sent_at IS NULL OR s.last_sent_at <= ?)`,
    )
    .all(ignoreGap ? now : now - MIN_GAP_MS) as SubscriptionRow[];

  const payload = JSON.stringify({
    title: 'Kliqtape',
    body: 'Die Challenge ist aufgelöst. Die Tüte liegt auf Seite A.',
    url: '/',
  });
  let sent = 0;
  for (const sub of subs) {
    try {
      await send(sub, payload);
      db.prepare(`UPDATE push_subscriptions SET last_sent_at = ? WHERE endpoint = ?`).run(now, sub.endpoint);
      sent++;
    } catch (err) {
      // Abgemeldet oder ungueltig: die Adresse faellt weg.
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(sub.endpoint);
      } else {
        console.error('[kliqtape] Push fehlgeschlagen', status ?? err);
      }
    }
  }
  return sent;
}

/** Nur fuer die Demo: gleich nach "Sonntag vorziehen" erinnern, auch wenn
 *  diese Woche schon einmal erinnert wurde. */
export function remindAfterDemoRelease(): void {
  if (!DEMO_TOOLS) return;
  void sendWeeklyReminders(Date.now(), realSender, true);
}
