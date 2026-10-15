import { db } from './db.js';

/* Die Wochen-Challenge als Datum: welche Typen es gibt und welche Woche
 * gerade laeuft. Eigenes Modul, weil routes/challenge.ts und
 * routes/imposter.ts es beide brauchen — ohne sich gegenseitig zu importieren. */

export const CHALLENGE_TYPES = ['photo', 'super8', 'damals', 'mixtape', 'imposter'] as const;
export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

export function isChallengeType(t: unknown): t is ChallengeType {
  return (CHALLENGE_TYPES as readonly unknown[]).includes(t);
}

export interface WeekRow {
  id: string;
  release_at: number;
  type: ChallengeType;
  theme: string;
  set_by: string;
  created_at: number;
  demo: number;
}

/** Die laufende Woche: naechste Aufloesung in der Zukunft. Eine Demo-Woche
 *  ueberlagert die geplante, weil sie spaeter angelegt wurde. */
export function currentWeek(now = Date.now()): WeekRow | undefined {
  return db
    .prepare(`SELECT * FROM challenge_weeks WHERE release_at > ? ORDER BY release_at ASC, created_at DESC LIMIT 1`)
    .get(now) as WeekRow | undefined;
}
