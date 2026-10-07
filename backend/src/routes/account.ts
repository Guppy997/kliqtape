import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { hashToken, requireIdentity } from '../access.js';
import { db } from '../db.js';
import { HttpError } from '../http.js';
import { dropMedia } from '../media.js';
import { handOverCassettesOf } from './cassettes.js';
import { shapeTape, tracksOf, type TapeRow } from './mixtapes.js';
import { privateMediaOf, privateTapesOf } from './privateTapes.js';

/* -------------------------------------------------------------------------
 * Konto: Namen beanspruchen (Zugangscode), Umbenennen, Profilbild — und die
 * eigenen Daten als Export (DSGVO Art. 20) oder komplett loeschen (Art. 17).
 * ---------------------------------------------------------------------- */

export const accountRouter = Router();

accountRouter.post('/api/auth/claim', (req, res) => {
  const name = String(req.body?.name ?? '')
    .trim()
    .slice(0, 40);
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

accountRouter.get('/api/auth/whoami', (req, res) => {
  const token = req.header('X-Auth-Token');
  const row = token
    ? (db.prepare(`SELECT name FROM person_tokens WHERE token_hash = ?`).get(hashToken(token)) as
        { name: string } | undefined)
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
accountRouter.post('/api/auth/rename', (req, res) => {
  const token = req.header('X-Auth-Token');
  const current = token
    ? (db.prepare(`SELECT name FROM person_tokens WHERE token_hash = ?`).get(hashToken(token)) as
        { name: string } | undefined)
    : undefined;
  if (!current) throw new HttpError(401, 'Nicht angemeldet');

  const next = String(req.body?.name ?? '')
    .trim()
    .slice(0, 40);
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
    db.prepare(`UPDATE invite_letters SET created_by = ? WHERE created_by = ?`).run(next, from);
    db.prepare(`UPDATE invite_letters SET used_by = ? WHERE used_by = ?`).run(next, from);
    db.prepare(`UPDATE private_tapes SET owner = ? WHERE owner = ?`).run(next, from);
  })();

  res.json({ name: next });
});

/* -------------------------------------------------------------------------
 * Profile
 * ---------------------------------------------------------------------- */
// Alle Profile auf einmal. Bei dieser Gruppengroesse ist das eine winzige
// Liste — ein Endpunkt pro Person waere reine Verschwendung.
accountRouter.get('/api/profiles', (_req, res) => {
  const rows = db.prepare(`SELECT name, avatar_id FROM profiles`).all() as {
    name: string;
    avatar_id: string | null;
  }[];
  res.json(rows.map((r) => ({ name: r.name, avatarId: r.avatar_id })));
});

accountRouter.put('/api/profiles/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name).trim().slice(0, 40);
  if (!name) throw new HttpError(400, 'Name fehlt');
  requireIdentity(req, name);

  const avatarId = req.body?.avatarId ?? null;
  if (avatarId && !db.prepare(`SELECT 1 FROM media WHERE id = ?`).get(avatarId)) {
    throw new HttpError(400, 'Bild unbekannt');
  }

  const prev = db.prepare(`SELECT avatar_id FROM profiles WHERE name = ?`).get(name) as
    { avatar_id: string | null } | undefined;

  db.prepare(
    `INSERT INTO profiles (name, avatar_id, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET avatar_id = excluded.avatar_id, updated_at = excluded.updated_at`,
  ).run(name, avatarId, Date.now());

  // Erst NACH dem Umbiegen der Referenz aufraeumen — sonst schlaegt der
  // Fremdschluessel zu, weil das Profil noch auf das alte Bild zeigt.
  if (prev?.avatar_id && prev.avatar_id !== avatarId) dropMedia(prev.avatar_id);

  res.json({ name, avatarId });
});

/* -------------------------------------------------------------------------
 * Eigene Daten — Export und Loeschung
 *
 * Steht so im Konzept (DSGVO Art. 20 und Art. 17) und gehoert ab der ersten
 * Version rein, nicht nachtraeglich.
 * ---------------------------------------------------------------------- */

accountRouter.get('/api/export', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const tapes = (db.prepare(`SELECT * FROM mixtapes WHERE from_name = ? OR to_name = ?`).all(me, me) as TapeRow[]).map(
    (t) => ({ ...shapeTape(t), tracks: tracksOf(t.id) }),
  );

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
    hotlineLeitungen: db.prepare(`SELECT * FROM hotline_threads WHERE person_a = ? OR person_b = ?`).all(me, me),
    tapeFavoriten: db.prepare(`SELECT * FROM cassette_tape_favorites WHERE member = ?`).all(me),
    meldungen: db.prepare(`SELECT * FROM reports WHERE reported_by = ?`).all(me),
    imposterTipps: db.prepare(`SELECT * FROM imposter_votes WHERE voter = ?`).all(me),
    mixtapes: tapes,
    eigeneTapes: privateTapesOf(me),
  });
});

accountRouter.delete('/api/me', (req, res) => {
  const me = String(req.query.me ?? '').trim();
  if (!me) throw new HttpError(400, 'me fehlt');
  requireIdentity(req, me);

  const stats = db.transaction(() => {
    // Medien zuerst einsammeln, danach loeschen — sonst sind die Referenzen weg.
    const mediaIds = [
      ...(db.prepare(`SELECT media_id AS id FROM posts WHERE author = ? AND media_id IS NOT NULL`).all(me) as {
        id: string;
      }[]),
      ...(db.prepare(`SELECT cover_id AS id FROM mixtapes WHERE from_name = ? AND cover_id IS NOT NULL`).all(me) as {
        id: string;
      }[]),
      ...(db.prepare(`SELECT avatar_id AS id FROM profiles WHERE name = ? AND avatar_id IS NOT NULL`).all(me) as {
        id: string;
      }[]),
      ...(db.prepare(`SELECT media_id AS id FROM stories WHERE author = ?`).all(me) as { id: string }[]),
      ...(db.prepare(`SELECT media_id AS id FROM news_posts WHERE author = ? AND media_id IS NOT NULL`).all(me) as {
        id: string;
      }[]),
      ...privateMediaOf(me).map((id) => ({ id })),
    ].map((r) => r.id);

    const posts = db.prepare(`DELETE FROM posts WHERE author = ?`).run(me).changes;
    const tapes = db.prepare(`DELETE FROM mixtapes WHERE from_name = ?`).run(me).changes;
    db.prepare(`DELETE FROM reactions WHERE author = ?`).run(me);
    db.prepare(`DELETE FROM stories WHERE author = ?`).run(me);
    db.prepare(`DELETE FROM news_posts WHERE author = ?`).run(me);
    // Eintraege gehen per ON DELETE CASCADE mit, ihre Medien oben ueber mediaIds.
    db.prepare(`DELETE FROM private_tapes WHERE owner = ?`).run(me);
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
    // Offene Briefe der Person verfallen mit ihr; eingeloeste bleiben anonym stehen.
    db.prepare(`DELETE FROM invite_letters WHERE created_by = ? AND used_at IS NULL`).run(me);
    db.prepare(`UPDATE invite_letters SET created_by = '(gelöscht)' WHERE created_by = ?`).run(me);
    db.prepare(`UPDATE invite_letters SET used_by = '(gelöscht)' WHERE used_by = ?`).run(me);
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
