import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { requireIdentity } from '../access.js';
import { ADMIN_NAME } from '../config.js';
import { NEWS_KINDS } from '../content.js';
import { type NewsKind, db } from '../db.js';
import { HttpError } from '../http.js';
import { dropMedia } from '../media.js';

/* -------------------------------------------------------------------------
 * Kliqtape-Kanal — News/Insights von den Betreiber:innen, dauerhaft und fuer
 * wirklich alle sichtbar. Schreiben darf nur ADMIN_NAME (config.ts, ueber
 * .env konfiguriert) — ein normal beanspruchter Name wie jeder andere, nur
 * dass genau dieser eine hier posten darf. Lesen darf jede angemeldete
 * Person, unabhaengig von Kassetten-Mitgliedschaft.
 * ---------------------------------------------------------------------- */

export const newsRouter = Router();

newsRouter.get('/api/news', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const rows = db
    .prepare(
      `SELECT n.id, n.author, n.kind, n.body, n.media_id, n.created_at, m.duration_ms
         FROM news_posts n
         LEFT JOIN media m ON m.id = n.media_id
        ORDER BY n.created_at DESC`,
    )
    .all() as {
    id: string;
    author: string;
    kind: NewsKind;
    body: string;
    media_id: string | null;
    created_at: number;
    duration_ms: number | null;
  }[];

  const funding = db.prepare(`SELECT balance, note, updated_at FROM project_funding WHERE id = 1`).get() as
    | { balance: string; note: string; updated_at: number }
    | undefined;

  res.json({
    canPost: Boolean(ADMIN_NAME) && me === ADMIN_NAME,
    funding: {
      balance: funding?.balance ?? '',
      note: funding?.note ?? '',
      updatedAt: funding?.updated_at ?? 0,
    },
    posts: rows.map((r) => ({
      id: r.id,
      author: r.author,
      kind: r.kind,
      body: r.body,
      mediaId: r.media_id,
      durationMs: r.duration_ms,
      createdAt: r.created_at,
    })),
  });
});

// Getrennt von POST /api/news: der Foerderstand ist kein Beitrag im Feed,
// sondern ein einzelner, ueberschreibbarer Wert (siehe project_funding).
newsRouter.put('/api/news/funding', (req, res) => {
  const me = String(req.body?.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);
  if (!ADMIN_NAME || me !== ADMIN_NAME) {
    throw new HttpError(403, 'Nur der Kliqtape-Kanal-Account darf hier aendern');
  }

  const balance = String(req.body?.balance ?? '').trim().slice(0, 40);
  const note = String(req.body?.note ?? '').trim().slice(0, 300);

  db.prepare(
    `INSERT INTO project_funding (id, balance, note, updated_at) VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET balance = excluded.balance, note = excluded.note, updated_at = excluded.updated_at`,
  ).run(balance, note, Date.now());

  res.status(204).end();
});

newsRouter.post('/api/news', (req, res) => {
  const { author, kind, body = '', mediaId = null } = req.body ?? {};
  if (typeof author !== 'string' || author.trim().length === 0) {
    throw new HttpError(400, 'Name fehlt');
  }
  requireIdentity(req, author.trim());
  if (!ADMIN_NAME || author.trim() !== ADMIN_NAME) {
    throw new HttpError(403, 'Nur der Kliqtape-Kanal-Account darf hier posten');
  }
  if (!NEWS_KINDS.includes(kind)) throw new HttpError(400, 'Unbekannte Art');
  if (kind === 'text' && String(body).trim().length === 0) throw new HttpError(400, 'Leerer Text');
  if (kind !== 'text' && !mediaId) throw new HttpError(400, 'Aufnahme fehlt');
  if (mediaId && !db.prepare(`SELECT 1 FROM media WHERE id = ?`).get(mediaId)) {
    throw new HttpError(400, 'Medium unbekannt');
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO news_posts (id, author, kind, body, media_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, author.trim().slice(0, 40), kind, String(body).slice(0, 1000), mediaId, Date.now());

  res.status(201).json({ id });
});

newsRouter.delete('/api/news/:id', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);
  if (!ADMIN_NAME || me !== ADMIN_NAME) {
    throw new HttpError(403, 'Nur der Kliqtape-Kanal-Account darf hier löschen');
  }

  const row = db.prepare(`SELECT media_id FROM news_posts WHERE id = ?`).get(req.params.id) as
    | { media_id: string | null }
    | undefined;
  if (!row) throw new HttpError(404, 'Beitrag nicht gefunden');

  db.prepare(`DELETE FROM news_posts WHERE id = ?`).run(req.params.id);
  if (row.media_id) dropMedia(row.media_id);

  res.status(204).end();
});
