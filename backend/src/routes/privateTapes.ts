import { type Request, Router } from 'express';
import { randomUUID } from 'node:crypto';
import { requireIdentity } from '../access.js';
import { NOTE_STYLES, PAIR_COUNT, PRIVATE_KINDS } from '../content.js';
import { db, type Kind } from '../db.js';
import { HttpError } from '../http.js';
import { dropMedia, mediaInUse } from '../media.js';

/* -------------------------------------------------------------------------
 * Eigene Tapes — private Baender im Profil-Regal, wie ein Tagebuch.
 *
 * Gehoeren genau einer Person und keiner Kassette. Jede Route laeuft ueber
 * requireOwnTape(): fremde Tapes antworten mit demselben 404 wie nicht
 * vorhandene, damit nicht einmal ihre Existenz durchsickert.
 * ---------------------------------------------------------------------- */

export const privateTapesRouter = Router();

const MAX_TITLE = 40;
const MAX_BODY = 500;

interface PrivateTapeRow {
  id: string;
  owner: string;
  title: string;
  color_index: number | null;
  created_at: number;
}

interface PrivateItemRow {
  id: string;
  kind: Kind;
  body: string;
  media_id: string | null;
  source: string | null;
  note_style: string | null;
  created_at: number;
  duration_ms: number | null;
}

function meOf(req: Request): string {
  const me = String(req.query.me ?? req.body?.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);
  return me;
}

function requireOwnTape(req: Request, id: string): { me: string; tape: PrivateTapeRow } {
  const me = meOf(req);
  const tape = db.prepare(`SELECT * FROM private_tapes WHERE id = ?`).get(id) as PrivateTapeRow | undefined;
  if (!tape || tape.owner !== me) throw new HttpError(404, 'Tape nicht gefunden');
  return { me, tape };
}

function parseColorIndex(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n >= PAIR_COUNT) {
    throw new HttpError(400, `colorIndex muss 0-${PAIR_COUNT - 1} oder null sein`);
  }
  return n;
}

function parseTitle(raw: unknown): string {
  const title = String(raw ?? '')
    .trim()
    .slice(0, MAX_TITLE);
  if (!title) throw new HttpError(400, 'Titel fehlt');
  return title;
}

/** Medien aller Eintraege eines Tapes — vor dem Loeschen einsammeln. */
function mediaOfTape(tapeId: string): string[] {
  return (
    db.prepare(`SELECT media_id FROM private_items WHERE tape_id = ? AND media_id IS NOT NULL`).all(tapeId) as {
      media_id: string;
    }[]
  ).map((r) => r.media_id);
}

function shapeTape(t: PrivateTapeRow) {
  const stats = db
    .prepare(
      `SELECT COUNT(*) AS n, MAX(created_at) AS last_at,
              (SELECT media_id FROM private_items
                WHERE tape_id = ? AND kind = 'photo' AND media_id IS NOT NULL
                ORDER BY created_at LIMIT 1) AS cover
         FROM private_items WHERE tape_id = ?`,
    )
    .get(t.id, t.id) as { n: number; last_at: number | null; cover: string | null };
  return {
    id: t.id,
    title: t.title,
    colorIndex: t.color_index,
    createdAt: t.created_at,
    itemCount: stats.n,
    lastAt: stats.last_at,
    coverMediaId: stats.cover,
  };
}

function shapeItem(r: PrivateItemRow) {
  return {
    id: r.id,
    kind: r.kind,
    body: r.body,
    mediaId: r.media_id,
    source: r.source,
    noteStyle: r.note_style,
    durationMs: r.duration_ms,
    createdAt: r.created_at,
  };
}

privateTapesRouter.get('/api/me/tapes', (req, res) => {
  const me = meOf(req);
  const rows = db
    .prepare(`SELECT * FROM private_tapes WHERE owner = ? ORDER BY created_at DESC`)
    .all(me) as PrivateTapeRow[];
  res.json(rows.map(shapeTape));
});

privateTapesRouter.post('/api/me/tapes', (req, res) => {
  const me = meOf(req);
  const row: PrivateTapeRow = {
    id: randomUUID(),
    owner: me,
    title: parseTitle(req.body?.title),
    color_index: parseColorIndex(req.body?.colorIndex),
    created_at: Date.now(),
  };
  db.prepare(
    `INSERT INTO private_tapes (id, owner, title, color_index, created_at) VALUES (@id, @owner, @title, @color_index, @created_at)`,
  ).run(row);
  res.status(201).json(shapeTape(row));
});

