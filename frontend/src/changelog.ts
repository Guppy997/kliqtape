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
    version: '0.6.1',
    date: '2026-08-03',
    changes: [
      'Filter gibt es jetzt auch auf Seite B, nicht nur im Archiv',
      'Filter setzt sich beim Seiten- oder Kassettenwechsel automatisch zurück',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-08-03',
    changes: [
      'Hot Line ist jetzt ein echter Verlauf — der Normalfall, nicht die Ausnahme',
      'Die 24-Stunden-Frist läuft ab der ersten Nachricht, Antworten verlängern sie nicht',
      'Anrufbeantworter zeigt offene Leitungen, antippen öffnet den Verlauf',
      'Der Hot-Line-Knopf zeigt zuerst „Weiterschreiben", dann neue Leitungen',
      '„Hot Line" wird jetzt überall auseinandergeschrieben',
      'REC-Auswahl kommt als kleiner Kranz aus Feldern um den Knopf, keine eigene Seite mehr',
    ],
  },
  {
    version: '0.5.3',
    date: '2026-08-02',
    changes: [
      'Filter sitzt jetzt oben in der Zeile bei Eject, Regal und Profil',
      'Filter klappt als kleines Fenster darunter auf, statt den Bildschirm zu wechseln',
      'Die Kliqe ist jetzt lila (Atomic Purple), Alle Freunde tauscht dafür die Farbe',
      'Jede Kassette hat einen optionalen Farb-Override statt der reinen ID',
      'Seite A färbt den Hintergrund jetzt auch leicht in Richtung der Bandsorte',
    ],
  },
  {
    version: '0.5.2',
    date: '2026-08-02',
    changes: [
      'Seite A und Seite B gehören farblich zusammen — sechs feste Paare',
      'Echtes Kassetten-Etikett: Farbband oben, Beschriftungsfeld mit Linien',
      'Der Name der Runde steht handgeschrieben auf der Linie',
      'Geripptes Gehäuse mit Schrauben und Sichtfenster für die Spulen',
      'Im Regal sehen nie zwei Bänder gleich aus',
    ],
  },
  {
    version: '0.5.1',
    date: '2026-08-02',
    changes: [
      'Jedes Band sieht anders aus: Bandsorte, Gehäusefarbe, Kratzer und Staub',
      'Der Name steht auf einem schief aufgeklebten Etikett',
      'Die Farbe der eingelegten Kassette färbt die ganze App ein',
      'Filter ist ein kleiner Knopf mit Auswahl statt einer Reihe Schalter',
      'Auch die Miniaturbänder im Fach zeigen ihre echte Sorte',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-08-02',
    changes: [
      'Kassetten sind jetzt Runden von Leuten — mehrere Freundeskreise nebeneinander',
      'Kassettenfach zum Wechseln, Leute dazuholen, Band umbenennen oder verlassen',
      'Seite A ist das Archiv der Runde und lässt sich nach Art filtern',
      'Seite B wird nach 24 Stunden überspielt, samt Bildern und Aufnahmen',
      'Bestehende Beiträge sind in eine Kassette „Alle Freunde" gewandert',
    ],
  },
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
