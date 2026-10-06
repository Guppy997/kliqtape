import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { requireMember } from '../access.js';
import { db } from '../db.js';
import { HttpError } from '../http.js';
import { RELEASED } from '../media.js';

/* -------------------------------------------------------------------------
 * Melden — eine Kassette oder einen Beitrag. Nur speichern und bestaetigen;
 * eine Moderationsoberflaeche gibt es im Prototyp nicht (CONCEPT.md §16.6).
 * ---------------------------------------------------------------------- */

export const reportsRouter = Router();

const REPORT_REASONS = ['spam', 'harassment', 'violence', 'illegal', 'other'] as const;
type ReportReason = (typeof REPORT_REASONS)[number];

reportsRouter.post('/api/reports', (req, res) => {
  const by = String(req.body?.by ?? '').trim();
  const cassetteId = req.body?.cassetteId ? String(req.body.cassetteId) : null;
  const postId = req.body?.postId ? String(req.body.postId) : null;
  const reason = String(req.body?.reason ?? '') as ReportReason;
  const note = String(req.body?.note ?? '').trim().slice(0, 500);
  if (!by) throw new HttpError(400, 'Name fehlt');
  if (Boolean(cassetteId) === Boolean(postId)) throw new HttpError(400, 'Entweder eine Kassette oder einen Beitrag melden');
  if (!REPORT_REASONS.includes(reason)) throw new HttpError(400, 'Unbekannter Grund');

  // Melden darf nur, wer das Gemeldete auch sehen kann — sonst liessen sich
  // fremde Runden per ID-Raten mit Meldungen fluten.
  if (cassetteId) {
    requireMember(req, cassetteId, by);
  } else {
    const post = db.prepare(`SELECT cassette_id, author FROM posts p WHERE id = ? AND ${RELEASED}`).get(postId, Date.now()) as
      | { cassette_id: string; author: string }
      | undefined;
    if (!post) throw new HttpError(404, 'Beitrag nicht gefunden');
    requireMember(req, post.cassette_id, by);
    if (post.author === by) throw new HttpError(400, 'Den eigenen Beitrag meldet man nicht, man löscht ihn');
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO reports (id, cassette_id, post_id, reported_by, reason, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, cassetteId, postId, by, reason, note, Date.now());

  res.status(201).json({ id });
});
