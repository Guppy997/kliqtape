import { type Request, Router } from 'express';
import { randomUUID } from 'node:crypto';
import { isCassetteAdmin, requireCassetteAdmin, requireIdentity, requireMember } from '../access.js';
import { ADMIN_NAME, DEMO_TOOLS } from '../config.js';
import { db } from '../db.js';
import { HttpError } from '../http.js';
import { PHOTO_MIME, mediaInUse } from '../media.js';
import { filmReleaseAfter } from '../time.js';

/* -------------------------------------------------------------------------
 * Wochen-Challenge — loest Film und Imposter-Woche als getrennte Funktionen
 * ab. Jede Woche EINE Challenge fuer alle Kassetten weltweit, geplant vom
 * Kliqtape-Kanal (ADMIN_NAME). Aufgeloest wird Sonntag 19:00 Europe/Berlin
 * (filmReleaseAfter, wie frueher der Film).
 *
 * Man macht sie einmal (challenge_entries) und legt sie in beliebig viele
 * eigene Kassetten (challenge_shares). Jede Ablage ist ein normaler
 * Seite-A-Beitrag mit develop_at = Aufloesung — Feed, Medien-Sperre, Album
 * und Tape-Gruppierung funktionieren dadurch unveraendert.
 *
 * Bewusst KEINE Streaks und keine Angabe, wer schon abgegeben hat: jeder
 * Status verraet nur den eigenen Stand.
 * ---------------------------------------------------------------------- */

export const challengeRouter = Router();

/** Welche Typen es gibt — waechst mit jeder Ausbaustufe. */
export const CHALLENGE_TYPES = ['photo'] as const;
export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

/** Thema, wenn eine Demo-Woche ohne eigenes angelegt wird. */
const DEMO_THEMES: Record<ChallengeType, string> = {
  photo: 'Etwas, das gerade Sonne abbekommt',
};

function isType(t: unknown): t is ChallengeType {
  return (CHALLENGE_TYPES as readonly unknown[]).includes(t);
}

const MAX_THEME = 120;
const MAX_CAPTION = 120;
/** So weit im Voraus plant der Kanal. */
const PLAN_WEEKS = 8;

export interface WeekRow {
  id: string;
  release_at: number;
  type: ChallengeType;
  theme: string;
  set_by: string;
  created_at: number;
  demo: number;
}

interface EntryRow {
  id: string;
  week_id: string;
  author: string;
  kind: string;
  body: string;
  media_id: string | null;
  tape_id: string | null;
  taken_at: number;
  created_at: number;
}

/** Die laufende Woche: naechste Aufloesung in der Zukunft. Eine Demo-Woche
 *  ueberlagert die geplante, weil sie spaeter angelegt wurde. */
export function currentWeek(now = Date.now()): WeekRow | undefined {
  return db
    .prepare(`SELECT * FROM challenge_weeks WHERE release_at > ? ORDER BY release_at ASC, created_at DESC LIMIT 1`)
    .get(now) as WeekRow | undefined;
}

function shapeWeek(w: WeekRow) {
  return { id: w.id, type: w.type, theme: w.theme, releaseAt: w.release_at };
}

function shapeEntry(e: EntryRow) {
  return { id: e.id, kind: e.kind, body: e.body, mediaId: e.media_id, tapeId: e.tape_id, takenAt: e.taken_at };
}

function myEntry(weekId: string, me: string): EntryRow | undefined {
  return db.prepare(`SELECT * FROM challenge_entries WHERE week_id = ? AND author = ?`).get(weekId, me) as
    EntryRow | undefined;
}

function isChannel(me: string): boolean {
  return Boolean(ADMIN_NAME) && me === ADMIN_NAME;
}

