import express, { type ErrorRequestHandler, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { mkdirSync, createReadStream, writeFileSync, statSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { db, type PostRow, type Side, type Kind, type StoryKind, type NewsKind } from './db.js';

const PORT = Number(process.env.PORT ?? 3000);
const MEDIA_DIR = process.env.MEDIA_DIR ?? './media';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 25);
// Wer den Kliqtape-Kanal bespielen darf (siehe /api/news weiter unten) — ein
// beanspruchter Name wie jeder andere, nur dieser eine darf dort posten.
// Leer per Default: ohne gesetzten Namen kann niemand posten, der Kanal ist
// dann nur eine leere, aber fuer alle sichtbare Kassette.
const ADMIN_NAME = process.env.ADMIN_NAME ?? '';

mkdirSync(MEDIA_DIR, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Caddy sitzt davor — sonst zaehlt das Limit unten alle IPs als eine.
app.use(express.json({ limit: '256kb' }));
// Grosszuegig, nur als Netz gegen Missbrauch/Bugs, sobald die API nicht mehr
// nur uebers Tailnet erreichbar ist — nicht als Schutz vor gezielten Angriffen gedacht.
app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    // Ueberschreibbar nur fuer die Testsuite, die in Sekunden mehr Anfragen
    // stellt als ein Mensch in einer Minute.
    limit: Number(process.env.RATE_LIMIT_PER_MIN ?? 300),
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

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
  // WAV kommt nicht vom MediaRecorder, laesst sich aber ohne Zusatzwerkzeug
  // erzeugen — dadurch kann das Seed-Skript echte, abspielbare O-Toene anlegen.
  'audio/wav': 'wav',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
};

const SIDES: Side[] = ['a', 'b'];
const KINDS: Kind[] = ['text', 'photo', 'video', 'voice', 'tape'];
/** Diese Arten brauchen eine hochgeladene Datei. */
const MEDIA_KINDS: Kind[] = ['photo', 'video', 'voice'];
/** Storys sind bewusst enger als posts — nur der schnelle Foto/Video-Moment. */
const STORY_KINDS: StoryKind[] = ['photo', 'video'];
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const NEWS_KINDS: NewsKind[] = ['text', 'photo', 'video'];
/** Wie ein Zettel "befestigt" ist — nur fuer kind === 'text' relevant. */
const NOTE_STYLES = ['tape', 'pin', 'staple', 'clip', 'fold'] as const;
type NoteStyle = (typeof NOTE_STYLES)[number];

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
    // Vorher ohne jede Pruefung: wer die URL kannte, konnte beliebig Dateien
    // auf die Platte schreiben. Ein gueltiger Zugangscode reicht — zu welcher
    // Kassette das Medium gehoert, entscheidet erst der Beitrag, der es nutzt.
    identityOf(req);
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
  requireIdentity(req, name);

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

/** Haengt dieses Medium an einem Beitrag, der noch nicht freigegeben ist
 *  (Film in der Entwicklung, verdeckter Imposter-Beitrag)? */
function isUnreleasedMedia(mediaId: string): boolean {
  return Boolean(
    db.prepare(`SELECT 1 FROM posts WHERE media_id = ? AND develop_at > ? LIMIT 1`).get(mediaId, Date.now()),
  );
}

/** Wie SELECT ... FROM posts p, nur ohne noch nicht freigegebene Beitraege. */
const RELEASED = `(p.develop_at IS NULL OR p.develop_at <= ?)`;

function dropMedia(id: string): void {
  const m = db.prepare(`SELECT mime FROM media WHERE id = ?`).get(id) as { mime: string } | undefined;
  if (!m) return;
  const p = join(MEDIA_DIR, `${id}.${ALLOWED_MIME[m.mime]}`);
  if (existsSync(p)) unlinkSync(p);
  db.prepare(`DELETE FROM media WHERE id = ?`).run(id);
}

/* -------------------------------------------------------------------------
 * Kassetten — jede steht für eine Runde von Leuten
 * ---------------------------------------------------------------------- */

const BERLIN_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Kalendertag in Europe/Berlin als UTC-Mitternacht — bewusst NICHT der
 *  rohe Zeitstempel, sonst driftet die Differenz an DST-Umstellungstagen
 *  (23h/25h statt 24h) und Tagesgrenzen landen an der falschen Stelle. */
function berlinCivilDay(ms: number): number {
  const parts = BERLIN_DAY.formatToParts(new Date(ms));
  const y = Number(parts.find((p) => p.type === 'year')!.value);
  const m = Number(parts.find((p) => p.type === 'month')!.value);
  const d = Number(parts.find((p) => p.type === 'day')!.value);
  return Date.UTC(y, m - 1, d);
}

/** Tape-Nummer: 1 = Gruendungstag der Kassette, danach ein Tape pro
 *  Kalendertag, unabhaengig davon ob gepostet wurde. */
function tapeIndexOf(cassetteCreatedAt: number, postedAt: number): number {
  const days = Math.round((berlinCivilDay(postedAt) - berlinCivilDay(cassetteCreatedAt)) / 86_400_000);
  return days + 1;
}

const BERLIN_CLOCK = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Wie weit Berliner Ortszeit zu diesem Zeitpunkt vor UTC liegt (1 h / 2 h). */
function berlinOffsetMs(ms: number): number {
  const parts = BERLIN_CLOCK.formatToParts(new Date(ms));
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Berliner Ortszeit (Kalendertag als UTC-Mitternacht + Stunde) → echter
 *  Zeitpunkt. Zweimal korrigiert, damit es auch am Umstellungstag stimmt. */
function berlinWallClock(civilDay: number, hour: number): number {
  const wall = civilDay + hour * 3_600_000;
  const first = wall - berlinOffsetMs(wall);
  return wall - berlinOffsetMs(first);
}

/** Sonntagabend: dann wird der Film der Woche fuer alle zugleich entwickelt
 *  (Spiegel in frontend/src/lib/berlinDay.ts). */
const FILM_RELEASE_HOUR = 19;

/** Naechste Film-Freigabe NACH `ms` — Sonntag 19:00 Europe/Berlin. Wer
 *  Sonntag um 19:01 belichtet, landet im Film der folgenden Woche. */
function filmReleaseAfter(ms: number): number {
  const today = berlinCivilDay(ms);
  const weekday = new Date(today).getUTCDay(); // 0 = Sonntag
  let release = berlinWallClock(today + ((7 - weekday) % 7) * 86_400_000, FILM_RELEASE_HOUR);
  if (release <= ms) release = berlinWallClock(today + (((7 - weekday) % 7) + 7) * 86_400_000, FILM_RELEASE_HOUR);
  return release;
}

/** Nur fuer Vorfuehrungen (DEMO_TOOLS=1): Film und Imposter-Woche lassen
 *  sich sofort aufloesen statt bis Sonntagabend zu warten. */
const DEMO_TOOLS = process.env.DEMO_TOOLS === '1';

/* -------------------------------------------------------------------------
 * Minimale Identitaet — ein Token pro Name statt eines vollen Login-Systems.
 *
 * Vorher reichte ein bekannter/erratener Name, um sich als diese Person
 * auszugeben (tragbar, solange nur ueber Tailscale erreichbar). Sobald das
 * Backend oeffentlich haengt, aendert sich das Bedrohungsmodell qualitativ,
 * nicht nur graduell. Absichtlich minimal: kein Passwort, keine E-Mail, kein
 * Ablauf — ein zufaelliger Token pro Name, einmal beim ersten Beanspruchen
 * ausgegeben, manuell auf ein Zweitgeraet uebertragbar (siehe Settings.tsx).
 * ---------------------------------------------------------------------- */

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Name hinter dem mitgeschickten Token, sonst 401. */
function identityOf(req: Request): string {
  const token = req.header('X-Auth-Token');
  const row = token
    ? (db.prepare(`SELECT name FROM person_tokens WHERE token_hash = ?`).get(hashToken(token)) as
        | { name: string }
        | undefined)
    : undefined;
  if (!row) throw new HttpError(401, 'Nicht angemeldet');
  return row.name;
}

/** Wirft 401, wenn der mitgeschickte Token nicht zum behaupteten Namen passt. */
function requireIdentity(req: Request, claimedName: string): void {
  if (identityOf(req) !== claimedName) throw new HttpError(401, 'Nicht angemeldet');
}

app.post('/api/auth/claim', (req, res) => {
  const name = String(req.body?.name ?? '').trim().slice(0, 40);
  if (!name) throw new HttpError(400, 'Name fehlt');

  const existing = db.prepare(`SELECT 1 FROM person_tokens WHERE name = ?`).get(name);
  if (existing) throw new HttpError(409, 'Name schon vergeben — Zugangscode von deinem anderen Gerät nötig');

  const token = randomBytes(24).toString('base64url');
  db.prepare(`INSERT INTO person_tokens (name, token_hash, created_at) VALUES (?, ?, ?)`).run(
    name,
    hashToken(token),
    Date.now(),
  );
  res.status(201).json({ name, token });
});

app.get('/api/auth/whoami', (req, res) => {
  const token = req.header('X-Auth-Token');
  const row = token
    ? (db.prepare(`SELECT name FROM person_tokens WHERE token_hash = ?`).get(hashToken(token)) as
        | { name: string }
        | undefined)
    : undefined;
  if (!row) throw new HttpError(401, 'Unbekannter Zugangscode');
  res.json({ name: row.name });
});

// Frueher (vor dem Token) nur ein lokaler setMe() in Settings.tsx — die
// eigenen alten Beitraege behielten bewusst den alten Namen ("Prototyp ohne
// Login"). Mit dem Token ist der Name jetzt auch der Primaerschluessel der
// Identitaet, ein rein lokales Umbenennen wuerde den Token von seinem Namen
// trennen und ihn ungueltig machen. Deshalb hier ein echter, serverseitiger
// Umzug — der Token bleibt derselbe, nur der Name dahinter aendert sich,
// ueberall, wo er als Referenz auftaucht (anders als bei DELETE /api/me, wo
// die Person verschwindet, bleibt sie hier ja dieselbe Person).
app.post('/api/auth/rename', (req, res) => {
  const token = req.header('X-Auth-Token');
  const current = token
    ? (db.prepare(`SELECT name FROM person_tokens WHERE token_hash = ?`).get(hashToken(token)) as
        | { name: string }
        | undefined)
    : undefined;
  if (!current) throw new HttpError(401, 'Nicht angemeldet');

  const next = String(req.body?.name ?? '').trim().slice(0, 40);
  if (!next) throw new HttpError(400, 'Name fehlt');
  if (next === current.name) return void res.json({ name: current.name });

  const taken = db.prepare(`SELECT 1 FROM person_tokens WHERE name = ?`).get(next);
  if (taken) throw new HttpError(409, 'Name schon vergeben');

  const from = current.name;
  db.transaction(() => {
    db.prepare(`UPDATE person_tokens SET name = ? WHERE name = ?`).run(next, from);
    db.prepare(`UPDATE cassette_members SET member = ? WHERE member = ?`).run(next, from);
    db.prepare(`UPDATE cassette_members SET added_by = ? WHERE added_by = ?`).run(next, from);
    db.prepare(`UPDATE cassettes SET created_by = ? WHERE created_by = ?`).run(next, from);
    db.prepare(`UPDATE posts SET author = ? WHERE author = ?`).run(next, from);
    db.prepare(`UPDATE reactions SET author = ? WHERE author = ?`).run(next, from);
    db.prepare(`UPDATE profiles SET name = ? WHERE name = ?`).run(next, from);
    db.prepare(`UPDATE hotline_threads SET person_a = ? WHERE person_a = ?`).run(next, from);
    db.prepare(`UPDATE hotline_threads SET person_b = ? WHERE person_b = ?`).run(next, from);
    db.prepare(`UPDATE hotline_messages SET from_name = ? WHERE from_name = ?`).run(next, from);
    db.prepare(`UPDATE mixtapes SET from_name = ? WHERE from_name = ?`).run(next, from);
    db.prepare(`UPDATE mixtapes SET to_name = ? WHERE to_name = ?`).run(next, from);
    db.prepare(`UPDATE cassette_tapes SET named_by = ? WHERE named_by = ?`).run(next, from);
    db.prepare(`UPDATE cassette_tape_favorites SET member = ? WHERE member = ?`).run(next, from);
    db.prepare(`UPDATE reports SET reported_by = ? WHERE reported_by = ?`).run(next, from);
    db.prepare(`UPDATE cassette_invites SET invitee = ? WHERE invitee = ?`).run(next, from);
    db.prepare(`UPDATE cassette_invites SET invited_by = ? WHERE invited_by = ?`).run(next, from);
    db.prepare(`UPDATE imposter_weeks SET imposter = ? WHERE imposter = ?`).run(next, from);
    db.prepare(`UPDATE imposter_weeks SET started_by = ? WHERE started_by = ?`).run(next, from);
    db.prepare(`UPDATE imposter_entries SET author = ? WHERE author = ?`).run(next, from);
    db.prepare(`UPDATE imposter_votes SET voter = ? WHERE voter = ?`).run(next, from);
    db.prepare(`UPDATE imposter_votes SET suspect = ? WHERE suspect = ?`).run(next, from);
  })();

  res.json({ name: next });
});

function requireMember(req: Request, cassetteId: string, person: string): void {
  requireIdentity(req, person);
  const ok = db
    .prepare(`SELECT 1 FROM cassette_members WHERE cassette_id = ? AND member = ?`)
    .get(cassetteId, person);
  if (!ok) throw new HttpError(403, 'Du bist nicht in dieser Runde');
}

app.get('/api/cassettes', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);
  const now = Date.now();

  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.created_by, c.created_at, c.color_seed, c.color_index,
              (SELECT COUNT(*) FROM cassette_members m2 WHERE m2.cassette_id = c.id) AS members,
              (SELECT COUNT(*) FROM posts p WHERE p.cassette_id = c.id AND p.side = 'a' AND ${RELEASED}) AS side_a,
              (SELECT COUNT(*) FROM posts p WHERE p.cassette_id = c.id AND p.side = 'b' AND ${RELEASED}) AS side_b,
              (SELECT MAX(p.created_at) FROM posts p WHERE p.cassette_id = c.id AND ${RELEASED}) AS last_at
         FROM cassettes c
         JOIN cassette_members m ON m.cassette_id = c.id AND m.member = ?
        ORDER BY COALESCE(last_at, c.created_at) DESC`,
    )
    .all(now, now, now, me) as {
    id: string;
    name: string;
    created_by: string;
    created_at: number;
    color_seed: string | null;
    color_index: number | null;
    members: number;
    side_a: number;
    side_b: number;
    last_at: number | null;
  }[];

  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdBy: r.created_by,
      createdAt: r.created_at,
      colorSeed: r.color_seed,
      colorIndex: r.color_index,
      memberCount: r.members,
      sideA: r.side_a,
      sideB: r.side_b,
      lastAt: r.last_at,
    })),
  );
});

app.get('/api/cassettes/:id/members', (req, res) => {
  // Vorher ohne jede Pruefung: mit einer Kassetten-ID liess sich die
  // Besetzung jeder Runde auslesen.
  requireMember(req, req.params.id, String(req.query.me ?? '').trim());
  const rows = db
    .prepare(`SELECT member, added_by, joined_at FROM cassette_members WHERE cassette_id = ? ORDER BY joined_at`)
    .all(req.params.id) as { member: string; added_by: string; joined_at: number }[];
  if (rows.length === 0) throw new HttpError(404, 'Kassette nicht gefunden');
  res.json(rows.map((r) => ({ name: r.member, addedBy: r.added_by, joinedAt: r.joined_at })));
});

app.post('/api/cassettes', (req, res) => {
  const name = String(req.body?.name ?? '').trim().slice(0, 40);
  const by = String(req.body?.by ?? '').trim();
  const colorSeed = req.body?.colorSeed ? String(req.body.colorSeed) : null;
  if (!name) throw new HttpError(400, 'Die Kassette braucht eine Beschriftung');
  if (!by) throw new HttpError(400, 'Name fehlt');
  requireIdentity(req, by);

  const id = randomUUID();
  const now = Date.now();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO cassettes (id, name, created_by, created_at, color_seed) VALUES (?, ?, ?, ?, ?)`,
    ).run(id, name, by, now, colorSeed);
    db.prepare(
      `INSERT INTO cassette_members (cassette_id, member, added_by, joined_at) VALUES (?, ?, ?, ?)`,
    ).run(id, by, by, now);
  })();

  res.status(201).json({ id, name, createdBy: by, colorSeed, colorIndex: null, memberCount: 1, sideA: 0, sideB: 0 });
});

