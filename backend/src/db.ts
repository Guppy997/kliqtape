import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = process.env.DATA_DIR ?? './data';
mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(join(DATA_DIR, 'kliqtape.sqlite'));

// WAL erlaubt gleichzeitiges Lesen waehrend geschrieben wird. Ohne das
// blockiert jeder Schreibvorgang alle Leser - bei einem Feed sofort spuerbar.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS media (
    id          TEXT PRIMARY KEY,
    mime        TEXT NOT NULL,
    bytes       INTEGER NOT NULL,
    duration_ms INTEGER,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS posts (
    id         TEXT PRIMARY KEY,
    side       TEXT NOT NULL CHECK (side IN ('a','b')),
    author     TEXT NOT NULL,
    kind       TEXT NOT NULL CHECK (kind IN ('text','photo','video','mixtape')),
    body       TEXT NOT NULL DEFAULT '',
    media_id   TEXT REFERENCES media(id),
    created_at INTEGER NOT NULL
  );

  -- Kein Login im Prototyp: der Name IST die Identitaet. Deshalb haengt das
  -- Profil am Namen und nicht an einer User-ID. Mit echtem Auth wandert das
  -- auf eine users-Tabelle um.
  CREATE TABLE IF NOT EXISTS profiles (
    name       TEXT PRIMARY KEY,
    avatar_id  TEXT REFERENCES media(id),
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reactions (
    post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author     TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (post_id, author)
  );

  -- Hot Line: eine direkte, private Reaktion auf genau einen Beitrag.
  -- Bewusst KEIN Chat — es gibt keinen Verlauf, und nach 24 Stunden ist sie
  -- weg. Ein Anruf passiert und ist dann vorbei.
  CREATE TABLE IF NOT EXISTS hotlines (
    id         TEXT PRIMARY KEY,
    post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    from_name  TEXT NOT NULL,
    to_name    TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    heard_at   INTEGER
  );

  -- Das Mixtape: ein Geschenk an genau eine Person.
  -- sealed_at ist der Kern der Idee — solange es NULL ist, ist das Tape ein
  -- Entwurf, den nur der Ersteller sieht. Man baut daran ueber Tage, und erst
  -- das Versiegeln uebergibt es. Aufwand als Feature.
  CREATE TABLE IF NOT EXISTS mixtapes (
    id         TEXT PRIMARY KEY,
    from_name  TEXT NOT NULL,
    to_name    TEXT NOT NULL,
    title      TEXT NOT NULL DEFAULT '',
    note       TEXT NOT NULL DEFAULT '',
    cover_id   TEXT REFERENCES media(id),
    sealed_at  INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mixtape_tracks (
    id         TEXT PRIMARY KEY,
    mixtape_id TEXT NOT NULL REFERENCES mixtapes(id) ON DELETE CASCADE,
    position   INTEGER NOT NULL,
    title      TEXT NOT NULL,
    artist     TEXT NOT NULL DEFAULT '',
    url        TEXT NOT NULL DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_posts_side_time ON posts(side, created_at);
  CREATE INDEX IF NOT EXISTS idx_hotlines_to ON hotlines(to_name, created_at);
  CREATE INDEX IF NOT EXISTS idx_mixtapes_to ON mixtapes(to_name, sealed_at);
  CREATE INDEX IF NOT EXISTS idx_mixtapes_from ON mixtapes(from_name, sealed_at);
  CREATE INDEX IF NOT EXISTS idx_tracks_tape ON mixtape_tracks(mixtape_id, position);
`);

export type Side = 'a' | 'b';
export type Kind = 'text' | 'photo' | 'video' | 'mixtape';

export interface PostRow {
  id: string;
  side: Side;
  author: string;
  kind: Kind;
  body: string;
  media_id: string | null;
  created_at: number;
}
