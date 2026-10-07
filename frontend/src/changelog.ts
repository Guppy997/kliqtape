/**
 * Manuell gepflegt, synchron zur Version in beiden package.json.
 * CI (.github/workflows/ci.yml) prueft Typen, Lint, Tests und Build —
 * versioniert wird trotzdem bewusst von Hand, nicht automatisch.
 */
export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.45.0',
    date: '2026-10-07',
    changes: [
      'Neue Titelzeile oben: Plus zum Aufnehmen links, Kliqtape in der Mitte, die Glocke für Neues rechts',
      'Darunter eine schmale Zeile mit der eingelegten Kassette, ihrem Namen und der Seite — die Lupe sitzt rechts daneben',
      'Untere Leiste deutlich schlanker: Fach, Band, Hot Line und neu Profil',
      'Neu: Profil als eigene Sammlung, nur für dich sichtbar — mit Regal, Mixtapes und den Einstellungen hinter dem Zahnrad',
      'Mixtapes lassen sich wieder bauen und verschenken (im Profil unter Mixtapes)',
    ],
  },
  {
    version: '0.44.4',
    date: '2026-10-07',
    changes: [
      'Die kleine Kassette oben links wird beim Aufklappen selbst größer, statt dass darunter eine zweite erscheint — ein Tipp daneben klappt sie wieder ein',
    ],
  },
  {
    version: '0.44.3',
    date: '2026-10-07',
    changes: [
      'Reagieren auf Beiträge mit zwei schlichten Zeichen statt Knöpfen mit Text: Mikrofon für einen Tonfetzen (gedrückt halten), Sprechblase fürs Eingehen im Gruppenchat',
    ],
  },
  {
    version: '0.44.2',
    date: '2026-10-07',
    changes: [
      'Obere Leiste wieder einzeilig: Suche und Filter klappen erst über die Lupe auf — die Lupe leuchtet, solange etwas ausgeblendet ist',
      'Suchfeld ohne eckigen Rahmen beim Tippen',
    ],
  },
  {
    version: '0.44.1',
    date: '2026-10-07',
    changes: [
      'Beiträge wieder als Karten mit Art, Track und Datum — Tonfetzen und Reagieren wieder als Knöpfe mit Text',
      'Die Kassette klappt jetzt aus dem kleinen Symbol oben links auf und bleibt handlich, statt fast den halben Bildschirm zu füllen',
    ],
  },
  {
    version: '0.44.0',
    date: '2026-10-07',
    changes: [
      'Aufgeräumteres Design: eine klare Schrift für die Bedienung, Handschrift nur noch auf Etiketten, Abzügen und Zetteln, keine Großbuchstaben-Beschriftungen mehr',
      'Beiträge liegen ohne Rahmen auf der Fläche; Melden und Löschen stecken im „…“-Menü, Tonfetzen und Reagieren sind kleine Symbole',
      'Oben nur noch dein Profilbild und das Regal-Symbol; darunter eine Suche durch die Beiträge der eingelegten Seite und der Filter',
      'Untere Leiste mit kurzen Namen: Fach, Band, Hot Line, Neues',
      'Gruppenchat: Nachrichten beginnen unten am Eingabefeld statt unter der Kassette zu verschwinden; die Zeichenzahl erscheint erst kurz vor der Grenze',
      'Alles gut lesbar (mindestens 11 Punkt) und kleine Knöpfe mit großer Tippfläche',
    ],
  },
  {
    version: '0.43.1',
    date: '2026-10-07',
    changes: [
      'Die ausgeklappte Kassette ist kleiner — auf dem Handy nahm sie vorher fast die Hälfte des Bildschirms ein',
    ],
  },
  {
    version: '0.43.0',
    date: '2026-10-06',
    changes: [
      'Neu: Mixtape als Bild speichern — eine Karte wie die Einlegekarte einer Kassette, mit Cover, Titel, Titelliste und Widmung',
      'Auf dem Handy über das Teilen-Menü direkt in die Galerie, sonst als PNG',
    ],
  },
  {
    version: '0.42.0',
    date: '2026-10-06',
    changes: [
      'Neu: Kassetten altern. Alle 10 Tage seit dem Anlegen etwas mehr Gebrauchsspuren — vergilbtes Etikett, Eselsohr, abgegriffene Kanten, Bandkorn',
      'Die Kassetten-Ansicht zeigt, wie das eigene Band mit der Zeit aussehen wird',
    ],
  },
  {
    version: '0.41.0',
    date: '2026-10-06',
    changes: [
      'Neu: Einladung als Brief — ein druckbares Blatt mit QR-Code, zu finden in der Kassetten-Ansicht',
      'Der Code im Brief gilt einmal, 14 Tage lang und nur für diese eine Kassette',
      'Wer ihn scannt, wählt einen Namen und stimmt der Einladung wie gewohnt zu',
    ],
  },
  {
    version: '0.40.0',
    date: '2026-10-06',
    changes: [
      'Neu: Album als PDF. In der Kassetten-Ansicht Tapes von Seite A auswählen und als druckbares Album speichern',
      'Neu im Profil: "Meine Beiträge nicht in Alben" — dann fehlen deine Beiträge in jedem Album, das jemand exportiert',
      'Seite B und Hot Line kommen nie in ein Album: der Export-Code hat technisch keinen Zugriff darauf',
    ],
  },
  {
    version: '0.39.0',
    date: '2026-10-06',
    changes: [
      'Neu: Imposter-Woche, ein Special ab vier Leuten. Alle bekommen dieselbe Aufgabe, eine Person nur einen vagen Hinweis',
      'Bis Sonntagabend bleiben alle Beiträge verborgen, dann tippt die Runde, wer es war — Auflösung mit Stempel, ohne Punkte und ohne Stimmenzahlen',
      'Gestartet wird in der Kassetten-Ansicht unter "Special", höchstens alle vier Wochen',
    ],
  },
  {
    version: '0.38.0',
    date: '2026-10-06',
    changes: [
      'Neu: Entwickelter Film. Pro Woche und Kassette ein Bild, nur mit der Kamera — es wird entwickelt und erst Sonntag um 19 Uhr für alle gleichzeitig sichtbar, auch für dich selbst erst dann',
      'Sonntagabend liegt auf Seite A eine Fototüte: öffnen, Abzüge einzeln durchblättern, danach liegen sie im Tape vom Sonntag',
      'Filmbilder tragen den orangen Datumsaufdruck einer Einwegkamera',
    ],
  },
  {
    version: '0.37.1',
    date: '2026-10-06',
    changes: [
      'Knöpfe zeigen ihre Beschriftung jetzt in der vorgesehenen Größe — eine alte Stilregel ließ seit Version 0.1 jeden Knopf die Schriftgröße seiner Umgebung erben',
    ],
  },
  {
    version: '0.37.0',
    date: '2026-10-06',
    changes: [
      'Storys als Raster: quadratische Bilder, drei pro Reihe, statt runder Profilbilder in einer Zeile — das Bild ist der Inhalt',
      'Oben links steht immer das Feld mit Plus für die eigene Story',
    ],
  },
  {
    version: '0.36.0',
    date: '2026-10-06',
    changes: [
      'Ohne Kassette gibt es jetzt einen richtigen Anfang: leere Kassettenhülle, drei Schritte (Beschriften, Einladen, Aufnehmen) und ein Knopf, der direkt ins Beschriften führt',
      'Offene Einladungen stehen dort gleich mit dabei',
      'Ein leeres Band erklärt Seite A und bietet "lad jemanden ein" an, solange man allein ist',
      'Die graue "Kein Band"-Kassette verdeckt den Anfang nicht mehr',
    ],
  },
  {
    version: '0.35.1',
    date: '2026-10-06',
    changes: [
      'Tape-Namen ändert man jetzt über das Stift-Symbol daneben — Antippen des Namens beim Scrollen startete vorher versehentlich das Umbenennen',
      'Escape bricht das Umbenennen ab, statt den halben Entwurf doch zu speichern',
    ],
  },
  {
    version: '0.35.0',
    date: '2026-10-06',
    changes: [
      'Neue Kassetten-Ansicht im Fach, aufgebaut wie eine Gruppeninfo: oben Name und Suche über das ganze Band, darunter Mitglieder und Einladen, ganz unten Verlassen, Melden und Löschen',
      'Suche findet Text, Bildunterschriften, Namen und Mixtape-Titel auf beiden Seiten — ein Treffer legt die Kassette ein und springt direkt hin',
      'Neu: Kassetten und fremde Beiträge melden. Die Meldung wird gespeichert, die gemeldete Person erfährt nichts davon',
      'Löschen darf nur noch, wer die Kassette angelegt hat. Geht diese Person, übernimmt das dienstälteste Mitglied',
      'Wer auf einer Kassette ist, sehen nur noch ihre Mitglieder',
      'Umbenennen nimmt jetzt auch offene Einladungen mit',
    ],
  },
  {
    version: '0.34.3',
    date: '2026-10-06',
    changes: [
      'Umdrehen der Kassette neu: eine durchgehende, ruhigere Drehung statt eines schnellen Hin-und-Zurück-Wackelns — A→B dreht nach rechts, B→A spiegelbildlich zurück',
      'Hintergrundfarbe und Inhalt der neuen Seite gleiten mit, statt im Moment des Umdrehens hart umzuspringen',
    ],
  },
  {
    version: '0.34.2',
    date: '2026-10-06',
    changes: [
      'Medien hochladen geht nur noch mit Zugangscode — vorher konnte jeder mit der Adresse Dateien ablegen',
      'Unter der Haube: automatische Tests für jede ändernde Funktion ("Fremde dürfen das nicht"), Linting und CI',
    ],
  },
  {
    version: '0.34.1',
    date: '2026-10-06',
    changes: [
      'Hot Line: der Hinweis "Nur Text" war veraltet — Leitungen nehmen längst Bilder, Clips, O-Töne und Mixtapes an',
    ],
  },
  {
    version: '0.34.0',
    date: '2026-09-08',
    changes: [
      'Neu: "Reagieren" auf einem Seite-A-Beitrag klappt zu Seite B und hängt ihn dort als Zitat an eine Chat-Nachricht — Archiv und Gespräch bleiben getrennt, lassen sich aber gezielt verbinden',
    ],
  },
  {
    version: '0.33.2',
    date: '2026-09-08',
    changes: [
      'Der "Zettel"-Filter ist auf Seite B raus — Gruppenchat-Nachrichten sahen dabei aus wie beklebte Zettel statt wie normale Sprechblasen',
    ],
  },
  {
    version: '0.33.1',
    date: '2026-09-07',
    changes: [
      'Einladungen und Kassetten mit Neuem zeigen jetzt die echte Bandsorte statt eines reinen Text-/Punkt-Eintrags',
      'Einladungen zeigen zusätzlich, wie lange sie schon offen sind',
    ],
  },
  {
    version: '0.33.0',
    date: '2026-09-07',
    changes: [
      'Jemanden auf ein Band holen ist jetzt eine Einladung, keine sofortige Mitgliedschaft mehr — die eingeladene Person muss erst zustimmen',
      'Benachrichtigung zeigt offene Einladungen mit Zustimmen/Ablehnen statt einer Hot-Line-Zahl, die der Hot-Line-Knopf eh schon selbst zeigt',
    ],
  },
  {
    version: '0.32.6',
    date: '2026-09-06',
    changes: [
      'Der dunkle Grundton der App ist jetzt überall derselbe warme Anthrazit statt drei leicht unterschiedlicher Schwarztöne',
    ],
  },
  {
    version: '0.32.5',
    date: '2026-08-17',
    changes: [
      'Kassetten-Icon oben links und im Kassettenfach hatte eine unpassend runde Ecke — jetzt genauso kantig wie bei Story und Kliqtape',
    ],
  },
  {
    version: '0.32.4',
    date: '2026-08-17',
    changes: [
      'Pinch- und Doppeltipp-Zoom sind jetzt gesperrt — versehentliches Reinzoomen sah wie ein abgeschnittenes Layout aus, ist aber keins',
    ],
  },
  {
    version: '0.32.3',
    date: '2026-08-17',
    changes: [
      'Die Bänder im Kassettenfach zeigen jetzt dieselbe Zeichnung wie oben links und der große Kopf — Logo, Bandsorte und Name statt der vereinfachten Vorschau',
    ],
  },
  {
    version: '0.32.2',
    date: '2026-08-17',
    changes: [
      'Kassetten-Symbol oben links ist jetzt keine Nachbildung mehr, sondern dieselbe Zeichnung wie der große Kopf, nur verkleinert — mit echtem Logo, Bandsorte, Name und Tape-Nummer',
    ],
  },
  {
    version: '0.32.1',
    date: '2026-08-17',
    changes: [
      'Mini-Kassetten tragen jetzt echte Beschriftung: Bandsorte im Farbband, Name im Etikett — wie am großen Kopf, nur klein',
      'Beim Anlegen zeigt die Farbauswahl live den gerade eingetippten Namen',
    ],
  },
  {
    version: '0.32.0',
    date: '2026-08-16',
    changes: [
      'Glas-Look ist raus: die Leisten decken jetzt sauber ab, durchlaufender Text schimmert nicht mehr durch',
      'Auf Seite B war die obere Leiste bisher fast durchsichtig — dort ist der Unterschied am größten',
    ],
  },
  {
    version: '0.31.1',
    date: '2026-08-16',
    changes: [
      'Die Kassette klappt jetzt ruhiger ein und aus statt wegzuschnappen',
      'Sie sitzt optisch auf derselben Fläche wie die obere Leiste — beim Ausklappen fällt die Trennlinie dazwischen weg',
    ],
  },
  {
    version: '0.31.0',
    date: '2026-08-16',
    changes: [
      'Die Kassette klappt jetzt aus der oberen Leiste nach unten — genau dort, wo man gerade im Verlauf steht, ohne die Position zu verlieren',
      'Beim Wechsel der Seite oder der Kassette ist sie automatisch aufgeklappt, beim Scrollen klappt sie wieder ein',
    ],
  },
  {
    version: '0.30.0',
    date: '2026-08-16',
    changes: [
      'Die App beginnt jetzt unterhalb von Notch bzw. Kamera-Aussparung — vorher lief die obere Zeile dort hinein',
      'Erstellen/Filter/Regal/Profil sind nach ganz oben gewandert und bleiben dort stehen',
      'Die Kassette scrollt jetzt einfach weg statt halb einzuklappen — der Inhalt bekommt den Platz. Über das kleine Kassettensymbol oben links holt man sie zurück',
    ],
  },
  {
    version: '0.29.0',
    date: '2026-08-16',
    changes: [
      'Story hat keinen leuchtenden Rahmen mehr — der sah aus wie „ausgewählt". Leuchten tut jetzt nur die eingelegte Gruppe',
      'Die eingelegte Gruppe steht im Fach immer ganz oben, darunter die übrigen nach letzter Aktivität',
    ],
  },
  {
    version: '0.28.2',
    date: '2026-08-16',
    changes: [
      'Kassettenfach: das Plus sitzt jetzt neben der Gruppensuche statt in der Überschrift',
      'Hot Line: das Plus nimmt die Farbe der eingelegten Kassette an',
    ],
  },
  {
    version: '0.28.1',
    date: '2026-08-16',
    changes: ['Kassettenfach: Suchleiste über den eigenen Gruppen'],
  },
  {
    version: '0.28.0',
    date: '2026-08-16',
    changes: [
      'Hot Line hat jetzt oben eine Suche über die laufenden Leitungen',
      'Daneben ein Plus: neue Leitung auf eigener Seite, mit Suche über die Kontakte',
    ],
  },
  {
    version: '0.27.1',
    date: '2026-08-16',
    changes: [
      'Kein Schließen-Kreuz mehr auf den Hauptseiten (Fach, Hot Line, Neuigkeiten) — die wechselt man ohnehin über die untere Leiste. Unterseiten behalten es.',
    ],
  },
  {
    version: '0.27.0',
    date: '2026-08-10',
    changes: [
      'Neue Gruppe wird jetzt über ein Plus oben bei „Gruppen" angelegt — der gedrängte Block am Seitenende ist weg',
      'Das Anlegen passiert auf einer eigenen Seite: Name und Bandsorte zusammen in einem Schritt, statt die Farbe erst danach zu fragen',
    ],
  },
  {
    version: '0.26.0',
    date: '2026-08-10',
    changes: [
      'Sicherheitslücke geschlossen: Beiträge konnten von jedem gelöscht werden, der die ID kannte — jetzt nur noch von der Person, die sie geschrieben hat',
      'Dasselbe bei Mixtapes: Ändern, Titel hinzufügen, Versiegeln und Löschen gehen jetzt nur noch am eigenen Tape',
    ],
  },
  {
    version: '0.25.1',
    date: '2026-08-09',
    changes: [
      'Die kleinen Kassetten im Fach, im Regal und in der Farbauswahl sehen jetzt aus wie die große im Spieler — Etikett mit Farbband, Sichtfenster und Fuß mit Andocklöchern statt des alten bunten Balkens',
      'Story- und Kliqtape-Kassette folgen demselben Aufbau, behalten aber ihre eigene Optik',
    ],
  },
  {
    version: '0.25.0',
    date: '2026-08-09',
    changes: [
      'Gehäuse von Seite A wieder schwarz statt grau',
      'Fuß mit den Andocklöchern sitzt jetzt bündig auf der Unterkante der Kassette, statt mittendrin zu schweben — Form nach den Proportionen einer echten Kassette',
    ],
  },
  {
    version: '0.24.6',
    date: '2026-08-09',
    changes: [
      'Gehäuse von Seite A wieder etwas dunkler — war zu grau geworden',
      'Fuß mit den Andocklöchern deutlich größer, näher an den echten Proportionen',
      '"umdrehen"-Hinweis ist jetzt nur noch ein kleines Zeichen statt Text',
    ],
  },
  {
    version: '0.24.5',
    date: '2026-08-09',
    changes: [
      'Hintergrund nochmal spürbar dunkler',
      'Neues Detail: der typische Fuß mit den vier Andocklöchern am unteren Rand der Kassette',
    ],
  },
  {
    version: '0.24.4',
    date: '2026-08-09',
    changes: [
      'Hintergrund wieder dunkler — war durch das hellere Kassetten-Gehäuse ungewollt mit aufgehellt worden',
      'Etikett und Sichtfenster haben jetzt einen echten, sichtbaren Rahmen (wie bei einer echten Kassette) statt der bunten Balken am unteren Rand',
    ],
  },
  {
    version: '0.24.3',
    date: '2026-08-09',
    changes: [
      'Seite A: Gehäuse jetzt helles Grau statt fast Schwarz — näher an einer echten Kassette (z. B. Philips C-60), Gebrauchsspuren/Kerben entsprechend angepasst, hebt sich dadurch nochmal klarer vom Hintergrund ab',
    ],
  },
  {
    version: '0.24.2',
    date: '2026-08-09',
    changes: [
      'Glas-Look weniger durchscheinend — besserer Kontrast für Text/Icons in Kopf- und unterer Leiste',
      'Kassette hebt sich jetzt deutlicher vom Hintergrund ab — größerer Schlagschatten + Glow in der eigenen Akzentfarbe, auch im Kassettenfach',
    ],
  },
  {
    version: '0.24.1',
    date: '2026-08-09',
    changes: [
      'Untere Leiste: Home und Hot Line haben die Plätze getauscht',
      'Benachrichtigung zeigt Leitungen jetzt als eine Zeile ("12 ungelesene Nachrichten") statt jede einzeln — ein Tipp springt direkt zu Hot Line',
    ],
  },
  {
    version: '0.24.0',
    date: '2026-08-09',
    changes: [
      'Neuer Glas-Look für Kopf-Leiste, untere Leiste und Filter-Panel (angelehnt an aktuelle Liquid-Glass-Optik)',
      'Kassetten-Spulen und Gehäuse wirken jetzt plastischer — mehr Licht/Schatten-Tiefe im Sichtfenster',
    ],
  },
  {
    version: '0.23.1',
    date: '2026-08-09',
    changes: [
      '"self-hosted" aus den Einstellungen und dem Kliqtape-Kanal entfernt — Kliqtape wird zentral gehostet, nicht von Nutzer:innen selbst',
    ],
  },
  {
    version: '0.23.0',
    date: '2026-08-09',
    changes: [
      'Kliqtape-Kanal zeigt jetzt einen echten Förderstand (Kontostand + Ziel-Notiz), von Admin bearbeitbar',
      'Kassettenfach: Kliqtape-Zeile erwähnt jetzt auch "unterstütze das Projekt"',
    ],
  },
  {
    version: '0.22.2',
    date: '2026-08-09',
    changes: [
      'Kliqtape-Kanal zeigt jetzt einen Hinweis "Unterstütze unser Projekt" — noch ohne Link, der folgt, sobald eine Spenden-Plattform steht',
    ],
  },
  {
    version: '0.22.1',
    date: '2026-08-09',
    changes: [
      'Die Kliqtape-Zeile im Kassettenfach hat jetzt einen eigenen Kassetten-Look im Stil des Logos: linke Spule voll eingefärbt wie "Kliq", rechte Spule nur als Kontur wie "tape"',
    ],
  },
  {
    version: '0.22.0',
    date: '2026-08-09',
    changes: [
      'Neu: der Kliqtape-Kanal — News und Insights vom Projekt, dauerhaft und für alle sichtbar, egal in welcher Gruppe. Zu finden im Kassettenfach, unter der Story-Zeile.',
      'Schreiben darf dort nur ein einzelner, per Server-Konfiguration festgelegter Kanal-Account — für alle anderen ist es eine reine Leseansicht.',
    ],
  },
  {
    version: '0.21.2',
    date: '2026-08-09',
    changes: [
      'Die Story-Zeile im Kassettenfach hat jetzt eine eigene, schimmernde Optik statt der gedeckten Bandsorten-Farben — auf den ersten Blick als eigener Bereich erkennbar',
      'Neue Überschrift "Gruppen" trennt die Story-Zeile jetzt sichtbar von der Liste der eigenen Runden',
    ],
  },
  {
    version: '0.21.1',
    date: '2026-08-09',
    changes: [
      'Bug behoben: Erstellen-Knopf, Filter, Regal und Profil waren nur ganz oben erreichbar — sobald man runtergescrollt hatte, verschwanden sie mit dem Rest der Seite. Sie bleiben jetzt zusammen mit dem (weiterhin einklappenden) Kassetten-Kopf oben sichtbar, auf beiden Seiten.',
    ],
  },
  {
    version: '0.21.0',
    date: '2026-08-09',
    changes: [
      'Der "+"-Knopf führt jetzt auf eine eigene Seite, die alle fünf Aufnahme-Arten erklärt (Mixtape, O-Ton, Schnappschuss, Clip, Zettel), statt nur ein kleines Auswahlfeld zu zeigen',
      'Neu: Storys — eigener Bereich im Kassettenfach, oberhalb der Gruppenliste. Foto/Video, sichtbar für alle, mit denen man in irgendeiner Kassette zusammen ist, verschwinden nach 24 Stunden von selbst',
    ],
  },
  {
    version: '0.20.3',
    date: '2026-08-07',
    changes: [
      'Bug behoben (vermutlich): Text im Kassetten-Kopf blieb nach einem Seitenwechsel manchmal unsichtbar stehen, obwohl Rahmen und Hintergrund korrekt da waren — der Kopf steckte im Ruhezustand dauerhaft in einem 3D-Drehkontext (fürs Umdrehen gedacht), was zusammen mit dem Weichzeichner im Hintergrund zu einem bekannten Darstellungsfehler führen kann. Der 3D-Kontext ist jetzt nur noch während der eigentlichen Dreh-Animation aktiv.',
    ],
  },
  {
    version: '0.20.2',
    date: '2026-08-07',
    changes: [
      'Eigentliche Ursache behoben: beim Wechsel zum Gruppenchat blieb die Scrollposition der vorherigen Seite stehen, wurde kurz danach faelschlich als "schon tief gescrollt" gelesen und klappte den Kassetten-Kopf komplett ein. Kopf setzt sich jetzt bei jedem Wechsel sauber zurueck, auch beim Chat.',
      'Vorherige Teillösung zurückgenommen: der Kassetten-Kopf klappt jetzt wieder ganz normal komplett ein (inkl. Gruppenname), wie es sein sollte — das war nie das eigentliche Problem.',
    ],
  },
  {
    version: '0.20.1',
    date: '2026-08-07',
    changes: [
      'Bug behoben: der Name der Runde verschwand komplett, sobald der Kassetten-Kopf beim Scrollen einklappte — er bleibt jetzt immer sichtbar, nur die Datum/Tape-Zeile darunter klappt noch ein',
    ],
  },
  {
    version: '0.20.0',
    date: '2026-08-07',
    changes: [
      'Beim Umdrehen oder Wechseln der Kassette landet man jetzt direkt beim ersten Beitrag, den man noch nicht gesehen hat — nicht mehr immer ganz am Bandanfang. Gibt es nichts Neues, geht es ans aktuelle Ende.',
      'Der Gesehen-Stand wird pro Seite getrennt gemerkt (Seite A und B einer Kassette getrennt voneinander) und zieht auch nach, während man gerade dort ist.',
    ],
  },
  {
    version: '0.19.8',
    date: '2026-08-07',
    changes: [
      'Bug behoben: der Kassetten-Kopf klappte auf Seite B sofort ein, weil der Gruppenchat beim Öffnen selbst ans Ende springt — er bleibt jetzt erst groß und klappt nur durch eigenes Scrollen ein, wie auf Seite A',
      'Die Spulen im Kassetten-Kopf sind jetzt eigene Tasten: linke Spule spult an den Bandanfang zurück, rechte Spule zum aktuellsten Stand — der Rest der Kassette dreht weiterhin beim Antippen die Seite um',
    ],
  },
  {
    version: '0.19.7',
    date: '2026-08-07',
    changes: [
      'Bug behoben: Geräte, deren Name schon vor dem Zugangscode-System lokal gespeichert war, landeten direkt in der App statt beim Anmelden — jede Aktion schlug dann still mit einem Berechtigungsfehler fehl. Fehlt der Zugangscode, springt die App jetzt wieder zur Anmeldung (Name schon ausgefüllt, nur noch bestätigen).',
    ],
  },
  {
    version: '0.19.6',
    date: '2026-08-07',
    changes: [
      'Home markiert sich jetzt auch selbst, wenn man dort tatsächlich ist — vierter echter Tab-Zustand statt reiner Aktion',
      'Der Erstellen-Knopf oben links ist jetzt nur noch in der Home-Übersicht zu sehen, nicht mehr während Eject, Hot Line oder Neuigkeiten offen sind',
      'Erstellen-Knopf zeigt jetzt ein Plus statt des roten REC-Punkts — dreht sich beim Öffnen zum X',
      'Filter ist von links nach rechts gewandert, jetzt zusammen mit Regal und Profil in einer Gruppe',
    ],
  },
  {
    version: '0.19.5',
    date: '2026-08-07',
    changes: [
      'Bug behoben: Home schaltete zwar auf Seite A um, ließ aber ein offenes Eject/Hot-Line/Neuigkeiten-Fenster weiter stehen — dadurch wirkte es, als würde gar nichts passieren. Home schließt den jeweiligen Bereich jetzt zuerst.',
    ],
  },
  {
    version: '0.19.4',
    date: '2026-08-07',
    changes: ['Home-Knopf zeigt jetzt eine kleine Kassette statt eines Haussymbols — passt besser zum Rest der App'],
  },
  {
    version: '0.19.3',
    date: '2026-08-07',
    changes: [
      'Untere Leiste jetzt näher an Signal & Co.: eine einheitliche, etwas hellere Fläche für die ganze Leiste statt einzeln getönter Spalten — nur der gerade offene Bereich bekommt eine eng sitzende Kapsel ums Icon',
      'Bug behoben: Eject, Hot Line und Neuigkeiten ließen sich gleichzeitig offen halten — jetzt schließt das Öffnen eines Bereichs die anderen automatisch, wie eine echte Tableiste, und wechselt sofort dorthin',
    ],
  },
  {
    version: '0.19.2',
    date: '2026-08-07',
    changes: [
      'Neuer Home-Knopf in der unteren Leiste (zwischen Hot Line und Neuigkeiten) — zurück zur Startansicht der eingelegten Kassette, egal wo man gerade ist',
      'Jeder Bereich der unteren Leiste hat jetzt eine leicht hellere Spalte als Hintergrund, damit die Flächen besser zu erkennen sind',
      'Ist eine Kassette/Hot-Line-Liste/Neuigkeiten-Liste offen, markiert sich der zugehörige Bereich in Akzentfarbe — bleibt beim Browsen sichtbar, welcher Knopf gerade "offen" ist',
      'Beim Öffnen von Eject, Hot Line oder Neuigkeiten bleibt die untere Leiste jetzt sichtbar, statt komplett hinter dem Fenster zu verschwinden — nur sobald ein konkretes Gespräch aufgeht, zieht sich die Leiste wieder zurück, wie schon im Gruppenchat',
    ],
  },
  {
    version: '0.19.1',
    date: '2026-08-07',
    changes: [
      'Eject, Hot Line und Neuigkeiten jetzt einheitlich gestaltet: gleiche Form, gleiche Farbe, nur Icon und Beschriftung wechseln — cleaner, näher an WhatsApp & Co.',
      'Neuigkeiten zeigt jetzt wie Hot Line eine Zahl oben rechts statt nur zu blinken',
    ],
  },
  {
    version: '0.19.0',
    date: '2026-08-07',
    changes: [
      'Untere Leiste komplett aufgeräumt: nur noch drei gleich große Bereiche wie bei WhatsApp & Co. — Eject, Hot Line, Neuigkeiten',
      'Neuer Action-Button oben links (an Ejects alter Stelle) zum Erstellen: Mixtape, O-Ton, Schnappschuss, Clip oder Zettel',
      'Rücklauf/Vorlauf und das durchgehende Abspielen aller O-Töne einer Seite ("Walkman") sind entfallen — jeder O-Ton lässt sich weiterhin einzeln direkt im Beitrag abspielen',
    ],
  },
  {
    version: '0.18.0',
    date: '2026-08-07',
    changes: [
      'Jeder Name bekommt jetzt beim ersten Beanspruchen einen eigenen Zugangscode — schützt davor, dass jemand einen fremden Namen einfach mit eintippt, sobald die App nicht mehr nur im eigenen Tailnet läuft',
      'Neuer Bereich "Zugangscode" in den Einstellungen: eigenen Code anzeigen (wie ein Passwortfeld) und kopieren, um ihn auf ein zweites Gerät zu übertragen',
      'Umbenennen läuft jetzt über den Server und zieht Beiträge, Mixtapes, Hotlines und Mitgliedschaften konsistent mit um',
      'Optionales Setup für öffentliches Hosting mit automatischem HTTPS-Zertifikat (Caddy) — weiterhin komplett optional, lokaler/Tailscale-Betrieb bleibt unverändert',
      'Bug behoben: der Feed einer Kassette ließ sich bisher mit einer bekannten Kassetten-ID auch ohne Mitgliedschaft abrufen',
    ],
  },
  {
    version: '0.17.2',
    date: '2026-08-05',
    changes: [
      'Emoji werden jetzt als eigene Grafiken angezeigt (wie bei WhatsApp/Telegram), statt sich auf die oft lückenhafte Emoji-Schrift des Geräts zu verlassen — betrifft den Picker und alle gesendeten Nachrichten',
    ],
  },
  {
    version: '0.17.1',
    date: '2026-08-05',
    changes: [
      'Chat-Eingabezeile komplett neu, näher an Signal/WhatsApp: Emoji links, Textfeld, "+" für Anhänge, Mikro/Senden rechts (morpht je nachdem ob getippt wird)',
      '"+" schickt jetzt Foto, Video oder ein Mixtape direkt im Gespräch — auch in Hot Line, die konnte bisher nur Text',
      'Neuer Emoji-Picker mit kuratierter Auswahl',
    ],
  },
  {
    version: '0.17.0',
    date: '2026-08-05',
    changes: [
      'Eigene Nachrichten erscheinen jetzt sofort beim Senden (optimistisch), nicht erst nach der Server-Antwort',
      'Chat holt neue Nachrichten alle 4 statt 15 Sekunden',
      'O-Ton in Seite B jetzt direkt im Schreibfeld aufnehmen — kein eigener Vollbild-Umweg mehr',
      'Bug behoben: Kassetten-Kopf blieb nach dem Seitenwechsel manchmal dauerhaft eingeklappt, wenn vorher weit gescrollt wurde',
    ],
  },
  {
    version: '0.16.8',
    date: '2026-08-05',
    changes: [
      'Hot Line blinkt nicht mehr bei Ungelesenem, sondern zeigt oben rechts eine kleine Zahl — wie beim Mixtape-Knopf',
    ],
  },
  {
    version: '0.16.7',
    date: '2026-08-04',
    changes: [
      'Hot Line saß nach der letzten Ausrichtung zu weit oben — jetzt wirklich auf gleicher Mitte wie REC, nicht nur gleicher Oberkante',
    ],
  },
  {
    version: '0.16.6',
    date: '2026-08-04',
    changes: [
      'Hot Line und REC beginnen jetzt auf exakt gleicher Höhe, mehr Abstand dazwischen',
      'Mixtape-Knopf vorerst aus der Leiste raus — der Platz fürs Erstellen wird noch überlegt',
    ],
  },
  {
    version: '0.16.5',
    date: '2026-08-04',
    changes: [
      'Hot Line sitzt jetzt direkt neben REC statt am rechten Rand',
      'Hot-Line-Farbton minimal Richtung Orange gezogen',
    ],
  },
  {
    version: '0.16.4',
    date: '2026-08-04',
    changes: [
      'Hot-Line-Knopf sieht jetzt aus wie eine echte gepolsterte Taste mit Metallschild, statt einem flachen Farbfeld',
    ],
  },
  {
    version: '0.16.3',
    date: '2026-08-04',
    changes: [
      'Löschen-Knopf trägt jetzt ein Mülleimer-Symbol statt nur Text',
      '"Jemanden holen" umgebaut: Suchfeld filtert bekannte Personen live als Liste, statt eine ungefilterte Wolke von Namen zu zeigen',
    ],
  },
  {
    version: '0.16.2',
    date: '2026-08-04',
    changes: [
      'Kassette lässt sich jetzt endgültig löschen (samt aller Beiträge und Medien) — im Kassettenfach über den neuen Bearbeiten-Knopf statt "Leute"',
      'Neues Band anlegen legt sofort dieses Band ein, egal ob man danach eine Farbe wählt oder überspringt',
    ],
  },
  {
    version: '0.16.1',
    date: '2026-08-04',
    changes: [
      '10 neue Bandsorten dazu (16 statt 6): Graphit, Rost, Petrol, Pflaume einfarbig, plus 6 gemusterte — Jazz Marmor, Rauchglas, Konfetti, Camo, Perlmutt, Türkis Marmor',
      'Gemusterte Sorten zeigen echte Sprenkel/Marmorierung, nicht nur eine andere Farbe — sichtbar im Farb-Schritt beim Anlegen, im Kassettenfach und im Kassetten-Kopf auf Seite B',
    ],
  },
  {
    version: '0.16.0',
    date: '2026-08-04',
    changes: [
      'Neue Kassette: nach dem Einlegen lässt sich jetzt gleich die Bandfarbe wählen (6 Sorten), überspringbar — sonst bleibt die automatisch zugewiesene',
    ],
  },
  {
    version: '0.15.9',
    date: '2026-08-04',
    changes: [
      'Alle Seite-B-Bandfarben gedämpfter — vor allem Kiwi (Grün) war deutlich zu grell, jetzt näher an den ruhigen, materialhaften Farben von Seite A',
    ],
  },
  {
    version: '0.15.8',
    date: '2026-08-04',
    changes: [
      'Bug behoben: Seite B zeigte immer dasselbe feste Lila statt der Farbe der eingelegten Kassette — betraf Hintergrund, Rahmen und Akzentfarbe überall auf Seite B, nicht nur die Schreibleiste',
    ],
  },
  {
    version: '0.15.7',
    date: '2026-08-04',
    changes: [
      'O-Ton-Knopf auf Seite B trägt jetzt die Leucht-Farbe der eingelegten Kassette statt des Kassetten-Braun/Rot vom REC-Knopf',
      'Schreibleiste auf Seite B jetzt dunkler und deutlicher in der Farbe der eingelegten Kassette, statt mit dem Bildschirm zu verschmelzen',
    ],
  },
  {
    version: '0.15.6',
    date: '2026-08-04',
    changes: [
      'Seite B zeigt unten keine Werkzeugleiste mehr, nur noch das Schreibfeld — voller Fokus auf den Chat',
      'Neuer O-Ton-Knopf direkt neben Senden — Sprachnachricht ohne Umweg über REC aufnehmen',
    ],
  },
  {
    version: '0.15.5',
    date: '2026-08-04',
    changes: [
      'O-Ton lässt sich jetzt nur noch auf Seite B aufnehmen — im kuratierten Archiv (Seite A) macht eine Sprachnachricht weniger Sinn',
      '"Noch kein Band im Regal" im Kassettenfach hieß fälschlich noch nach dem alten Regal — jetzt "Noch kein Band im Fach"',
    ],
  },
  {
    version: '0.15.4',
    date: '2026-08-04',
    changes: [
      'Mixtape-Knopf in der Leiste hat jetzt ein eigenes Symbol (Achtelnoten) statt des Kassetten-Zeichens, das sich sonst mit dem Regal überschnitt',
    ],
  },
  {
    version: '0.15.3',
    date: '2026-08-04',
    changes: [
      'Seite B: Eingabefeld hängt jetzt fest über der Werkzeugleiste, statt beim Scrollen zu verschwinden',
      'Seite B zeigt jetzt oben dasselbe Tape-Datum wie Seite A, daneben "Gruppenchat" statt "Gespräch"',
    ],
  },
  {
    version: '0.15.2',
    date: '2026-08-04',
    changes: [
      'Umbenannte Tapes zeigen die Standard-Nummer weiterhin daneben, z.B. "Der Anfang · Tape 01" — die Zählung geht so nicht verloren',
    ],
  },
  {
    version: '0.15.1',
    date: '2026-08-04',
    changes: [
      'Leere Tapes erscheinen nicht mehr im Regal — ein abgeschlossener Tag lässt sich sowieso nicht mehr nachträglich befüllen',
    ],
  },
  {
    version: '0.15.0',
    date: '2026-08-04',
    changes: [
      'Regal komplett umgebaut: jetzt eine Liste statt Kacheln, wie das Kassettenfach beim Eject',
      'Zeigt Tapes über alle Kassetten hinweg, sortiert nach echtem Datum — nicht mehr nur die eingelegte Kassette',
      'Jede Zeile mit dem echten Kassetten-Logo in der richtigen Farbe',
      'Filter klappt jetzt aus und wählt eine Kassette aus, statt Beitragsarten zu zeigen',
      'Antippen einer Zeile legt bei Bedarf die passende Kassette automatisch ein und springt zum Tape',
    ],
  },
  {
    version: '0.14.2',
    date: '2026-08-04',
    changes: [
      'Tape-Kacheln im Regal zeigen jetzt ein kleines Vorschaubild (erstes Foto des Tages)',
      'Suchfeld fürs Regal — nach Tape-Namen suchen',
      'Filter fürs Regal — nur Tapes mit bestimmter Beitragsart zeigen (Fotos, O-Töne, …)',
    ],
  },
  {
    version: '0.14.1',
    date: '2026-08-04',
    changes: [
      'Regal zeigt jetzt die Tapes von Seite A statt Mixtapes — jedes Tape als Kachel, umbenennbar, favorisierbar, antippen springt hin',
      'Mixtapes bekommen einen eigenen Knopf im Laufwerk statt im Regal',
      'Der kleine "Springen"-Knopf ist wieder raus, das Regal übernimmt seine Aufgabe',
    ],
  },
  {
    version: '0.14.0',
    date: '2026-08-04',
    changes: [
      'Seite A ist jetzt in Tapes gegliedert — ein Tape pro Kalendertag seit Gründung, umbenennbar, favorisierbar',
      'Track-Nummern (A1, A2, …) fangen jetzt pro Tape wieder bei 1 an, wie bei einer echten Kassette',
      'Kassetten-Kopf zeigt jetzt das aktuelle Tape samt Datum statt "Seite A — Bleibt"',
      'Neuer "Springen"-Knopf: per Datum oder über Favoriten direkt zu einem Tape springen',
      'Jeder Beitrag zeigt jetzt zusätzlich Datum und Uhrzeit',
    ],
  },
  {
    version: '0.13.0',
    date: '2026-08-04',
    changes: [
      'Seite B ist jetzt ein echter Gruppenchat — Eingabefeld direkt da, Bubbles statt Karten, Tagestrenner',
      'Hot Line ist jetzt auch dauerhaft — kein Verlauf verfällt mehr',
      'Fotos, Clips, O-Ton und Mixtapes erscheinen als Bubble im Chat, weiterhin über REC',
      'Mit aktivem Filter auf Seite B (z.B. "nur Fotos") bleibt die bisherige Kartenansicht zum Durchsuchen',
    ],
  },
  {
    version: '0.12.0',
    date: '2026-08-04',
    changes: [
      'Seite B verfällt nicht mehr — kein Beitrag verschwindet mehr nach 24 Stunden',
      'Erster Schritt zum Gruppenchat auf Seite B, die eigentliche Chat-Oberfläche folgt als Nächstes',
    ],
  },
  {
    version: '0.11.2',
    date: '2026-08-04',
    changes: [
      'Jeder Zettel-Stil hat jetzt sein eigenes Papier: Tacker liniert, Klammer kariert und dunkler, Pin Post-it-gelb, Eselsohr Packpapier',
      'Tesa, Pin und Klammer halten das Papier jetzt sichtbar fest, statt daneben zu schweben',
    ],
  },
  {
    version: '0.11.1',
    date: '2026-08-04',
    changes: [
      'Echte Live-Vorschau beim Zettel-Schreiben statt nur Textauswahl',
      'Optik-Kacheln zeigen jetzt verkleinerte, echte Vorschauen statt Namen allein',
    ],
  },
  {
    version: '0.11.0',
    date: '2026-08-04',
    changes: [
      'Zettel gibt es jetzt in 5 Optiken: Tesa, Pin, Tacker, Klammer, Eselsohr',
      'Optik wird beim Schreiben gewählt, jede Karte hängt leicht schief',
    ],
  },
  {
    version: '0.10.2',
    date: '2026-08-03',
    changes: ['„Tapen" heißt jetzt Tonfetzen — „tapen" war im Deutschen schon an Kinesio-Tape vergeben'],
  },
  {
    version: '0.10.1',
    date: '2026-08-03',
    changes: [
      'Tapen läuft nicht mehr auf einer eigenen Seite — halten zum Aufnehmen, direkt am Knopf',
      'Eject-Knopf zeigt jetzt "Eject" statt des Kassettennamens, der steht schon oben im Kopf',
    ],
  },
  {
    version: '0.10.0',
    date: '2026-08-03',
    changes: [
      '„da war ich" ist raus — Reagieren heißt jetzt Tapen: eine 3 Sekunden kurze Sprachaufnahme',
      'Tapen ist privat: nur die postende Person hört, wer wie reagiert hat',
      'Eigene Tapen-Reaktionen zu einem Beitrag laufen nacheinander ab, wie ein kleiner Walkman',
      'Zweites Tapen auf denselben Beitrag ersetzt das erste, statt sich anzuhäufen',
      'Eject-Knopf im Kassettenfach jetzt rot markiert',
    ],
  },
  {
    version: '0.9.3',
    date: '2026-08-03',
    changes: ['Zählwerk zieht mit der Lampe mit — beide stehen jetzt zusammen ganz rechts'],
  },
  {
    version: '0.9.2',
    date: '2026-08-03',
    changes: [
      'Neuigkeiten-Lampe zog nach ganz rechts um, direkt neben Hot Line',
      'Zählwerk und Tapedeck-Reihe dadurch weiter links',
    ],
  },
  {
    version: '0.9.1',
    date: '2026-08-03',
    changes: [
      'Hot-Line-Metallplatte wieder raus — zurück zu Gelb mit leichtem schwarzen Rahmen',
      'Hot Line sitzt jetzt allein rechts, nicht mehr neben REC',
      'Tapedeck-Reihe: Rücklauf, Play/Pause und Vorlauf jetzt nebeneinander',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-08-03',
    changes: [
      'Hot Line sitzt jetzt auf einer angeschraubten Metallplatte statt in der Ecke',
      'Hot Line neben REC gerückt — die zwei Hauptaktionen jetzt nebeneinander, mit Luft dazwischen',
      'Zählwerk umgezogen: sitzt jetzt bei der Neuigkeiten-Lampe statt bei REC',
    ],
  },
  {
    version: '0.8.1',
    date: '2026-08-03',
    changes: [
      'Hot-Line-Knopf kleiner — sattes Gelb wirkte bei gleicher Größe lauter als die Laufwerkstasten',
      'Zählwerk neben REC zurück: zeigt die Anzahl der Beiträge, bleibt beim Scrollen sichtbar',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-08-03',
    changes: [
      'Anrufbeantworter wird zur Neuigkeiten-Anzeige über alle Kassetten hinweg',
      'Zwei getrennte Rubriken: Kassetten mit Neuem und Leitungen mit Ungelesenem',
      'Nur noch eine blinkende Lampe, keine Zahl mehr — Details erst beim Öffnen',
      'Hot-Line-Knopf blinkt jetzt selbst, wenn dort etwas Neues wartet',
      '„Neu" bei Kassetten ist rein lokal gespeichert, kein Server-Tracking',
    ],
  },
  {
    version: '0.7.1',
    date: '2026-08-03',
    changes: ['Hot-Line-Knopf jetzt vollflächig gelb, ohne den dunklen Gehäuse-Rand'],
  },
  {
    version: '0.7.0',
    date: '2026-08-03',
    changes: [
      'Hot Line: rollierendes 24-Stunden-Fenster statt fester Frist ab der ersten Nachricht',
      'Jede Nachricht hält die Leitung offen, alte Nachrichten fallen trotzdem einzeln raus',
      'Keine Leitung sammelt mehr einen permanenten Verlauf an, egal wie oft man schreibt',
      'Geht die letzte Nachricht über 24h hinaus, schließt die Leitung endgültig',
    ],
  },
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