app.patch('/api/cassettes/:id', (req, res) => {
  const by = String(req.body?.by ?? '').trim();
  requireMember(req, req.params.id, by);

  // Name und Farb-Override sind unabhaengig voneinander setzbar — Umbenennen
  // soll das Aussehen nicht anfassen, und umgekehrt.
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim().slice(0, 40);
    if (!name) throw new HttpError(400, 'Beschriftung fehlt');
    db.prepare(`UPDATE cassettes SET name = ? WHERE id = ?`).run(name, req.params.id);
  }
  if (req.body?.colorSeed !== undefined) {
    const colorSeed = req.body.colorSeed ? String(req.body.colorSeed) : null;
    db.prepare(`UPDATE cassettes SET color_seed = ? WHERE id = ?`).run(colorSeed, req.params.id);
  }
  if (req.body?.colorIndex !== undefined) {
    // Anzahl Bandsorten dupliziert aus frontend/src/lib/cassetteLook.ts
    // (PAIR_COUNT) — kein gemeinsames Package fuer eine einzelne Zahl.
    const PAIR_COUNT = 16;
    const raw = req.body.colorIndex;
    const colorIndex = raw === null ? null : Number(raw);
    if (colorIndex !== null && (!Number.isInteger(colorIndex) || colorIndex < 0 || colorIndex >= PAIR_COUNT)) {
      throw new HttpError(400, `colorIndex muss 0-${PAIR_COUNT - 1} oder null sein`);
    }
    db.prepare(`UPDATE cassettes SET color_index = ? WHERE id = ?`).run(colorIndex, req.params.id);
  }
  if (req.body?.name === undefined && req.body?.colorSeed === undefined && req.body?.colorIndex === undefined) {
    throw new HttpError(400, 'Nichts zu ändern');
  }

  const row = db.prepare(`SELECT id, name, color_seed, color_index FROM cassettes WHERE id = ?`).get(req.params.id) as {
    id: string;
    name: string;
    color_seed: string | null;
    color_index: number | null;
  };
  res.json({ id: row.id, name: row.name, colorSeed: row.color_seed, colorIndex: row.color_index });
});

