import type { Kind, NewsKind, Side, StoryKind } from './db.js';

/* Was es an Beitraegen gibt — geteilt von Posts, Hot Line und Imposter-Woche. */

export const SIDES: Side[] = ['a', 'b'];
export const KINDS: Kind[] = ['text', 'photo', 'video', 'voice', 'tape'];
/** Diese Arten brauchen eine hochgeladene Datei. */
export const MEDIA_KINDS: Kind[] = ['photo', 'video', 'voice'];
/** Storys sind bewusst enger als posts — nur der schnelle Foto/Video-Moment. */
export const STORY_KINDS: StoryKind[] = ['photo', 'video'];
export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const NEWS_KINDS: NewsKind[] = ['text', 'photo', 'video'];
/** Wie ein Zettel "befestigt" ist — nur fuer kind === 'text' relevant. */
export const NOTE_STYLES = ['tape', 'pin', 'staple', 'clip', 'fold'] as const;
export type NoteStyle = (typeof NOTE_STYLES)[number];

/** Anzahl Bandsorten, dupliziert aus frontend/src/lib/cassetteLook.ts
 *  (PAIR_COUNT) — kein gemeinsames Package fuer eine einzelne Zahl. */
export const PAIR_COUNT = 16;

/** Was auf ein eigenes, privates Tape passt (Profil-Regal): wie Seite A,
 *  nur ohne Mixtape — ein Tagebuch-Band aus Fotos, Clips, O-Toenen, Zetteln. */
export const PRIVATE_KINDS: Kind[] = ['text', 'photo', 'video', 'voice'];
