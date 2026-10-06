import { Router } from 'express';
import { randomInt, randomUUID } from 'node:crypto';
import { creatorOf, requireMember } from '../access.js';
import { DEMO_TOOLS } from '../config.js';
import { type Kind, db } from '../db.js';
import { HttpError } from '../http.js';
import { PHOTO_MIME, mediaInUse } from '../media.js';
import { filmReleaseAfter } from '../time.js';

/* -------------------------------------------------------------------------
 * Imposter-Woche — ein Special, nicht jede Woche, nur ab vier Personen.
 * Alle bekommen dieselbe Aufgabe, eine zufaellige Person nur einen vagen
 * Hinweis. Beitraege sind bis Sonntag 19:00 verborgen (wie der Film), dann
 * wird getippt, wer der Imposter war, und aufgeloest. Kein Punktestand,
 * keine Belohnung, keine Stimmenzahlen — nur "richtig" oder "daneben".
 * ---------------------------------------------------------------------- */

export const imposterRouter = Router();

interface ImposterTask {
  task: string;
  hint: string;
  /** Womit man mitmacht: Foto (nur Kamera) oder ein paar Worte. */
  entry: 'photo' | 'text';
}

const IMPOSTER_TASKS: Record<string, ImposterTask> = {
  rot: {
    task: 'Fotografier etwas Rotes, das du jeden Tag benutzt.',
    hint: 'Fotografier etwas, das du benutzt.',
    entry: 'photo',
  },
  fruehstueck: { task: 'Zeig dein Frühstück von heute.', hint: 'Zeig etwas, das du heute hattest.', entry: 'photo' },
  fenster: { task: 'Fotografier den Blick aus deinem Fenster.', hint: 'Fotografier einen Ausblick.', entry: 'photo' },
  schuhe: { task: 'Zeig die Schuhe, die du heute trägst.', hint: 'Zeig etwas, das du heute anhast.', entry: 'photo' },
  rund: {
    task: 'Fotografier etwas Rundes in deiner Küche.',
    hint: 'Fotografier etwas aus deiner Wohnung.',
    entry: 'photo',
  },
  erinnerung: {
    task: 'Fotografier etwas, das dich an diese Runde erinnert.',
    hint: 'Fotografier etwas, das dir etwas bedeutet.',
    entry: 'photo',
  },
  gekocht: {
    task: 'Koch etwas, das du noch nie gekocht hast, und zeig es.',
    hint: 'Zeig etwas, das du gemacht hast.',
    entry: 'photo',
  },
  lied: {
    task: 'Schreib das Lied auf, das du diese Woche am meisten gehört hast.',
    hint: 'Schreib einen Liedtitel auf.',
    entry: 'text',
  },
  satz: {
    task: 'Schreib den letzten Satz auf, den du laut vorgelesen hast.',
    hint: 'Schreib einen Satz auf.',
    entry: 'text',
  },
  wunsch: {
    task: 'Schreib auf, wohin ihr als Runde als Nächstes zusammen fahren solltet.',
    hint: 'Schreib einen Ort auf.',
    entry: 'text',
  },
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

imposterRouter.get('/api/cassettes/:id/imposter', (req, res) => {
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

  if (!w)
    return void res.json({
      week: null,
      canStart,
      minMembers: IMPOSTER_MIN_MEMBERS,
      nextStartAt: null,
      demoTools: DEMO_TOOLS,
    });

  const phase = phaseOf(w, now);
  const t = IMPOSTER_TASKS[w.task_key]!;
  const isImposter = w.imposter === me;
  const mine = db.prepare(`SELECT post_id FROM imposter_entries WHERE week_id = ? AND author = ?`).get(w.id, me) as
    { post_id: string } | undefined;
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
    { suspect: string } | undefined;
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
      entries: entries.map((e) => ({
        postId: e.id,
        author: e.author,
        kind: e.kind,
        body: e.body,
        mediaId: e.media_id,
      })),
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

imposterRouter.post('/api/cassettes/:id/imposter', (req, res) => {
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
    throw new HttpError(
      409,
      'Die Imposter-Woche ist ein Special — die nächste geht frühestens vier Wochen nach der letzten',
    );
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

imposterRouter.post('/api/cassettes/:id/imposter/entry', (req, res) => {
  const author = String(req.body?.author ?? '').trim();
  const mediaId = req.body?.mediaId ? String(req.body.mediaId) : null;
  const body = String(req.body?.body ?? '')
    .trim()
    .slice(0, 280);
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
    if (!media || !PHOTO_MIME.includes(media.mime)) throw new HttpError(400, 'Für diese Aufgabe braucht es ein Foto');
    if (mediaInUse(mediaId)) throw new HttpError(400, 'Dieses Bild hängt schon woanders');
  } else if (!body) {
    throw new HttpError(400, 'Ein paar Worte braucht es schon');
  }

  const postId = randomUUID();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO posts (id, cassette_id, side, author, kind, body, media_id, source, develop_at, taken_at, created_at)
       VALUES (?, ?, 'a', ?, ?, ?, ?, 'imposter', ?, ?, ?)`,
    ).run(
      postId,
      req.params.id,
      author,
      t.entry === 'photo' ? 'photo' : 'text',
      body,
      t.entry === 'photo' ? mediaId : null,
      w.reveal_at,
      now,
      w.reveal_at,
    );
    db.prepare(`INSERT INTO imposter_entries (week_id, author, post_id) VALUES (?, ?, ?)`).run(w.id, author, postId);
  })();

  res.status(201).json({ postId });
});

imposterRouter.post('/api/cassettes/:id/imposter/vote', (req, res) => {
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

imposterRouter.post('/api/cassettes/:id/imposter/reveal', (req, res) => {
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
imposterRouter.post('/api/cassettes/:id/imposter/now', (req, res) => {
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
