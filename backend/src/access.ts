import { type Request } from 'express';
import { createHash } from 'node:crypto';
import { db } from './db.js';
import { HttpError } from './http.js';

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

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Name hinter dem mitgeschickten Token, sonst 401. */
export function identityOf(req: Request): string {
  const token = req.header('X-Auth-Token');
  const row = token
    ? (db.prepare(`SELECT name FROM person_tokens WHERE token_hash = ?`).get(hashToken(token)) as
        { name: string } | undefined)
    : undefined;
  if (!row) throw new HttpError(401, 'Nicht angemeldet');
  return row.name;
}

/** Wirft 401, wenn der mitgeschickte Token nicht zum behaupteten Namen passt. */
export function requireIdentity(req: Request, claimedName: string): void {
  if (identityOf(req) !== claimedName) throw new HttpError(401, 'Nicht angemeldet');
}

export function requireMember(req: Request, cassetteId: string, person: string): void {
  requireIdentity(req, person);
  const ok = db.prepare(`SELECT 1 FROM cassette_members WHERE cassette_id = ? AND member = ?`).get(cassetteId, person);
  if (!ok) throw new HttpError(403, 'Du bist nicht in dieser Runde');
}

/** Wer eine Kassette angelegt hat — nur diese Person darf sie loeschen. */
export function creatorOf(cassetteId: string): string {
  const row = db.prepare(`SELECT created_by FROM cassettes WHERE id = ?`).get(cassetteId) as
    { created_by: string } | undefined;
  if (!row) throw new HttpError(404, 'Kassette nicht gefunden');
  return row.created_by;
}

/** Gruppen-Admin: wer die Kassette angelegt hat (bzw. sie uebernommen hat,
 *  siehe handOver) oder von einem Admin dazu ernannt wurde. Steuert bisher
 *  nur die Wochen-Challenge der Runde. */
export function isCassetteAdmin(cassetteId: string, person: string): boolean {
  const row = db
    .prepare(
      `SELECT c.created_by, m.is_admin FROM cassettes c
         LEFT JOIN cassette_members m ON m.cassette_id = c.id AND m.member = ?
        WHERE c.id = ?`,
    )
    .get(person, cassetteId) as { created_by: string; is_admin: number | null } | undefined;
  if (!row) throw new HttpError(404, 'Kassette nicht gefunden');
  return row.created_by === person || row.is_admin === 1;
}

export function requireCassetteAdmin(req: Request, cassetteId: string, person: string): void {
  requireMember(req, cassetteId, person);
  if (!isCassetteAdmin(cassetteId, person)) throw new HttpError(403, 'Das kann nur, wer die Runde verwaltet');
}