// Jedes Mitglied darf jemanden einladen — wie im echten Freundeskreis, nur
// dass die eingeladene Person selbst zustimmen muss (siehe cassette_invites
// in db.ts). Vorher landete member hier sofort in cassette_members, ganz
// ohne dass die geholte Person je gefragt wurde.
app.post('/api/cassettes/:id/invites', (req, res) => {
  const by = String(req.body?.by ?? '').trim();
  const invitee = String(req.body?.invitee ?? '').trim().slice(0, 40);
  if (!invitee) throw new HttpError(400, 'Wen denn?');
  requireMember(req, req.params.id, by);

  const already = db
    .prepare(`SELECT 1 FROM cassette_members WHERE cassette_id = ? AND member = ?`)
    .get(req.params.id, invitee);
  if (already) throw new HttpError(409, `${invitee} ist schon auf dem Band`);

  // INSERT OR IGNORE greift bei einer bereits offenen Einladung (UNIQUE auf
  // cassette_id+invitee) — die neu erzeugte id waere dann eine Karteileiche,
  // die zu keiner Zeile gehoert. .changes verrät, ob wirklich eingefuegt
  // wurde; sonst wird die ID der schon bestehenden Einladung zurueckgegeben.
  const id = randomUUID();
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO cassette_invites (id, cassette_id, invitee, invited_by, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, req.params.id, invitee, by, Date.now());

  const finalId =
    result.changes > 0
      ? id
      : (
          db
            .prepare(`SELECT id FROM cassette_invites WHERE cassette_id = ? AND invitee = ?`)
            .get(req.params.id, invitee) as { id: string }
        ).id;

  res.status(201).json({ id: finalId, invitee, invitedBy: by });
});

/** Wirft 404, wenn die Einladung nicht existiert. */
function loadInvite(id: string) {
  const row = db
    .prepare(
      `SELECT ci.id, ci.cassette_id, ci.invitee, ci.invited_by, ci.created_at, c.name AS cassette_name
         FROM cassette_invites ci
         JOIN cassettes c ON c.id = ci.cassette_id
        WHERE ci.id = ?`,
    )
    .get(id) as
    | { id: string; cassette_id: string; invitee: string; invited_by: string; created_at: number; cassette_name: string }
    | undefined;
  if (!row) throw new HttpError(404, 'Einladung nicht gefunden');
  return row;
}

// Alle offenen Einladungen einer Person — landet in der Benachrichtigung,
// nicht in einer eigenen Inbox (siehe AnsweringMachine.tsx).
app.get('/api/invites', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const rows = db
    .prepare(
      `SELECT ci.id, ci.cassette_id, ci.invitee, ci.invited_by, ci.created_at, c.name AS cassette_name,
              c.color_seed, c.color_index
         FROM cassette_invites ci
         JOIN cassettes c ON c.id = ci.cassette_id
        WHERE ci.invitee = ?
        ORDER BY ci.created_at DESC`,
    )
    .all(me) as {
    id: string;
    cassette_id: string;
    invitee: string;
    invited_by: string;
    created_at: number;
    cassette_name: string;
    color_seed: string | null;
    color_index: number | null;
  }[];

  res.json(
    rows.map((r) => ({
      id: r.id,
      cassetteId: r.cassette_id,
      cassetteName: r.cassette_name,
      invitedBy: r.invited_by,
      createdAt: r.created_at,
      // Damit die Benachrichtigung dieselbe Bandsorte zeigen kann wie das
      // Fach spaeter, sobald die Einladung angenommen ist — sonst wuerde die
      // Kassette dort erst nach dem Zustimmen ihre Farbe bekommen.
      colorSeed: r.color_seed,
      colorIndex: r.color_index,
    })),
  );
});

