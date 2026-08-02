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
