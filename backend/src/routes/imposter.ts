import { Router } from 'express';
import { randomInt, randomUUID } from 'node:crypto';
import { isCassetteAdmin, requireMember } from '../access.js';
import { currentWeek } from '../challengeWeek.js';
import { DEMO_TOOLS } from '../config.js';
import { type Kind, db } from '../db.js';
import { HttpError } from '../http.js';
import { PHOTO_MIME, mediaInUse } from '../media.js';

/* -------------------------------------------------------------------------
 * Imposter-Woche — einer der Typen der Wochen-Challenge (routes/challenge.ts).
 * Plant der Kliqtape-Kanal eine Imposter-Woche, bekommt jede Runde mit
 * mindestens vier Mitspielenden ihr eigenes Spiel, beim ersten Blick darauf
 * angelegt: Alle bekommen dieselbe Aufgabe, eine zufaellige Person nur einen
 * vagen Hinweis. Beitraege sind bis Sonntag 19:00 verborgen, dann wird
 * getippt, wer der Imposter war, und aufgeloest. Kein Punktestand, keine
 * Belohnung, keine Stimmenzahlen — nur "richtig" oder "daneben".
 *
 * Die Aufgabe zieht jede Runde selbst, und pro Woche ist man in hoechstens
 * einer Runde Imposter. Sonst erfuehre der Imposter der einen Runde die
 * Aufgabe einfach ueber eine andere, in der er ganz normal mitspielt.
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
/** Wie lange nach Sonntagabend getippt werden kann, bevor von selbst aufgeloest wird. */
const IMPOSTER_VOTING_MS = 24 * 3_600_000;

