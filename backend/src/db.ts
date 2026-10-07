import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
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
    -- Aktuell ungenutzt: beide Seiten sind dauerhaft. Bleibt fuer
    -- moegliche spaetere Wiederverwendung stehen, wird von keinem Code
    -- mehr gesetzt oder gelesen.
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

  -- Hot Line: eine offene Leitung zwischen zwei Personen, dauerhaft wie
  -- Seite B. person_a/person_b liegen alphabetisch sortiert, damit "wer
  -- schreibt wem zuerst" keine zwei Leitungen fuer dasselbe Paar erzeugt.
  CREATE TABLE IF NOT EXISTS hotline_threads (
    id         TEXT PRIMARY KEY,
    person_a   TEXT NOT NULL,
    person_b   TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (person_a, person_b)
  );

  CREATE TABLE IF NOT EXISTS hotline_messages (
    id         TEXT PRIMARY KEY,
    thread_id  TEXT NOT NULL REFERENCES hotline_threads(id) ON DELETE CASCADE,
    from_name  TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    heard_at   INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_hthreads_a ON hotline_threads(person_a);
  CREATE INDEX IF NOT EXISTS idx_hthreads_b ON hotline_threads(person_b);
  CREATE INDEX IF NOT EXISTS idx_hmessages_thread ON hotline_messages(thread_id, created_at);

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

  -- Ein Tape ist ein Kalendertag seit Gruendung der Kassette (Europe/Berlin,
  -- siehe time.ts) — Gruendungstag ist Tape 1. tape_index wird nicht
  -- gespeichert, nur aus cassettes.created_at berechnet; hier liegt nur der
  -- optionale, kassettenweite Name, sparse (Zeile existiert nur wenn jemand
  -- umbenannt hat).
  CREATE TABLE IF NOT EXISTS cassette_tapes (
    cassette_id TEXT NOT NULL REFERENCES cassettes(id) ON DELETE CASCADE,
    tape_index  INTEGER NOT NULL,
    name        TEXT NOT NULL,
    named_by    TEXT NOT NULL,
    named_at    INTEGER NOT NULL,
    PRIMARY KEY (cassette_id, tape_index)
  );

  -- Favorit ist privat pro Person, anders als der Name — sonst wuerde eine
  -- Person alle anderen mit-favorisieren.
  CREATE TABLE IF NOT EXISTS cassette_tape_favorites (
    cassette_id  TEXT NOT NULL REFERENCES cassettes(id) ON DELETE CASCADE,
    tape_index   INTEGER NOT NULL,
    member       TEXT NOT NULL,
    favorited_at INTEGER NOT NULL,
    PRIMARY KEY (cassette_id, tape_index, member)
  );

  -- Minimale Identitaet: ein Token pro Name statt eines vollen Login-Systems
  -- (siehe access.ts, requireIdentity). Der Token selbst wird nie
  -- gespeichert, nur sein Hash.
  CREATE TABLE IF NOT EXISTS person_tokens (
    name       TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  -- Eine Einladung ist eine Kassetten-Mitgliedschaft, die erst gilt, wenn
  -- die eingeladene Person zustimmt — anders als frueher, wo "jemanden
  -- holen" sofort ein cassette_members-Eintrag war, ganz ohne Zustimmung
  -- der geholten Person. Kein status-Feld: die Zeile existiert nur,
  -- solange sie offen ist (routes/cassettes.ts, accept/decline loeschen sie).
  CREATE TABLE IF NOT EXISTS cassette_invites (
    id          TEXT PRIMARY KEY,
    cassette_id TEXT NOT NULL REFERENCES cassettes(id) ON DELETE CASCADE,
    invitee     TEXT NOT NULL,
    invited_by  TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    UNIQUE (cassette_id, invitee)
  );

  -- Storys: kassettenuebergreifend sichtbar fuer jeden, mit dem man in
  -- IRGENDEINER Kassette zusammen ist (routes/stories.ts, die Netzwerk-Abfrage
  -- ueber cassette_members) — anders als posts, das strikt an eine einzelne
  -- Runde gebunden ist. expires_at wird serverseitig beim Anlegen gesetzt
  -- (created_at + 24h), nie vom Client. Kein duration_ms hier: steht schon
  -- auf media.duration_ms, wird beim Lesen dazugejoint statt dupliziert.
  -- Kein Hintergrund-Job fuer den Ablauf (die App hat bewusst keinen Cron) —
  -- routes/stories.ts filtert abgelaufene Zeilen beim Lesen heraus und raeumt sie
  -- gelegentlich beim Zugriff mit auf (sweepExpiredStories).
  CREATE TABLE IF NOT EXISTS stories (
    id         TEXT PRIMARY KEY,
    author     TEXT NOT NULL,
    kind       TEXT NOT NULL,
    media_id   TEXT NOT NULL REFERENCES media(id),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  -- Der Kliqtape-Kanal: News/Insights von den Betreiber:innen, dauerhaft und
  -- fuer WIRKLICH ALLE sichtbar (keine Kassetten-Mitgliedschaft noetig,
  -- anders als posts, und auch nicht auf das eigene Netzwerk beschraenkt wie
  -- stories). Schreiben darf nur, wessen Name in ADMIN_NAME steht (siehe
  -- routes/news.ts) — author wird trotzdem gespeichert, rein zur Nachvollziehbarkeit.
  CREATE TABLE IF NOT EXISTS news_posts (
    id         TEXT PRIMARY KEY,
    author     TEXT NOT NULL,
    kind       TEXT NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    media_id   TEXT REFERENCES media(id),
    created_at INTEGER NOT NULL
  );

  -- Foerderstand des Projekts: genau ein Datensatz (id = 1), gepflegt von
  -- ADMIN_NAME im Kliqtape-Kanal. Freitext statt Cent-Betrag mit
  -- Waehrungscode — wird von Hand selten aktualisiert, da reicht ein String
  -- wie "128,40 €" voellig, ganz ohne Formatierungslogik.
  CREATE TABLE IF NOT EXISTS project_funding (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    balance    TEXT NOT NULL DEFAULT '',
    note       TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL DEFAULT 0
  );

  -- Meldungen (Kassette ODER Beitrag). Bewusst ohne Fremdschluessel: eine
  -- Meldung soll nicht verschwinden, nur weil die gemeldete Person ihren
  -- Beitrag oder die ganze Kassette loescht. Keine Moderationsoberflaeche —
  -- gespeichert und bestaetigt, gelesen wird direkt in der Datenbank.
  CREATE TABLE IF NOT EXISTS reports (
    id          TEXT PRIMARY KEY,
    cassette_id TEXT,
    post_id     TEXT,
    reported_by TEXT NOT NULL,
    reason      TEXT NOT NULL,
    note        TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL,
    CHECK ((cassette_id IS NULL) <> (post_id IS NULL))
  );

  -- Imposter-Woche (routes/imposter.ts): alle bekommen dieselbe Aufgabe, eine Person
  -- nur einen vagen Hinweis. task_key zeigt in IMPOSTER_TASKS (routes/imposter.ts),
  -- damit Aufgabe und Hinweis nicht in jeder Zeile dupliziert werden.
  CREATE TABLE IF NOT EXISTS imposter_weeks (
    id          TEXT PRIMARY KEY,
    cassette_id TEXT NOT NULL REFERENCES cassettes(id) ON DELETE CASCADE,
    task_key    TEXT NOT NULL,
    imposter    TEXT NOT NULL,
    started_by  TEXT NOT NULL,
    started_at  INTEGER NOT NULL,
    reveal_at   INTEGER NOT NULL,
    revealed_at INTEGER
  );

  -- Ein Beitrag pro Person und Woche. Der Beitrag selbst ist ein normaler
  -- Seite-A-Post mit develop_at = reveal_at (verborgen bis Sonntagabend).
  CREATE TABLE IF NOT EXISTS imposter_entries (
    week_id TEXT NOT NULL REFERENCES imposter_weeks(id) ON DELETE CASCADE,
    author  TEXT NOT NULL,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    PRIMARY KEY (week_id, author)
  );

  -- Tipps, wer der Imposter war. Werden nie gezaehlt ausgeliefert — nur
  -- das Ergebnis "richtig/daneben" nach der Aufloesung.
  CREATE TABLE IF NOT EXISTS imposter_votes (
    week_id    TEXT NOT NULL REFERENCES imposter_weeks(id) ON DELETE CASCADE,
    voter      TEXT NOT NULL,
    suspect    TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (week_id, voter)
  );

  -- Einladung als Brief: ein Token im QR-Code, einmal gueltig, mit Ablauf,
  -- nur fuer genau diese Kassette. Gespeichert wird nur der Hash — der
  -- Klartext steht ausschliesslich auf dem gedruckten Brief. Einloesen
  -- erzeugt eine normale cassette_invites-Zeile, zugestimmt wird wie immer.
  CREATE TABLE IF NOT EXISTS invite_letters (
    id          TEXT PRIMARY KEY,
    cassette_id TEXT NOT NULL REFERENCES cassettes(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    created_by  TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL,
    used_by     TEXT,
    used_at     INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_imposter_cassette ON imposter_weeks(cassette_id, started_at);
  CREATE INDEX IF NOT EXISTS idx_posts_side_time ON posts(side, created_at);
  CREATE INDEX IF NOT EXISTS idx_members_person ON cassette_members(member);
  CREATE INDEX IF NOT EXISTS idx_mixtapes_to ON mixtapes(to_name, sealed_at);
  CREATE INDEX IF NOT EXISTS idx_mixtapes_from ON mixtapes(from_name, sealed_at);
  CREATE INDEX IF NOT EXISTS idx_tracks_tape ON mixtape_tracks(mixtape_id, position);
  CREATE INDEX IF NOT EXISTS idx_tape_favorites_member ON cassette_tape_favorites(cassette_id, member);
  CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);
  CREATE INDEX IF NOT EXISTS idx_stories_author_time ON stories(author, created_at);
  CREATE INDEX IF NOT EXISTS idx_invites_invitee ON cassette_invites(invitee, created_at);
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
      { sql: string } | undefined
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

/**
 * Alte hotlines-Tabelle (Einzelnachricht, eigene Frist pro Nachricht) auf
 * echte Leitungen migrieren: je Personenpaar EIN Thread, Frist ab der
 * fruehesten Nachricht der beiden. Danach wird die alte Tabelle verworfen —
 * ihr Nachfolger deckt denselben Zweck vollstaendig ab.
 */
if (db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='hotlines'`).get()) {
  console.log('[kliqtape] Migriere hotlines zu hotline_threads/hotline_messages');
  db.transaction(() => {
    const rows = db.prepare(`SELECT * FROM hotlines ORDER BY created_at ASC`).all() as {
      id: string;
      from_name: string;
      to_name: string;
      body: string;
      created_at: number;
      heard_at: number | null;
    }[];

    const threadFor = new Map<string, string>();
    const findThread = db.prepare(`SELECT id FROM hotline_threads WHERE person_a = ? AND person_b = ?`);
    const insertThread = db.prepare(
      `INSERT INTO hotline_threads (id, person_a, person_b, created_at) VALUES (?, ?, ?, ?)`,
    );
    const insertMessage = db.prepare(
      `INSERT INTO hotline_messages (id, thread_id, from_name, body, created_at, heard_at) VALUES (?, ?, ?, ?, ?, ?)`,
    );

    for (const r of rows) {
      const [a, b] = [r.from_name, r.to_name].sort();
      const key = `${a} ${b}`;
      let threadId = threadFor.get(key);
      if (!threadId) {
        const existing = findThread.get(a, b) as { id: string } | undefined;
        threadId = existing?.id ?? randomUUID();
        threadFor.set(key, threadId);
        if (!existing) {
          insertThread.run(threadId, a, b, r.created_at);
        }
      }
      insertMessage.run(randomUUID(), threadId, r.from_name, r.body, r.created_at, r.heard_at);
    }

    db.exec(`DROP TABLE hotlines`);
  })();
}

/**
 * Installationen, die schon mit dem ersten Leitungs-Modell liefen, haben
 * hotline_threads.expires_at — eine feste Frist ab der ersten Nachricht.
 * Das rollierende Fenster braucht dieses Feld nicht mehr: die Leitung lebt,
 * solange sie eine Nachricht unter 24h hat, berechnet aus den Nachrichten
 * selbst statt aus einem gespeicherten Wert. Spalte raus, Rest bleibt.
 */
const threadCols = db.prepare(`PRAGMA table_info(hotline_threads)`).all() as { name: string }[];

if (threadCols.some((c) => c.name === 'expires_at')) {
  console.log('[kliqtape] Migriere hotline_threads: expires_at faellt weg (rollierendes Fenster)');
  db.pragma('foreign_keys = OFF');
  db.pragma('legacy_alter_table = ON');
  db.transaction(() => {
    db.exec(`
      ALTER TABLE hotline_threads RENAME TO hotline_threads_old;

      CREATE TABLE hotline_threads (
        id         TEXT PRIMARY KEY,
        person_a   TEXT NOT NULL,
        person_b   TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE (person_a, person_b)
      );

      INSERT INTO hotline_threads (id, person_a, person_b, created_at)
        SELECT id, person_a, person_b, created_at FROM hotline_threads_old;

      DROP TABLE hotline_threads_old;

      CREATE INDEX IF NOT EXISTS idx_hthreads_a ON hotline_threads(person_a);
      CREATE INDEX IF NOT EXISTS idx_hthreads_b ON hotline_threads(person_b);
    `);
  })();
  db.pragma('legacy_alter_table = OFF');
  db.pragma('foreign_keys = ON');
}

/** Fehlende Spalte ergaenzen. Reine Ergaenzungen brauchen keinen Tabellenumbau. */
function addColumn(table: string, column: string, ddl: string, note: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.length === 0 || cols.some((c) => c.name === column)) return;
  console.log(`[kliqtape] Ergaenze ${table}.${column} — ${note}`);
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

addColumn('posts', 'source', 'source TEXT', 'Kamera oder Galerie');
addColumn('posts', 'cassette_id', 'cassette_id TEXT REFERENCES cassettes(id)', 'Beitrag gehoert zu einer Runde');
addColumn('posts', 'expires_at', 'expires_at INTEGER', 'aktuell ungenutzt, fuer spaetere Wiederverwendung verfuegbar');
// Optionaler Override fuer die Bandsorte: normalerweise haengt das Aussehen
// an der Kassetten-ID, damit es auf jedem Geraet gleich ist. Wer explizit ein
// anderes Muster will (oder zwei Kassetten tauschen moechte), setzt hier einen
// eigenen Schluessel statt der ID.
addColumn('cassettes', 'color_seed', 'color_seed TEXT', 'manueller Override fuer die Bandsorte');
// Tonfetzen: eine kurze Sprachreaktion statt eines oeffentlichen Zaehlers.
// Alte Reaktionen ohne media_id sind Karteileichen aus der "da war ich"-Zeit
// davor und werden ueberall herausgefiltert, statt sie zu migrieren.
addColumn('reactions', 'media_id', 'media_id TEXT REFERENCES media(id)', 'Tonfetzen — kurze Sprachreaktion');
// Optik des Zettels: wie er "befestigt" ist. Null (alte Zettel) faellt beim
// Rendern auf 'tape' zurueck, kein Backfill noetig.
addColumn('posts', 'note_style', 'note_style TEXT', 'Zettel-Optik (Tesa, Pin, Tacker, Klammer, Eselsohr)');
// Direkte, feste Wahl einer der 6 Bandsorten (0-5) beim Anlegen — anders als
// color_seed (ein Hash-Eingabewert fuers automatische Kollisions-Vermeiden)
// zeigt das IMMER genau diese Sorte, ohne Zufall. Null = weiterhin automatisch
// per Hash zugewiesen.
addColumn('cassettes', 'color_index', 'color_index INTEGER', 'fest gewaehlte Bandsorte (0-5), unabhaengig vom Hash');
// Hot Line konnte bisher nur Text — jetzt dieselben Beitragsarten wie posts,
// damit der Anhang-Knopf im Chat auf beiden Seiten (Leitung/Gruppe) gleich
// funktioniert. 'text' als Default haelt alte Nachrichten gueltig.
addColumn('hotline_messages', 'kind', "kind TEXT NOT NULL DEFAULT 'text'", 'Nachrichtenart wie bei posts');
addColumn('hotline_messages', 'media_id', 'media_id TEXT REFERENCES media(id)', 'Foto/Video/O-Ton');
addColumn('hotline_messages', 'tape_id', 'tape_id TEXT REFERENCES mixtapes(id)', 'geteiltes Mixtape');
addColumn('hotline_messages', 'source', 'source TEXT', 'Kamera oder Galerie, wie bei posts');
// Bruecke von Seite A zu Seite B: eine Chat-Nachricht kann sich auf einen
// Archiv-Beitrag beziehen ("dazu schreiben"), ohne die beiden Seiten zu
// vermischen — die Referenz ist rein optional und aendert nichts an dem,
// worauf sie zeigt. NULL bei allen bisherigen Nachrichten (kein Backfill noetig).
addColumn(
  'posts',
  'quoted_post_id',
  'quoted_post_id TEXT REFERENCES posts(id)',
  'Bezug auf einen Seite-A-Beitrag aus einer Seite-B-Nachricht',
);
// Entwickelter Film (routes/film.ts): bis develop_at ist
// der Beitrag fuer NIEMANDEN sichtbar und sein Bild wird nicht ausgeliefert.
// created_at = develop_at, damit er nach der Freigabe im Tape des Sonntags
// steht; taken_at haelt fest, wann wirklich belichtet wurde.
addColumn('posts', 'develop_at', 'develop_at INTEGER', 'Film: ab wann der Beitrag sichtbar ist');
addColumn('posts', 'taken_at', 'taken_at INTEGER', 'Film: wann belichtet wurde');

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

    db.prepare(`INSERT OR IGNORE INTO cassettes (id, name, created_by, created_at) VALUES (?, ?, ?, ?)`).run(
      id,
      'Alle Freunde',
      first,
      Date.now(),
    );

    const join = db.prepare(
      `INSERT OR IGNORE INTO cassette_members (cassette_id, member, added_by, joined_at) VALUES (?, ?, ?, ?)`,
    );
    for (const a of authors) join.run(id, a.author, first, Date.now());

    db.prepare(`UPDATE posts SET cassette_id = ? WHERE cassette_id IS NULL`).run(id);
  })();
}

/**
 * Seite B ist kein Story-Format mehr, sondern ein dauerhafter Gruppenchat —
 * bestehende Seite-B-Beitraege mit einer noch offenen Frist wuerden sonst
 * kurz nach diesem Update ueberspielt, obwohl das nicht mehr Sinn der Sache
 * ist. Danach setzt routes/posts.ts fuer neue Seite-B-Beitraege gar kein
 * expires_at mehr — dieser Block ist von Natur aus einmalig wirksam.
 */
const pendingSideB = db
  .prepare(`SELECT COUNT(*) AS n FROM posts WHERE side = 'b' AND expires_at IS NOT NULL`)
  .get() as { n: number };

if (pendingSideB.n > 0) {
  console.log(`[kliqtape] Seite B wird dauerhaft — ${pendingSideB.n} Beitraege verlieren ihre Frist`);
  db.prepare(`UPDATE posts SET expires_at = NULL WHERE side = 'b' AND expires_at IS NOT NULL`).run();
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

addColumn(
  'cassette_tape_favorites',
  'label',
  'label TEXT',
  'eigene Beschriftung im persoenlichen Regal (Profil) — sieht nur diese Person',
);
addColumn('profiles', 'album_opt_out', 'album_opt_out INTEGER NOT NULL DEFAULT 0', 'Meine Beiträge nicht in Alben');

/**
 * Die EINZIGE Quelle fuer den Album-Export (src/album/). Enthaelt nur
 * freigegebene Seite-A-Beitraege und nichts von Leuten, die ihre Beitraege
 * aus Alben ausgenommen haben. Seite B und Hot Line sind hier technisch
 * nicht erreichbar — das Album-Modul bekommt keinen anderen Zugang zur
 * Datenbank (siehe AlbumSource in routes/album.ts und die Lint-Regel in
 * eslint.config.js). Bei jedem Start neu angelegt, damit Aenderungen an der
 * Definition ohne Migration greifen.
 */
db.exec(`
  DROP VIEW IF EXISTS album_posts;
  CREATE VIEW album_posts AS
    SELECT p.id, p.cassette_id, p.author, p.kind, p.body, p.media_id, p.tape_id,
           p.source, p.taken_at, p.created_at
      FROM posts p
     WHERE p.side = 'a'
       AND (p.develop_at IS NULL OR p.develop_at <= CAST(strftime('%s', 'now') AS INTEGER) * 1000)
       AND p.author NOT IN (SELECT name FROM profiles WHERE album_opt_out = 1);
`);

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
  source: 'camera' | 'upload' | 'film' | 'imposter' | null;
  note_style: string | null;
  quoted_post_id: string | null;
  develop_at: number | null;
  taken_at: number | null;
  created_at: number;
}

export type StoryKind = 'photo' | 'video';

export interface StoryRow {
  id: string;
  author: string;
  kind: StoryKind;
  media_id: string;
  created_at: number;
  expires_at: number;
}

export type NewsKind = 'text' | 'photo' | 'video';

export interface NewsPostRow {
  id: string;
  author: string;
  kind: NewsKind;
  body: string;
  media_id: string | null;
  created_at: number;
}

export interface ProjectFundingRow {
  id: 1;
  balance: string;
  note: string;
  updated_at: number;
}
