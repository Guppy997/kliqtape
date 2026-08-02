/**
 * Manuell gepflegt, synchron zur Version in package.json.
 * Bewusst kein CI, bewusst kein automatisches Versionieren.
 */
export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.4.0',
    date: '2026-08-02',
    changes: [
      'Mixtape-Cover darf aus der Galerie kommen — ein Tape ist gemacht, nicht spontan',
      'Bilder im Feed auch aus der Galerie, aber sichtbar anders als Live-Aufnahmen',
      'Live bleibt der Fotoabzug mit Filzstift, Galerie bekommt einen schlichten Rahmen',
      'Galerie funktioniert auch, wenn die Kamera nicht freigegeben ist',
      'Zurück zu Die Crew und Die Kliqe',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-08-02',
    changes: [
      'Hotline sitzt jetzt unten neben dem REC-Knopf, in Walkman-Gelb',
      'Hotline geht direkt an eine Person, ein Beitragsbezug ist nicht mehr nötig',
      'Testdaten-Skript: fünf Leute, Bilder, O-Töne, Mixtapes, Reaktionen, Hotlines',
    ],
  },
  {
    version: '0.2.1',
    date: '2026-08-02',
    changes: [
      'Blätter waren durchsichtig — durch das Portal fehlten ihnen die Seitenfarben',
      'Profil, Aufnahme und Regal decken jetzt komplett ab, in der Farbe der aktuellen Seite',
      'Profil: „Was der Server sieht" — eine ehrliche Tabelle statt eines Versprechens',
      'Datenexport als JSON und vollständiges Löschen vom Server',
      'Startseite wählbar: A oder B beim Öffnen',
      'Datenbank repariert: Reaktionen und Hotlines zeigten nach der letzten Migration ins Leere',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-08-02',
    changes: [
      'Mixtapes lassen sich jetzt auch mit der ganzen Seite teilen, nicht nur verschenken',
      'Neue Namen: O-Ton, Schnappschuss, Clip, Zettel',
      'Hotline ist eine leuchtende Walkman-Taste mit Beschriftung darüber',
      'Profil öffnet als eigene Seite statt als halbes Blatt',
      'Aufnahmen laufen bildschirmfüllend, der Hintergrund scheint nicht mehr durch',
    ],
  },
  {
    version: '0.1.1',
    date: '2026-08-02',
    changes: [
      'Blätter ließen sich nicht mehr schließen — der Header lag über dem Knopf',
      'Seitenwechsel jetzt durch Tippen auf die Kassette, sie dreht sich dabei um',
      'Die Schaltflächen Seite A / Seite B sind weggefallen',
      'Regal und Profil sitzen nebeneinander über dem Feed',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-08-02',
    changes: [
      'Mixtapes — ein echtes Tape für genau eine Person bauen, bis zu 12 Titel',
      'Cover per Kamera, handgeschriebene Widmung, Titel mit Link zu jedem Musikdienst',
      'Versiegeln: der Empfänger sieht nichts, solange du daran baust',
      'Regal für empfangene, laufende und verschenkte Tapes',
      'Seiten heißen jetzt The Crew und The Kliqe',
      'Wortmarke sitzt auf dem Kassettenrücken',
    ],
  },
  {
    version: '0.0.4',
    date: '2026-08-02',
    changes: [
      'Hot Line — direkte private Antwort auf einen Beitrag, verfällt nach 24 Stunden',
      'Anrufbeantworter unten links, mit blinkender LED bei neuen Hot Lines',
      'Bewusst ohne Verlauf: ein Anruf passiert und ist dann vorbei',
    ],
  },
  {
    version: '0.0.3',
    date: '2026-08-02',
    changes: [
      'Update-Banner: neue Versionen hingen vorher unsichtbar fest',
      'Laufwerkstasten — an den Bandanfang, ans Bandende, Walkman-Wiedergabe',
      'Walkman: alle Mixtapes einer Seite laufen am Stück durch',
      'Jedes Blatt hat jetzt einen sichtbaren Schließen-Knopf',
      'Versionsverlauf sitzt im Profil statt unten links',
    ],
  },
  {
    version: '0.0.2',
    date: '2026-08-02',
    changes: [
      'Ein REC-Knopf statt vier Schaltflächen — was aufs Band kommt, wählt man danach',
      'Profil mit Bild, ebenfalls nur per Kamera aufgenommen',
      'Einstellungen: Name ändern, Profilbild, Gerät zurücksetzen',
      'Versionsverlauf unten links',
      'Wortmarke KLIQ/tape aus dem Designentwurf übernommen',
      'Seite A heißt jetzt „Die Crew" statt „Die Runde"',
    ],
  },
  {
    version: '0.0.1',
    date: '2026-08-01',
    changes: [
      'Erster Gefühls-Prototyp',
      'Kassetten-Header mit Seite A / Seite B, Spulen laufen beim Scrollen mit',
      'Mixtape: 90 Sekunden Aufnahme, Zurückspulen mit Bandquietschen',
      'Kamera-Zwang: Fotos und Videos nur live, kein Upload aus der Galerie',
      'Reaktionen als Gesichter statt Zahlen, Track-Nummern statt Zeitstempel',
    ],
  },
];

export const VERSION = CHANGELOG[0]!.version;
