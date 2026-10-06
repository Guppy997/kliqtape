import { type Request, Router } from 'express';
import { randomUUID } from 'node:crypto';
import { requireIdentity } from '../access.js';
import { db } from '../db.js';
import { HttpError } from '../http.js';
import { dropMedia } from '../media.js';

/* -------------------------------------------------------------------------
 * Mixtapes — ein Geschenk an genau eine Person
 * ---------------------------------------------------------------------- */

export const mixtapesRouter = Router();

// Eine C-60-Seite fasst ungefaehr so viele Titel. Die Grenze ist der Punkt:
// auswaehlen muessen ist das, was ein Mixtape persoenlich macht.
const MAX_TRACKS = 12;

export interface TapeRow {
  id: string;
  from_name: string;
  to_name: string;
  title: string;
  note: string;
  cover_id: string | null;
  sealed_at: number | null;
  created_at: number;
}

interface TrackRow {
  id: string;
  position: number;
  title: string;
  artist: string;
  url: string;
}

function loadTape(id: string): TapeRow {
  const row = db.prepare(`SELECT * FROM mixtapes WHERE id = ?`).get(id) as TapeRow | undefined;
  if (!row) throw new HttpError(404, 'Tape nicht gefunden');
  return row;
}

/**
 * Laedt ein Tape und stellt sicher, dass der Aufrufer wirklich der Absender
 * ist — Aendern, Titel ergaenzen, Versiegeln und Loeschen gehen nur am
 * eigenen Tape.
 *
 * Vorher hatten ALLE veraendernden Mixtape-Routen gar keine Pruefung: mit
 * einer bekannten Tape-ID konnte jede beliebige Person (sogar voellig ohne
 * Zugangscode) ein fremdes Geschenk umschreiben oder loeschen. Nachgewiesen
 * gegen eine Test-Datenbank, siehe Sicherheits-Notiz in docs/CONCEPT.md.
 */
function requireTapeOwner(req: Request, id: string): TapeRow {
  const me = String(req.query.me ?? req.body?.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);
  const tape = loadTape(id);
  if (tape.from_name !== me) throw new HttpError(403, 'Das ist nicht dein Mixtape');
  return tape;
}

export function tracksOf(tapeId: string): TrackRow[] {
  return db
    .prepare(`SELECT id, position, title, artist, url FROM mixtape_tracks WHERE mixtape_id = ? ORDER BY position`)
    .all(tapeId) as TrackRow[];
}

export const shapeTape = (t: TapeRow, withTracks = true) => ({
  id: t.id,
  from: t.from_name,
  to: t.to_name,
  title: t.title,
  note: t.note,
  coverId: t.cover_id,
  sealed: t.sealed_at != null,
  sealedAt: t.sealed_at,
  createdAt: t.created_at,
  tracks: withTracks ? tracksOf(t.id) : [],
  trackCount: (db.prepare(`SELECT COUNT(*) AS n FROM mixtape_tracks WHERE mixtape_id = ?`).get(t.id) as { n: number }).n,
});

/** Entwuerfe sieht nur der Ersteller, versiegelte Tapes beide Seiten. */
mixtapesRouter.get('/api/mixtapes', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const rows = db
    .prepare(
      `SELECT * FROM mixtapes
        WHERE from_name = ? OR (to_name = ? AND sealed_at IS NOT NULL)
        ORDER BY COALESCE(sealed_at, created_at) DESC`,
    )
    .all(me, me) as TapeRow[];

  res.json(rows.map((r) => shapeTape(r, false)));
});

mixtapesRouter.get('/api/mixtapes/:id', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (me) requireIdentity(req, me);
  const tape = loadTape(req.params.id);
  // Ein unversiegeltes Tape ist privat — der Empfaenger darf nichts sehen,
  // bevor es uebergeben wurde. Das ist die halbe Idee.
  if (!tape.sealed_at && tape.from_name !== me) throw new HttpError(403, 'Noch nicht überreicht');
  res.json(shapeTape(tape));
});

