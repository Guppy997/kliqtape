# Kliqtape

> Ein Regal voller Kassetten. Jede steht für eine Runde von Leuten.
> Du legst eine ein — **Seite A** ist das, was bleibt. **Seite B** wird nach
> 24 Stunden überspielt. Chronologisch, ohne Algorithmus, ohne Werbung, ohne Zahlen.

**Stand:** 2026-08-02 · lauffähiger Prototyp, noch ohne Anmeldung und Verschlüsselung
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
**Haltbarkeit**:

| | **Seite A** | **Seite B** |
|---|---|---|
| Was da hingehört | was bleiben soll: Bilder, Infos, Absprachen | was flüchtig ist: Gespräch, Zwischenstand, Gedanke |
| Lebensdauer | dauerhaft | **24 Stunden, dann überspielt** |
| Sortierung | chronologisch, filterbar nach Art | chronologisch |
| Charakter | Archiv der Runde | offene Leitung |

Auf einer echten Kassette war die B-Seite die, die man überspielt hat. Genau das passiert hier.

### Warum das leichter ist als die übliche Lösung

Andere Apps verlangen bei jedem Beitrag die Frage: *„Wie intim ist das? Wer darf das sehen?"*
Das ist anstrengend, und genau daran scheitern Close-Friends-Funktionen — aus Unsicherheit postet
man am Ende gar nichts.

Hier sind es zwei Fragen, die man ohne Nachdenken beantwortet:

1. **Welche Kassette?** → Du weißt, mit wem du redest.
2. **Bleibt das oder ist es weg?** → Du weißt, ob es wichtig ist.

## 2. Warum es funktionieren kann

**Kein Cold-Start-Problem.** Eine Kleingruppen-App ist mit sechs Leuten vollständig. Wachstum
passiert über Zellteilung, nicht über kritische Masse.

**Die Metapher trägt das Datenmodell.** Ein Kassettenregal *ist* eine Sammlung getrennter Kreise.
Die Gestaltung ist nicht Verzierung, sondern die Struktur selbst.

**Der Verzicht ist kopiersicher.** Instagram kann keinen Feed einführen, der sich selbst löscht,
und keine Follower-Zahlen abschaffen — es würde ihr Geschäftsmodell zerstören.

## 3. Positionierung

> **Das soziale Netz, das dich wieder gehen lässt.**

- **Seite B ist endlich.** Sie leert sich von selbst. Kein Archiv, kein Nachlesen, kein Druck.
- **Keine öffentlichen Zahlen.** Keine Follower, keine Likes. Du siehst *wer* reagiert hat.
- **Kleine Runden.** Eine Kassette fasst so viele Leute, wie man wirklich kennt.
- **Datenminimierung als Architektur.** Später Login per Passkey — keine E-Mail, kein Passwort.
- **Nachprüfbare Ehrlichkeit.** Im Profil steht eine Tabelle „Was der Server sieht", und sie sagt
  immer die Wahrheit — auch dann, wenn die Antwort unangenehm ist.

## 4. Was es „cooler" macht

**Retro sind die Materialien, modern ist alles andere.** Bandkorn, Filzstift, Fotoabzug — aber
saubere Typografie, großzügige Abstände, flüssige Bewegung. Kein Sepia über allem.

- **Tippen auf die Kassette dreht sie um.** Auf halbem Weg steht sie hochkant, dort wechselt der
  Inhalt — man sieht ihn nie umklappen.
- **Die Spulen laufen beim Scrollen mit.** Links wird dünner, rechts dicker.
- **Track-Nummern statt Zeitstempel.** `A3`, `B7` — Position auf dem Band, kein Zeitdruck.
- **Reaktionen sind Gesichter, keine Zahl.** Bei zwölf Leuten ist „wer" interessanter als „wie viele".
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
die Leitung, danach ein echtes Hin und Her. **Nur Text**, höchstens 240 Zeichen pro Nachricht.

**Rollierendes 24-Stunden-Fenster:** jede Nachricht hält die Leitung offen, aber nur die letzten
24 Stunden bleiben sichtbar. Es gibt keine feste Frist auf der Leitung selbst — sie „lebt",
solange sie mindestens eine Nachricht hat, die jünger als 24 Stunden ist. Schreibt niemand mehr,
fallen die letzten Nachrichten einzeln raus, bis die Leitung leer ist und verschwindet.

Das löst zwei Probleme auf einmal: aktives Schreiben hält die Leitung offen (kein Gespräch
bricht mitten drin ab), aber es sammelt sich nie ein permanenter Verlauf an — auch bei Freunden,
die täglich schreiben, bleiben immer nur die letzten 24 Stunden sichtbar. Eingehende landen auf
dem **Anrufbeantworter** mit blinkender LED und öffnen direkt den Verlauf mit dieser Person.

## 8. Sicherheitsmodell — was der Server sieht

**Aktueller Stand: alles.** Nichts ist Ende-zu-Ende verschlüsselt, auch Seite B nicht. Das steht
so in der App, und es bleibt so, bis es nicht mehr stimmt.

**Warum noch nicht:** Verschlüsselung ohne Anmeldung ist Dekoration. Die Identität ist derzeit ein
Name in einem Eingabefeld — jeder kann „Mira" eintippen. An so etwas lässt sich kein Schlüssel
binden. Die Reihenfolge muss sein:

1. **Passkey-Anmeldung** — echte Identität, an die ein Schlüssel gehört
2. **Mitgliedschaften** — wer ist wirklich in dieser Runde
3. **Dann E2EE** — Inhalt mit Zufallsschlüssel, der Schlüssel pro Mitglied einzeln verpackt

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

## 10. Datenmodell

```sql
cassettes(id, name, created_by, created_at)
cassette_members(cassette_id, member, added_by, joined_at)

posts(id, cassette_id, side, author, kind, body,
      media_id, tape_id, source, expires_at, created_at)
      -- side='b' setzt expires_at = created_at + 24h
reactions(post_id, author, created_at)

mixtapes(id, from_name, to_name, title, note, cover_id, sealed_at, created_at)
mixtape_tracks(id, mixtape_id, position, title, artist, url)

hotlines(id, post_id?, from_name, to_name, body, created_at, expires_at, heard_at)
profiles(name, avatar_id, updated_at)
media(id, mime, bytes, duration_ms, created_at)
```

## 11. Roadmap

**Erledigt:** Kassetten als Gruppen · beide Seiten mit 24-Stunden-Verfall auf B · Mixtapes bauen,
verschenken, teilen · O-Ton mit Bandquietschen · Kamera und Galerie · Hot Line mit
Anrufbeantworter · Profil mit Export und Löschung · Testdaten-Skript

**Als Nächstes:** Passkey-Anmeldung · Einladungen · Push-Benachrichtigungen · E2EE für Seite B ·
Onboarding für neue Nutzer

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
2. **Verfall auf Seite B: 24 Stunden fest** oder pro Kassette einstellbar.
3. **Bandsorten** frei wählbar statt nur gepaart mit der Gehäusefarbe.
