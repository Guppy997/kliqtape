import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { requireIdentity, requireMember } from '../access.js';
import { KINDS, MEDIA_KINDS, NOTE_STYLES, NoteStyle, SIDES } from '../content.js';
import { type Kind, type PostRow, type Side, db } from '../db.js';
import { HttpError } from '../http.js';
import { RELEASED, dropMedia } from '../media.js';
import { tapeIndexOf } from '../time.js';

/* -------------------------------------------------------------------------
 * Beitraege auf Seite A (Archiv, nach Tapes gegliedert) und Seite B
 * (Gruppenchat): Feed lesen, posten, loeschen, Tonfetzen.
 * ---------------------------------------------------------------------- */

export const postsRouter = Router();

interface FeedItem extends Omit<
  PostRow,
  'media_id' | 'tape_id' | 'cassette_id' | 'expires_at' | 'note_style' | 'quoted_post_id' | 'develop_at' | 'taken_at'
> {
  cassetteId: string;
  /** Nur beim Film: wann wirklich belichtet wurde (created_at ist die Freigabe). */
  takenAt: number | null;
  /** Beitrag aus einer Imposter-Woche: 'entry' vor der Aufloesung, danach
   *  'imposter' oder 'crew'. */
  imposterMark: 'entry' | 'imposter' | 'crew' | null;
  mediaId: string | null;
  durationMs: number | null;
  tapeId: string | null;
  tape: { title: string; coverId: string | null; trackCount: number } | null;
  track: string;
  /** Nur auf Seite A gesetzt — welches Tape (Kalendertag) dieser Post gehoert. */
  tapeIndex: number | null;
  tonfetzenCount: number;
  iSentTonfetzen: boolean;
  noteStyle: NoteStyle | null;
  quotedPostId: string | null;
  quotedPost: { id: string; author: string; kind: Kind; body: string; mediaId: string | null } | null;
}

postsRouter.get('/api/posts', (req, res) => {
  const side = String(req.query.side ?? 'a') as Side;
  const cassetteId = String(req.query.cassette ?? '').trim();
  const me = String(req.query.me ?? '').trim();
  if (!SIDES.includes(side)) throw new HttpError(400, 'side muss a oder b sein');
  if (!cassetteId) throw new HttpError(400, 'Welche Kassette?');

  const cassette = db.prepare(`SELECT created_at FROM cassettes WHERE id = ?`).get(cassetteId) as
    { created_at: number } | undefined;
  if (!cassette) throw new HttpError(404, 'Kassette nicht gefunden');
  // Fehlte bisher komplett: ohne diese Pruefung konnte jede Person mit einer
  // Kassetten-ID deren ganzen Feed lesen, egal ob Mitglied oder nicht.
  requireMember(req, cassetteId, me);

  // Aeltestes zuerst: der Feed laeuft wie ein Band von vorn nach hinten ab.
  const rows = db
    .prepare(
      `SELECT p.*, m.duration_ms AS duration_ms,
              t.title AS tape_title, t.cover_id AS tape_cover,
              (SELECT COUNT(*) FROM mixtape_tracks mt WHERE mt.mixtape_id = t.id) AS tape_tracks,
              q.author AS quoted_author, q.kind AS quoted_kind, q.body AS quoted_body,
              q.media_id AS quoted_media_id,
              -- Wer Imposter war, erst nach der Aufloesung — vorher NULL.
              CASE WHEN iw.revealed_at IS NOT NULL THEN iw.imposter END AS imposter_name
         FROM posts p
         LEFT JOIN media m ON m.id = p.media_id
         LEFT JOIN mixtapes t ON t.id = p.tape_id
         LEFT JOIN posts q ON q.id = p.quoted_post_id
         LEFT JOIN imposter_entries ie ON ie.post_id = p.id
         LEFT JOIN imposter_weeks iw ON iw.id = ie.week_id
        WHERE p.side = ? AND p.cassette_id = ? AND ${RELEASED}
        ORDER BY p.created_at ASC`,
    )
    .all(side, cassetteId, Date.now()) as (PostRow & {
    duration_ms: number | null;
    tape_title: string | null;
    tape_cover: string | null;
    tape_tracks: number | null;
    quoted_author: string | null;
    quoted_kind: Kind | null;
    quoted_body: string | null;
    quoted_media_id: string | null;
    imposter_name: string | null;
  })[];

  // Tonfetzen sind eine private Geste: wie viele Reaktionen ein Beitrag hat, sieht
  // nur die postende Person. Alle anderen sehen bloss, ob sie selbst schon
  // getapt haben (kein erneutes Aufnehmen noetig/moeglich in der UI).
  const reactions = db
    .prepare(
      `SELECT r.post_id, r.author
         FROM reactions r
         JOIN posts p ON p.id = r.post_id
        WHERE p.side = ? AND p.cassette_id = ? AND r.media_id IS NOT NULL`,
    )
    .all(side, cassetteId) as { post_id: string; author: string }[];

  const countByPost = new Map<string, number>();
  const mineByPost = new Set<string>();
  for (const r of reactions) {
    countByPost.set(r.post_id, (countByPost.get(r.post_id) ?? 0) + 1);
    if (r.author === me) mineByPost.add(r.post_id);
  }

  // Track-Nummer: auf Seite A pro Tape (Kalendertag) neu ab 1 — wie bei
  // einer echten Kassette hat jedes Tape seine eigene Tracklist. Seite B
  // kennt kein Tape, dort bleibt es die durchgehende Position.
  const tapePositions = new Map<number, number>();

  const items: FeedItem[] = rows.map((row, i) => {
    const tapeIndex = side === 'a' ? tapeIndexOf(cassette.created_at, row.created_at) : null;
    let track: string;
    if (tapeIndex != null) {
      const pos = (tapePositions.get(tapeIndex) ?? 0) + 1;
      tapePositions.set(tapeIndex, pos);
      track = `A${pos}`;
    } else {
      track = `${side.toUpperCase()}${i + 1}`;
    }
    return {
      id: row.id,
      side: row.side,
      author: row.author,
      kind: row.kind,
      body: row.body,
      created_at: row.created_at,
      cassetteId: row.cassette_id,
      mediaId: row.media_id,
      durationMs: row.duration_ms,
      source: row.source ?? 'camera',
      takenAt: row.taken_at,
      imposterMark:
        row.source === 'imposter'
          ? row.imposter_name
            ? row.imposter_name === row.author
              ? 'imposter'
              : 'crew'
            : 'entry'
          : null,
      tapeId: row.tape_id,
      tape: row.tape_id
        ? { title: row.tape_title ?? '', coverId: row.tape_cover, trackCount: row.tape_tracks ?? 0 }
        : null,
      track,
      tapeIndex,
      tonfetzenCount: row.author === me ? (countByPost.get(row.id) ?? 0) : 0,
      iSentTonfetzen: mineByPost.has(row.id),
      noteStyle: (row.note_style as NoteStyle | null) ?? null,
      quotedPostId: row.quoted_post_id,
      quotedPost: row.quoted_post_id
        ? {
            id: row.quoted_post_id,
            author: row.quoted_author ?? '',
            kind: row.quoted_kind ?? 'text',
            body: row.quoted_body ?? '',
            mediaId: row.quoted_media_id,
          }
        : null,
    };
  });

  res.json(items);
});

