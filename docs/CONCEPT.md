# Kliqtape

> Ein Regal voller Kassetten. Jede steht für eine Runde von Leuten.
> Du legst eine ein — **Seite A** ist das Archiv, **Seite B** das laufende Gespräch.
> Chronologisch, ohne Algorithmus, ohne Werbung, ohne Zahlen.

**Stand:** 2026-08-10 · lauffähiger Web-Prototyp mit Zugangscode-Identität, noch ohne
Verschlüsselung · Zielplattform ist eine React-Native-App, zentral gehostet auf Hetzner
(siehe Abschnitt 16)
**Design-Richtung:** [Entwurf 01](https://claude.ai/code/artifact/256c8199-6b83-4916-b1e9-a30f88ea53c4)
**Repo:** https://github.com/Guppy997/kliqtape (privat)

**Wortmarke:** `Kliq` steht, `tape` ist nur Kontur — der bedruckte Teil des Etiketts und der,
den man selbst ausfüllt (`frontend/src/components/Lockup.tsx`).

---

## 1. Der Kern

Die meisten sozialen Netze sind für Reichweite gebaut und verkaufen Aufmerksamkeit. Dieses hier
ist für **Nähe** gebaut und verkauft nichts.

Man hat nicht *einen* Freundeskreis, sondern mehrere — und die zu vermischen funktioniert nicht.
Deshalb ist eine **Kassette** eine Gruppe von Leuten. Du legst die Kassette der Runde ein, mit der
du gerade redest. Wechselst du die Runde, wechselst du das Band.

Jede Kassette hat zwei Seiten, und die unterscheiden sich nicht nach *Publikum*, sondern nach
**Charakter**:

| | **Seite A** | **Seite B** |
|---|---|---|
| Was da hingehört | was bleiben soll: Bilder, Infos, Absprachen | was im Fluss ist: Gespräch, Zwischenstand, Gedanke |
| Form | einzelne Beiträge als Karten | durchgehender Gruppenchat |
| Sortierung | chronologisch, filterbar nach Art, nach Tagen gebündelt | chronologisch |
| Charakter | Archiv der Runde | laufendes Gespräch |

> **Geändert gegenüber dem Ursprungsentwurf:** Seite B sollte ursprünglich nach 24 Stunden
> überspielt werden. Das wurde verworfen — ein Gruppenchat, der sich selbst löscht, hat sich
> im Gebrauch als Verlust angefühlt, nicht als Befreiung. Das Verfalls-Modell steckt
> stattdessen in den **Storys** (24 Stunden) und ist dort auch das richtige Format.

### Warum das leichter ist als die übliche Lösung

Andere Apps verlangen bei jedem Beitrag die Frage: *„Wie intim ist das? Wer darf das sehen?"*
Das ist anstrengend, und genau daran scheitern Close-Friends-Funktionen — aus Unsicherheit postet
man am Ende gar nichts.

Hier sind es zwei Fragen, die man ohne Nachdenken beantwortet:

1. **Welche Kassette?** → Du weißt, mit wem du redest.
2. **Bleibt das oder ist es weg?** → Du weißt, ob es wichtig ist.

### Der erste Moment

Ohne Kassette zeigt die App eine leere Kassettenhülle, einen Satz dazu, was eine Kassette ist,
drei Schritte (Beschriften, Einladen, Aufnehmen) und einen Knopf direkt ins Beschriften. Offene
Einladungen stehen dort mit dabei. Ein leeres Band erklärt Seite A und bietet Einladen an,
solange man allein ist.

### Die Kassetten-Ansicht im Fach

Aufgebaut wie die Gruppeninfo bei WhatsApp, weil das jede:r kennt: oben die Kassette mit Namen
(Stift zum Umbenennen) und eine **Suche über das Band** (Text, Bildunterschriften, Namen,
Mixtape-Titel auf beiden Seiten; ein Treffer legt die Kassette ein und springt hin). Darunter
die Mitglieder und „Jemanden einladen“. Ganz unten, abgesetzt: **Kassette verlassen**,
**Kassette melden**, **Kassette löschen**.

**Löschen darf nur, wer die Kassette angelegt hat.** Umbenennen, Umfärben und Einladen bleiben
für alle. Die Gründerin kann niemand anderes vom Band nehmen (sonst ließe sich die Regel
umgehen); geht sie selbst, übernimmt das dienstälteste Mitglied.

**Melden** geht für eine Kassette oder einen fremden Beitrag auf Seite A. Gespeichert werden
Ziel, meldende Person, Grund und eine optionale Notiz (Tabelle `reports`). Es gibt bewusst
noch keine Moderationsoberfläche, die Bestätigung sagt das auch so.

## 2. Warum es funktionieren kann

**Kein Cold-Start-Problem.** Eine Kleingruppen-App ist mit sechs Leuten vollständig. Wachstum
passiert über Zellteilung, nicht über kritische Masse.

**Die Metapher trägt das Datenmodell.** Ein Kassettenregal *ist* eine Sammlung getrennter Kreise.
Die Gestaltung ist nicht Verzierung, sondern die Struktur selbst.

**Der Verzicht ist kopiersicher.** Instagram kann keinen Feed einführen, der sich selbst löscht,
und keine Follower-Zahlen abschaffen — es würde ihr Geschäftsmodell zerstören.

## 3. Positionierung

> **Das soziale Netz, das dich wieder gehen lässt.**

- **Der Feed ist endlich.** Chronologisch, mit einem Ende. Kein unendliches Scrollen, kein Druck.
- **Keine öffentlichen Zahlen.** Keine Follower, keine Likes. Du siehst *wer* reagiert hat.
- **Kleine Runden.** Eine Kassette fasst so viele Leute, wie man wirklich kennt.
- **Datenminimierung als Architektur.** Konto ohne E-Mail und ohne Passwort (siehe Abschnitt 16).
- **Nachprüfbare Ehrlichkeit.** Im Profil steht eine Tabelle „Was der Server sieht", und sie sagt
  immer die Wahrheit — auch dann, wenn die Antwort unangenehm ist.

## 4. Was es „cooler" macht

**Retro sind die Materialien, modern ist alles andere.** Bandkorn, Filzstift, Fotoabzug — aber
saubere Typografie, großzügige Abstände, flüssige Bewegung. Kein Sepia über allem.

- **Tippen auf die Kassette dreht sie um.** Auf halbem Weg steht sie hochkant, dort wechselt der
  Inhalt — man sieht ihn nie umklappen. Eine durchgehende Drehung (hinaus beschleunigend, von der
  Gegenseite herein abbremsend, zusammen etwa 0,6 s), A→B nach rechts, B→A spiegelbildlich
  zurück. Hintergrund und Inhalt gleiten im zweiten Teil mit.
- **Die Spulen laufen beim Scrollen mit.** Links wird dünner, rechts dicker.
- **Track-Nummern statt Zeitstempel.** `A3`, `B7` — Position auf dem Band, kein Zeitdruck.
  Auf Seite A zählt die Nummer pro Tape (also pro Berlin-Kalendertag) neu ab `A1`.
- **Tonfetzen statt „da war ich".** Reagieren heißt: eine 3 Sekunden kurze Sprachaufnahme an die
  postende Person. Privat — nur sie hört, wer wie reagiert hat, niemand sonst sieht eine Liste
  oder einen öffentlichen Zähler.
- **Ein REC-Knopf**, kein Menüband. Was aufs Band kommt, entscheidest du danach.
- **Live-Aufnahmen sehen anders aus als Uploads.** Kein Verbot, aber ein sichtbarer Unterschied.

## 5. Die Beitragsarten

| Name | Was es ist |
|---|---|
| **Mixtape** | ein Musik-Tape aus dem Regal, mit der Runde geteilt |
| **O-Ton** | 90 Sekunden Stimme, mit Bandquietschen beim Spulen |
| **Schnappschuss** | Foto — live aufgenommen oder aus der Galerie, sichtbar unterschieden |
| **Clip** | Video, maximal 10 Sekunden |
| **Zettel** | ein paar Zeilen Text |

## 5a. Entwickelter Film

Jede Person kann pro Kassette und Woche **ein** Bild auf den Film belichten, nur mit der Kamera.
Danach sieht es niemand, auch die Person selbst nicht: Der Film wird entwickelt. **Sonntag um
19 Uhr (Europe/Berlin)** ist er für alle Mitglieder gleichzeitig fertig. Auf Seite A liegt dann
eine Fototüte, beim Öffnen klappt die Lasche hoch, die Abzüge rutschen heraus, man blättert sie
einzeln durch. Danach liegen sie als normale Beiträge im Tape des Sonntags, mit dem orangen
Datumsaufdruck einer Einwegkamera (Tag der Belichtung).

**Technisch:** ein Seite-A-Beitrag mit `source = 'film'`, `develop_at` (Freigabe) und
`taken_at` (Belichtung); `created_at = develop_at`, damit er im Tape des Sonntags steht. Bis zur
Freigabe filtert der Server ihn aus Feed, Zählern, Tonfetzen, Zitaten und Meldungen, und
`GET /api/media/:id` antwortet mit 404, auch der Person, die belichtet hat. Wer Sonntag nach
19 Uhr belichtet, landet im Film der nächsten Woche. Der Status verrät nur, ob man selbst schon
belichtet hat, nicht wer sonst oder wie viele. Ein Film nimmt nur frisch hochgeladene Bilder
an; sonst ließe sich ein fremdes, sichtbares Foto per ID bis Sonntag sperren.

**Vorführung:** Mit `DEMO_TOOLS=1` kann die Person, die die Kassette angelegt hat, den Film
sofort entwickeln. Im Betrieb bleibt das aus.

## 5b. Imposter-Woche (Special)

Ein Spiel für die Runde, **nicht jede Woche**: frühestens vier Wochen nach der letzten, nur auf
Kassetten mit **mindestens vier Leuten**, gestartet von einem Mitglied in der Kassetten-Ansicht.
Alle bekommen dieselbe Wochenaufgabe (ein Foto oder ein paar Worte), eine zufällige Person ist
Imposter, weiß das und bekommt nur einen vagen Hinweis. Die Beiträge sind wie der Film bis
**Sonntag 19 Uhr** verborgen, auch die Bilder. Dann sieht die Runde alle Beiträge und tippt, wer
die Aufgabe nicht kannte; umentscheiden geht bis zur Auflösung. Aufgelöst wird, sobald alle
getippt haben, durch die Person, die gestartet hat, oder 24 Stunden später von selbst.

Die Auflösung ist bewusst kein Glücksrad: Die Abzüge der Leute, die die Aufgabe kannten,
bekommen nacheinander einen leisen Stempel, übrig bleibt der Imposter mit einem roten Stempel.
Danach stehen Aufgabe, Hinweis und ob die Runde richtig lag. **Kein Punktestand, keine
Belohnung, keine Stimmenzahlen** — der Server gibt nur „richtig“ oder „daneben“ heraus. Die
Beiträge bleiben im Tape des Sonntags auf Seite A, der Imposter-Beitrag mit Stempel.

**Technisch:** `imposter_weeks`, `imposter_entries`, `imposter_votes`; Aufgaben als feste Liste
in `server.ts`. Beiträge sind Seite-A-Posts mit `source = 'imposter'` und `develop_at`, also
dieselbe Sperre wie beim Film. Mit `DEMO_TOOLS=1` kann die Gründerin den Sonntagabend
vorziehen; die Vier-Wochen-Pause entfällt dann.

## 5c. Album-Export

Ein oder mehrere Tapes von Seite A als **PDF-Album** (A5, Papierton, Abzüge mit Rand, zwei pro
Seite), zu finden in der Kassetten-Ansicht unter „Zum Mitnehmen“. Clips und O-Töne lassen sich
nicht drucken und fehlen. Wer im Profil **„Meine Beiträge nicht in Alben“** einschaltet, fehlt
automatisch in jedem Album, das irgendwer exportiert.

**Seite B und Hot Line sind technisch ausgeschlossen, nicht nur weggefiltert:**

1. Die einzige Datenquelle ist die SQLite-View `album_posts` (freigegebene Seite-A-Beiträge
   ohne ausgenommene Personen).
2. Das Druck-Modul `backend/src/print/album.ts` importiert weder die Datenbank noch den Server.
   Es bekommt nur eine `AlbumSource`, die `server.ts` aus dieser View baut; Medien liefert sie
   nur für IDs aus genau diesen Zeilen.
3. Eine ESLint-Regel verbietet in `src/print/` den Import von `db`, `server` und
   `better-sqlite3`, ein Test prüft den Quelltext zusätzlich.

Das PDF entsteht auf dem Server (pdfkit) und wird nicht gespeichert.

## 5d. Einladung als Brief

Für Leute, die man lieber mit Papier einlädt als mit einem Link: In der Kassetten-Ansicht
erzeugt jedes Mitglied ein druckbares A5-Blatt mit QR-Code („Du bist eingeladen.“). Der Code
enthält einen **neuen Einladungs-Token**, unabhängig vom Zugangscode:

- **einmal gültig**, **14 Tage** lang, führt **nur auf diese eine Kassette**
- gespeichert wird nur sein Hash; der Klartext steht ausschließlich im PDF
- Einlösen (QR scannen, Namen wählen) legt eine **normale Einladung** an. Dabei ist man erst
  nach dem bestehenden Zustimmen in der Benachrichtigung, die dafür gleich aufgeht.
- Wer schon Mitglied ist, verbraucht den Brief nicht.

Die Adresse im QR-Code ist `PUBLIC_URL` oder, falls leer, die Adresse, von der aus der Brief
angefordert wurde. Das Druck-Modul `backend/src/print/letter.ts` hat wie das Album keinen
Datenbankzugang.

## 6. Das Mixtape — der eigentliche USP

Ein Mixtape ist ein **Geschenk an genau eine Person**. Du baust es über Tage: bis zu **12 Titel**,
Cover, handgeschriebene Widmung. Der Empfänger sieht **nichts**, solange es ein Entwurf ist —
erst das **Versiegeln** überreicht es, danach ist es unveränderlich.

Das Regal ist **persönlich**, nicht an eine Kassette gebunden. Ein fertiges Tape kann man
zusätzlich auf Seite A einer Runde teilen.

**Bewusst ohne Spotify.** Deren Development Mode ist seit Februar 2026 auf **5 Nutzer** begrenzt,
Extended Quota verlangt ein eingetragenes Unternehmen und **250.000 MAU** — für dieses Projekt
unerreichbar, und eine Abhängigkeit von einer Plattform widerspräche der Mission. Stattdessen:
Titel, Künstler und ein beliebiger Musiklink. Die Plattform wird lokal am Hostnamen erkannt, ohne
einen einzigen Aufruf nach draußen. Funktioniert für Apple Music, YouTube und Bandcamp genauso.

## 7. Hot Line

Eine offene Leitung zwischen **zwei Personen**, unabhängig von jeder Kassette. Gelber
Walkman-Knopf unten neben REC. Normalfall ist ein echter Verlauf — die erste Nachricht eröffnet
die Leitung, danach ein echtes Hin und Her. Dieselben Nachrichtenarten wie im Gruppenchat
(Text bis 240 Zeichen, Schnappschuss, Clip, O-Ton, versiegeltes Mixtape) und dieselbe
Darstellung: Seite B und Hot Line teilen sich die Komponente `ChatThread`.

**Der Verlauf bleibt dauerhaft.** Ursprünglich war ein rollierendes 24-Stunden-Fenster geplant
(nur die letzten 24 Stunden sichtbar, danach fallen Nachrichten einzeln raus) — das wurde
zusammen mit dem Verfall auf Seite B verworfen, aus demselben Grund: ein Gespräch, das sich
hinter einem wegradiert, erzeugt Druck statt Leichtigkeit. Der Hot-Line-Knopf zeigt Ungelesenes
als Zahl.

**Neuigkeiten-Anzeige** (die alte „Anrufbeantworter"-Lampe, unten links): eine blinkende LED,
kein Zähler. Fasst zwei getrennte Rubriken zusammen — offene Leitungen mit Ungelesenem, und
Kassetten, auf denen seit dem letzten Einlegen etwas Neues dazukam. Bewusst nicht zu einer Zahl
verrechnet: „wer dir schreiben will" ist etwas anderes als „wer was gepostet hat". Welche
Kassette „neu" ist, entscheidet ein rein lokaler Zeitstempel pro Kassette (kein Server-Zustand,
kein Tracking) gegen deren `lastAt`.

## 8. Sicherheitsmodell — was der Server sieht

**Aktueller Stand: alles.** Nichts ist Ende-zu-Ende verschlüsselt, auch Seite B nicht. Das steht
so in der App, und es bleibt so, bis es nicht mehr stimmt.

**Warum noch nicht:** Verschlüsselung ohne Anmeldung ist Dekoration. Die Identität ist derzeit ein
Name in einem Eingabefeld — jeder kann „Mira" eintippen. An so etwas lässt sich kein Schlüssel
binden. Die Reihenfolge muss sein:

1. **Echte Identität** — Konto mit eindeutiger ID (siehe Abschnitt 16), an die ein Schlüssel gehört
2. **Mitgliedschaften** — wer ist wirklich in dieser Runde
3. **Dann E2EE**

**Festgelegt: verschlüsselt wird mit dem Signal-Protokoll.** Kein Eigenbau. Das Protokoll ist
seit Jahren öffentlich auditiert, löst Gruppen-Schlüsselverteilung, Forward Secrecy und
Post-Compromise-Security bereits — genau die Teile, an denen selbstgebaute Krypto scheitert.
Umsetzung über die offiziellen Bibliotheken (`libsignal`), nicht nachprogrammiert.

**Zu klären, wenn es soweit ist:** `libsignal` ist auf native Clients ausgelegt — das ist ein
weiteres Argument für die geplante React-Native-App und gegen den Web-Client als Endziel.
Ausserdem: Was passiert mit Seite A? Moderation illegaler Inhalte setzt voraus, dass der Server
mitlesen kann (siehe Abschnitt 12). Wahrscheinliche Auflösung: **Seite B verschlüsselt,
Seite A bewusst nicht** — und genau so kommuniziert.

**Grenzen, die auch danach bleiben:** Metadaten (wer wann mit wem), Screenshots, und dass
entfernte Mitglieder alte Schlüssel behalten. Gehört offen kommuniziert.

## 9. Technischer Stack

```
kliqtape/
├─ backend/     Node + Express + TypeScript, SQLite (better-sqlite3, WAL)
├─ frontend/    React 19 + TypeScript + Vite, Tailwind v4, Zustand + TanStack Query, PWA
├─ scripts/     seed.py — Testdaten mit echten Bildern und Aufnahmen
├─ docs/        dieses Dokument
└─ docker-compose.yml   nginx + optionaler Tailscale-Sidecar
```

**Keine Third-Party-Verbindungen.** Kein CDN, keine externen Fonts, kein Analytics, kein Sentry.
Jede fremde Verbindung wäre ein Datenleck.

**Lizenz AGPL-3.0** — wer Kliqtape betreibt, muss seinen Quellcode offenlegen.

**Betriebsmodell: zentral gehostet auf Hetzner als Standard, Selbstbetrieb erlaubt.**
Nutzer:innen betreiben nichts selbst, sie melden sich an. Dank AGPL dürfen Communities aber
eine eigene Instanz betreiben; ein dokumentiertes Paket dafür ist geplant. Eigene Instanzen
stehen für sich, Föderation bleibt ausgeschlossen (siehe Abschnitt 11). Der Docker-Compose-Stack
hier ist derzeit die Entwicklungs-/Beta-Umgebung, nicht die Produktion. Die Zielplattform ist eine
**React-Native-App**; der jetzige Web-Client ist ein funktionierender Prototyp, keine
Endarchitektur.

## 10. Datenmodell

Gekürzt, die vollständige Fassung steht in `backend/src/db.ts`.

```sql
cassettes(id, name, created_by, created_at, color_index)
cassette_members(cassette_id, member, added_by, joined_at)
cassette_invites(id, cassette_id, invitee, invited_by, created_at)
reports(id, cassette_id | post_id, reported_by, reason, note, created_at)
imposter_weeks(id, cassette_id, task_key, imposter, started_by, started_at, reveal_at, revealed_at)
imposter_entries(week_id, author, post_id)   imposter_votes(week_id, voter, suspect, created_at)
posts.develop_at, posts.taken_at
      -- Film: unsichtbar bis develop_at (Sonntag 19:00 Berlin), created_at = develop_at
      -- ohne Fremdschlüssel: Meldungen überleben das Löschen des Gemeldeten

posts(id, cassette_id, side, author, kind, body, media_id, tape_id, source,
      note_style, quoted_post_id, created_at)
      -- beide Seiten dauerhaft; expires_at existiert noch, wird aber nicht gesetzt
      -- quoted_post_id: Seite-B-Nachricht greift einen Seite-A-Beitrag auf
cassette_tapes(cassette_id, tape_index, name, named_by, named_at)
      -- Tape = Berlin-Kalendertag seit Gründung, tape_index wird berechnet, nie gespeichert
reactions(post_id, author, media_id, created_at)
      -- Tonfetzen: hörbar nur für posts.author, sonst nur "iSentTonfetzen" (ja/nein)

hotline_threads(id, person_a, person_b, created_at)
hotline_messages(id, thread_id, from_name, kind, body, media_id, tape_id, source,
                 created_at, heard_at)          -- dauerhaft

stories(id, author, kind, media_id, created_at, expires_at)   -- 24 h
mixtapes(id, from_name, to_name, title, note, cover_id, sealed_at, created_at)
mixtape_tracks(id, mixtape_id, position, title, artist, url)
profiles(name, avatar_id, album_opt_out, updated_at)
album_posts   -- VIEW: einzige Quelle für den Album-Export (Abschnitt 5c)
invite_letters(id, cassette_id, token_hash, created_by, created_at, expires_at, used_by, used_at)
person_tokens(name, token_hash, created_at)
media(id, mime, bytes, duration_ms, created_at)
```

## 11. Roadmap

**Erledigt:** Kassetten als Gruppen · Seite A als Archiv, Seite B als dauerhafter Gruppenchat ·
Mixtapes bauen, verschenken, teilen · O-Ton mit Bandquietschen · Kamera und Galerie · Hot Line mit
Anrufbeantworter · Profil mit Export und Löschung · Testdaten-Skript · Storys (24 h) ·
Kliqtape-Kanal mit Förderstand · Zugangscode-Identität

> Der ursprünglich geplante 24-Stunden-Verfall auf Seite B wurde **verworfen** — Seite B ist ein
> dauerhafter Gruppenchat. Das Verfalls-Modell lebt stattdessen in den Storys weiter.

**Als Nächstes:** Konto-/Namensmodell (Abschnitt 16) · Einladungen · Push-Benachrichtigungen ·
E2EE für Seite B über das Signal-Protokoll · Onboarding für neue Nutzer

**Bewusst nicht geplant:** Föderation, Suche über fremde Inhalte, öffentliche Profile,
Reichweiten-Funktionen jeder Art.

## 12. Rechts-Checkliste (Deutschland/EU)

**Ab echtem Betrieb:** Datenschutzerklärung · Löschkonzept · Datenexport (Art. 20, **erledigt**) ·
TOM-Dokumentation (Art. 32) · Verzeichnis von Verarbeitungstätigkeiten (Art. 30)

**Vor öffentlicher Registrierung:** Impressum nach DDG mit ladungsfähiger Anschrift — als
Privatperson heißt das die eigene Wohnadresse · DSA: AGB mit Moderationsregeln, Meldeverfahren,
Kontaktstelle · dokumentierter Takedown-Prozess · Mindestalter

**Der Punkt, an dem Solo-Projekte scheitern:** illegale Bild-Uploads. Solange Seite A server-lesbar
ist, bleibt Moderation möglich — das ist der Grund, sie *nicht* zu verschlüsseln. Kombiniert mit
Einladungs-Pflicht (kein anonymer Massen-Signup) ist das Risiko in einer geschlossenen Runde gering.
Vor einer Öffnung juristisch prüfen lassen.

## 13. Visuelle Identität

**Seite A — Type I, klassisch.** Mattes schwarzes Gehäuse `#23201C`, Papieretikett `#E4DAC4`,
Oxidbraun `#5C3A21`, roter Type-I-Streifen `#B8462C`, Handschrift auf dem Etikett.

**Seite B — Atomic Purple.** Das durchscheinende Violett des Game Boy Color von 1999 `#6B4A9E`,
milchiger Rand `#C9AFEF`, Glow `#A97CE8`, dunkler Innenraum `#2B1A42`, ein Hauch Platinengrün
`#4E7A5E`. Bei transluzentem Plastik *sieht man die Maschine* — so soll sich Verschlüsselung
später anfühlen.

**Hot Line** `#F5B324` — Sony-Sports-Walkman-Gelb, Beschriftung auf dem Gehäuse über der Taste.

**Keine frei wählbaren Farben.** Die zwei Farbwelten sind das Produkt; ein Farbwähler würde die
Wiedererkennbarkeit auflösen und unlesbare Kombinationen erzeugen. Stattdessen später ein paar
fertig gestaltete **Bandsorten** (Type I / Chrome / Metal) und **Gehäusefarben** (Atomic Purple /
Kiwi / Berry).

## 14. Namensrechte (geprüft 2026-08-01)

`kliqtape.com` · `.io` · `.de` · `.net` · `.social` frei · `github.com/kliqtape` frei · npm frei ·
`.app` ungeprüft.

⚠️ **„Kliq" allein ist als App-Marke belegt** (zwei aktive Apps auf `kliqapp.io`). Vor einer
Markenanmeldung Verwechslungsgefahr in Klasse 9/38/42 bei DPMA und EUIPO prüfen lassen.

## 15. Offene Entscheidungen

1. **Wie groß darf eine Kassette werden?** Hartes Limit oder Empfehlung.
2. **Bandsorten** frei wählbar statt nur gepaart mit der Gehäusefarbe.
3. **Verfallsdauer der Storys** — 24 Stunden fest oder einstellbar.

## 16. Offene Punkte vor dem öffentlichen Start

Stand 2026-08-10, aus einer Durchsicht des gesamten Codes. Alles hier ist **bewusst
vermerkt statt sofort umgesetzt** — die Punkte gehören in die Planung der
React-Native-App, nicht mehr in den Web-Prototyp.

### 16.1 Sicherheitsprüfung — Pflicht vor dem Launch

Die Durchsicht hat eine ganze Klasse von Lücken gefunden: **veränderende Routen ohne
Berechtigungsprüfung.** Nachgewiesen gegen eine Test-Datenbank, nicht nur vermutet.

**Behoben (2026-08-10):**

| Route | Lücke |
|---|---|
| `DELETE /api/posts/:id` | Löschte fremde Beiträge **ohne jeden Zugangscode**. Jedes Gruppenmitglied sieht im Feed die IDs aller Beiträge — damit konnte jeder die Beiträge aller anderen löschen, samt Mediendatei. Jetzt: nur der Autor. |
| `DELETE /api/mixtapes/:id` | Löschte fremde Mixtapes ohne Zugangscode — auch versiegelte Geschenke, unwiederbringlich. |
| `PATCH /api/mixtapes/:id` | Fremde Tapes umschreiben (Titel, Widmung, Cover). |
| `POST /api/mixtapes/:id/tracks` | Titel auf fremde Tapes legen. |
| `DELETE /api/mixtapes/:id/tracks/:trackId` | Titel von fremden Tapes entfernen. |
| `POST /api/mixtapes/:id/seal` | Fremde Entwürfe versiegeln und damit zwangsweise verschenken. |

Alle fünf Mixtape-Routen laufen jetzt über den gemeinsamen Helfer `requireTapeOwner()`
(`backend/src/server.ts`), damit nicht beim nächsten neuen Endpunkt wieder einer vergessen
wird.

**Lehre daraus, für die App wichtig:** Die Ursache war nicht Unachtsamkeit an einer
Stelle, sondern dass es **keine Tests für Berechtigungslogik gibt**. Beim Neubau gehört zu
jeder verändernden Route ein Test „Fremder darf das nicht". Bevor die App an echte Nutzer
geht, sollte eine vollständige Durchsicht **aller** Endpunkte auf Authentifizierung und
Eigentumsprüfung stehen.

### 16.2 Konto- und Namensmodell (festgelegt)

Das heutige Modell — der Name **ist** die Identität, first come first served — ist der
gefährlichste Rest für einen öffentlichen Dienst: Mitglieder werden als *Namens-String* zu
Kassetten hinzugefügt, auch wenn den Namen noch niemand beansprucht hat. Wer den Namen
später zuerst beansprucht, erbt den Zugriff auf die Gruppenhistorie.

**Geplantes Modell:**

- **Anzeigename** — frei geschrieben, mehrfach vergebbar, jederzeit änderbar (echter Name)
- **Eindeutige ID** — vom System vergeben, unveränderlich, die eigentliche Identität
- **Benutzername** — selbst gewählt, eindeutig, änderbar; die menschenlesbare Adresse

Hinzufügen dann **über Benutzername oder über die eindeutige ID**, nie über den
Anzeigenamen. Alle Mitgliedschaften, Beiträge und Schlüssel hängen an der ID, nicht am
Namen — dadurch ist Umbenennen gefahrlos und Namens-Übernahme unmöglich.

**Zusätzlich:** Profil-Link zum Teilen. Man lässt sich einen Link generieren
(z. B. `kliqtape.de/@benutzername` oder ein Token-Link), über den andere einen direkt
hinzufügen können — der übliche Weg, wie Leute sich heute vernetzen.

### 16.3 Datenbank und Mandantenfähigkeit

Heute: **eine SQLite-Datei, ein Prozess, ein globaler `ADMIN_NAME`** — passend für die
Beta, nicht für einen zentralen Dienst mit vielen unabhängigen Freundeskreisen. Zu
entscheiden vor dem Launch:

- SQLite behalten (einfach, schnell, aber ein Schreiber und ein Server) **oder**
  PostgreSQL (mehrere Instanzen, echte Nebenläufigkeit, Standard bei Hetzner)
- Empfehlung: **PostgreSQL**, sobald es öffentlich wird. Der Umstieg ist umso teurer, je
  später er kommt — das Schema ist heute noch klein.
- Alle Abfragen sind bereits parametrisiert (`better-sqlite3` prepared statements), also
  kein SQL-Injection-Risiko; das bleibt beim Umstieg beizubehalten.

### 16.4 Backup-Strategie — fehlt komplett

Es gibt **keine**. Weder im `docker-compose.yml` noch dokumentiert. Bei einem Dienst,
dessen Versprechen „deine Erinnerungen bleiben" ist, wäre ein verlorenes Volume das
Projektende. Nötig:

- Regelmässiger konsistenter DB-Schnappschuss (bei SQLite `.backup`, nicht Datei kopieren —
  WAL!) plus Sicherung des Medien-Verzeichnisses
- Off-Site, verschlüsselt, mit **getestetem Rückspielen** — ein Backup, das nie
  zurückgespielt wurde, ist keins
- Aufbewahrungsdauer festlegen (kollidiert sonst mit dem Löschkonzept aus Abschnitt 12)

### 16.5 Medien sind unauthentifiziert abrufbar

`GET /api/media/:id` prüft **nichts**. Die IDs sind zufällige UUIDs, also praktisch nicht
erratbar — die Dateien sind damit „unlisted", aber nicht geschützt. Wer eine ID kennt oder
mitbekommt (geteilter Link, Export, Protokolldatei), kommt dauerhaft dran, auch ohne
Mitglied zu sein. Für eine App mit Privatsphäre als Kernversprechen sollte der Abruf an
die Mitgliedschaft gebunden werden — oder an kurzlebige signierte Links.

**Teilweise behoben (2026-10-06):** Das *Hochladen* (`POST /api/media`) verlangt jetzt einen
gültigen Zugangscode. Vorher konnte jeder, der die URL kannte, Dateien auf die Platte schreiben.
Der *Abruf* bleibt wie beschrieben offen.

### 16.6 Rechtliches vor der öffentlichen Registrierung

Die Liste steht in Abschnitt 12 und wird mit dem Wechsel von „Freundeskreis über
Tailscale" zu „öffentlicher Dienst auf Hetzner" **verbindlich**, nicht mehr optional.
Kurzfassung: Impressum mit ladungsfähiger Anschrift · Datenschutzerklärung ·
AV-Vertrag mit Hetzner · Verzeichnis von Verarbeitungstätigkeiten · TOM-Dokumentation ·
DSA-Pflichten (Meldeverfahren, Moderationsregeln, Kontaktstelle) · Mindestalter.
Dazu die Produktseite davon: **Melden** gibt es seit v0.35 (speichern und bestätigen, siehe
Abschnitt 1), **Blockieren** und eine Moderationsoberfläche noch nicht.

### 16.7 Qualitätssicherung

**Eingerichtet (2026-10-06):** API-Tests mit vitest in `backend/tests/`. Der echte Server
startet dabei als eigener Prozess gegen eine Wegwerf-Datenbank. Pro verändernder Route gibt es
mindestens einen Test „Fremder darf das nicht“ (siehe 16.1), jeweils mit Gegenprobe, dass die
berechtigte Person es darf. ESLint (Flat Config) läuft in beiden Paketen. GitHub Actions prüft
bei jedem Push Typen, Lint, Tests und den Frontend-Build, mit `TZ=Europe/Berlin`.

**Regel ab jetzt:** Eine neue verändernde Route kommt nur zusammen mit ihrem Fremden-Test ins
Repo.

**Lokal:** Node 22 wie im Docker-Image. `better-sqlite3` 11 lässt sich unter Node 26 nicht
bauen; ohne Node 22 im Pfad hilft `npx -p node@22 -- npm test`.