function meOf(req: Request): string {
  const me = String(req.query.me ?? req.body?.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  return me;
}

/** Ist die Challenge in dieser Runde aus, oder fuer mich stumm? */
function blockOf(cassetteId: string, me: string): { off: boolean; muted: boolean } {
  const row = db
    .prepare(
      `SELECT c.challenge_off, m.challenge_muted FROM cassettes c
         JOIN cassette_members m ON m.cassette_id = c.id AND m.member = ?
        WHERE c.id = ?`,
    )
    .get(me, cassetteId) as { challenge_off: number; challenge_muted: number } | undefined;
  return { off: row?.challenge_off === 1, muted: row?.challenge_muted === 1 };
}

/** Noch nicht aufgeloeste Ablagen in einer Runde zurueckziehen — beim
 *  Abschalten alle, beim Stummschalten nur die eigene. Die Beitraege selbst
 *  bleiben und lassen sich anderswo weiter teilen. */
function withdrawPending(cassetteId: string, author?: string): number {
  const rows = db
    .prepare(
      `SELECT s.post_id FROM challenge_shares s
         JOIN challenge_entries e ON e.id = s.entry_id
         JOIN challenge_weeks w ON w.id = e.week_id
        WHERE s.cassette_id = ? AND w.release_at > ? ${author ? 'AND e.author = ?' : ''}`,
    )
    .all(...(author ? [cassetteId, Date.now(), author] : [cassetteId, Date.now()])) as { post_id: string }[];
  const del = db.prepare(`DELETE FROM posts WHERE id = ?`);
  for (const r of rows) del.run(r.post_id);
  return rows.length;
}

/* --- Status ---------------------------------------------------------------- */

/** Die Woche fuer mich: was dran ist und — nur — mein eigener Stand. */
challengeRouter.get('/api/challenge', (req, res) => {
  const me = meOf(req);
  requireIdentity(req, me);
  const week = currentWeek();
  const entry = week ? myEntry(week.id, me) : undefined;
  const sharedIn = entry
    ? (
        db.prepare(`SELECT cassette_id FROM challenge_shares WHERE entry_id = ?`).all(entry.id) as {
          cassette_id: string;
        }[]
      ).map((r) => r.cassette_id)
    : [];
  // In welche meiner Runden ich ueberhaupt etwas legen kann — nicht dort, wo
  // die Challenge aus oder fuer mich stumm ist.
  const open = (
    db
      .prepare(
        `SELECT c.id FROM cassettes c JOIN cassette_members m ON m.cassette_id = c.id AND m.member = ?
          WHERE c.challenge_off = 0 AND m.challenge_muted = 0`,
      )
      .all(me) as { id: string }[]
  ).map((r) => r.id);
  res.json({
    current: week ? shapeWeek(week) : null,
    mine: entry ? { entry: shapeEntry(entry), cassetteIds: sharedIn } : null,
    openCassetteIds: open,
    demoTools: DEMO_TOOLS,
  });
});

/** Die Challenge aus Sicht einer Kassette: laufende Woche, ob mein Beitrag
 *  hier liegt, und die zuletzt aufgeloeste Woche dieser Kassette (die Tuete). */
challengeRouter.get('/api/cassettes/:id/challenge', (req, res) => {
  const me = meOf(req);
  requireMember(req, req.params.id, me);
  const now = Date.now();
  const week = currentWeek(now);
  const entry = week ? myEntry(week.id, me) : undefined;
  const sharedHere = entry
    ? Boolean(
        db
          .prepare(`SELECT 1 FROM challenge_shares WHERE entry_id = ? AND cassette_id = ?`)
          .get(entry.id, req.params.id),
      )
    : false;

  const last = db
    .prepare(
      `SELECT w.* FROM challenge_weeks w
         JOIN challenge_entries e ON e.week_id = w.id
         JOIN challenge_shares s ON s.entry_id = e.id
        WHERE s.cassette_id = ? AND w.release_at <= ?
        ORDER BY w.release_at DESC LIMIT 1`,
    )
    .get(req.params.id, now) as WeekRow | undefined;
  const shots = last
    ? (db
        .prepare(
          `SELECT p.id, p.author, p.kind, p.media_id, p.tape_id, p.body, p.taken_at
             FROM challenge_shares s
             JOIN challenge_entries e ON e.id = s.entry_id
             JOIN posts p ON p.id = s.post_id
            WHERE s.cassette_id = ? AND e.week_id = ?
            ORDER BY p.taken_at ASC`,
        )
        .all(req.params.id, last.id) as {
        id: string;
        author: string;
        kind: string;
        media_id: string | null;
        tape_id: string | null;
        body: string;
        taken_at: number;
      }[])
    : [];

  res.json({
    current: week ? shapeWeek(week) : null,
    ...blockOf(req.params.id, me),
    iAmAdmin: isCassetteAdmin(req.params.id, me),
    mine: { entry: entry ? shapeEntry(entry) : null, sharedHere },
    developed: last
      ? {
          ...shapeWeek(last),
          at: last.release_at,
          shots: shots.map((r) => ({
            id: r.id,
            author: r.author,
            kind: r.kind,
            mediaId: r.media_id,
            tapeId: r.tape_id,
            caption: r.body,
            takenAt: r.taken_at,
          })),
        }
      : null,
    demoTools: DEMO_TOOLS,
  });
});

/* --- Mitmachen: einmal machen, in Kassetten legen ------------------------- */

challengeRouter.post('/api/challenge/entry', (req, res) => {
  const me = meOf(req);
  requireIdentity(req, me);
  const week = currentWeek();
  if (!week) throw new HttpError(409, 'Diese Woche gibt es keine Challenge');
  if (myEntry(week.id, me)) throw new HttpError(409, 'Du hast diese Woche schon mitgemacht');

  const caption = String(req.body?.caption ?? '')
    .trim()
    .slice(0, MAX_CAPTION);
  const mediaId = String(req.body?.mediaId ?? '').trim();
  const now = Date.now();
  let kind: string;

  switch (week.type) {
    case 'photo': {
      // Nur Kamera — pruefbar ist das auf dem Server nicht, die App bietet
      // hier schlicht keine Galerie an (wie frueher beim Film).
      kind = 'photo';
      if (!mediaId) throw new HttpError(400, 'Aufnahme fehlt');
      const media = db.prepare(`SELECT mime FROM media WHERE id = ?`).get(mediaId) as { mime: string } | undefined;
      if (!media) throw new HttpError(400, 'Medium unbekannt');
      if (!PHOTO_MIME.includes(media.mime)) throw new HttpError(400, 'Hier passt nur ein Foto');
      if (mediaInUse(mediaId)) throw new HttpError(400, 'Dieses Bild hängt schon woanders');
      break;
    }
    default:
      throw new HttpError(400, 'Unbekannter Challenge-Typ');
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO challenge_entries (id, week_id, author, kind, body, media_id, tape_id, taken_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
  ).run(id, week.id, me, kind, caption, mediaId || null, now, now);
  res.status(201).json(shapeEntry(myEntry(week.id, me)!));
});

challengeRouter.post('/api/cassettes/:id/challenge/share', (req, res) => {
  const me = meOf(req);
  requireMember(req, req.params.id, me);
  const week = currentWeek();
  if (!week) throw new HttpError(409, 'Diese Woche gibt es keine Challenge');
  const entry = myEntry(week.id, me);
  if (!entry) throw new HttpError(409, 'Erst mitmachen, dann teilen');
  const already = db
    .prepare(`SELECT 1 FROM challenge_shares WHERE entry_id = ? AND cassette_id = ?`)
    .get(entry.id, req.params.id);
  if (already) throw new HttpError(409, 'Liegt hier schon');
  const block = blockOf(req.params.id, me);
  if (block.off) throw new HttpError(409, 'In dieser Runde ist die Challenge ausgeschaltet');
  if (block.muted) throw new HttpError(409, 'Du hast die Challenge hier für dich stummgeschaltet');

  const postId = randomUUID();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO posts (id, cassette_id, side, author, kind, body, media_id, tape_id, source, develop_at, taken_at, created_at)
       VALUES (?, ?, 'a', ?, ?, ?, ?, ?, 'challenge', ?, ?, ?)`,
    ).run(
      postId,
      req.params.id,
      me,
      entry.kind,
      entry.body,
      entry.media_id,
      entry.tape_id,
      week.release_at,
      entry.taken_at,
      week.release_at,
    );
    db.prepare(`INSERT INTO challenge_shares (entry_id, cassette_id, post_id) VALUES (?, ?, ?)`).run(
      entry.id,
      req.params.id,
      postId,
    );
  })();
  res.status(201).json({ postId, releaseAt: week.release_at });
});

/** Vor der Aufloesung wieder herausnehmen. Der Beitrag selbst bleibt, er
 *  laesst sich anderswo weiter teilen. */
challengeRouter.delete('/api/cassettes/:id/challenge/share', (req, res) => {
  const me = meOf(req);
  requireMember(req, req.params.id, me);
  const week = currentWeek();
  const entry = week ? myEntry(week.id, me) : undefined;
  const share = entry
    ? (db
        .prepare(`SELECT post_id FROM challenge_shares WHERE entry_id = ? AND cassette_id = ?`)
        .get(entry.id, req.params.id) as { post_id: string } | undefined)
    : undefined;
  if (!share) throw new HttpError(404, 'Liegt hier nicht');
  // Der Post faellt, die Ablage kaskadiert mit; das Medium bleibt am Beitrag.
  db.prepare(`DELETE FROM posts WHERE id = ?`).run(share.post_id);
  res.status(204).end();
});

/* --- Abschalten: fuer die Runde (Admins) oder fuer sich -------------------- */

challengeRouter.put('/api/cassettes/:id/challenge', (req, res) => {
  const me = meOf(req);
  requireCassetteAdmin(req, req.params.id, me);
  const off = req.body?.off === true;
  const withdrawn = db.transaction(() => {
    db.prepare(`UPDATE cassettes SET challenge_off = ? WHERE id = ?`).run(off ? 1 : 0, req.params.id);
    return off ? withdrawPending(req.params.id) : 0;
  })();
  res.json({ off, withdrawn });
});

challengeRouter.put('/api/cassettes/:id/challenge/mute', (req, res) => {
  const me = meOf(req);
  requireMember(req, req.params.id, me);
  const muted = req.body?.muted === true;
  db.transaction(() => {
    db.prepare(`UPDATE cassette_members SET challenge_muted = ? WHERE cassette_id = ? AND member = ?`).run(
      muted ? 1 : 0,
      req.params.id,
      me,
    );
    if (muted) withdrawPending(req.params.id, me);
  })();
  res.json({ muted });
});

/* --- Planung durch den Kliqtape-Kanal -------------------------------------- */

function requireChannel(req: Request): string {
  const me = meOf(req);
  requireIdentity(req, me);
  if (!isChannel(me)) throw new HttpError(403, 'Planen darf nur der Kliqtape-Kanal');
  return me;
}

/** Die naechsten Sonntage 19:00, ab der laufenden Woche. */
function upcomingReleases(now = Date.now()): number[] {
  const out: number[] = [];
  let at = filmReleaseAfter(now);
  for (let i = 0; i < PLAN_WEEKS; i++) {
    out.push(at);
    at = filmReleaseAfter(at);
  }
  return out;
}

challengeRouter.get('/api/challenges', (req, res) => {
  requireChannel(req);
  const releases = upcomingReleases();
  const planned = db
    .prepare(`SELECT * FROM challenge_weeks WHERE demo = 0 AND release_at >= ? ORDER BY release_at`)
    .all(releases[0]) as WeekRow[];
  const byAt = new Map(planned.map((w) => [w.release_at, w]));
  res.json({
    types: CHALLENGE_TYPES,
    weeks: releases.map((at) => {
      const w = byAt.get(at);
      const started = w
        ? Boolean(db.prepare(`SELECT 1 FROM challenge_entries WHERE week_id = ? LIMIT 1`).get(w.id))
        : false;
      return { releaseAt: at, type: w?.type ?? null, theme: w?.theme ?? '', started };
    }),
  });
});

challengeRouter.put('/api/challenges/:releaseAt', (req, res) => {
  const me = requireChannel(req);
  const at = Number(req.params.releaseAt);
  if (!upcomingReleases().includes(at)) throw new HttpError(400, 'Geplant wird nur Sonntag 19 Uhr der nächsten Wochen');
  const type = req.body?.type ?? null;
  const theme = String(req.body?.theme ?? '')
    .trim()
    .slice(0, MAX_THEME);
  if (type !== null && !isType(type)) throw new HttpError(400, 'Unbekannter Challenge-Typ');

  const prev = db.prepare(`SELECT * FROM challenge_weeks WHERE demo = 0 AND release_at = ?`).get(at) as
    WeekRow | undefined;
  if (prev && db.prepare(`SELECT 1 FROM challenge_entries WHERE week_id = ? LIMIT 1`).get(prev.id)) {
    throw new HttpError(409, 'Die Woche läuft schon — es gibt bereits Beiträge');
  }
  if (type === null) {
    if (prev) db.prepare(`DELETE FROM challenge_weeks WHERE id = ?`).run(prev.id);
    return void res.json({ releaseAt: at, type: null, theme: '' });
  }
  if (prev) {
    db.prepare(`UPDATE challenge_weeks SET type = ?, theme = ?, set_by = ? WHERE id = ?`).run(type, theme, me, prev.id);
  } else {
    db.prepare(
      `INSERT INTO challenge_weeks (id, release_at, type, theme, set_by, created_at, demo) VALUES (?, ?, ?, ?, ?, ?, 0)`,
    ).run(randomUUID(), at, type, theme, me, Date.now());
  }
  res.json({ releaseAt: at, type, theme });
});

/* --- Nur fuer Vorfuehrungen (DEMO_TOOLS=1) ---------------------------------- */

/** Eine neue Woche eines beliebigen Typs, sofort laufend — ueberlagert die
 *  geplante. Jede angemeldete Person darf, es ist ein Demo-Server. */
challengeRouter.post('/api/challenge/demo', (req, res) => {
  if (!DEMO_TOOLS) throw new HttpError(404, 'Nicht verfügbar');
  const me = meOf(req);
  requireIdentity(req, me);
  const type = req.body?.type;
  if (!isType(type)) throw new HttpError(400, 'Unbekannter Challenge-Typ');
  const theme =
    String(req.body?.theme ?? '')
      .trim()
      .slice(0, MAX_THEME) || DEMO_THEMES[type];
  const id = randomUUID();
  db.prepare(
    `INSERT INTO challenge_weeks (id, release_at, type, theme, set_by, created_at, demo) VALUES (?, ?, ?, ?, ?, ?, 1)`,
  ).run(id, filmReleaseAfter(Date.now()), type, theme, me, Date.now());
  res.status(201).json(shapeWeek(currentWeek()!));
});

/** Sonntagabend vorziehen: die laufende Woche loest jetzt auf. */
challengeRouter.post('/api/challenge/demo/release', (req, res) => {
  if (!DEMO_TOOLS) throw new HttpError(404, 'Nicht verfügbar');
  const me = meOf(req);
  requireIdentity(req, me);
  const week = currentWeek();
  if (!week) throw new HttpError(409, 'Diese Woche gibt es keine Challenge');
  const now = Date.now();
  const released = db.transaction(() => {
    db.prepare(`UPDATE challenge_weeks SET release_at = ? WHERE id = ?`).run(now, week.id);
    return db
      .prepare(
        `UPDATE posts SET develop_at = ?, created_at = ?
          WHERE id IN (SELECT s.post_id FROM challenge_shares s
                         JOIN challenge_entries e ON e.id = s.entry_id
                        WHERE e.week_id = ?)`,
      )
      .run(now, now, week.id).changes;
  })();
  res.json({ released });
});
