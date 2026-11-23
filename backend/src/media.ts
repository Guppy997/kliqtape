import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { identityOf } from './access.js';
import { MAX_UPLOAD_MB, MEDIA_DIR } from './config.js';
import { db } from './db.js';
import { HttpError } from './http.js';

/* Medien: Upload, Abruf und die Regeln, wann ein Medium (noch) nicht
 * herausgegeben wird. */

export const mediaRouter = Router();

// Welche Medientypen ueberhaupt akzeptiert werden. Bewusst eine Whitelist:
// alles andere wird abgelehnt, statt zu raten was der Browser geschickt hat.
export const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'audio/webm': 'weba',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  // WAV kommt nicht vom MediaRecorder, laesst sich aber ohne Zusatzwerkzeug
  // erzeugen — dadurch kann das Seed-Skript echte, abspielbare O-Toene anlegen.
  'audio/wav': 'wav',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
};

/** Was als Foto zaehlt (Wochen-Challenge, Imposter-Woche). */
export const PHOTO_MIME = ['image/jpeg', 'image/webp'];

/** Haengt dieses Medium an etwas, das noch nicht freigegeben ist — ein
 *  Challenge-Beitrag vor Sonntagabend (auch noch ungeteilt), ein verdeckter
 *  Imposter-Beitrag, ein alter Film? Dann geht es an niemanden raus. */
function isUnreleasedMedia(mediaId: string): boolean {
  const now = Date.now();
  return Boolean(
    db
      .prepare(
        `SELECT 1 WHERE EXISTS (SELECT 1 FROM posts WHERE media_id = ? AND develop_at > ?)
            OR EXISTS (SELECT 1 FROM challenge_entries e JOIN challenge_weeks w ON w.id = e.week_id
                        WHERE e.media_id = ? AND w.release_at > ?)`,
      )
      .get(mediaId, now, mediaId, now),
  );
}

/** Wie SELECT ... FROM posts p, nur ohne noch nicht freigegebene Beitraege. */
export const RELEASED = `(p.develop_at IS NULL OR p.develop_at <= ?)`;

/** Medium samt Datei entfernen — aber nur, wenn nichts mehr darauf zeigt.
 *  Seit der Wochen-Challenge kann ein Medium in mehreren Kassetten haengen
 *  (ein Beitrag, mehrfach geteilt); frueher loeschte das Entfernen EINES
 *  Beitrags die Datei auch fuer alle anderen. Aufrufer entfernen deshalb
 *  immer zuerst ihre eigene Referenz und rufen erst danach dropMedia. */
export function dropMedia(id: string): void {
  if (mediaInUse(id)) return;
  const m = db.prepare(`SELECT mime FROM media WHERE id = ?`).get(id) as { mime: string } | undefined;
  if (!m) return;
  const p = join(MEDIA_DIR, `${id}.${ALLOWED_MIME[m.mime]}`);
  if (existsSync(p)) unlinkSync(p);
  db.prepare(`DELETE FROM media WHERE id = ?`).run(id);
}

/** Wird das Medium schon irgendwo verwendet? Sonst koennte jemand die ID
 *  eines fremden, sichtbaren Fotos als Film einreichen und es damit bis
 *  Sonntag fuer alle sperren. */
export function mediaInUse(mediaId: string): boolean {
  return Boolean(
    db
      .prepare(
        `SELECT 1 WHERE EXISTS (SELECT 1 FROM posts WHERE media_id = ?)
            OR EXISTS (SELECT 1 FROM stories WHERE media_id = ?)
            OR EXISTS (SELECT 1 FROM profiles WHERE avatar_id = ?)
            OR EXISTS (SELECT 1 FROM mixtapes WHERE cover_id = ?)
            OR EXISTS (SELECT 1 FROM hotline_messages WHERE media_id = ?)
            OR EXISTS (SELECT 1 FROM news_posts WHERE media_id = ?)
            OR EXISTS (SELECT 1 FROM reactions WHERE media_id = ?)
            OR EXISTS (SELECT 1 FROM private_items WHERE media_id = ?)
            OR EXISTS (SELECT 1 FROM challenge_entries WHERE media_id = ?)`,
      )
      .get(mediaId, mediaId, mediaId, mediaId, mediaId, mediaId, mediaId, mediaId, mediaId),
  );
}

/* -------------------------------------------------------------------------
 * Medien
 * ---------------------------------------------------------------------- */

// Rohen Body statt multipart: der Client schickt genau einen Blob. Damit
// sparen wir uns multer und eine weitere Abhaengigkeit.
// inflate: false wie bei express.json in server.ts: gepackte Uploads werden
// abgelehnt statt entpackt (GHSA-27r3-jxmh-p828).
mediaRouter.post(
  '/api/media',
  express.raw({ type: '*/*', limit: `${MAX_UPLOAD_MB}mb`, inflate: false }),
  (req, res) => {
    // Vorher ohne jede Pruefung: wer die URL kannte, konnte beliebig Dateien
    // auf die Platte schreiben. Ein gueltiger Zugangscode reicht — zu welcher
    // Kassette das Medium gehoert, entscheidet erst der Beitrag, der es nutzt.
    identityOf(req);
    const mime = (req.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
    const ext = ALLOWED_MIME[mime];
    if (!ext) throw new HttpError(415, `Medientyp nicht erlaubt: ${mime || 'unbekannt'}`);

    // req.body ist fuer TypeScript `any`. Erst pruefen, dann als Buffer nutzen,
    // und die Groesse ueber byteLength lesen: Das gibt es nur bei Buffern, nicht
    // bei Arrays oder Strings (CodeQL: type confusion through parameter tampering).
    const body: unknown = req.body;
    if (!Buffer.isBuffer(body) || body.byteLength === 0) {
      throw new HttpError(400, 'Leerer Upload');
    }
    const buf: Buffer = body;
    const bytes = buf.byteLength;

    const durationHeader = req.get('x-duration-ms');
    const durationMs = durationHeader ? Number(durationHeader) : null;

    const id = randomUUID();
    writeFileSync(join(MEDIA_DIR, `${id}.${ext}`), buf);

    db.prepare(`INSERT INTO media (id, mime, bytes, duration_ms, created_at) VALUES (?, ?, ?, ?, ?)`).run(
      id,
      mime,
      bytes,
      Number.isFinite(durationMs) ? durationMs : null,
      Date.now(),
    );

    res.status(201).json({ id, bytes });
  },
);

mediaRouter.get('/api/media/:id', (req, res) => {
  const row = db.prepare(`SELECT id, mime FROM media WHERE id = ?`).get(req.params.id) as
    { id: string; mime: string } | undefined;
  if (!row) throw new HttpError(404, 'Medium nicht gefunden');
  // Ein Film, der noch entwickelt wird, geht an NIEMANDEN raus — auch nicht
  // an die Person, die ihn belichtet hat. Gleiches 404 wie "gibt es nicht",
  // damit nicht einmal die Existenz verraten wird.
  if (isUnreleasedMedia(row.id)) throw new HttpError(404, 'Medium nicht gefunden');

  const path = join(MEDIA_DIR, `${row.id}.${ALLOWED_MIME[row.mime]}`);
  if (!existsSync(path)) throw new HttpError(404, 'Datei fehlt auf der Platte');

  const { size } = statSync(path);
  res.setHeader('Content-Type', row.mime);
  res.setHeader('Content-Length', String(size));
  // Medien sind unveraenderlich (ID = Inhalt), also darf der Browser sie lange halten.
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  createReadStream(path).pipe(res);
});