interface ImposterWeekRow {
  id: string;
  cassette_id: string;
  challenge_week_id: string | null;
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

/** Wer in einer Runde mitspielt: alle Mitglieder, ausser wer die Challenge
 *  dort fuer sich stummgeschaltet hat. */
function playersOf(cassetteId: string): string[] {
  return (
    db
      .prepare(`SELECT member FROM cassette_members WHERE cassette_id = ? AND challenge_muted = 0 ORDER BY joined_at`)
      .all(cassetteId) as { member: string }[]
  ).map((r) => r.member);
}

function shuffled<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Laeuft diese Woche die Imposter-Challenge, bekommt die Runde ihr Spiel —
 * angelegt beim ersten Blick darauf, die App hat keinen Hintergrund-Job.
 * Keins, wenn die Challenge hier aus ist oder weniger als vier mitspielen.
 *
 * Aufgabe und Imposter werden zusammen gezogen, damit nichts durchsickert:
 * - wer diese Woche schon anderswo Imposter ist, wird es hier nicht;
 * - hat eine andere Runde dieselbe Aufgabe, darf deren Imposter hier nicht
 *   mitspielen, und der neue Imposter dort nicht — er saehe sonst die Aufgabe.
 * Findet sich keine Kombination, setzt die Runde diese Woche aus.
 */
export function ensureImposterGame(cassetteId: string, now = Date.now()): void {
  const cw = currentWeek(now);
  if (!cw || cw.type !== 'imposter') return;
  const has = db
    .prepare(`SELECT 1 FROM imposter_weeks WHERE cassette_id = ? AND challenge_week_id = ?`)
    .get(cassetteId, cw.id);
  if (has) return;
  const cassette = db.prepare(`SELECT challenge_off FROM cassettes WHERE id = ?`).get(cassetteId) as
    { challenge_off: number } | undefined;
  if (!cassette || cassette.challenge_off === 1) return;
  const players = playersOf(cassetteId);
  if (players.length < IMPOSTER_MIN_MEMBERS) return;

  const others = db
    .prepare(
      `SELECT cassette_id, task_key, imposter FROM imposter_weeks WHERE challenge_week_id = ? AND cassette_id != ?`,
    )
    .all(cw.id, cassetteId) as { cassette_id: string; task_key: string; imposter: string }[];
  const busy = new Set(others.map((o) => o.imposter));

  for (const task of shuffled(Object.keys(IMPOSTER_TASKS))) {
    const sameTask = others.filter((o) => o.task_key === task);
    if (sameTask.some((o) => players.includes(o.imposter))) continue;
    const seesTask = new Set(sameTask.flatMap((o) => playersOf(o.cassette_id)));
    const imposter = shuffled(players).find((p) => !busy.has(p) && !seesTask.has(p));
    if (!imposter) continue;
    db.prepare(
      `INSERT INTO imposter_weeks (id, cassette_id, task_key, imposter, started_by, started_at, reveal_at, challenge_week_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(randomUUID(), cassetteId, task, imposter, cw.set_by, now, cw.release_at, cw.id);
    return;
  }
}

/** Beim Abschalten der Runde: ein noch laufendes Challenge-Spiel faellt weg,
 *  samt seiner noch verborgenen Beitraege. */
export function dropPendingImposterGame(cassetteId: string, now = Date.now()): void {
  const games = db
    .prepare(
      `SELECT id FROM imposter_weeks
        WHERE cassette_id = ? AND challenge_week_id IS NOT NULL AND revealed_at IS NULL AND reveal_at > ?`,
    )
    .all(cassetteId, now) as { id: string }[];
  for (const g of games) {
    db.prepare(`DELETE FROM posts WHERE id IN (SELECT post_id FROM imposter_entries WHERE week_id = ?)`).run(g.id);
    db.prepare(`DELETE FROM imposter_weeks WHERE id = ?`).run(g.id);
  }
}

/** Haben alle Mitglieder der Runde getippt? */
function everyoneVoted(cassetteId: string, weekId: string): boolean {
  const members = db.prepare(`SELECT COUNT(*) AS n FROM cassette_members WHERE cassette_id = ?`).get(cassetteId) as {
    n: number;
  };
  const votes = db
    .prepare(
      `SELECT COUNT(*) AS n FROM imposter_votes v
         JOIN cassette_members m ON m.cassette_id = ? AND m.member = v.voter
        WHERE v.week_id = ?`,
    )
    .get(cassetteId, weekId) as { n: number };
  return votes.n >= members.n;
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
  ensureImposterGame(req.params.id, now);
  const w = latestImposterWeek(req.params.id, now);

  if (!w) return void res.json({ week: null, minMembers: IMPOSTER_MIN_MEMBERS, demoTools: DEMO_TOOLS });

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
  // Wer stumm ist, spielt hier nicht mit und bekommt keine Karte.
  const playing = isImposter || playersOf(req.params.id).includes(me);

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
      card: !playing ? null : isImposter ? { imposter: true, text: t.hint } : { imposter: false, text: t.task },
      iSubmitted: Boolean(mine),
      entries: entries.map((e) => ({
        postId: e.id,
        author: e.author,
        kind: e.kind,
        body: e.body,
        mediaId: e.media_id,
      })),
      myVote: myVote?.suspect ?? null,
      // Nur ob alle getippt haben — nicht wer, keine Zahl.
      allVoted: phase !== 'playing' && everyoneVoted(req.params.id, w.id),
      // Nur fuer aeltere App-Versionen, die das Feld noch lesen — immer leer.
      // Ohne es stuerzten installierte Apps vor dem Update in der Tipp-Phase ab.
      voted: [],
      result:
        phase === 'revealed'
          ? { imposter: w.imposter, task: t.task, hint: t.hint, caught: imposterCaught(w), revealedAt: w.revealed_at }
          : null,
    },
    minMembers: IMPOSTER_MIN_MEMBERS,
    demoTools: DEMO_TOOLS,
  });
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

  if (w.imposter !== author && !playersOf(req.params.id).includes(author)) {
    throw new HttpError(409, 'Du hast die Challenge hier für dich stummgeschaltet');
  }
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
  // Frueher aufloesen duerfen die Admins der Runde — oder alle, sobald jede:r
  // getippt hat. Sonst nimmt jemand den anderen das Raten weg; spaetestens
  // 24 Stunden nach Sonntagabend loest es sich von selbst auf.
  if (!isCassetteAdmin(req.params.id, by) && !everyoneVoted(req.params.id, w.id)) {
    throw new HttpError(403, 'Auflösen kann, wer die Runde verwaltet, oder alle, sobald alle getippt haben');
  }
  db.prepare(`UPDATE imposter_weeks SET revealed_at = ? WHERE id = ?`).run(Date.now(), w.id);
  res.json({ ok: true });
});