privateTapesRouter.patch('/api/me/tapes/:id', (req, res) => {
  const { tape } = requireOwnTape(req, req.params.id);
  if (req.body?.title === undefined && req.body?.colorIndex === undefined) {
    throw new HttpError(400, 'Nichts zu ändern');
  }
  const next: PrivateTapeRow = {
    ...tape,
    title: req.body?.title === undefined ? tape.title : parseTitle(req.body.title),
    color_index: req.body?.colorIndex === undefined ? tape.color_index : parseColorIndex(req.body.colorIndex),
  };
  db.prepare(`UPDATE private_tapes SET title = ?, color_index = ? WHERE id = ?`).run(
    next.title,
    next.color_index,
    tape.id,
  );
  res.json(shapeTape(next));
});

privateTapesRouter.delete('/api/me/tapes/:id', (req, res) => {
  const { tape } = requireOwnTape(req, req.params.id);
  const media = mediaOfTape(tape.id);
  db.transaction(() => {
    db.prepare(`DELETE FROM private_tapes WHERE id = ?`).run(tape.id);
    for (const id of media) dropMedia(id);
  })();
  res.status(204).end();
});

privateTapesRouter.get('/api/me/tapes/:id/items', (req, res) => {
  const { tape } = requireOwnTape(req, req.params.id);
  const rows = db
    .prepare(
      `SELECT i.*, m.duration_ms FROM private_items i
         LEFT JOIN media m ON m.id = i.media_id
        WHERE i.tape_id = ? ORDER BY i.created_at`,
    )
    .all(tape.id) as PrivateItemRow[];
  res.json(rows.map(shapeItem));
});

privateTapesRouter.post('/api/me/tapes/:id/items', (req, res) => {
  const { tape } = requireOwnTape(req, req.params.id);
  const { kind, body = '', mediaId = null, source = null, noteStyle = null } = req.body ?? {};

  if (!PRIVATE_KINDS.includes(kind)) throw new HttpError(400, 'Unbekannte Art');
  const text = String(body).trim().slice(0, MAX_BODY);
  if (kind === 'text' && !text) throw new HttpError(400, 'Leerer Zettel');
  if (noteStyle != null && !NOTE_STYLES.includes(noteStyle)) throw new HttpError(400, 'Unbekannte Zettel-Optik');
  if (kind !== 'text') {
    if (!mediaId) throw new HttpError(400, `Für ${kind} fehlt die Aufnahme`);
    if (!db.prepare(`SELECT 1 FROM media WHERE id = ?`).get(mediaId)) throw new HttpError(400, 'Medium unbekannt');
    // Sonst liesse sich ein fremdes, schon verwendetes Medium "einkleben" —
    // und beim Loeschen des privaten Tapes mitloeschen.
    if (mediaInUse(mediaId)) throw new HttpError(409, 'Medium wird schon verwendet');
  }

  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO private_items (id, tape_id, kind, body, media_id, source, note_style, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    tape.id,
    kind,
    text,
    kind === 'text' ? null : mediaId,
    kind === 'text' ? null : source === 'upload' ? 'upload' : 'camera',
    kind === 'text' ? noteStyle : null,
    now,
  );

  const row = db
    .prepare(`SELECT i.*, m.duration_ms FROM private_items i LEFT JOIN media m ON m.id = i.media_id WHERE i.id = ?`)
    .get(id) as PrivateItemRow;
  res.status(201).json(shapeItem(row));
});

privateTapesRouter.delete('/api/me/tapes/:id/items/:itemId', (req, res) => {
  const { tape } = requireOwnTape(req, req.params.id);
  const item = db
    .prepare(`SELECT media_id FROM private_items WHERE id = ? AND tape_id = ?`)
    .get(req.params.itemId, tape.id) as { media_id: string | null } | undefined;
  if (!item) throw new HttpError(404, 'Eintrag nicht gefunden');
  db.transaction(() => {
    db.prepare(`DELETE FROM private_items WHERE id = ?`).run(req.params.itemId);
    if (item.media_id) dropMedia(item.media_id);
  })();
  res.status(204).end();
});

/** Fuer Export und Kontoloeschung (account.ts). */
export function privateTapesOf(owner: string) {
  const tapes = db
    .prepare(`SELECT * FROM private_tapes WHERE owner = ? ORDER BY created_at`)
    .all(owner) as PrivateTapeRow[];
  return tapes.map((t) => ({
    ...shapeTape(t),
    eintraege: (
      db
        .prepare(
          `SELECT i.*, m.duration_ms FROM private_items i
             LEFT JOIN media m ON m.id = i.media_id
            WHERE i.tape_id = ? ORDER BY i.created_at`,
        )
        .all(t.id) as PrivateItemRow[]
    ).map(shapeItem),
  }));
}

export function privateMediaOf(owner: string): string[] {
  return (
    db
      .prepare(
        `SELECT i.media_id FROM private_items i JOIN private_tapes t ON t.id = i.tape_id
          WHERE t.owner = ? AND i.media_id IS NOT NULL`,
      )
      .all(owner) as { media_id: string }[]
  ).map((r) => r.media_id);
}