app.post('/api/invites/:id/accept', (req, res) => {
  const me = String(req.body?.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const invite = loadInvite(req.params.id);
  if (invite.invitee !== me) throw new HttpError(403, 'Das ist nicht deine Einladung');

  db.transaction(() => {
    db.prepare(`DELETE FROM cassette_invites WHERE id = ?`).run(invite.id);
    db.prepare(
      `INSERT OR IGNORE INTO cassette_members (cassette_id, member, added_by, joined_at)
       VALUES (?, ?, ?, ?)`,
    ).run(invite.cassette_id, me, invite.invited_by, Date.now());
  })();

  res.json({ cassetteId: invite.cassette_id, cassetteName: invite.cassette_name });
});

app.post('/api/invites/:id/decline', (req, res) => {
  const me = String(req.body?.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const invite = loadInvite(req.params.id);
  if (invite.invitee !== me) throw new HttpError(403, 'Das ist nicht deine Einladung');

  db.prepare(`DELETE FROM cassette_invites WHERE id = ?`).run(invite.id);
  res.status(204).end();
});

/** Wer eine Kassette angelegt hat — nur diese Person darf sie loeschen. */
function creatorOf(cassetteId: string): string {
  const row = db.prepare(`SELECT created_by FROM cassettes WHERE id = ?`).get(cassetteId) as
    | { created_by: string }
    | undefined;
  if (!row) throw new HttpError(404, 'Kassette nicht gefunden');
  return row.created_by;
}

/** Geht die Gruenderin, uebernimmt das dienstaelteste verbliebene Mitglied —
 *  sonst koennte niemand mehr die Kassette loeschen (wie die Admin-Rolle bei
 *  WhatsApp-Gruppen). Ohne verbliebene Mitglieder passiert nichts, die
 *  leere Kassette raeumt der Aufrufer ohnehin weg. */
function handOver(cassetteId: string, leaving: string): void {
  const next = db
    .prepare(
      `SELECT member FROM cassette_members WHERE cassette_id = ? AND member != ?
        ORDER BY joined_at ASC LIMIT 1`,
    )
    .get(cassetteId, leaving) as { member: string } | undefined;
  if (next) db.prepare(`UPDATE cassettes SET created_by = ? WHERE id = ?`).run(next.member, cassetteId);
}

function handOverCassettesOf(person: string): void {
  const owned = db.prepare(`SELECT id FROM cassettes WHERE created_by = ?`).all(person) as { id: string }[];
  for (const { id } of owned) handOver(id, person);
}

app.delete('/api/cassettes/:id/members/:member', (req, res) => {
  const by = String(req.query.by ?? '').trim();
  const target = decodeURIComponent(req.params.member);
  requireMember(req, req.params.id, by);
  // Sonst liesse sich "loeschen darf nur die Gruenderin" umgehen: erst sie
  // rauswerfen, dann selbst nachruecken.
  if (target !== by && target === creatorOf(req.params.id)) {
    throw new HttpError(403, 'Wer die Kassette angelegt hat, geht nur selbst');
  }

  db.transaction(() => {
    if (target === by && creatorOf(req.params.id) === by) handOver(req.params.id, by);
    db.prepare(`DELETE FROM cassette_members WHERE cassette_id = ? AND member = ?`).run(req.params.id, target);
  })();

  // Leere Kassetten verschwinden mitsamt ihren Beiträgen — sonst blieben
  // verwaiste Runden liegen, die niemand mehr sehen kann.
  const rest = db
    .prepare(`SELECT COUNT(*) AS n FROM cassette_members WHERE cassette_id = ?`)
    .get(req.params.id) as { n: number };
  if (rest.n === 0) {
    for (const p of db
      .prepare(`SELECT media_id FROM posts WHERE cassette_id = ? AND media_id IS NOT NULL`)
      .all(req.params.id) as { media_id: string }[]) {
      dropMedia(p.media_id);
    }
    db.prepare(`DELETE FROM posts WHERE cassette_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM cassettes WHERE id = ?`).run(req.params.id);
  }

  res.status(204).end();
});

// Loeschen darf nur, wer die Kassette angelegt hat. Frueher durfte das
// jedes Mitglied — eine Person konnte so die Erinnerungen aller anderen
// wegwerfen. Umbenennen und Umfaerben bleiben fuer alle offen.
app.delete('/api/cassettes/:id', (req, res) => {
  const by = String(req.query.by ?? '').trim();
  requireMember(req, req.params.id, by);
  if (creatorOf(req.params.id) !== by) {
    throw new HttpError(403, 'Löschen darf nur, wer die Kassette angelegt hat');
  }

  const stats = db.transaction(() => {
    // Medien zuerst einsammeln, danach loeschen — sonst sind die Referenzen weg.
    const mediaIds = (
      db
        .prepare(`SELECT media_id AS id FROM posts WHERE cassette_id = ? AND media_id IS NOT NULL`)
        .all(req.params.id) as { id: string }[]
    ).map((r) => r.id);

    const posts = db.prepare(`DELETE FROM posts WHERE cassette_id = ?`).run(req.params.id).changes;
    // cassette_members/cassette_tapes/cassette_tape_favorites kaskadieren
    // automatisch (ON DELETE CASCADE, siehe db.ts) — posts hingegen wurde per
    // addColumn nachgeruestet und muss deshalb hier explizit zuerst raus.
    db.prepare(`DELETE FROM cassettes WHERE id = ?`).run(req.params.id);

    for (const id of mediaIds) dropMedia(id);
    return { posts, medien: mediaIds.length };
  })();

  res.json({ geloescht: stats });
});

/* -------------------------------------------------------------------------
 * Melden — eine Kassette oder einen Beitrag. Nur speichern und bestaetigen;
 * eine Moderationsoberflaeche gibt es im Prototyp nicht (CONCEPT.md §16.6).
 * ---------------------------------------------------------------------- */

const REPORT_REASONS = ['spam', 'harassment', 'violence', 'illegal', 'other'] as const;
type ReportReason = (typeof REPORT_REASONS)[number];

app.post('/api/reports', (req, res) => {
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

/* -------------------------------------------------------------------------
 * Entwickelter Film — ein Schnappschuss pro Person, Kassette und Woche, nur
 * Kamera. Er wird "entwickelt": bis Sonntag 19:00 (Europe/Berlin) sieht ihn
 * niemand, danach alle Mitglieder gleichzeitig. Technisch ein normaler
 * Seite-A-Beitrag mit develop_at; created_at = develop_at, damit er nach der
 * Freigabe im Tape des Sonntags steht (siehe RELEASED, isUnreleasedMedia).
 * ---------------------------------------------------------------------- */

const FILM_MIME = ['image/jpeg', 'image/webp'];

/** Wird das Medium schon irgendwo verwendet? Sonst koennte jemand die ID
 *  eines fremden, sichtbaren Fotos als Film einreichen und es damit bis
 *  Sonntag fuer alle sperren. */
function mediaInUse(mediaId: string): boolean {
  return Boolean(
    db
      .prepare(
        `SELECT 1 WHERE EXISTS (SELECT 1 FROM posts WHERE media_id = ?)
            OR EXISTS (SELECT 1 FROM stories WHERE media_id = ?)
            OR EXISTS (SELECT 1 FROM profiles WHERE avatar_id = ?)
            OR EXISTS (SELECT 1 FROM mixtapes WHERE cover_id = ?)
            OR EXISTS (SELECT 1 FROM hotline_messages WHERE media_id = ?)
            OR EXISTS (SELECT 1 FROM news_posts WHERE media_id = ?)
            OR EXISTS (SELECT 1 FROM reactions WHERE media_id = ?)`,
      )
      .get(mediaId, mediaId, mediaId, mediaId, mediaId, mediaId, mediaId),
  );
}

app.get('/api/cassettes/:id/film', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  requireMember(req, req.params.id, me);
  const now = Date.now();
  const next = filmReleaseAfter(now);

  const iShot = Boolean(
    db
      .prepare(`SELECT 1 FROM posts WHERE cassette_id = ? AND author = ? AND source = 'film' AND develop_at = ?`)
      .get(req.params.id, me, next),
  );
  const last = db
    .prepare(`SELECT MAX(develop_at) AS at FROM posts WHERE cassette_id = ? AND source = 'film' AND develop_at <= ?`)
    .get(req.params.id, now) as { at: number | null };
  const shots = last.at
    ? (db
        .prepare(
          `SELECT id, author, media_id, body, taken_at FROM posts
            WHERE cassette_id = ? AND source = 'film' AND develop_at = ?
            ORDER BY taken_at ASC`,
        )
        .all(req.params.id, last.at) as { id: string; author: string; media_id: string; body: string; taken_at: number }[])
    : [];

  // Bewusst KEINE Angabe, wer diese Woche schon belichtet hat oder wie
  // viele — nur, ob man selbst schon. Der Film soll eine Ueberraschung sein.
  res.json({
    nextRelease: next,
    iShot,
    developed: last.at
      ? {
          at: last.at,
          shots: shots.map((r) => ({ id: r.id, author: r.author, mediaId: r.media_id, caption: r.body, takenAt: r.taken_at })),
        }
      : null,
    demoTools: DEMO_TOOLS,
  });
});

app.post('/api/cassettes/:id/film', (req, res) => {
  const author = String(req.body?.author ?? '').trim();
  const mediaId = String(req.body?.mediaId ?? '').trim();
  const caption = String(req.body?.caption ?? '').trim().slice(0, 120);
  requireMember(req, req.params.id, author);
  if (!mediaId) throw new HttpError(400, 'Aufnahme fehlt');
  const media = db.prepare(`SELECT mime FROM media WHERE id = ?`).get(mediaId) as { mime: string } | undefined;
  if (!media) throw new HttpError(400, 'Medium unbekannt');
  if (!FILM_MIME.includes(media.mime)) throw new HttpError(400, 'Auf den Film passt nur ein Foto');
  if (mediaInUse(mediaId)) throw new HttpError(400, 'Dieses Bild hängt schon woanders');

  const now = Date.now();
  const developAt = filmReleaseAfter(now);
  const already = db
    .prepare(`SELECT 1 FROM posts WHERE cassette_id = ? AND author = ? AND source = 'film' AND develop_at = ?`)
    .get(req.params.id, author, developAt);
  if (already) throw new HttpError(409, 'Diese Woche hast du deinen Film schon belichtet');

  const id = randomUUID();
  db.prepare(
    `INSERT INTO posts (id, cassette_id, side, author, kind, body, media_id, source, develop_at, taken_at, created_at)
     VALUES (?, ?, 'a', ?, 'photo', ?, ?, 'film', ?, ?, ?)`,
  ).run(id, req.params.id, author, caption, mediaId, developAt, now, developAt);

  res.status(201).json({ id, developAt });
});

// Nur mit DEMO_TOOLS=1: fuer eine Vorfuehrung nicht bis Sonntag warten. Nur
// wer die Kassette angelegt hat, und nur fuer diese eine Kassette.
app.post('/api/cassettes/:id/film/develop-now', (req, res) => {
  if (!DEMO_TOOLS) throw new HttpError(404, 'Nicht verfügbar');
  const by = String(req.body?.by ?? '').trim();
  requireMember(req, req.params.id, by);
  if (creatorOf(req.params.id) !== by) throw new HttpError(403, 'Nur wer die Kassette angelegt hat');
  const now = Date.now();
  const n = db
    .prepare(
      `UPDATE posts SET develop_at = ?, created_at = ?
        WHERE cassette_id = ? AND source = 'film' AND develop_at > ?`,
    )
    .run(now, now, req.params.id, now).changes;
  res.json({ developed: n });
});

/* -------------------------------------------------------------------------
 * Imposter-Woche — ein Special, nicht jede Woche, nur ab vier Personen.
 * Alle bekommen dieselbe Aufgabe, eine zufaellige Person nur einen vagen
 * Hinweis. Beitraege sind bis Sonntag 19:00 verborgen (wie der Film), dann
 * wird getippt, wer der Imposter war, und aufgeloest. Kein Punktestand,
 * keine Belohnung, keine Stimmenzahlen — nur "richtig" oder "daneben".
 * ---------------------------------------------------------------------- */

interface ImposterTask {
  task: string;
  hint: string;
  /** Womit man mitmacht: Foto (nur Kamera) oder ein paar Worte. */
  entry: 'photo' | 'text';
}

const IMPOSTER_TASKS: Record<string, ImposterTask> = {
  rot: { task: 'Fotografier etwas Rotes, das du jeden Tag benutzt.', hint: 'Fotografier etwas, das du benutzt.', entry: 'photo' },
  fruehstueck: { task: 'Zeig dein Frühstück von heute.', hint: 'Zeig etwas, das du heute hattest.', entry: 'photo' },
  fenster: { task: 'Fotografier den Blick aus deinem Fenster.', hint: 'Fotografier einen Ausblick.', entry: 'photo' },
  schuhe: { task: 'Zeig die Schuhe, die du heute trägst.', hint: 'Zeig etwas, das du heute anhast.', entry: 'photo' },
  rund: { task: 'Fotografier etwas Rundes in deiner Küche.', hint: 'Fotografier etwas aus deiner Wohnung.', entry: 'photo' },
  erinnerung: { task: 'Fotografier etwas, das dich an diese Runde erinnert.', hint: 'Fotografier etwas, das dir etwas bedeutet.', entry: 'photo' },
  gekocht: { task: 'Koch etwas, das du noch nie gekocht hast, und zeig es.', hint: 'Zeig etwas, das du gemacht hast.', entry: 'photo' },
  lied: { task: 'Schreib das Lied auf, das du diese Woche am meisten gehört hast.', hint: 'Schreib einen Liedtitel auf.', entry: 'text' },
  satz: { task: 'Schreib den letzten Satz auf, den du laut vorgelesen hast.', hint: 'Schreib einen Satz auf.', entry: 'text' },
  wunsch: { task: 'Schreib auf, wohin ihr als Runde als Nächstes zusammen fahren solltet.', hint: 'Schreib einen Ort auf.', entry: 'text' },
};

const IMPOSTER_MIN_MEMBERS = 4;
/** "Nicht jede Woche": zwischen zwei Imposter-Wochen einer Kassette. */
const IMPOSTER_COOLDOWN_MS = 28 * 86_400_000;
/** Wie lange nach Sonntagabend getippt werden kann, bevor von selbst aufgeloest wird. */
const IMPOSTER_VOTING_MS = 24 * 3_600_000;

interface ImposterWeekRow {
  id: string;
  cassette_id: string;
  task_key: string;
  imposter: string;
  started_by: string;
  started_at: number;
  reveal_at: number;
  revealed_at: number | null;
}

type ImposterPhase = 'playing' | 'voting' | 'revealed';

/** Letzte Imposter-Woche der Kassette. Loest eine liegengebliebene
 *  Abstimmung nebenbei auf — die App hat bewusst keinen Hintergrund-Job. */
function latestImposterWeek(cassetteId: string, now: number): ImposterWeekRow | null {
  const w = db
    .prepare(`SELECT * FROM imposter_weeks WHERE cassette_id = ? ORDER BY started_at DESC LIMIT 1`)
    .get(cassetteId) as ImposterWeekRow | undefined;
  if (!w) return null;
  if (!w.revealed_at && now >= w.reveal_at + IMPOSTER_VOTING_MS) {
    w.revealed_at = w.reveal_at + IMPOSTER_VOTING_MS;
    db.prepare(`UPDATE imposter_weeks SET revealed_at = ? WHERE id = ?`).run(w.revealed_at, w.id);
  }
  return w;
}

function phaseOf(w: ImposterWeekRow, now: number): ImposterPhase {
  if (w.revealed_at) return 'revealed';
  return now < w.reveal_at ? 'playing' : 'voting';
}

/** Hat die Runde den Imposter gefunden? Meiste Tipps auf genau die richtige
 *  Person, Gleichstand zaehlt als daneben. Zahlen verlassen den Server nie. */
function imposterCaught(w: ImposterWeekRow): boolean {
  const rows = db
    .prepare(`SELECT suspect, COUNT(*) AS n FROM imposter_votes WHERE week_id = ? GROUP BY suspect ORDER BY n DESC`)
    .all(w.id) as { suspect: string; n: number }[];
  if (rows.length === 0) return false;
  if (rows.length > 1 && rows[0]!.n === rows[1]!.n) return false;
  return rows[0]!.suspect === w.imposter;
}

function loadActiveWeek(cassetteId: string, now: number, phase: ImposterPhase): ImposterWeekRow {
  const w = latestImposterWeek(cassetteId, now);
  if (!w || phaseOf(w, now) !== phase) {
    throw new HttpError(409, phase === 'playing' ? 'Gerade läuft keine Imposter-Woche' : 'Gerade wird nicht getippt');
  }
  return w;
}

app.get('/api/cassettes/:id/imposter', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  requireMember(req, req.params.id, me);
  const now = Date.now();
  const members = (
    db.prepare(`SELECT member FROM cassette_members WHERE cassette_id = ? ORDER BY joined_at`).all(req.params.id) as {
      member: string;
    }[]
  ).map((r) => r.member);
  const w = latestImposterWeek(req.params.id, now);

  const canStartAt = w ? w.started_at + IMPOSTER_COOLDOWN_MS : 0;
  const busy = w && phaseOf(w, now) !== 'revealed';
  const canStart = members.length >= IMPOSTER_MIN_MEMBERS && !busy && (DEMO_TOOLS || now >= canStartAt);

  if (!w) return void res.json({ week: null, canStart, minMembers: IMPOSTER_MIN_MEMBERS, nextStartAt: null, demoTools: DEMO_TOOLS });

  const phase = phaseOf(w, now);
  const t = IMPOSTER_TASKS[w.task_key]!;
  const isImposter = w.imposter === me;
  const mine = db.prepare(`SELECT post_id FROM imposter_entries WHERE week_id = ? AND author = ?`).get(w.id, me) as
    | { post_id: string }
    | undefined;
  const entries =
    phase === 'playing'
      ? []
      : (db
          .prepare(
            `SELECT e.author, p.id, p.kind, p.body, p.media_id
               FROM imposter_entries e JOIN posts p ON p.id = e.post_id
              WHERE e.week_id = ? ORDER BY p.taken_at`,
          )
          .all(w.id) as { author: string; id: string; kind: Kind; body: string; media_id: string | null }[]);
  const myVote = db.prepare(`SELECT suspect FROM imposter_votes WHERE week_id = ? AND voter = ?`).get(w.id, me) as
    | { suspect: string }
    | undefined;
  // Wer schon getippt hat (Namen, keine Zahl) — damit man weiss, auf wen man wartet.
  const voted = (db.prepare(`SELECT voter FROM imposter_votes WHERE week_id = ?`).all(w.id) as { voter: string }[]).map(
    (r) => r.voter,
  );

  res.json({
    week: {
      id: w.id,
      phase,
      startedBy: w.started_by,
      startedAt: w.started_at,
      revealAt: w.reveal_at,
      votingEndsAt: w.reveal_at + IMPOSTER_VOTING_MS,
      entryKind: t.entry,
      // Die eigene Karte: entweder die Aufgabe oder nur der Hinweis. Wer
      // Imposter ist, erfaehrt vor der Aufloesung nur die Person selbst.
      card: isImposter ? { imposter: true, text: t.hint } : { imposter: false, text: t.task },
      iSubmitted: Boolean(mine),
      entries: entries.map((e) => ({ postId: e.id, author: e.author, kind: e.kind, body: e.body, mediaId: e.media_id })),
      myVote: myVote?.suspect ?? null,
      voted: phase === 'playing' ? [] : voted,
      result:
        phase === 'revealed'
          ? { imposter: w.imposter, task: t.task, hint: t.hint, caught: imposterCaught(w), revealedAt: w.revealed_at }
          : null,
    },
    canStart,
    minMembers: IMPOSTER_MIN_MEMBERS,
    nextStartAt: DEMO_TOOLS ? null : canStartAt,
    demoTools: DEMO_TOOLS,
  });
});

app.post('/api/cassettes/:id/imposter', (req, res) => {
  const by = String(req.body?.by ?? '').trim();
  requireMember(req, req.params.id, by);
  const now = Date.now();
  const members = (
    db.prepare(`SELECT member FROM cassette_members WHERE cassette_id = ?`).all(req.params.id) as { member: string }[]
  ).map((r) => r.member);
  if (members.length < IMPOSTER_MIN_MEMBERS) {
    throw new HttpError(400, `Eine Imposter-Woche braucht mindestens ${IMPOSTER_MIN_MEMBERS} Leute auf dem Band`);
  }
  const last = latestImposterWeek(req.params.id, now);
  if (last && phaseOf(last, now) !== 'revealed') throw new HttpError(409, 'Es läuft schon eine Imposter-Woche');
  if (last && !DEMO_TOOLS && now < last.started_at + IMPOSTER_COOLDOWN_MS) {
    throw new HttpError(409, 'Die Imposter-Woche ist ein Special — die nächste geht frühestens vier Wochen nach der letzten');
  }

  const keys = Object.keys(IMPOSTER_TASKS);
  // Nicht zweimal hintereinander dieselbe Aufgabe.
  const pool = keys.filter((k) => k !== last?.task_key);
  const taskKey = pool[randomInt(pool.length)]!;
  const imposter = members[randomInt(members.length)]!;
  const id = randomUUID();
  db.prepare(
    `INSERT INTO imposter_weeks (id, cassette_id, task_key, imposter, started_by, started_at, reveal_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, req.params.id, taskKey, imposter, by, now, filmReleaseAfter(now));

  res.status(201).json({ id });
});

app.post('/api/cassettes/:id/imposter/entry', (req, res) => {
  const author = String(req.body?.author ?? '').trim();
  const mediaId = req.body?.mediaId ? String(req.body.mediaId) : null;
  const body = String(req.body?.body ?? '').trim().slice(0, 280);
  requireMember(req, req.params.id, author);
  const now = Date.now();
  const w = loadActiveWeek(req.params.id, now, 'playing');
  const t = IMPOSTER_TASKS[w.task_key]!;

  if (db.prepare(`SELECT 1 FROM imposter_entries WHERE week_id = ? AND author = ?`).get(w.id, author)) {
    throw new HttpError(409, 'Du hast diese Woche schon etwas abgegeben');
  }
  if (t.entry === 'photo') {
    if (!mediaId) throw new HttpError(400, 'Für diese Aufgabe braucht es ein Foto');
    const media = db.prepare(`SELECT mime FROM media WHERE id = ?`).get(mediaId) as { mime: string } | undefined;
    if (!media || !FILM_MIME.includes(media.mime)) throw new HttpError(400, 'Für diese Aufgabe braucht es ein Foto');
    if (mediaInUse(mediaId)) throw new HttpError(400, 'Dieses Bild hängt schon woanders');
  } else if (!body) {
    throw new HttpError(400, 'Ein paar Worte braucht es schon');
  }

  const postId = randomUUID();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO posts (id, cassette_id, side, author, kind, body, media_id, source, develop_at, taken_at, created_at)
       VALUES (?, ?, 'a', ?, ?, ?, ?, 'imposter', ?, ?, ?)`,
    ).run(postId, req.params.id, author, t.entry === 'photo' ? 'photo' : 'text', body, t.entry === 'photo' ? mediaId : null, w.reveal_at, now, w.reveal_at);
    db.prepare(`INSERT INTO imposter_entries (week_id, author, post_id) VALUES (?, ?, ?)`).run(w.id, author, postId);
  })();

  res.status(201).json({ postId });
});

