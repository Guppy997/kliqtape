import { Router } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { requireIdentity, requireMember } from '../access.js';
import { MEDIA_DIR } from '../config.js';
import { type Kind, db } from '../db.js';
import { HttpError } from '../http.js';
import { ALLOWED_MIME } from '../media.js';
import { type AlbumSource, buildAlbum, renderAlbumPdf } from '../print/album.js';
import { BERLIN_DAY, BERLIN_HM, UTC_DATE, berlinCivilDay, tapeIndexOf } from '../time.js';

/* -------------------------------------------------------------------------
 * Album-Export — Tapes von Seite A als PDF. Die Gestaltung liegt in
 * print/album.ts und hat KEINEN Datenbankzugang; sie bekommt nur diese
 * AlbumSource, die ausschliesslich die View album_posts liest (db.ts):
 * freigegebene Seite-A-Beitraege ohne die Leute, die ihre Beitraege aus
 * Alben ausgenommen haben. Seite B und Hot Line sind so nicht erreichbar.
 * ---------------------------------------------------------------------- */

export const albumRouter = Router();

function albumSourceFor(cassetteId: string): AlbumSource {
  const cassette = db.prepare(`SELECT name, created_at FROM cassettes WHERE id = ?`).get(cassetteId) as
    | { name: string; created_at: number }
    | undefined;
  if (!cassette) throw new HttpError(404, 'Kassette nicht gefunden');
  const rows = db
    .prepare(
      `SELECT ap.id, ap.author, ap.kind, ap.body, ap.media_id, ap.source, ap.taken_at, ap.created_at,
              t.title AS tape_title, t.cover_id AS tape_cover
         FROM album_posts ap
         LEFT JOIN mixtapes t ON t.id = ap.tape_id
        WHERE ap.cassette_id = ?
        ORDER BY ap.created_at ASC`,
    )
    .all(cassetteId) as {
    id: string;
    author: string;
    kind: Kind;
    body: string;
    media_id: string | null;
    source: string | null;
    taken_at: number | null;
    created_at: number;
    tape_title: string | null;
    tape_cover: string | null;
  }[];
  // Nur Medien, die zu genau diesen Zeilen gehoeren, sind abrufbar.
  const allowed = new Set<string>();
  for (const r of rows) {
    if (r.media_id) allowed.add(r.media_id);
    if (r.tape_cover) allowed.add(r.tape_cover);
  }
  const startDay = berlinCivilDay(cassette.created_at);

  return {
    cassette: () => ({ name: cassette.name, createdAt: cassette.created_at }),
    posts: () =>
      rows.map((r) => ({
        id: r.id,
        author: r.author,
        kind: r.kind,
        body: r.body,
        mediaId: r.media_id,
        source: r.source,
        takenAt: r.taken_at,
        createdAt: r.created_at,
        tapeIndex: tapeIndexOf(cassette.created_at, r.created_at),
        mixtape: r.kind === 'tape' ? { title: r.tape_title ?? '', coverId: r.tape_cover } : null,
      })),
    tapeNames: () =>
      new Map(
        (db.prepare(`SELECT tape_index, name FROM cassette_tapes WHERE cassette_id = ?`).all(cassetteId) as {
          tape_index: number;
          name: string;
        }[]).map((r) => [r.tape_index, r.name]),
      ),
    mediaFile: (mediaId) => {
      if (!allowed.has(mediaId)) return null;
      const m = db.prepare(`SELECT mime FROM media WHERE id = ?`).get(mediaId) as { mime: string } | undefined;
      if (!m) return null;
      const path = join(MEDIA_DIR, `${mediaId}.${ALLOWED_MIME[m.mime]}`);
      return existsSync(path) ? { path, mime: m.mime } : null;
    },
    dateOfTape: (i) => UTC_DATE.format(new Date(startDay + (i - 1) * 86_400_000)),
    timeOf: (ms) => BERLIN_HM.format(new Date(ms)),
    stampOf: (ms) => {
      const parts = BERLIN_DAY.formatToParts(new Date(ms));
      const v = (t: string) => parts.find((p) => p.type === t)!.value;
      return `'${v('year').slice(2)} ${v('month')} ${v('day')}`;
    },
  };
}

/** ?tapes=1,3,4 — leer heisst alle. */
function tapesParam(raw: unknown): number[] | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const list = s.split(',').map(Number);
  if (list.some((n) => !Number.isInteger(n) || n < 1)) throw new HttpError(400, 'Ungültige Tapes');
  return list;
}

// Vorschau fuer die Auswahl: welche Tapes haben etwas Druckbares, wie heissen sie.
albumRouter.get('/api/cassettes/:id/album', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  requireMember(req, req.params.id, me);
  const album = buildAlbum(albumSourceFor(req.params.id), tapesParam(req.query.tapes));
  res.json(album);
});

albumRouter.get('/api/cassettes/:id/album.pdf', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  requireMember(req, req.params.id, me);
  const source = albumSourceFor(req.params.id);
  const album = buildAlbum(source, tapesParam(req.query.tapes));
  if (album.tapes.length === 0) throw new HttpError(404, 'In diesen Tapes ist nichts, das sich drucken lässt');
  const safe = album.cassetteName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'kassette';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="kliqtape-album-${safe}.pdf"; filename*=UTF-8''kliqtape-album-${encodeURIComponent(safe)}.pdf`);
  res.setHeader('Cache-Control', 'no-store');
  renderAlbumPdf(album, source, res);
});

// "Meine Beitraege nicht in Alben" — wirkt fuer alle Kassetten und alle,
// die exportieren; die Beitraege fehlen dann einfach (View album_posts).
albumRouter.get('/api/me/album', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  requireIdentity(req, me);
  const row = db.prepare(`SELECT album_opt_out FROM profiles WHERE name = ?`).get(me) as
    | { album_opt_out: number }
    | undefined;
  res.json({ optOut: row?.album_opt_out === 1 });
});

albumRouter.put('/api/me/album', (req, res) => {
  const me = String(req.body?.me ?? '').trim();
  requireIdentity(req, me);
  const optOut = req.body?.optOut === true ? 1 : 0;
  db.prepare(
    `INSERT INTO profiles (name, avatar_id, updated_at, album_opt_out) VALUES (?, NULL, ?, ?)
     ON CONFLICT(name) DO UPDATE SET album_opt_out = excluded.album_opt_out, updated_at = excluded.updated_at`,
  ).run(me, Date.now(), optOut);
  res.json({ optOut: optOut === 1 });
});
