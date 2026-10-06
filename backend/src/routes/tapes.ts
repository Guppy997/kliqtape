import { Router } from 'express';
import { requireMember } from '../access.js';
import { db } from '../db.js';
import { HttpError } from '../http.js';
import { tapeIndexOf } from '../time.js';

/* -------------------------------------------------------------------------
 * Tapes — Seite A in Kalendertage gegliedert, siehe tapeIndexOf() in time.ts.
 * Kassettenweit benennbar, pro Person favorisierbar. Sparse: eine Zeile
 * existiert nur, wenn jemand tatsaechlich benannt oder favorisiert hat.
 * ---------------------------------------------------------------------- */

export const tapesRouter = Router();

/** Hoechste erreichbare Tape-Nummer heute — verhindert Benennen/Favorisieren
 *  eines Tapes, das noch gar nicht angefangen hat. */
function maxTapeIndex(cassetteCreatedAt: number): number {
  return tapeIndexOf(cassetteCreatedAt, Date.now());
}

function loadCassetteOr404(cassetteId: string): { created_at: number } {
  const row = db.prepare(`SELECT created_at FROM cassettes WHERE id = ?`).get(cassetteId) as
    { created_at: number } | undefined;
  if (!row) throw new HttpError(404, 'Kassette nicht gefunden');
  return row;
}

tapesRouter.get('/api/cassettes/:id/tapes', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireMember(req, req.params.id, me);

  const names = db.prepare(`SELECT tape_index, name FROM cassette_tapes WHERE cassette_id = ?`).all(req.params.id) as {
    tape_index: number;
    name: string;
  }[];
  const favCounts = db
    .prepare(
      `SELECT tape_index, COUNT(*) AS n FROM cassette_tape_favorites
        WHERE cassette_id = ? GROUP BY tape_index`,
    )
    .all(req.params.id) as { tape_index: number; n: number }[];
  const mine = new Set(
    (
      db
        .prepare(`SELECT tape_index FROM cassette_tape_favorites WHERE cassette_id = ? AND member = ?`)
        .all(req.params.id, me) as { tape_index: number }[]
    ).map((r) => r.tape_index),
  );

  const byIndex = new Map<number, { name: string | null; favoriteCount: number }>();
  for (const n of names) byIndex.set(n.tape_index, { name: n.name, favoriteCount: 0 });
  for (const f of favCounts) {
    const cur = byIndex.get(f.tape_index) ?? { name: null, favoriteCount: 0 };
    cur.favoriteCount = f.n;
    byIndex.set(f.tape_index, cur);
  }

  res.json(
    [...byIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([tapeIndex, v]) => ({
        tapeIndex,
        name: v.name,
        favoriteCount: v.favoriteCount,
        favoritedByMe: mine.has(tapeIndex),
      })),
  );
});

tapesRouter.get('/api/cassettes/:id/tapes/favorites', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireMember(req, req.params.id, me);

  const rows = db
    .prepare(
      `SELECT f.tape_index, f.favorited_at, t.name
         FROM cassette_tape_favorites f
         LEFT JOIN cassette_tapes t ON t.cassette_id = f.cassette_id AND t.tape_index = f.tape_index
        WHERE f.cassette_id = ? AND f.member = ?
        ORDER BY f.tape_index ASC`,
    )
    .all(req.params.id, me) as { tape_index: number; favorited_at: number; name: string | null }[];

  res.json(rows.map((r) => ({ tapeIndex: r.tape_index, name: r.name, favoritedAt: r.favorited_at })));
});

tapesRouter.put('/api/cassettes/:id/tapes/:tapeIndex', (req, res) => {
  const by = String(req.body?.by ?? '').trim();
  const name = String(req.body?.name ?? '').trim();
  const tapeIndex = Number(req.params.tapeIndex);
  if (!by) throw new HttpError(400, 'Name fehlt');
  requireMember(req, req.params.id, by);

  const cassette = loadCassetteOr404(req.params.id);
  if (!Number.isInteger(tapeIndex) || tapeIndex < 1 || tapeIndex > maxTapeIndex(cassette.created_at)) {
    throw new HttpError(400, 'Ungueltiges Tape');
  }

  if (!name) {
    db.prepare(`DELETE FROM cassette_tapes WHERE cassette_id = ? AND tape_index = ?`).run(req.params.id, tapeIndex);
  } else {
    db.prepare(
      `INSERT INTO cassette_tapes (cassette_id, tape_index, name, named_by, named_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(cassette_id, tape_index) DO UPDATE SET name = excluded.name, named_by = excluded.named_by, named_at = excluded.named_at`,
    ).run(req.params.id, tapeIndex, name.slice(0, 60), by, Date.now());
  }

  res.json({ tapeIndex, name: name || null });
});

tapesRouter.post('/api/cassettes/:id/tapes/:tapeIndex/favorite', (req, res) => {
  const by = String(req.body?.by ?? '').trim();
  const tapeIndex = Number(req.params.tapeIndex);
  if (!by) throw new HttpError(400, 'Name fehlt');
  requireMember(req, req.params.id, by);

  const cassette = loadCassetteOr404(req.params.id);
  if (!Number.isInteger(tapeIndex) || tapeIndex < 1 || tapeIndex > maxTapeIndex(cassette.created_at)) {
    throw new HttpError(400, 'Ungueltiges Tape');
  }

  db.prepare(
    `INSERT OR IGNORE INTO cassette_tape_favorites (cassette_id, tape_index, member, favorited_at) VALUES (?, ?, ?, ?)`,
  ).run(req.params.id, tapeIndex, by, Date.now());

  res.status(201).json({ ok: true });
});

tapesRouter.delete('/api/cassettes/:id/tapes/:tapeIndex/favorite', (req, res) => {
  const by = String(req.query.by ?? '').trim();
  if (!by) throw new HttpError(400, 'Name fehlt');
  requireMember(req, req.params.id, by);

  db.prepare(`DELETE FROM cassette_tape_favorites WHERE cassette_id = ? AND tape_index = ? AND member = ?`).run(
    req.params.id,
    Number(req.params.tapeIndex),
    by,
  );

  res.status(204).end();
});
