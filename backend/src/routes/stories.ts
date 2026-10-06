import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { requireIdentity } from '../access.js';
import { STORY_KINDS, STORY_LIFETIME_MS } from '../content.js';
import { type StoryKind, db } from '../db.js';
import { HttpError } from '../http.js';
import { dropMedia } from '../media.js';

/* -------------------------------------------------------------------------
 * Storys — kassettenuebergreifend, nur Foto/Video, verschwinden nach 24h.
 *
 * Anders als posts nicht an eine einzelne Kassette gebunden, sondern
 * sichtbar fuer jeden, mit dem man in IRGENDEINER Kassette zusammen ist
 * (networkOf). Kein Cron fuer den Ablauf — die App hat bewusst keinen
 * Hintergrund-Job: sweepExpiredStories() raeumt abgelaufene Zeilen samt
 * Mediendatei einfach bei jedem Story-Zugriff mit auf.
 * ---------------------------------------------------------------------- */

export const storiesRouter = Router();

/** Alle Namen, mit denen `person` in irgendeiner Kassette zusammen ist —
 *  schliesst `person` selbst ein, da man Mitglied der eigenen Kassetten ist. */
function networkOf(person: string): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT cm2.member
         FROM cassette_members cm1
         JOIN cassette_members cm2 ON cm2.cassette_id = cm1.cassette_id
        WHERE cm1.member = ?`,
    )
    .all(person) as { member: string }[];
  return rows.map((r) => r.member);
}

/** Entfernt abgelaufene Storys samt Mediendatei. Gibt den benutzten
 *  Zeitpunkt zurueck, damit der nachfolgende SELECT in derselben Anfrage
 *  denselben "jetzt"-Wert verwendet statt eine zweite Uhrzeit zu lesen. */
function sweepExpiredStories(): number {
  const now = Date.now();
  const expired = db.prepare(`SELECT id, media_id FROM stories WHERE expires_at <= ?`).all(now) as {
    id: string;
    media_id: string;
  }[];
  if (expired.length > 0) {
    db.transaction(() => {
      db.prepare(`DELETE FROM stories WHERE expires_at <= ?`).run(now);
      for (const row of expired) dropMedia(row.media_id);
    })();
  }
  return now;
}

storiesRouter.get('/api/stories', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const now = sweepExpiredStories();
  const network = networkOf(me);
  if (network.length === 0) return res.json([]);

  const placeholders = network.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT s.id, s.author, s.kind, s.media_id, s.created_at, s.expires_at, m.duration_ms
         FROM stories s
         LEFT JOIN media m ON m.id = s.media_id
        WHERE s.author IN (${placeholders}) AND s.expires_at > ?
        ORDER BY s.created_at DESC`,
    )
    .all(...network, now) as {
    id: string;
    author: string;
    kind: StoryKind;
    media_id: string;
    created_at: number;
    expires_at: number;
    duration_ms: number | null;
  }[];

  // Nach Autor gruppiert, neuester Autor zuerst (deren neueste Story
  // bestimmt die Reihenfolge) — Frontend zeigt eine Reihe pro Person.
  const byAuthor = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byAuthor.get(r.author) ?? [];
    list.push(r);
    byAuthor.set(r.author, list);
  }

  const groups = [...byAuthor.entries()].map(([author, items]) => ({
    author,
    stories: items.map((r) => ({
      id: r.id,
      kind: r.kind,
      mediaId: r.media_id,
      durationMs: r.duration_ms,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    })),
  }));

  res.json(groups);
});

storiesRouter.post('/api/stories', (req, res) => {
  sweepExpiredStories();
  const { author, kind, mediaId } = req.body ?? {};

  if (typeof author !== 'string' || author.trim().length === 0) {
    throw new HttpError(400, 'Name fehlt');
  }
  requireIdentity(req, author.trim());
  if (!STORY_KINDS.includes(kind)) throw new HttpError(400, 'Storys sind nur Foto oder Video');
  if (!mediaId) throw new HttpError(400, 'Aufnahme fehlt');
  if (!db.prepare(`SELECT 1 FROM media WHERE id = ?`).get(mediaId)) {
    throw new HttpError(400, 'Medium unbekannt');
  }

  const id = randomUUID();
  const now = Date.now();
  db.prepare(`INSERT INTO stories (id, author, kind, media_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    id,
    author.trim().slice(0, 40),
    kind,
    mediaId,
    now,
    now + STORY_LIFETIME_MS,
  );

  res.status(201).json({ id, expiresAt: now + STORY_LIFETIME_MS });
});

storiesRouter.delete('/api/stories/:id', (req, res) => {
  sweepExpiredStories();
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const row = db.prepare(`SELECT author, media_id FROM stories WHERE id = ?`).get(req.params.id) as
    { author: string; media_id: string } | undefined;
  if (!row) throw new HttpError(404, 'Story nicht gefunden');
  // Anders als bei posts (dort fehlt diese Pruefung bisher komplett) hier
  // bewusst eine echte Besitzpruefung — bei einer kassettenuebergreifend
  // sichtbaren Story ist das Risiko fremden Loeschens groesser.
  if (row.author !== me) throw new HttpError(403, 'Nicht deine Story');

  db.transaction(() => {
    db.prepare(`DELETE FROM stories WHERE id = ?`).run(req.params.id);
    dropMedia(row.media_id);
  })();

  res.status(204).end();
});
