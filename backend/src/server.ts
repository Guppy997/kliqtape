import express, { type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdirSync, createReadStream, writeFileSync, statSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { db, type PostRow, type Side, type Kind } from './db.js';

const PORT = Number(process.env.PORT ?? 3000);
const MEDIA_DIR = process.env.MEDIA_DIR ?? './media';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 25);

mkdirSync(MEDIA_DIR, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

/** Fehler mit HTTP-Status, damit die zentrale Middleware sauber antworten kann. */
class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Welche Medientypen ueberhaupt akzeptiert werden. Bewusst eine Whitelist:
// alles andere wird abgelehnt, statt zu raten was der Browser geschickt hat.
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'audio/webm': 'weba',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
};

const SIDES: Side[] = ['a', 'b'];
const KINDS: Kind[] = ['text', 'photo', 'video', 'mixtape'];

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

/* -------------------------------------------------------------------------
 * Medien
 * ---------------------------------------------------------------------- */

// Rohen Body statt multipart: der Client schickt genau einen Blob. Damit
// sparen wir uns multer und eine weitere Abhaengigkeit.
app.post(
  '/api/media',
  express.raw({ type: '*/*', limit: `${MAX_UPLOAD_MB}mb` }),
  (req, res) => {
    const mime = (req.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
    const ext = ALLOWED_MIME[mime];
    if (!ext) throw new HttpError(415, `Medientyp nicht erlaubt: ${mime || 'unbekannt'}`);

    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      throw new HttpError(400, 'Leerer Upload');
    }

    const durationHeader = req.get('x-duration-ms');
    const durationMs = durationHeader ? Number(durationHeader) : null;

    const id = randomUUID();
    writeFileSync(join(MEDIA_DIR, `${id}.${ext}`), buf);

    db.prepare(
      `INSERT INTO media (id, mime, bytes, duration_ms, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(id, mime, buf.length, Number.isFinite(durationMs) ? durationMs : null, Date.now());

    res.status(201).json({ id, bytes: buf.length });
  },
);

app.get('/api/media/:id', (req, res) => {
  const row = db
    .prepare(`SELECT id, mime FROM media WHERE id = ?`)
    .get(req.params.id) as { id: string; mime: string } | undefined;
  if (!row) throw new HttpError(404, 'Medium nicht gefunden');

  const path = join(MEDIA_DIR, `${row.id}.${ALLOWED_MIME[row.mime]}`);
  if (!existsSync(path)) throw new HttpError(404, 'Datei fehlt auf der Platte');

  const { size } = statSync(path);
  res.setHeader('Content-Type', row.mime);
  res.setHeader('Content-Length', String(size));
  // Medien sind unveraenderlich (ID = Inhalt), also darf der Browser sie lange halten.
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  createReadStream(path).pipe(res);
});

/* -------------------------------------------------------------------------
 * Profile
 * ---------------------------------------------------------------------- */

// Alle Profile auf einmal. Bei dieser Gruppengroesse ist das eine winzige
// Liste — ein Endpunkt pro Person waere reine Verschwendung.
app.get('/api/profiles', (_req, res) => {
  const rows = db.prepare(`SELECT name, avatar_id FROM profiles`).all() as {
    name: string;
    avatar_id: string | null;
  }[];
  res.json(rows.map((r) => ({ name: r.name, avatarId: r.avatar_id })));
});

app.put('/api/profiles/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name).trim().slice(0, 40);
  if (!name) throw new HttpError(400, 'Name fehlt');

  const avatarId = req.body?.avatarId ?? null;
  if (avatarId && !db.prepare(`SELECT 1 FROM media WHERE id = ?`).get(avatarId)) {
    throw new HttpError(400, 'Bild unbekannt');
  }

  const prev = db.prepare(`SELECT avatar_id FROM profiles WHERE name = ?`).get(name) as
    | { avatar_id: string | null }
    | undefined;

  db.prepare(
    `INSERT INTO profiles (name, avatar_id, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET avatar_id = excluded.avatar_id, updated_at = excluded.updated_at`,
  ).run(name, avatarId, Date.now());

  // Erst NACH dem Umbiegen der Referenz aufraeumen — sonst schlaegt der
  // Fremdschluessel zu, weil das Profil noch auf das alte Bild zeigt.
  if (prev?.avatar_id && prev.avatar_id !== avatarId) dropMedia(prev.avatar_id);

  res.json({ name, avatarId });
});

function dropMedia(id: string): void {
  const m = db.prepare(`SELECT mime FROM media WHERE id = ?`).get(id) as { mime: string } | undefined;
  if (!m) return;
  const p = join(MEDIA_DIR, `${id}.${ALLOWED_MIME[m.mime]}`);
  if (existsSync(p)) unlinkSync(p);
  db.prepare(`DELETE FROM media WHERE id = ?`).run(id);
}

/* -------------------------------------------------------------------------
 * Posts
 * ---------------------------------------------------------------------- */

interface FeedItem extends Omit<PostRow, 'media_id'> {
  mediaId: string | null;
  durationMs: number | null;
  track: string;
  reactors: string[];
}

app.get('/api/posts', (req, res) => {
  const side = String(req.query.side ?? 'a') as Side;
  if (!SIDES.includes(side)) throw new HttpError(400, 'side muss a oder b sein');

  // Aeltestes zuerst: der Feed laeuft wie ein Band von vorn nach hinten ab.
  const rows = db
    .prepare(
      `SELECT p.*, m.duration_ms AS duration_ms
         FROM posts p
         LEFT JOIN media m ON m.id = p.media_id
        WHERE p.side = ?
        ORDER BY p.created_at ASC`,
    )
    .all(side) as (PostRow & { duration_ms: number | null })[];

  const reactions = db
    .prepare(
      `SELECT r.post_id, r.author
         FROM reactions r
         JOIN posts p ON p.id = r.post_id
        WHERE p.side = ?
        ORDER BY r.created_at ASC`,
    )
    .all(side) as { post_id: string; author: string }[];

  const byPost = new Map<string, string[]>();
  for (const r of reactions) {
    const list = byPost.get(r.post_id) ?? [];
    list.push(r.author);
    byPost.set(r.post_id, list);
  }

  const items: FeedItem[] = rows.map((row, i) => ({
    id: row.id,
    side: row.side,
    author: row.author,
    kind: row.kind,
    body: row.body,
    created_at: row.created_at,
    mediaId: row.media_id,
    durationMs: row.duration_ms,
    // Track-Nummer statt Zeitstempel: A1, A2, B1 ... Position auf dem Band.
    track: `${side.toUpperCase()}${i + 1}`,
    reactors: byPost.get(row.id) ?? [],
  }));

  res.json(items);
});

app.post('/api/posts', (req, res) => {
  const { side, author, kind, body = '', mediaId = null } = req.body ?? {};

  if (!SIDES.includes(side)) throw new HttpError(400, 'side muss a oder b sein');
  if (!KINDS.includes(kind)) throw new HttpError(400, 'Unbekannte Post-Art');
  if (typeof author !== 'string' || author.trim().length === 0) {
    throw new HttpError(400, 'Name fehlt');
  }
  if (kind === 'text' && String(body).trim().length === 0) {
    throw new HttpError(400, 'Leerer Text');
  }
  if (kind !== 'text' && !mediaId) {
    throw new HttpError(400, `Für ${kind} fehlt das Medium`);
  }
  if (mediaId && !db.prepare(`SELECT 1 FROM media WHERE id = ?`).get(mediaId)) {
    throw new HttpError(400, 'Medium unbekannt');
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO posts (id, side, author, kind, body, media_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, side, author.trim().slice(0, 40), kind, String(body).slice(0, 500), mediaId, Date.now());

  res.status(201).json({ id });
});

app.delete('/api/posts/:id', (req, res) => {
  const row = db.prepare(`SELECT media_id FROM posts WHERE id = ?`).get(req.params.id) as
    | { media_id: string | null }
    | undefined;
  if (!row) throw new HttpError(404, 'Post nicht gefunden');

  db.prepare(`DELETE FROM posts WHERE id = ?`).run(req.params.id);

  // Medium mit loeschen — sonst bleiben verwaiste Dateien im Volume liegen.
  if (row.media_id) dropMedia(row.media_id);

  res.status(204).end();
});

// Reaktion ist ein Umschalter, nicht ein Zaehler: entweder du bist dabei oder nicht.
app.post('/api/posts/:id/react', (req, res) => {
  const author = String(req.body?.author ?? '').trim();
  if (!author) throw new HttpError(400, 'Name fehlt');
  if (!db.prepare(`SELECT 1 FROM posts WHERE id = ?`).get(req.params.id)) {
    throw new HttpError(404, 'Post nicht gefunden');
  }

  const existing = db
    .prepare(`SELECT 1 FROM reactions WHERE post_id = ? AND author = ?`)
    .get(req.params.id, author);

  if (existing) {
    db.prepare(`DELETE FROM reactions WHERE post_id = ? AND author = ?`).run(req.params.id, author);
    res.json({ reacted: false });
  } else {
    db.prepare(`INSERT INTO reactions (post_id, author, created_at) VALUES (?, ?, ?)`).run(
      req.params.id,
      author,
      Date.now(),
    );
    res.json({ reacted: true });
  }
});

/* -------------------------------------------------------------------------
 * Hot Line
 * ---------------------------------------------------------------------- */

const HOTLINE_TTL_MS = 24 * 60 * 60 * 1000;
const HOTLINE_MAX = 240;

/** Abgelaufene Hotlines entfernen. Laeuft faul bei jedem Zugriff — bei dieser
 *  Datenmenge braucht es dafuer keinen Hintergrundjob. */
function sweepHotlines(): void {
  db.prepare(`DELETE FROM hotlines WHERE expires_at < ?`).run(Date.now());
}

app.post('/api/hotlines', (req, res) => {
  const { postId, from, to, body } = req.body ?? {};
  const text = String(body ?? '').trim();

  if (!text) throw new HttpError(400, 'Leere Hotline');
  if (text.length > HOTLINE_MAX) throw new HttpError(400, `Maximal ${HOTLINE_MAX} Zeichen`);
  if (typeof from !== 'string' || !from.trim()) throw new HttpError(400, 'Absender fehlt');
  if (typeof to !== 'string' || !to.trim()) throw new HttpError(400, 'Empfänger fehlt');
  if (from.trim() === to.trim()) throw new HttpError(400, 'Man ruft sich nicht selbst an');

  const post = db.prepare(`SELECT author FROM posts WHERE id = ?`).get(postId) as
    | { author: string }
    | undefined;
  if (!post) throw new HttpError(404, 'Beitrag nicht gefunden');

  sweepHotlines();

  const now = Date.now();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO hotlines (id, post_id, from_name, to_name, body, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, postId, from.trim(), to.trim(), text, now, now + HOTLINE_TTL_MS);

  res.status(201).json({ id, expiresAt: now + HOTLINE_TTL_MS });
});

app.get('/api/hotlines', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');

  sweepHotlines();

  const rows = db
    .prepare(
      `SELECT h.id, h.from_name, h.body, h.created_at, h.expires_at, h.heard_at,
              p.id AS post_id, p.side, p.kind, p.body AS post_body
         FROM hotlines h
         JOIN posts p ON p.id = h.post_id
        WHERE h.to_name = ?
        ORDER BY h.created_at DESC`,
    )
    .all(me) as {
    id: string;
    from_name: string;
    body: string;
    created_at: number;
    expires_at: number;
    heard_at: number | null;
    post_id: string;
    side: string;
    kind: string;
    post_body: string;
  }[];

  res.json(
    rows.map((r) => ({
      id: r.id,
      from: r.from_name,
      body: r.body,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      heard: r.heard_at != null,
      post: { id: r.post_id, side: r.side, kind: r.kind, body: r.post_body },
    })),
  );
});

app.post('/api/hotlines/:id/heard', (req, res) => {
  const info = db
    .prepare(`UPDATE hotlines SET heard_at = ? WHERE id = ? AND heard_at IS NULL`)
    .run(Date.now(), req.params.id);
  if (info.changes === 0 && !db.prepare(`SELECT 1 FROM hotlines WHERE id = ?`).get(req.params.id)) {
    throw new HttpError(404, 'Hotline nicht gefunden');
  }
  res.json({ heard: true });
});

app.delete('/api/hotlines/:id', (req, res) => {
  db.prepare(`DELETE FROM hotlines WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

/* -------------------------------------------------------------------------
 * Mixtapes — ein Geschenk an genau eine Person
 * ---------------------------------------------------------------------- */

// Eine C-60-Seite fasst ungefaehr so viele Titel. Die Grenze ist der Punkt:
// auswaehlen muessen ist das, was ein Mixtape persoenlich macht.
const MAX_TRACKS = 12;

interface TapeRow {
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

function tracksOf(tapeId: string): TrackRow[] {
  return db
    .prepare(`SELECT id, position, title, artist, url FROM mixtape_tracks WHERE mixtape_id = ? ORDER BY position`)
    .all(tapeId) as TrackRow[];
}

const shapeTape = (t: TapeRow, withTracks = true) => ({
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
app.get('/api/mixtapes', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');

  const rows = db
    .prepare(
      `SELECT * FROM mixtapes
        WHERE from_name = ? OR (to_name = ? AND sealed_at IS NOT NULL)
        ORDER BY COALESCE(sealed_at, created_at) DESC`,
    )
    .all(me, me) as TapeRow[];

  res.json(rows.map((r) => shapeTape(r, false)));
});

app.get('/api/mixtapes/:id', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  const tape = loadTape(req.params.id);
  // Ein unversiegeltes Tape ist privat — der Empfaenger darf nichts sehen,
  // bevor es uebergeben wurde. Das ist die halbe Idee.
  if (!tape.sealed_at && tape.from_name !== me) throw new HttpError(403, 'Noch nicht überreicht');
  res.json(shapeTape(tape));
});

app.post('/api/mixtapes', (req, res) => {
  const from = String(req.body?.from ?? '').trim();
  const to = String(req.body?.to ?? '').trim();
  const title = String(req.body?.title ?? '').trim().slice(0, 60);

  if (!from) throw new HttpError(400, 'Absender fehlt');
  if (!to) throw new HttpError(400, 'Für wen ist das Tape?');
  if (from === to) throw new HttpError(400, 'Ein Mixtape macht man für jemand anderen');

  const id = randomUUID();
  db.prepare(
    `INSERT INTO mixtapes (id, from_name, to_name, title, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, from, to, title, Date.now());

  res.status(201).json(shapeTape(loadTape(id)));
});

app.patch('/api/mixtapes/:id', (req, res) => {
  const tape = loadTape(req.params.id);
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

app.post('/api/mixtapes/:id/tracks', (req, res) => {
  const tape = loadTape(req.params.id);
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

app.delete('/api/mixtapes/:id/tracks/:trackId', (req, res) => {
  const tape = loadTape(req.params.id);
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

app.post('/api/mixtapes/:id/seal', (req, res) => {
  const tape = loadTape(req.params.id);
  if (tape.sealed_at) throw new HttpError(409, 'Schon überreicht');
  if (tracksOf(tape.id).length === 0) throw new HttpError(400, 'Ein leeres Tape verschenkt man nicht');
  if (!tape.title.trim()) throw new HttpError(400, 'Das Tape braucht einen Titel');

  db.prepare(`UPDATE mixtapes SET sealed_at = ? WHERE id = ?`).run(Date.now(), tape.id);
  res.json(shapeTape(loadTape(tape.id)));
});

app.delete('/api/mixtapes/:id', (req, res) => {
  const tape = loadTape(req.params.id);
  db.prepare(`DELETE FROM mixtapes WHERE id = ?`).run(tape.id);
  if (tape.cover_id) dropMedia(tape.cover_id);
  res.status(204).end();
});

/* -------------------------------------------------------------------------
 * Zentrale Fehlerbehandlung — gibt immer JSON zurueck, nie HTML.
 * Der vierte Parameter ist Pflicht, sonst erkennt Express die Middleware nicht.
 * ---------------------------------------------------------------------- */
const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : err?.type === 'entity.too.large' ? 413 : 500;
  const message =
    status === 413
      ? `Zu groß — maximal ${MAX_UPLOAD_MB} MB`
      : err instanceof HttpError
        ? err.message
        : 'Unerwarteter Serverfehler';

  if (status >= 500) console.error('[kliqtape]', err);
  res.status(status).json({ error: message });
};
app.use(onError);

app.listen(PORT, () => {
  console.log(`[kliqtape] Backend läuft auf :${PORT} — Medien in ${MEDIA_DIR}`);
});
