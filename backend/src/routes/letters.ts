import { Router } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { hashToken, requireIdentity, requireMember } from '../access.js';
import { PUBLIC_URL } from '../config.js';
import { db } from '../db.js';
import { HttpError } from '../http.js';
import { renderLetterPdf } from '../print/letter.js';
import { UTC_DATE, berlinCivilDay } from '../time.js';

/* -------------------------------------------------------------------------
 * Einladung als Brief — druckbares PDF mit QR-Code. Der Token ist neu und
 * unabhaengig vom Zugangscode: einmal gueltig, LETTER_TTL_MS lang, nur fuer
 * genau diese Kassette. Gespeichert wird nur sein Hash; der Klartext steht
 * ausschliesslich im PDF dieser einen Antwort. Einloesen legt eine normale
 * Einladung an — dabei ist man erst nach dem bestehenden Zustimmen.
 * ---------------------------------------------------------------------- */

export const lettersRouter = Router();

const LETTER_TTL_MS = 14 * 86_400_000;

lettersRouter.post('/api/cassettes/:id/letter.pdf', (req, res) => {
  const by = String(req.body?.by ?? '').trim();
  requireMember(req, req.params.id, by);
  const cassette = db.prepare(`SELECT name FROM cassettes WHERE id = ?`).get(req.params.id) as { name: string };

  const token = randomBytes(24).toString('base64url');
  const now = Date.now();
  const expiresAt = now + LETTER_TTL_MS;
  db.prepare(
    `INSERT INTO invite_letters (id, cassette_id, token_hash, created_by, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), req.params.id, hashToken(token), by, now, expiresAt);

  // Origin schickt der Browser bei POST ohnehin mit und zeigt auf die App,
  // nicht auf den Backend-Port hinter einem Proxy.
  const origin = req.get('origin');
  const base =
    PUBLIC_URL || (origin && /^https?:\/\/[^/\s]+$/.test(origin) ? origin : `${req.protocol}://${req.get('host')}`);
  const url = `${base}/?brief=${token}`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="kliqtape-einladung.pdf"');
  res.setHeader('Cache-Control', 'no-store');
  // Fuer "Link kopieren" in der App — die Person haelt ihn mit dem PDF ohnehin.
  res.setHeader('X-Letter-Url', url);
  renderLetterPdf(
    { cassetteName: cassette.name, from: by, url, validUntil: UTC_DATE.format(new Date(berlinCivilDay(expiresAt))) },
    res,
  );
});

lettersRouter.post('/api/letters/redeem', (req, res) => {
  const me = String(req.body?.me ?? '').trim();
  const token = String(req.body?.token ?? '').trim();
  requireIdentity(req, me);
  if (!token) throw new HttpError(400, 'Token fehlt');

  const letter = db
    .prepare(
      `SELECT l.id, l.cassette_id, l.created_by, l.expires_at, l.used_at, c.name AS cassette_name
         FROM invite_letters l JOIN cassettes c ON c.id = l.cassette_id
        WHERE l.token_hash = ?`,
    )
    .get(hashToken(token)) as
    | {
        id: string;
        cassette_id: string;
        created_by: string;
        expires_at: number;
        used_at: number | null;
        cassette_name: string;
      }
    | undefined;
  if (!letter) throw new HttpError(404, 'Diesen Brief kennt der Server nicht');
  if (letter.used_at) throw new HttpError(410, 'Dieser Brief wurde schon eingelöst');
  if (Date.now() > letter.expires_at) throw new HttpError(410, 'Dieser Brief ist abgelaufen');
  if (db.prepare(`SELECT 1 FROM cassette_members WHERE cassette_id = ? AND member = ?`).get(letter.cassette_id, me)) {
    // Token bleibt gueltig — vielleicht ist er fuer jemand anderen gedacht.
    throw new HttpError(409, `Du bist schon auf »${letter.cassette_name}«`);
  }

  const inviteId = db.transaction(() => {
    db.prepare(`UPDATE invite_letters SET used_by = ?, used_at = ? WHERE id = ?`).run(me, Date.now(), letter.id);
    const existing = db
      .prepare(`SELECT id FROM cassette_invites WHERE cassette_id = ? AND invitee = ?`)
      .get(letter.cassette_id, me) as { id: string } | undefined;
    if (existing) return existing.id;
    const id = randomUUID();
    db.prepare(
      `INSERT INTO cassette_invites (id, cassette_id, invitee, invited_by, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(id, letter.cassette_id, me, letter.created_by, Date.now());
    return id;
  })();

  res.status(201).json({ inviteId, cassetteName: letter.cassette_name, invitedBy: letter.created_by });
});
