import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { creatorOf, requireCassetteAdmin, requireIdentity, requireMember } from '../access.js';
import { db } from '../db.js';
import { HttpError } from '../http.js';
import { PAIR_COUNT } from '../content.js';
import { RELEASED, dropMedia } from '../media.js';

/* -------------------------------------------------------------------------
 * Kassetten — jede steht fuer eine Runde von Leuten: anlegen, umbenennen,
 * Besetzung, Einladungen (mit Zustimmen), verlassen und loeschen.
 * ---------------------------------------------------------------------- */

export const cassettesRouter = Router();

cassettesRouter.get('/api/cassettes', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);
  const now = Date.now();

  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.created_by, c.created_at, c.color_seed, c.color_index, c.challenge_off,
              m.is_admin, m.challenge_muted,
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
    challenge_off: number;
    is_admin: number;
    challenge_muted: number;
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
      /** Wochen-Challenge in dieser Runde aus (Admins), bzw. fuer mich stumm. */
      challengeOff: r.challenge_off === 1,
      challengeMuted: r.challenge_muted === 1,
      iAmAdmin: r.created_by === me || r.is_admin === 1,
      memberCount: r.members,
      sideA: r.side_a,
      sideB: r.side_b,
      lastAt: r.last_at,
    })),
  );
});

cassettesRouter.get('/api/cassettes/:id/members', (req, res) => {
  // Vorher ohne jede Pruefung: mit einer Kassetten-ID liess sich die
  // Besetzung jeder Runde auslesen.
  requireMember(req, req.params.id, String(req.query.me ?? '').trim());
  const rows = db
    .prepare(
      `SELECT m.member, m.added_by, m.joined_at, m.is_admin, c.created_by, p.pronouns
         FROM cassette_members m JOIN cassettes c ON c.id = m.cassette_id
         LEFT JOIN profiles p ON p.name = m.member
        WHERE m.cassette_id = ? ORDER BY m.joined_at`,
    )
    .all(req.params.id) as {
    member: string;
    added_by: string;
    joined_at: number;
    is_admin: number;
    created_by: string;
    pronouns: string | null;
  }[];
  if (rows.length === 0) throw new HttpError(404, 'Kassette nicht gefunden');
  res.json(
    rows.map((r) => ({
      name: r.member,
      addedBy: r.added_by,
      joinedAt: r.joined_at,
      admin: r.member === r.created_by || r.is_admin === 1,
      // Einzige Stelle, an der andere die Pronomen sehen: nur Mitglieder
      // dieser Kassette kommen bis hier (requireMember oben).
      pronouns: r.pronouns,
    })),
  );
});

cassettesRouter.post('/api/cassettes', (req, res) => {
  const name = String(req.body?.name ?? '')
    .trim()
    .slice(0, 40);
  const by = String(req.body?.by ?? '').trim();
  const colorSeed = req.body?.colorSeed ? String(req.body.colorSeed) : null;
  if (!name) throw new HttpError(400, 'Die Kassette braucht eine Beschriftung');
  if (!by) throw new HttpError(400, 'Name fehlt');
  requireIdentity(req, by);

  const id = randomUUID();
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`INSERT INTO cassettes (id, name, created_by, created_at, color_seed) VALUES (?, ?, ?, ?, ?)`).run(
      id,
      name,
      by,
      now,
      colorSeed,
    );
    db.prepare(`INSERT INTO cassette_members (cassette_id, member, added_by, joined_at) VALUES (?, ?, ?, ?)`).run(
      id,
      by,
      by,
      now,
    );
  })();

  res.status(201).json({
    id,
    name,
    createdBy: by,
    colorSeed,
    colorIndex: null,
    challengeOff: false,
    challengeMuted: false,
    iAmAdmin: true,
    memberCount: 1,
    sideA: 0,
    sideB: 0,
  });
});