app.post('/api/cassettes/:id/imposter/vote', (req, res) => {
  const by = String(req.body?.by ?? '').trim();
  const suspect = String(req.body?.suspect ?? '').trim();
  requireMember(req, req.params.id, by);
  const w = loadActiveWeek(req.params.id, Date.now(), 'voting');
  if (suspect === by) throw new HttpError(400, 'Auf dich selbst tippst du nicht');
  const isMember = db
    .prepare(`SELECT 1 FROM cassette_members WHERE cassette_id = ? AND member = ?`)
    .get(req.params.id, suspect);
  if (!isMember && suspect !== w.imposter) throw new HttpError(400, 'Diese Person ist nicht auf dem Band');

  // Umentscheiden ist erlaubt, bis aufgeloest wird.
  db.prepare(
    `INSERT INTO imposter_votes (week_id, voter, suspect, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(week_id, voter) DO UPDATE SET suspect = excluded.suspect, created_at = excluded.created_at`,
  ).run(w.id, by, suspect, Date.now());
  res.status(201).json({ ok: true });
});

app.post('/api/cassettes/:id/imposter/reveal', (req, res) => {
  const by = String(req.body?.by ?? '').trim();
  requireMember(req, req.params.id, by);
  const w = loadActiveWeek(req.params.id, Date.now(), 'voting');
  // Aufloesen darf, wer die Woche gestartet hat — oder jede:r, sobald alle
  // Mitglieder getippt haben. Sonst nimmt jemand den anderen das Raten weg.
  const members = db.prepare(`SELECT COUNT(*) AS n FROM cassette_members WHERE cassette_id = ?`).get(req.params.id) as {
    n: number;
  };
  const votes = db
    .prepare(
      `SELECT COUNT(*) AS n FROM imposter_votes v
         JOIN cassette_members m ON m.cassette_id = ? AND m.member = v.voter
        WHERE v.week_id = ?`,
    )
    .get(req.params.id, w.id) as { n: number };
  if (by !== w.started_by && votes.n < members.n) {
    throw new HttpError(403, `Auflösen kann ${w.started_by}, oder alle, sobald jede:r getippt hat`);
  }
  db.prepare(`UPDATE imposter_weeks SET revealed_at = ? WHERE id = ?`).run(Date.now(), w.id);
  res.json({ ok: true });
});

