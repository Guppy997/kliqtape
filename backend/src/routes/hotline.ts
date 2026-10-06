import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { requireIdentity } from '../access.js';
import { KINDS, MEDIA_KINDS } from '../content.js';
import { type Kind, db } from '../db.js';
import { HttpError } from '../http.js';

/* -------------------------------------------------------------------------
 * Hot Line — eine offene Leitung zwischen zwei Personen
 *
 * Dauerhaft, wie Seite B: eine Leitung sammelt den ganzen Verlauf, nichts
 * verfaellt mehr. Fruehere Version hatte hier ein rollierendes 24h-Fenster
 * (siehe Git-Historie) — bewusst aufgegeben, weil Hot Line WhatsApp fuer die
 * Runde teilweise ersetzen soll und ein Verlauf dafuer nicht staendig
 * Nachrichten verlieren darf.
 * ---------------------------------------------------------------------- */

export const hotlineRouter = Router();

const HOTLINE_MAX = 240;

/** Zwei Namen alphabetisch sortiert — macht das Paar unabhaengig davon,
 *  wer zuerst geschrieben hat. */
function pairOf(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

hotlineRouter.get('/api/hotlines/threads', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const rows = db
    .prepare(
      `SELECT t.id, t.person_a, t.person_b, t.created_at,
              (SELECT body FROM hotline_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_body,
              (SELECT kind FROM hotline_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_kind,
              (SELECT from_name FROM hotline_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_from,
              (SELECT MAX(created_at) FROM hotline_messages m WHERE m.thread_id = t.id) AS last_at,
              (SELECT COUNT(*) FROM hotline_messages m WHERE m.thread_id = t.id AND m.from_name != ? AND m.heard_at IS NULL) AS unread
         FROM hotline_threads t
        WHERE t.person_a = ? OR t.person_b = ?
        ORDER BY COALESCE(last_at, t.created_at) DESC`,
    )
    .all(me, me, me) as {
    id: string;
    person_a: string;
    person_b: string;
    created_at: number;
    last_body: string | null;
    last_kind: Kind | null;
    last_from: string | null;
    last_at: number | null;
    unread: number;
  }[];

  res.json(
    rows
      // Eine Leitung ohne jede Nachricht kann es nicht geben (jede Zeile
      // entsteht erst mit der ersten Nachricht) — defensiv trotzdem filtern.
      .filter((r) => r.last_at != null)
      .map((r) => ({
        id: r.id,
        other: r.person_a === me ? r.person_b : r.person_a,
        createdAt: r.created_at,
        lastBody: r.last_body,
        lastKind: r.last_kind,
        lastFrom: r.last_from,
        lastAt: r.last_at,
        unread: r.unread,
      })),
  );
});

hotlineRouter.get('/api/hotlines/threads/:id/messages', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const thread = db.prepare(`SELECT * FROM hotline_threads WHERE id = ?`).get(req.params.id) as
    { id: string; person_a: string; person_b: string; created_at: number } | undefined;
  if (!thread) throw new HttpError(404, 'Leitung nicht gefunden');
  if (thread.person_a !== me && thread.person_b !== me) {
    throw new HttpError(403, 'Du bist nicht in dieser Leitung');
  }

  const messages = db
    .prepare(
      `SELECT h.id, h.from_name, h.body, h.kind, h.media_id, h.tape_id, h.source, h.created_at, h.heard_at,
              med.duration_ms AS duration_ms,
              t.title AS tape_title, t.cover_id AS tape_cover,
              (SELECT COUNT(*) FROM mixtape_tracks mt WHERE mt.mixtape_id = t.id) AS tape_tracks
         FROM hotline_messages h
         LEFT JOIN media med ON med.id = h.media_id
         LEFT JOIN mixtapes t ON t.id = h.tape_id
        WHERE h.thread_id = ? ORDER BY h.created_at ASC`,
    )
    .all(thread.id) as {
    id: string;
    from_name: string;
    body: string;
    kind: Kind;
    media_id: string | null;
    tape_id: string | null;
    source: 'camera' | 'upload' | null;
    created_at: number;
    heard_at: number | null;
    duration_ms: number | null;
    tape_title: string | null;
    tape_cover: string | null;
    tape_tracks: number | null;
  }[];

  res.json({
    id: thread.id,
    other: thread.person_a === me ? thread.person_b : thread.person_a,
    createdAt: thread.created_at,
    messages: messages.map((m) => ({
      id: m.id,
      from: m.from_name,
      body: m.body,
      kind: m.kind,
      mediaId: m.media_id,
      durationMs: m.duration_ms,
      tapeId: m.tape_id,
      tape: m.tape_id ? { title: m.tape_title ?? '', coverId: m.tape_cover, trackCount: m.tape_tracks ?? 0 } : null,
      source: m.source,
      createdAt: m.created_at,
      heard: m.heard_at != null,
    })),
  });
});