cassettesRouter.patch('/api/cassettes/:id', (req, res) => {
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
cassettesRouter.post('/api/cassettes/:id/invites', (req, res) => {
  const by = String(req.body?.by ?? '').trim();
  const invitee = String(req.body?.invitee ?? '')
    .trim()
    .slice(0, 40);
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
    | {
        id: string;
        cassette_id: string;
        invitee: string;
        invited_by: string;
        created_at: number;
        cassette_name: string;
      }
    | undefined;
  if (!row) throw new HttpError(404, 'Einladung nicht gefunden');
  return row;
}

// Alle offenen Einladungen einer Person — landet in der Benachrichtigung,
// nicht in einer eigenen Inbox (siehe AnsweringMachine.tsx).
cassettesRouter.get('/api/invites', (req, res) => {
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

cassettesRouter.post('/api/invites/:id/accept', (req, res) => {
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

cassettesRouter.post('/api/invites/:id/decline', (req, res) => {
  const me = String(req.body?.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const invite = loadInvite(req.params.id);
  if (invite.invitee !== me) throw new HttpError(403, 'Das ist nicht deine Einladung');

  db.prepare(`DELETE FROM cassette_invites WHERE id = ?`).run(invite.id);
  res.status(204).end();
});

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

export function handOverCassettesOf(person: string): void {
  const owned = db.prepare(`SELECT id FROM cassettes WHERE created_by = ?`).all(person) as { id: string }[];
  for (const { id } of owned) handOver(id, person);
}

/** Admin ernennen oder zuruecknehmen — nur Admins. Die Gruenderin bleibt
 *  immer Admin, an ihr aendert dieser Schalter nichts. */
cassettesRouter.put('/api/cassettes/:id/members/:member/admin', (req, res) => {
  const by = String(req.body?.me ?? '').trim();
  const target = decodeURIComponent(req.params.member);
  requireCassetteAdmin(req, req.params.id, by);
  const isMember = db
    .prepare(`SELECT 1 FROM cassette_members WHERE cassette_id = ? AND member = ?`)
    .get(req.params.id, target);
  if (!isMember) throw new HttpError(404, 'Nicht in dieser Runde');
  if (target === creatorOf(req.params.id))
    throw new HttpError(400, 'Wer die Kassette angelegt hat, verwaltet sie immer mit');
  const admin = req.body?.admin === true;
  db.prepare(`UPDATE cassette_members SET is_admin = ? WHERE cassette_id = ? AND member = ?`).run(
    admin ? 1 : 0,
    req.params.id,
    target,
  );
  res.json({ name: target, admin });
});

cassettesRouter.delete('/api/cassettes/:id/members/:member', (req, res) => {
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

  dropIfEmpty(req.params.id);

  res.status(204).end();
});

/** Leere Kassetten verschwinden mitsamt ihren Beitraegen — sonst blieben
 *  verwaiste Runden liegen, die niemand mehr sehen kann, samt dem Namen,
 *  wer sie angelegt hat. Beim Verlassen und beim Loeschen des Kontos. */
export function dropIfEmpty(cassetteId: string): void {
  const rest = db.prepare(`SELECT COUNT(*) AS n FROM cassette_members WHERE cassette_id = ?`).get(cassetteId) as {
    n: number;
  };
  if (rest.n > 0) return;
  // Erst die Beitraege, dann die Medien — dropMedia raeumt nur auf, was
  // nirgends mehr haengt (ein Challenge-Beitrag kann in mehreren Kassetten
  // liegen, siehe media.ts).
  const mediaIds = (
    db.prepare(`SELECT media_id FROM posts WHERE cassette_id = ? AND media_id IS NOT NULL`).all(cassetteId) as {
      media_id: string;
    }[]
  ).map((p) => p.media_id);
  db.prepare(`DELETE FROM posts WHERE cassette_id = ?`).run(cassetteId);
  db.prepare(`DELETE FROM cassettes WHERE id = ?`).run(cassetteId);
  for (const id of mediaIds) dropMedia(id);
}

// Loeschen darf nur, wer die Kassette angelegt hat. Frueher durfte das
// jedes Mitglied — eine Person konnte so die Erinnerungen aller anderen
// wegwerfen. Umbenennen und Umfaerben bleiben fuer alle offen.
cassettesRouter.delete('/api/cassettes/:id', (req, res) => {
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