postsRouter.post('/api/posts', (req, res) => {
  const {
    cassetteId,
    side,
    author,
    kind,
    body = '',
    mediaId = null,
    tapeId = null,
    source = null,
    noteStyle = null,
    quotedPostId = null,
  } = req.body ?? {};

  if (!SIDES.includes(side)) throw new HttpError(400, 'side muss a oder b sein');
  if (!KINDS.includes(kind)) throw new HttpError(400, 'Unbekannte Post-Art');
  if (typeof author !== 'string' || author.trim().length === 0) {
    throw new HttpError(400, 'Name fehlt');
  }
  if (!cassetteId) throw new HttpError(400, 'Welche Kassette?');
  requireMember(req, cassetteId, author.trim());
  if (kind === 'text' && String(body).trim().length === 0) {
    throw new HttpError(400, 'Leerer Text');
  }
  if (noteStyle != null && !NOTE_STYLES.includes(noteStyle)) {
    throw new HttpError(400, 'Unbekannte Zettel-Optik');
  }
  if (MEDIA_KINDS.includes(kind) && !mediaId) {
    throw new HttpError(400, `Für ${kind} fehlt die Aufnahme`);
  }
  if (mediaId && !db.prepare(`SELECT 1 FROM media WHERE id = ?`).get(mediaId)) {
    throw new HttpError(400, 'Medium unbekannt');
  }

  if (kind === 'tape') {
    if (!tapeId) throw new HttpError(400, 'Welches Mixtape?');
    const tape = db.prepare(`SELECT from_name, sealed_at FROM mixtapes WHERE id = ?`).get(tapeId) as
      { from_name: string; sealed_at: number | null } | undefined;
    if (!tape) throw new HttpError(404, 'Mixtape nicht gefunden');
    // Nur eigene und bereits versiegelte Tapes lassen sich teilen — ein
    // Entwurf ist privat, und fremde Tapes gehoeren einem nicht.
    if (tape.from_name !== author.trim()) throw new HttpError(403, 'Das ist nicht dein Mixtape');
    if (!tape.sealed_at) throw new HttpError(400, 'Erst versiegeln, dann teilen');
  }

  // Bruecke von Seite A zu Seite B: eine Chat-Nachricht darf sich auf einen
  // Archiv-Beitrag beziehen ("dazu schreiben"). Nur in diese eine Richtung,
  // sonst waere das eine zweite, verwirrende Bedeutung von "Zitat" auf
  // derselben Seite, auf der der Beitrag selbst steht.
  if (quotedPostId != null) {
    if (side !== 'b') throw new HttpError(400, 'Beziehen kann man sich nur in Seite B auf einen Beitrag');
    const quoted = db
      .prepare(`SELECT cassette_id, side FROM posts p WHERE id = ? AND ${RELEASED}`)
      .get(quotedPostId, Date.now()) as { cassette_id: string | null; side: Side } | undefined;
    if (!quoted) throw new HttpError(404, 'Beitrag nicht gefunden');
    if (quoted.cassette_id !== cassetteId) throw new HttpError(400, 'Beitrag gehört zu einer anderen Kassette');
    if (quoted.side !== 'a') throw new HttpError(400, 'Nur Beiträge von Seite A lassen sich aufgreifen');
  }

  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO posts (id, cassette_id, side, author, kind, body, media_id, tape_id, source,
                        note_style, quoted_post_id, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    cassetteId,
    side,
    author.trim().slice(0, 40),
    kind,
    String(body).slice(0, 500),
    mediaId,
    kind === 'tape' ? tapeId : null,
    source === 'upload' ? 'upload' : 'camera',
    kind === 'text' ? noteStyle : null,
    quotedPostId,
    // Beide Seiten sind dauerhaft — siehe db.ts fuer die Historie dazu.
    null,
    now,
  );

  res.status(201).json({ id });
});