hotlineRouter.post('/api/hotlines/threads', (req, res) => {
  const from = String(req.body?.from ?? '').trim();
  const to = String(req.body?.to ?? '').trim();
  const kind = (req.body?.kind ?? 'text') as Kind;
  const text = String(req.body?.body ?? '').trim();
  const mediaId = req.body?.mediaId ? String(req.body.mediaId) : null;
  const tapeId = req.body?.tapeId ? String(req.body.tapeId) : null;
  const source = req.body?.source ? String(req.body.source) : null;

  if (!KINDS.includes(kind)) throw new HttpError(400, 'Unbekannte Nachrichtenart');
  if (kind === 'text' && !text) throw new HttpError(400, 'Leere Nachricht');
  if (text.length > HOTLINE_MAX) throw new HttpError(400, `Maximal ${HOTLINE_MAX} Zeichen`);
  if (!from) throw new HttpError(400, 'Absender fehlt');
  if (!to) throw new HttpError(400, 'Empfänger fehlt');
  if (from === to) throw new HttpError(400, 'Man ruft sich nicht selbst an');
  requireIdentity(req, from);
  if (MEDIA_KINDS.includes(kind) && !mediaId) throw new HttpError(400, `Für ${kind} fehlt die Aufnahme`);
  if (mediaId && !db.prepare(`SELECT 1 FROM media WHERE id = ?`).get(mediaId)) {
    throw new HttpError(400, 'Medium unbekannt');
  }
  if (kind === 'tape') {
    if (!tapeId) throw new HttpError(400, 'Welches Mixtape?');
    const tape = db.prepare(`SELECT sealed_at FROM mixtapes WHERE id = ?`).get(tapeId) as
      { sealed_at: number | null } | undefined;
    if (!tape) throw new HttpError(404, 'Mixtape nicht gefunden');
    if (!tape.sealed_at) throw new HttpError(400, 'Nur versiegelte Mixtapes lassen sich teilen');
  }

  const [a, b] = pairOf(from, to);
  const now = Date.now();

  let threadId = (
    db.prepare(`SELECT id FROM hotline_threads WHERE person_a = ? AND person_b = ?`).get(a, b) as
      { id: string } | undefined
  )?.id;

  if (!threadId) {
    threadId = randomUUID();
    db.prepare(`INSERT INTO hotline_threads (id, person_a, person_b, created_at) VALUES (?, ?, ?, ?)`).run(
      threadId,
      a,
      b,
      now,
    );
  }

  const messageId = randomUUID();
  db.prepare(
    `INSERT INTO hotline_messages (id, thread_id, from_name, body, kind, media_id, tape_id, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(messageId, threadId, from, text, kind, mediaId, tapeId, source, now);

  res.status(201).json({ threadId, messageId });
});

hotlineRouter.post('/api/hotlines/threads/:id/heard', (req, res) => {
  const me = String(req.body?.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const thread = db.prepare(`SELECT person_a, person_b FROM hotline_threads WHERE id = ?`).get(req.params.id) as
    { person_a: string; person_b: string } | undefined;
  if (!thread) throw new HttpError(404, 'Leitung nicht gefunden');
  if (thread.person_a !== me && thread.person_b !== me) throw new HttpError(403, 'Du bist nicht in dieser Leitung');

  db.prepare(
    `UPDATE hotline_messages SET heard_at = ? WHERE thread_id = ? AND from_name != ? AND heard_at IS NULL`,
  ).run(Date.now(), req.params.id, me);

  res.json({ ok: true });
});
