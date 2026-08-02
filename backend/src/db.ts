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

  -- Kein CHECK auf kind: die Pruefung sitzt im Server, wo die Fehlermeldung
  -- lesbar ist. Ein CHECK haette bei jeder neuen Beitragsart einen kompletten
  -- Tabellenumbau erzwungen.
  CREATE TABLE IF NOT EXISTS posts (
    id         TEXT PRIMARY KEY,
    side       TEXT NOT NULL CHECK (side IN ('a','b')),
    author     TEXT NOT NULL,
    kind       TEXT NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    media_id   TEXT REFERENCES media(id),
    tape_id    TEXT REFERENCES mixtapes(id),
    -- 'camera' oder 'upload'. Live aufgenommene Bilder werden anders dargestellt
    -- als hochgeladene — kein Verbot, aber ein sichtbarer Unterschied.
    source     TEXT,
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
    post_id    TEXT REFERENCES posts(id) ON DELETE CASCADE,
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

/* ---------------------------------------------------------------------------
 * Migration
 *
 * Aeltere Datenbanken haben posts noch ohne tape_id und mit einem CHECK auf
 * kind. SQLite kann weder Spalten-CHECKs entfernen noch Fremdschluessel
 * nachtraeglich hinzufuegen — also wird die Tabelle einmal neu gebaut und der
 * Inhalt uebernommen. Fremdschluessel muessen dafuer kurz aus, sonst wuerde
 * hotlines beim Umbenennen mitwandern.
 * ------------------------------------------------------------------------ */
const postCols = db.prepare(`PRAGMA table_info(posts)`).all() as { name: string }[];

if (postCols.length > 0 && !postCols.some((c) => c.name === 'tape_id')) {
  console.log('[kliqtape] Migriere posts: tape_id ergaenzen, CHECK auf kind entfernen');
  db.pragma('foreign_keys = OFF');
  // legacy_alter_table = ON ist hier zwingend: sonst zieht SQLite beim RENAME
  // die Fremdschluessel ANDERER Tabellen mit um. hotlines zeigte danach auf
  // posts_old — und die wird gleich geloescht.
  db.pragma('legacy_alter_table = ON');
  db.transaction(() => {
    db.exec(`
      ALTER TABLE posts RENAME TO posts_old;

      CREATE TABLE posts (
        id         TEXT PRIMARY KEY,
        side       TEXT NOT NULL CHECK (side IN ('a','b')),
        author     TEXT NOT NULL,
        kind       TEXT NOT NULL,
        body       TEXT NOT NULL DEFAULT '',
        media_id   TEXT REFERENCES media(id),
        tape_id    TEXT REFERENCES mixtapes(id),
        created_at INTEGER NOT NULL
      );

      INSERT INTO posts (id, side, author, kind, body, media_id, created_at)
        SELECT id, side, author, kind, body, media_id, created_at FROM posts_old;

      DROP TABLE posts_old;

      CREATE INDEX IF NOT EXISTS idx_posts_side_time ON posts(side, created_at);
    `);

    // Sprachaufnahmen hiessen frueher 'mixtape'. Der Name wird jetzt fuer
    // Musik-Tapes gebraucht, die Aufnahme heisst 'voice'.
    db.prepare(`UPDATE posts SET kind = 'voice' WHERE kind = 'mixtape'`).run();
  })();
  db.pragma('legacy_alter_table = OFF');
  db.pragma('foreign_keys = ON');
}

/**
 * Reparatur fuer Datenbanken, die die fehlerhafte Migration schon mitgemacht
 * haben. Dort zeigen ALLE Tabellen, die posts referenzieren, auf die geloeschte
 * posts_old — jeder Zugriff schlaegt mit "no such table" fehl.
 * Betroffen sind hotlines und reactions.
 */
function repairReference(table: string, ddl: string, indexDdl = ''): void {
  const sql = (
    db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name = ?`).get(table) as
      | { sql: string }
      | undefined
  )?.sql;
  if (!sql?.includes('posts_old')) return;

  console.log(`[kliqtape] Repariere ${table}: Fremdschluessel zeigt auf posts_old`);
  db.pragma('foreign_keys = OFF');
  db.pragma('legacy_alter_table = ON');
  db.transaction(() => {
    db.exec(`ALTER TABLE ${table} RENAME TO ${table}_broken;`);
    db.exec(ddl);
    // Nur Zeilen uebernehmen, deren Beitrag es noch gibt.
    db.exec(`
      INSERT INTO ${table}
        SELECT b.* FROM ${table}_broken b
         WHERE EXISTS (SELECT 1 FROM posts p WHERE p.id = b.post_id);
    `);
    db.exec(`DROP TABLE ${table}_broken;`);
    if (indexDdl) db.exec(indexDdl);
  })();
  db.pragma('legacy_alter_table = OFF');
  db.pragma('foreign_keys = ON');
}

repairReference(
  'hotlines',
  `CREATE TABLE hotlines (
     id         TEXT PRIMARY KEY,
     post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
     from_name  TEXT NOT NULL,
     to_name    TEXT NOT NULL,
     body       TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL,
     heard_at   INTEGER
   );`,
  `CREATE INDEX IF NOT EXISTS idx_hotlines_to ON hotlines(to_name, created_at);`,
);

// Reine Spaltenergaenzung — kein Tabellenumbau noetig, weil kein Fremdschluessel
// betroffen ist. Bestehende Beitraege haben NULL und gelten als Kamera-Aufnahme.
if (
  db.prepare(`PRAGMA table_info(posts)`).all().length > 0 &&
  !(db.prepare(`PRAGMA table_info(posts)`).all() as { name: string }[]).some((c) => c.name === 'source')
) {
  console.log('[kliqtape] Ergaenze posts.source (Kamera oder Galerie)');
  db.exec(`ALTER TABLE posts ADD COLUMN source TEXT`);
}

/**
 * Hot Line haengt nicht mehr zwingend an einem Beitrag: der Knopf sitzt jetzt
 * in der unteren Leiste, man waehlt direkt eine Person. Ein Beitragsbezug
 * bleibt moeglich, ist aber optional.
 */
const hotlineCols = db.prepare(`PRAGMA table_info(hotlines)`).all() as {
  name: string;
  notnull: number;
}[];

if (hotlineCols.some((c) => c.name === 'post_id' && c.notnull === 1)) {
  console.log('[kliqtape] Migriere hotlines: post_id wird optional');
  db.pragma('foreign_keys = OFF');
  db.pragma('legacy_alter_table = ON');
  db.transaction(() => {
    db.exec(`
      ALTER TABLE hotlines RENAME TO hotlines_old;

      CREATE TABLE hotlines (
        id         TEXT PRIMARY KEY,
        post_id    TEXT REFERENCES posts(id) ON DELETE CASCADE,
        from_name  TEXT NOT NULL,
        to_name    TEXT NOT NULL,
        body       TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        heard_at   INTEGER
      );

      INSERT INTO hotlines SELECT * FROM hotlines_old;
      DROP TABLE hotlines_old;

      CREATE INDEX IF NOT EXISTS idx_hotlines_to ON hotlines(to_name, created_at);
    `);
  })();
  db.pragma('legacy_alter_table = OFF');
  db.pragma('foreign_keys = ON');
}

repairReference(
  'reactions',
  `CREATE TABLE reactions (
     post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
     author     TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     PRIMARY KEY (post_id, author)
   );`,
);

export type Side = 'a' | 'b';
export type Kind = 'text' | 'photo' | 'video' | 'voice' | 'tape';

export interface PostRow {
  id: string;
  side: Side;
  author: string;
  kind: Kind;
  body: string;
  media_id: string | null;
  tape_id: string | null;
  source: 'camera' | 'upload' | null;
  created_at: number;
}
