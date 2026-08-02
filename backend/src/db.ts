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
  -- Eine Kassette ist eine Runde von Leuten. Man legt sie ein, um mit genau
  -- dieser Gruppe zu reden — verschiedene Freundeskreise vermischen sich nicht.
  CREATE TABLE IF NOT EXISTS cassettes (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  -- Jedes Mitglied darf weitere holen. Wer wen geholt hat, bleibt sichtbar,
  -- damit es nachvollziehbar ist.
  CREATE TABLE IF NOT EXISTS cassette_members (
    cassette_id TEXT NOT NULL REFERENCES cassettes(id) ON DELETE CASCADE,
    member      TEXT NOT NULL,
    added_by    TEXT NOT NULL,
    joined_at   INTEGER NOT NULL,
    PRIMARY KEY (cassette_id, member)
  );

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
    id          TEXT PRIMARY KEY,
    cassette_id TEXT REFERENCES cassettes(id) ON DELETE CASCADE,
    -- Seite A bleibt, Seite B wird nach 24 Stunden ueberspielt.
    expires_at  INTEGER,
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
  CREATE INDEX IF NOT EXISTS idx_members_person ON cassette_members(member);
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

/** Fehlende Spalte ergaenzen. Reine Ergaenzungen brauchen keinen Tabellenumbau. */
function addColumn(table: string, column: string, ddl: string, note: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.length === 0 || cols.some((c) => c.name === column)) return;
  console.log(`[kliqtape] Ergaenze ${table}.${column} — ${note}`);
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

addColumn('posts', 'source', 'source TEXT', 'Kamera oder Galerie');
addColumn('posts', 'cassette_id', 'cassette_id TEXT REFERENCES cassettes(id)', 'Beitrag gehoert zu einer Runde');
addColumn('posts', 'expires_at', 'expires_at INTEGER', 'Seite B wird ueberspielt');
// Optionaler Override fuer die Bandsorte: normalerweise haengt das Aussehen
// an der Kassetten-ID, damit es auf jedem Geraet gleich ist. Wer explizit ein
// anderes Muster will (oder zwei Kassetten tauschen moechte), setzt hier einen
// eigenen Schluessel statt der ID.
addColumn('cassettes', 'color_seed', 'color_seed TEXT', 'manueller Override fuer die Bandsorte');

/**
 * Bestehende Beitraege haben noch keine Kassette. Damit nichts verlorengeht,
 * bekommen sie eine Standard-Runde, in der alle bisherigen Autoren Mitglied sind.
 */
const orphans = db.prepare(`SELECT COUNT(*) AS n FROM posts WHERE cassette_id IS NULL`).get() as {
  n: number;
};

if (orphans.n > 0) {
  console.log(`[kliqtape] Ordne ${orphans.n} Beitraege einer Standard-Kassette zu`);
  db.transaction(() => {
    const id = 'default-alle-freunde';
    const authors = db.prepare(`SELECT DISTINCT author FROM posts WHERE cassette_id IS NULL`).all() as {
      author: string;
    }[];
    const first = authors[0]?.author ?? 'unbekannt';

    db.prepare(
      `INSERT OR IGNORE INTO cassettes (id, name, created_by, created_at) VALUES (?, ?, ?, ?)`,
    ).run(id, 'Alle Freunde', first, Date.now());

    const join = db.prepare(
      `INSERT OR IGNORE INTO cassette_members (cassette_id, member, added_by, joined_at) VALUES (?, ?, ?, ?)`,
    );
    for (const a of authors) join.run(id, a.author, first, Date.now());

    db.prepare(`UPDATE posts SET cassette_id = ? WHERE cassette_id IS NULL`).run(id);
    // Alte Seite-B-Beitraege bekommen rueckwirkend eine Frist ab Erstellung.
    db.prepare(
      `UPDATE posts SET expires_at = created_at + ? WHERE side = 'b' AND expires_at IS NULL`,
    ).run(24 * 60 * 60 * 1000);
  })();
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
  cassette_id: string;
  expires_at: number | null;
  side: Side;
  author: string;
  kind: Kind;
  body: string;
  media_id: string | null;
  tape_id: string | null;
  source: 'camera' | 'upload' | null;
  created_at: number;
}
