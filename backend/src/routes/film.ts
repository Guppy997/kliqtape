import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { creatorOf, requireMember } from '../access.js';
import { DEMO_TOOLS } from '../config.js';
import { db } from '../db.js';
import { HttpError } from '../http.js';
import { PHOTO_MIME, mediaInUse } from '../media.js';
import { filmReleaseAfter } from '../time.js';

/* -------------------------------------------------------------------------
 * Entwickelter Film — ein Schnappschuss pro Person, Kassette und Woche, nur
 * Kamera. Er wird "entwickelt": bis Sonntag 19:00 (Europe/Berlin) sieht ihn
 * niemand, danach alle Mitglieder gleichzeitig. Technisch ein normaler
 * Seite-A-Beitrag mit develop_at; created_at = develop_at, damit er nach der
 * Freigabe im Tape des Sonntags steht (siehe RELEASED, isUnreleasedMedia).
 * ---------------------------------------------------------------------- */

export const filmRouter = Router();

filmRouter.get('/api/cassettes/:id/film', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  requireMember(req, req.params.id, me);
  const now = Date.now();
  const next = filmReleaseAfter(now);

  const iShot = Boolean(
    db
      .prepare(`SELECT 1 FROM posts WHERE cassette_id = ? AND author = ? AND source = 'film' AND develop_at = ?`)
      .get(req.params.id, me, next),
  );
  const last = db
    .prepare(`SELECT MAX(develop_at) AS at FROM posts WHERE cassette_id = ? AND source = 'film' AND develop_at <= ?`)
    .get(req.params.id, now) as { at: number | null };
  const shots = last.at
    ? (db
        .prepare(
          `SELECT id, author, media_id, body, taken_at FROM posts
            WHERE cassette_id = ? AND source = 'film' AND develop_at = ?
            ORDER BY taken_at ASC`,
        )
        .all(req.params.id, last.at) as { id: string; author: string; media_id: string; body: string; taken_at: number }[])
    : [];

  // Bewusst KEINE Angabe, wer diese Woche schon belichtet hat oder wie
  // viele — nur, ob man selbst schon. Der Film soll eine Ueberraschung sein.
  res.json({
    nextRelease: next,
    iShot,
    developed: last.at
      ? {
          at: last.at,
          shots: shots.map((r) => ({ id: r.id, author: r.author, mediaId: r.media_id, caption: r.body, takenAt: r.taken_at })),
        }
      : null,
    demoTools: DEMO_TOOLS,
  });
});

filmRouter.post('/api/cassettes/:id/film', (req, res) => {
  const author = String(req.body?.author ?? '').trim();
  const mediaId = String(req.body?.mediaId ?? '').trim();
  const caption = String(req.body?.caption ?? '').trim().slice(0, 120);
  requireMember(req, req.params.id, author);
  if (!mediaId) throw new HttpError(400, 'Aufnahme fehlt');
  const media = db.prepare(`SELECT mime FROM media WHERE id = ?`).get(mediaId) as { mime: string } | undefined;
  if (!media) throw new HttpError(400, 'Medium unbekannt');
  if (!PHOTO_MIME.includes(media.mime)) throw new HttpError(400, 'Auf den Film passt nur ein Foto');
  if (mediaInUse(mediaId)) throw new HttpError(400, 'Dieses Bild hängt schon woanders');

  const now = Date.now();
  const developAt = filmReleaseAfter(now);
  const already = db
    .prepare(`SELECT 1 FROM posts WHERE cassette_id = ? AND author = ? AND source = 'film' AND develop_at = ?`)
    .get(req.params.id, author, developAt);
  if (already) throw new HttpError(409, 'Diese Woche hast du deinen Film schon belichtet');

  const id = randomUUID();
  db.prepare(
    `INSERT INTO posts (id, cassette_id, side, author, kind, body, media_id, source, develop_at, taken_at, created_at)
     VALUES (?, ?, 'a', ?, 'photo', ?, ?, 'film', ?, ?, ?)`,
  ).run(id, req.params.id, author, caption, mediaId, developAt, now, developAt);

  res.status(201).json({ id, developAt });
});

// Nur mit DEMO_TOOLS=1: fuer eine Vorfuehrung nicht bis Sonntag warten. Nur
// wer die Kassette angelegt hat, und nur fuer diese eine Kassette.
filmRouter.post('/api/cassettes/:id/film/develop-now', (req, res) => {
  if (!DEMO_TOOLS) throw new HttpError(404, 'Nicht verfügbar');
  const by = String(req.body?.by ?? '').trim();
  requireMember(req, req.params.id, by);
  if (creatorOf(req.params.id) !== by) throw new HttpError(403, 'Nur wer die Kassette angelegt hat');
  const now = Date.now();
  const n = db
    .prepare(
      `UPDATE posts SET develop_at = ?, created_at = ?
        WHERE cassette_id = ? AND source = 'film' AND develop_at > ?`,
    )
    .run(now, now, req.params.id, now).changes;
  res.json({ developed: n });
});