mixtapesRouter.post('/api/mixtapes', (req, res) => {
  const from = String(req.body?.from ?? '').trim();
  const to = String(req.body?.to ?? '').trim();
  const title = String(req.body?.title ?? '').trim().slice(0, 60);

  if (!from) throw new HttpError(400, 'Absender fehlt');
  if (!to) throw new HttpError(400, 'Für wen ist das Tape?');
  if (from === to) throw new HttpError(400, 'Ein Mixtape macht man für jemand anderen');
  requireIdentity(req, from);

  const id = randomUUID();
  db.prepare(
    `INSERT INTO mixtapes (id, from_name, to_name, title, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, from, to, title, Date.now());

  res.status(201).json(shapeTape(loadTape(id)));
});

mixtapesRouter.patch('/api/mixtapes/:id', (req, res) => {
  const tape = requireTapeOwner(req, req.params.id);
  if (tape.sealed_at) throw new HttpError(409, 'Versiegelte Tapes lassen sich nicht mehr ändern');

  const title = req.body?.title != null ? String(req.body.title).slice(0, 60) : tape.title;
  const note = req.body?.note != null ? String(req.body.note).slice(0, 300) : tape.note;
  let coverId = tape.cover_id;

  if (req.body?.coverId !== undefined) {
    const next = req.body.coverId as string | null;
    if (next && !db.prepare(`SELECT 1 FROM media WHERE id = ?`).get(next)) {
      throw new HttpError(400, 'Cover unbekannt');
    }
    coverId = next;
  }

  db.prepare(`UPDATE mixtapes SET title = ?, note = ?, cover_id = ? WHERE id = ?`).run(
    title,
    note,
    coverId,
    tape.id,
  );

  // Altes Cover erst nach dem Umbiegen der Referenz loeschen.
  if (tape.cover_id && tape.cover_id !== coverId) dropMedia(tape.cover_id);

  res.json(shapeTape(loadTape(tape.id)));
});

mixtapesRouter.post('/api/mixtapes/:id/tracks', (req, res) => {
  const tape = requireTapeOwner(req, req.params.id);
  if (tape.sealed_at) throw new HttpError(409, 'Tape ist versiegelt');

  const title = String(req.body?.title ?? '').trim().slice(0, 90);
  const artist = String(req.body?.artist ?? '').trim().slice(0, 90);
  const url = String(req.body?.url ?? '').trim().slice(0, 500);
  if (!title) throw new HttpError(400, 'Titel fehlt');

  const { n } = db
    .prepare(`SELECT COUNT(*) AS n FROM mixtape_tracks WHERE mixtape_id = ?`)
    .get(tape.id) as { n: number };
  if (n >= MAX_TRACKS) throw new HttpError(409, `Das Band ist voll — ${MAX_TRACKS} Titel`);

  db.prepare(
    `INSERT INTO mixtape_tracks (id, mixtape_id, position, title, artist, url) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), tape.id, n + 1, title, artist, url);

  res.status(201).json(shapeTape(loadTape(tape.id)));
});

mixtapesRouter.delete('/api/mixtapes/:id/tracks/:trackId', (req, res) => {
  const tape = requireTapeOwner(req, req.params.id);
  if (tape.sealed_at) throw new HttpError(409, 'Tape ist versiegelt');

  db.prepare(`DELETE FROM mixtape_tracks WHERE id = ? AND mixtape_id = ?`).run(
    req.params.trackId,
    tape.id,
  );

  // Positionen neu durchnummerieren, damit keine Luecken bleiben.
  const rest = tracksOf(tape.id);
  const renumber = db.prepare(`UPDATE mixtape_tracks SET position = ? WHERE id = ?`);
  rest.forEach((t, i) => renumber.run(i + 1, t.id));

  res.json(shapeTape(loadTape(tape.id)));
});

mixtapesRouter.post('/api/mixtapes/:id/seal', (req, res) => {
  const tape = requireTapeOwner(req, req.params.id);
  if (tape.sealed_at) throw new HttpError(409, 'Schon überreicht');
  if (tracksOf(tape.id).length === 0) throw new HttpError(400, 'Ein leeres Tape verschenkt man nicht');
  if (!tape.title.trim()) throw new HttpError(400, 'Das Tape braucht einen Titel');

  db.prepare(`UPDATE mixtapes SET sealed_at = ? WHERE id = ?`).run(Date.now(), tape.id);
  res.json(shapeTape(loadTape(tape.id)));
});

mixtapesRouter.delete('/api/mixtapes/:id', (req, res) => {
  const tape = requireTapeOwner(req, req.params.id);
  db.prepare(`DELETE FROM mixtapes WHERE id = ?`).run(tape.id);
  if (tape.cover_id) dropMedia(tape.cover_id);
  res.status(204).end();
});