// Loeschen darf nur, wer den Beitrag selbst geschrieben hat. Vorher stand
// hier GAR KEINE Pruefung: jedes Mitglied sieht im Feed die IDs aller
// Beitraege und konnte damit die Beitraege aller anderen loeschen — sogar
// ganz ohne Zugangscode. Die Oberflaeche zeigt den Loeschen-Knopf ohnehin
// nur am eigenen Beitrag (PostCard.tsx, `mine`), die Regel hier bildet also
// nur nach, was die App sowieso meint.
postsRouter.delete('/api/posts/:id', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const row = db.prepare(`SELECT author, media_id FROM posts WHERE id = ?`).get(req.params.id) as
    { author: string; media_id: string | null } | undefined;
  if (!row) throw new HttpError(404, 'Post nicht gefunden');
  if (row.author !== me) throw new HttpError(403, 'Das ist nicht dein Beitrag');

  db.prepare(`DELETE FROM posts WHERE id = ?`).run(req.params.id);

  // Medium mit loeschen — sonst bleiben verwaiste Dateien im Volume liegen.
  if (row.media_id) dropMedia(row.media_id);

  res.status(204).end();
});

// Tonfetzen: eine kurze, private Sprachreaktion statt eines oeffentlichen
// Zaehlers. Ein zweiter Tonfetzen auf denselben Beitrag ersetzt den ersten, statt
// sich anzuhaeufen — pro Person zaehlt die aktuellste Reaktion.
postsRouter.post('/api/posts/:id/react', (req, res) => {
  const author = String(req.body?.author ?? '').trim();
  const mediaId = String(req.body?.mediaId ?? '').trim();
  if (!author) throw new HttpError(400, 'Name fehlt');
  if (!mediaId) throw new HttpError(400, 'Aufnahme fehlt');

  const post = db
    .prepare(`SELECT cassette_id, author AS post_author FROM posts p WHERE id = ? AND ${RELEASED}`)
    .get(req.params.id, Date.now()) as { cassette_id: string; post_author: string } | undefined;
  if (!post) throw new HttpError(404, 'Post nicht gefunden');
  if (post.post_author === author) throw new HttpError(400, 'Kein Tonfetzen auf den eigenen Beitrag');
  requireMember(req, post.cassette_id, author);
  if (!db.prepare(`SELECT 1 FROM media WHERE id = ?`).get(mediaId)) throw new HttpError(400, 'Medium unbekannt');

  const prev = db
    .prepare(`SELECT media_id FROM reactions WHERE post_id = ? AND author = ?`)
    .get(req.params.id, author) as { media_id: string | null } | undefined;

  db.prepare(
    `INSERT INTO reactions (post_id, author, media_id, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(post_id, author) DO UPDATE SET media_id = excluded.media_id, created_at = excluded.created_at`,
  ).run(req.params.id, author, mediaId, Date.now());

  // Erst NACH dem Umbiegen aufraeumen — sonst schlaegt der Fremdschluessel
  // zu, waehrend die Reaktion noch auf die alte Aufnahme zeigt.
  if (prev?.media_id && prev.media_id !== mediaId) dropMedia(prev.media_id);

  res.status(201).json({ mediaId });
});

// Nur die postende Person hoert ihre Tonfetzen — bewusst nicht oeffentlich,
// sonst wird aus der Geste wieder eine Performance vor der ganzen Runde.
postsRouter.get('/api/posts/:id/reactions', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  const post = db.prepare(`SELECT author FROM posts WHERE id = ?`).get(req.params.id) as { author: string } | undefined;
  if (!post) throw new HttpError(404, 'Post nicht gefunden');
  if (!me || post.author !== me) throw new HttpError(403, 'Nur die postende Person hört das');
  requireIdentity(req, me);

  const rows = db
    .prepare(
      `SELECT author, media_id, created_at
         FROM reactions
        WHERE post_id = ? AND media_id IS NOT NULL
        ORDER BY created_at ASC`,
    )
    .all(req.params.id) as { author: string; media_id: string; created_at: number }[];

  res.json(rows.map((r) => ({ author: r.author, mediaId: r.media_id, createdAt: r.created_at })));
});
