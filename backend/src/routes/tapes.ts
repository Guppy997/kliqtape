import { Router } from 'express';
import { requireIdentity, requireMember } from '../access.js';
import { db } from '../db.js';
import { HttpError } from '../http.js';
import { RELEASED } from '../media.js';
import { berlinCivilDay, berlinWallClock, tapeIndexOf } from '../time.js';

/* -------------------------------------------------------------------------
 * Tapes — Seite A in Kalendertage gegliedert, siehe tapeIndexOf() in time.ts.
 * Kassettenweit benennbar, pro Person ins eigene Regal zu legen (Favorit,
 * mit eigener Beschriftung). Sparse: eine Zeile existiert nur, wenn jemand
 * tatsaechlich benannt oder gesammelt hat.
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
  // Nur die EIGENEN Favoriten — wer sonst ein Tape ins Regal gelegt hat (und
  // wie viele), erfaehrt die Runde nicht. Frueher lag hier ein Zaehler bei.
  const mine = new Set(
    (
      db
        .prepare(`SELECT tape_index FROM cassette_tape_favorites WHERE cassette_id = ? AND member = ?`)
        .all(req.params.id, me) as { tape_index: number }[]
    ).map((r) => r.tape_index),
  );

  const byIndex = new Map<number, string | null>();
  for (const n of names) byIndex.set(n.tape_index, n.name);
  for (const idx of mine) if (!byIndex.has(idx)) byIndex.set(idx, null);

  res.json(
    [...byIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([tapeIndex, name]) => ({ tapeIndex, name, favoritedByMe: mine.has(tapeIndex) })),
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

  // Ins eigene Regal legen. Mit `label` zugleich (um)beschriften — die
  // Beschriftung ist persoenlich, die Runde sieht sie nie (anders als der
  // kassettenweite Tape-Name ueber PUT).
  if (req.body?.label === undefined) {
    db.prepare(
      `INSERT OR IGNORE INTO cassette_tape_favorites (cassette_id, tape_index, member, favorited_at) VALUES (?, ?, ?, ?)`,
    ).run(req.params.id, tapeIndex, by, Date.now());
  } else {
    const label =
      String(req.body.label ?? '')
        .trim()
        .slice(0, 60) || null;
    db.prepare(
      `INSERT INTO cassette_tape_favorites (cassette_id, tape_index, member, favorited_at, label) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(cassette_id, tape_index, member) DO UPDATE SET label = excluded.label`,
    ).run(req.params.id, tapeIndex, by, Date.now(), label);
  }

  res.status(201).json({ ok: true });
});

/* -------------------------------------------------------------------------
 * Das eigene Regal im Profil: alle Tapes, die man sich aus seinen Kassetten
 * hineingelegt hat — nur aus Runden, in denen man noch Mitglied ist. Mit
 * eigener Beschriftung, Datum und dem ersten Foto des Tages als Vorschau.
 * Die Bandfarbe rechnet das Frontend selbst (useLookIndex), wie im Fach.
 * ---------------------------------------------------------------------- */
tapesRouter.get('/api/me/shelf', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  requireIdentity(req, me);
  const rows = db
    .prepare(
      `SELECT f.cassette_id, f.tape_index, f.label, f.favorited_at,
              c.name AS cassette_name, c.created_at AS cassette_created,
              t.name AS tape_name
         FROM cassette_tape_favorites f
         JOIN cassettes c ON c.id = f.cassette_id
         JOIN cassette_members m ON m.cassette_id = f.cassette_id AND m.member = f.member
         LEFT JOIN cassette_tapes t ON t.cassette_id = f.cassette_id AND t.tape_index = f.tape_index
        WHERE f.member = ?
        ORDER BY f.favorited_at DESC`,
    )
    .all(me) as {
    cassette_id: string;
    tape_index: number;
    label: string | null;
    favorited_at: number;
    cassette_name: string;
    cassette_created: number;
    tape_name: string | null;
  }[];

  const firstPhoto = db.prepare(
    `SELECT media_id FROM posts p
      WHERE p.cassette_id = ? AND p.side = 'a' AND p.kind = 'photo' AND p.media_id IS NOT NULL
        AND p.created_at >= ? AND p.created_at < ? AND ${RELEASED}
      ORDER BY p.created_at LIMIT 1`,
  );
  const now = Date.now();

  res.json(
    rows.map((r) => {
      const day = berlinCivilDay(r.cassette_created) + (r.tape_index - 1) * 86_400_000;
      const photo = firstPhoto.get(
        r.cassette_id,
        berlinWallClock(day, 0),
        berlinWallClock(day + 86_400_000, 0),
        now,
      ) as { media_id: string } | undefined;
      return {
        cassetteId: r.cassette_id,
        cassetteName: r.cassette_name,
        tapeIndex: r.tape_index,
        label: r.label,
        tapeName: r.tape_name,
        // Kalendertag als UTC-Mitternacht, wie dateOfTapeIndex() im Frontend
        dayMs: day,
        previewMediaId: photo?.media_id ?? null,
        savedAt: r.favorited_at,
      };
    }),
  );
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