// Nur mit DEMO_TOOLS=1: Sonntagabend vorziehen, damit die Abstimmung in
// einer Vorfuehrung sofort beginnt. Nur wer die Kassette angelegt hat.
app.post('/api/cassettes/:id/imposter/now', (req, res) => {
  if (!DEMO_TOOLS) throw new HttpError(404, 'Nicht verfügbar');
  const by = String(req.body?.by ?? '').trim();
  requireMember(req, req.params.id, by);
  if (creatorOf(req.params.id) !== by) throw new HttpError(403, 'Nur wer die Kassette angelegt hat');
  const now = Date.now();
  const w = loadActiveWeek(req.params.id, now, 'playing');
  db.transaction(() => {
    db.prepare(`UPDATE imposter_weeks SET reveal_at = ? WHERE id = ?`).run(now, w.id);
    db.prepare(
      `UPDATE posts SET develop_at = ?, created_at = ?
        WHERE id IN (SELECT post_id FROM imposter_entries WHERE week_id = ?)`,
    ).run(now, now, w.id);
  })();
  res.json({ ok: true });
});

/* -------------------------------------------------------------------------
 * Posts
 * ---------------------------------------------------------------------- */

interface FeedItem
  extends Omit<
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

app.get('/api/posts', (req, res) => {
  const side = String(req.query.side ?? 'a') as Side;
  const cassetteId = String(req.query.cassette ?? '').trim();
  const me = String(req.query.me ?? '').trim();
  if (!SIDES.includes(side)) throw new HttpError(400, 'side muss a oder b sein');
  if (!cassetteId) throw new HttpError(400, 'Welche Kassette?');

  const cassette = db.prepare(`SELECT created_at FROM cassettes WHERE id = ?`).get(cassetteId) as
    | { created_at: number }
    | undefined;
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
        row.source === 'imposter' ? (row.imposter_name ? (row.imposter_name === row.author ? 'imposter' : 'crew') : 'entry') : null,
      tapeId: row.tape_id,
      tape: row.tape_id
        ? { title: row.tape_title ?? '', coverId: row.tape_cover, trackCount: row.tape_tracks ?? 0 }
        : null,
      track,
      tapeIndex,
      tonfetzenCount: row.author === me ? countByPost.get(row.id) ?? 0 : 0,
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

/* -------------------------------------------------------------------------
 * Tapes — Seite A in Kalendertage gegliedert, siehe tapeIndexOf() oben.
 * Kassettenweit benennbar, pro Person favorisierbar. Sparse: eine Zeile
 * existiert nur, wenn jemand tatsaechlich benannt oder favorisiert hat.
 * ---------------------------------------------------------------------- */

/** Hoechste erreichbare Tape-Nummer heute — verhindert Benennen/Favorisieren
 *  eines Tapes, das noch gar nicht angefangen hat. */
function maxTapeIndex(cassetteCreatedAt: number): number {
  return tapeIndexOf(cassetteCreatedAt, Date.now());
}

function loadCassetteOr404(cassetteId: string): { created_at: number } {
  const row = db.prepare(`SELECT created_at FROM cassettes WHERE id = ?`).get(cassetteId) as
    | { created_at: number }
    | undefined;
  if (!row) throw new HttpError(404, 'Kassette nicht gefunden');
  return row;
}

app.get('/api/cassettes/:id/tapes', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireMember(req, req.params.id, me);

  const names = db
    .prepare(`SELECT tape_index, name FROM cassette_tapes WHERE cassette_id = ?`)
    .all(req.params.id) as { tape_index: number; name: string }[];
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

app.get('/api/cassettes/:id/tapes/favorites', (req, res) => {
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

app.put('/api/cassettes/:id/tapes/:tapeIndex', (req, res) => {
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

app.post('/api/cassettes/:id/tapes/:tapeIndex/favorite', (req, res) => {
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

app.delete('/api/cassettes/:id/tapes/:tapeIndex/favorite', (req, res) => {
  const by = String(req.query.by ?? '').trim();
  if (!by) throw new HttpError(400, 'Name fehlt');
  requireMember(req, req.params.id, by);

  db.prepare(
    `DELETE FROM cassette_tape_favorites WHERE cassette_id = ? AND tape_index = ? AND member = ?`,
  ).run(req.params.id, Number(req.params.tapeIndex), by);

  res.status(204).end();
});

app.post('/api/posts', (req, res) => {
  const {
    cassetteId, side, author, kind, body = '', mediaId = null, tapeId = null, source = null,
    noteStyle = null, quotedPostId = null,
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
      | { from_name: string; sealed_at: number | null }
      | undefined;
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
app.delete('/api/posts/:id', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const row = db.prepare(`SELECT author, media_id FROM posts WHERE id = ?`).get(req.params.id) as
    | { author: string; media_id: string | null }
    | undefined;
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
app.post('/api/posts/:id/react', (req, res) => {
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
app.get('/api/posts/:id/reactions', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  const post = db.prepare(`SELECT author FROM posts WHERE id = ?`).get(req.params.id) as
    | { author: string }
    | undefined;
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

/* -------------------------------------------------------------------------
 * Storys — kassettenuebergreifend, nur Foto/Video, verschwinden nach 24h.
 *
 * Anders als posts nicht an eine einzelne Kassette gebunden, sondern
 * sichtbar fuer jeden, mit dem man in IRGENDEINER Kassette zusammen ist
 * (networkOf). Kein Cron fuer den Ablauf — die App hat bewusst keinen
 * Hintergrund-Job: sweepExpiredStories() raeumt abgelaufene Zeilen samt
 * Mediendatei einfach bei jedem Story-Zugriff mit auf.
 * ---------------------------------------------------------------------- */

/** Alle Namen, mit denen `person` in irgendeiner Kassette zusammen ist —
 *  schliesst `person` selbst ein, da man Mitglied der eigenen Kassetten ist. */
function networkOf(person: string): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT cm2.member
         FROM cassette_members cm1
         JOIN cassette_members cm2 ON cm2.cassette_id = cm1.cassette_id
        WHERE cm1.member = ?`,
    )
    .all(person) as { member: string }[];
  return rows.map((r) => r.member);
}

/** Entfernt abgelaufene Storys samt Mediendatei. Gibt den benutzten
 *  Zeitpunkt zurueck, damit der nachfolgende SELECT in derselben Anfrage
 *  denselben "jetzt"-Wert verwendet statt eine zweite Uhrzeit zu lesen. */
function sweepExpiredStories(): number {
  const now = Date.now();
  const expired = db.prepare(`SELECT id, media_id FROM stories WHERE expires_at <= ?`).all(now) as
    { id: string; media_id: string }[];
  if (expired.length > 0) {
    db.transaction(() => {
      db.prepare(`DELETE FROM stories WHERE expires_at <= ?`).run(now);
      for (const row of expired) dropMedia(row.media_id);
    })();
  }
  return now;
}

app.get('/api/stories', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const now = sweepExpiredStories();
  const network = networkOf(me);
  if (network.length === 0) return res.json([]);

  const placeholders = network.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT s.id, s.author, s.kind, s.media_id, s.created_at, s.expires_at, m.duration_ms
         FROM stories s
         LEFT JOIN media m ON m.id = s.media_id
        WHERE s.author IN (${placeholders}) AND s.expires_at > ?
        ORDER BY s.created_at DESC`,
    )
    .all(...network, now) as {
    id: string;
    author: string;
    kind: StoryKind;
    media_id: string;
    created_at: number;
    expires_at: number;
    duration_ms: number | null;
  }[];

  // Nach Autor gruppiert, neuester Autor zuerst (deren neueste Story
  // bestimmt die Reihenfolge) — Frontend zeigt eine Reihe pro Person.
  const byAuthor = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byAuthor.get(r.author) ?? [];
    list.push(r);
    byAuthor.set(r.author, list);
  }

  const groups = [...byAuthor.entries()].map(([author, items]) => ({
    author,
    stories: items.map((r) => ({
      id: r.id,
      kind: r.kind,
      mediaId: r.media_id,
      durationMs: r.duration_ms,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    })),
  }));

  res.json(groups);
});

app.post('/api/stories', (req, res) => {
  sweepExpiredStories();
  const { author, kind, mediaId } = req.body ?? {};

  if (typeof author !== 'string' || author.trim().length === 0) {
    throw new HttpError(400, 'Name fehlt');
  }
  requireIdentity(req, author.trim());
  if (!STORY_KINDS.includes(kind)) throw new HttpError(400, 'Storys sind nur Foto oder Video');
  if (!mediaId) throw new HttpError(400, 'Aufnahme fehlt');
  if (!db.prepare(`SELECT 1 FROM media WHERE id = ?`).get(mediaId)) {
    throw new HttpError(400, 'Medium unbekannt');
  }

  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO stories (id, author, kind, media_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, author.trim().slice(0, 40), kind, mediaId, now, now + STORY_LIFETIME_MS);

  res.status(201).json({ id, expiresAt: now + STORY_LIFETIME_MS });
});

app.delete('/api/stories/:id', (req, res) => {
  sweepExpiredStories();
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const row = db.prepare(`SELECT author, media_id FROM stories WHERE id = ?`).get(req.params.id) as
    | { author: string; media_id: string }
    | undefined;
  if (!row) throw new HttpError(404, 'Story nicht gefunden');
  // Anders als bei posts (dort fehlt diese Pruefung bisher komplett) hier
  // bewusst eine echte Besitzpruefung — bei einer kassettenuebergreifend
  // sichtbaren Story ist das Risiko fremden Loeschens groesser.
  if (row.author !== me) throw new HttpError(403, 'Nicht deine Story');

  db.transaction(() => {
    db.prepare(`DELETE FROM stories WHERE id = ?`).run(req.params.id);
    dropMedia(row.media_id);
  })();

  res.status(204).end();
});

/* -------------------------------------------------------------------------
 * Kliqtape-Kanal — News/Insights von den Betreiber:innen, dauerhaft und fuer
 * wirklich alle sichtbar. Schreiben darf nur ADMIN_NAME (siehe oben, ueber
 * .env konfiguriert) — ein normal beanspruchter Name wie jeder andere, nur
 * dass genau dieser eine hier posten darf. Lesen darf jede angemeldete
 * Person, unabhaengig von Kassetten-Mitgliedschaft.
 * ---------------------------------------------------------------------- */

app.get('/api/news', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const rows = db
    .prepare(
      `SELECT n.id, n.author, n.kind, n.body, n.media_id, n.created_at, m.duration_ms
         FROM news_posts n
         LEFT JOIN media m ON m.id = n.media_id
        ORDER BY n.created_at DESC`,
    )
    .all() as {
    id: string;
    author: string;
    kind: NewsKind;
    body: string;
    media_id: string | null;
    created_at: number;
    duration_ms: number | null;
  }[];

  const funding = db.prepare(`SELECT balance, note, updated_at FROM project_funding WHERE id = 1`).get() as
    | { balance: string; note: string; updated_at: number }
    | undefined;

  res.json({
    canPost: Boolean(ADMIN_NAME) && me === ADMIN_NAME,
    funding: {
      balance: funding?.balance ?? '',
      note: funding?.note ?? '',
      updatedAt: funding?.updated_at ?? 0,
    },
    posts: rows.map((r) => ({
      id: r.id,
      author: r.author,
      kind: r.kind,
      body: r.body,
      mediaId: r.media_id,
      durationMs: r.duration_ms,
      createdAt: r.created_at,
    })),
  });
});

// Getrennt von POST /api/news: der Foerderstand ist kein Beitrag im Feed,
// sondern ein einzelner, ueberschreibbarer Wert (siehe project_funding).
app.put('/api/news/funding', (req, res) => {
  const me = String(req.body?.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);
  if (!ADMIN_NAME || me !== ADMIN_NAME) {
    throw new HttpError(403, 'Nur der Kliqtape-Kanal-Account darf hier aendern');
  }

  const balance = String(req.body?.balance ?? '').trim().slice(0, 40);
  const note = String(req.body?.note ?? '').trim().slice(0, 300);

  db.prepare(
    `INSERT INTO project_funding (id, balance, note, updated_at) VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET balance = excluded.balance, note = excluded.note, updated_at = excluded.updated_at`,
  ).run(balance, note, Date.now());

  res.status(204).end();
});

app.post('/api/news', (req, res) => {
  const { author, kind, body = '', mediaId = null } = req.body ?? {};
  if (typeof author !== 'string' || author.trim().length === 0) {
    throw new HttpError(400, 'Name fehlt');
  }
  requireIdentity(req, author.trim());
  if (!ADMIN_NAME || author.trim() !== ADMIN_NAME) {
    throw new HttpError(403, 'Nur der Kliqtape-Kanal-Account darf hier posten');
  }
  if (!NEWS_KINDS.includes(kind)) throw new HttpError(400, 'Unbekannte Art');
  if (kind === 'text' && String(body).trim().length === 0) throw new HttpError(400, 'Leerer Text');
  if (kind !== 'text' && !mediaId) throw new HttpError(400, 'Aufnahme fehlt');
  if (mediaId && !db.prepare(`SELECT 1 FROM media WHERE id = ?`).get(mediaId)) {
    throw new HttpError(400, 'Medium unbekannt');
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO news_posts (id, author, kind, body, media_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, author.trim().slice(0, 40), kind, String(body).slice(0, 1000), mediaId, Date.now());

  res.status(201).json({ id });
});

app.delete('/api/news/:id', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);
  if (!ADMIN_NAME || me !== ADMIN_NAME) {
    throw new HttpError(403, 'Nur der Kliqtape-Kanal-Account darf hier löschen');
  }

  const row = db.prepare(`SELECT media_id FROM news_posts WHERE id = ?`).get(req.params.id) as
    | { media_id: string | null }
    | undefined;
  if (!row) throw new HttpError(404, 'Beitrag nicht gefunden');

  db.prepare(`DELETE FROM news_posts WHERE id = ?`).run(req.params.id);
  if (row.media_id) dropMedia(row.media_id);

  res.status(204).end();
});

/* -------------------------------------------------------------------------
 * Hot Line — eine offene Leitung zwischen zwei Personen
 *
 * Dauerhaft, wie Seite B: eine Leitung sammelt den ganzen Verlauf, nichts
 * verfaellt mehr. Fruehere Version hatte hier ein rollierendes 24h-Fenster
 * (siehe Git-Historie) — bewusst aufgegeben, weil Hot Line WhatsApp fuer die
 * Runde teilweise ersetzen soll und ein Verlauf dafuer nicht staendig
 * Nachrichten verlieren darf.
 * ---------------------------------------------------------------------- */

const HOTLINE_MAX = 240;

/** Zwei Namen alphabetisch sortiert — macht das Paar unabhaengig davon,
 *  wer zuerst geschrieben hat. */
function pairOf(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

app.get('/api/hotlines/threads', (req, res) => {
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

app.get('/api/hotlines/threads/:id/messages', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const thread = db.prepare(`SELECT * FROM hotline_threads WHERE id = ?`).get(req.params.id) as
    | { id: string; person_a: string; person_b: string; created_at: number }
    | undefined;
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

app.post('/api/hotlines/threads', (req, res) => {
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
      | { sealed_at: number | null }
      | undefined;
    if (!tape) throw new HttpError(404, 'Mixtape nicht gefunden');
    if (!tape.sealed_at) throw new HttpError(400, 'Nur versiegelte Mixtapes lassen sich teilen');
  }

  const [a, b] = pairOf(from, to);
  const now = Date.now();

  let threadId = (
    db.prepare(`SELECT id FROM hotline_threads WHERE person_a = ? AND person_b = ?`).get(a, b) as
      | { id: string }
      | undefined
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

app.post('/api/hotlines/threads/:id/heard', (req, res) => {
  const me = String(req.body?.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const thread = db.prepare(`SELECT person_a, person_b FROM hotline_threads WHERE id = ?`).get(req.params.id) as
    | { person_a: string; person_b: string }
    | undefined;
  if (!thread) throw new HttpError(404, 'Leitung nicht gefunden');
  if (thread.person_a !== me && thread.person_b !== me) throw new HttpError(403, 'Du bist nicht in dieser Leitung');

  db.prepare(
    `UPDATE hotline_messages SET heard_at = ? WHERE thread_id = ? AND from_name != ? AND heard_at IS NULL`,
  ).run(Date.now(), req.params.id, me);

  res.json({ ok: true });
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

app.get('/api/mixtapes/:id', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (me) requireIdentity(req, me);
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
  requireIdentity(req, from);

  const id = randomUUID();
  db.prepare(
    `INSERT INTO mixtapes (id, from_name, to_name, title, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, from, to, title, Date.now());

  res.status(201).json(shapeTape(loadTape(id)));
});

app.patch('/api/mixtapes/:id', (req, res) => {
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

app.post('/api/mixtapes/:id/tracks', (req, res) => {
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

app.delete('/api/mixtapes/:id/tracks/:trackId', (req, res) => {
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

app.post('/api/mixtapes/:id/seal', (req, res) => {
  const tape = requireTapeOwner(req, req.params.id);
  if (tape.sealed_at) throw new HttpError(409, 'Schon überreicht');
  if (tracksOf(tape.id).length === 0) throw new HttpError(400, 'Ein leeres Tape verschenkt man nicht');
  if (!tape.title.trim()) throw new HttpError(400, 'Das Tape braucht einen Titel');

  db.prepare(`UPDATE mixtapes SET sealed_at = ? WHERE id = ?`).run(Date.now(), tape.id);
  res.json(shapeTape(loadTape(tape.id)));
});

app.delete('/api/mixtapes/:id', (req, res) => {
  const tape = requireTapeOwner(req, req.params.id);
  db.prepare(`DELETE FROM mixtapes WHERE id = ?`).run(tape.id);
  if (tape.cover_id) dropMedia(tape.cover_id);
  res.status(204).end();
});

/* -------------------------------------------------------------------------
 * Eigene Daten — Export und Loeschung
 *
 * Steht so im Konzept (DSGVO Art. 20 und Art. 17) und gehoert ab der ersten
 * Version rein, nicht nachtraeglich.
 * ---------------------------------------------------------------------- */

app.get('/api/export', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const tapes = (db.prepare(`SELECT * FROM mixtapes WHERE from_name = ? OR to_name = ?`).all(me, me) as TapeRow[])
    .map((t) => ({ ...shapeTape(t), tracks: tracksOf(t.id) }));

  res.setHeader('Content-Disposition', `attachment; filename="kliqtape-${me}.json"`);
  res.json({
    exportiertAm: new Date().toISOString(),
    hinweis:
      'Medien (Fotos, Clips, O-Töne, Cover) sind hier nur als IDs aufgeführt. ' +
      'Sie liegen unter /api/media/<id> und lassen sich einzeln herunterladen.',
    name: me,
    profil: db.prepare(`SELECT name, avatar_id AS avatarId FROM profiles WHERE name = ?`).get(me) ?? null,
    beitraege: db.prepare(`SELECT * FROM posts WHERE author = ? ORDER BY created_at`).all(me),
    reaktionen: db.prepare(`SELECT * FROM reactions WHERE author = ? ORDER BY created_at`).all(me),
    hotlineNachrichten: db.prepare(`SELECT * FROM hotline_messages WHERE from_name = ?`).all(me),
    hotlineLeitungen: db
      .prepare(`SELECT * FROM hotline_threads WHERE person_a = ? OR person_b = ?`)
      .all(me, me),
    tapeFavoriten: db.prepare(`SELECT * FROM cassette_tape_favorites WHERE member = ?`).all(me),
    meldungen: db.prepare(`SELECT * FROM reports WHERE reported_by = ?`).all(me),
    imposterTipps: db.prepare(`SELECT * FROM imposter_votes WHERE voter = ?`).all(me),
    mixtapes: tapes,
  });
});

app.delete('/api/me', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const stats = db.transaction(() => {
    // Medien zuerst einsammeln, danach loeschen — sonst sind die Referenzen weg.
    const mediaIds = [
      ...(db.prepare(`SELECT media_id AS id FROM posts WHERE author = ? AND media_id IS NOT NULL`).all(me) as { id: string }[]),
      ...(db.prepare(`SELECT cover_id AS id FROM mixtapes WHERE from_name = ? AND cover_id IS NOT NULL`).all(me) as { id: string }[]),
      ...(db.prepare(`SELECT avatar_id AS id FROM profiles WHERE name = ? AND avatar_id IS NOT NULL`).all(me) as { id: string }[]),
      ...(db.prepare(`SELECT media_id AS id FROM stories WHERE author = ?`).all(me) as { id: string }[]),
      ...(db.prepare(`SELECT media_id AS id FROM news_posts WHERE author = ? AND media_id IS NOT NULL`).all(me) as { id: string }[]),
    ].map((r) => r.id);

    const posts = db.prepare(`DELETE FROM posts WHERE author = ?`).run(me).changes;
    const tapes = db.prepare(`DELETE FROM mixtapes WHERE from_name = ?`).run(me).changes;
    db.prepare(`DELETE FROM reactions WHERE author = ?`).run(me);
    db.prepare(`DELETE FROM stories WHERE author = ?`).run(me);
    db.prepare(`DELETE FROM news_posts WHERE author = ?`).run(me);
    // Eine Leitung gehoert zwei Personen — loescht eine ihr Konto, verschwindet
    // die ganze Leitung mit, nicht nur die eigenen Nachrichten darin.
    db.prepare(`DELETE FROM hotline_threads WHERE person_a = ? OR person_b = ?`).run(me, me);
    db.prepare(`DELETE FROM profiles WHERE name = ?`).run(me);
    db.prepare(`DELETE FROM reports WHERE reported_by = ?`).run(me);
    db.prepare(`DELETE FROM cassette_invites WHERE invitee = ?`).run(me);
    // Imposter: eigene Tipps weg, Beitraege gehen mit den Posts. Der Name
    // in einer laengst aufgeloesten Woche wird neutralisiert statt die
    // Woche der anderen zu loeschen.
    db.prepare(`DELETE FROM imposter_votes WHERE voter = ? OR suspect = ?`).run(me, me);
    db.prepare(`UPDATE imposter_weeks SET imposter = '(gelöscht)' WHERE imposter = ?`).run(me);
    db.prepare(`UPDATE imposter_weeks SET started_by = '(gelöscht)' WHERE started_by = ?`).run(me);
    handOverCassettesOf(me);
    db.prepare(`DELETE FROM cassette_members WHERE member = ?`).run(me);
    db.prepare(`DELETE FROM cassette_tape_favorites WHERE member = ?`).run(me);
    // Ein Tape-Name ist kassettenweit sichtbar, nicht privat — kann beim
    // Loeschen der benennenden Person trotzdem mit verschwinden, konsistent
    // damit dass auch Posts geloescht statt anonymisiert werden.
    db.prepare(`DELETE FROM cassette_tapes WHERE named_by = ?`).run(me);
    db.prepare(`DELETE FROM person_tokens WHERE name = ?`).run(me);

    for (const id of mediaIds) dropMedia(id);
    return { posts, tapes, medien: mediaIds.length };
  })();

  res.json({ geloescht: stats });
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
