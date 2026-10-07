# Kliqtape

[![CI](https://github.com/Guppy997/kliqtape/actions/workflows/ci.yml/badge.svg)](https://github.com/Guppy997/kliqtape/actions/workflows/ci.yml)
[![Lizenz: AGPL-3.0](https://img.shields.io/badge/Lizenz-AGPL--3.0-blue.svg)](LICENSE)

> **In short (English):** Kliqtape is an ad-free, algorithm-free social app for small, fixed
> groups of friends. Every group is a cassette: side A is the group's lasting archive, side B
> its ongoing group chat. No follower counts, no likes, no feed ranking. This repository is a
> working web prototype (PWA, React + Express + SQLite); the target platform is React Native.
> Documentation is in German.

Ein Regal voller Kassetten. **Jede Kassette ist eine Runde von Leuten** — du legst die
ein, mit der du gerade redest. Man hat nicht *einen* Freundeskreis, sondern mehrere,
und die zu vermischen funktioniert nicht.

Jede Kassette hat zwei Seiten:

- **Seite A — bleibt.** Das Archiv der Runde: Bilder, Absprachen, Infos. Filterbar nach Art.
- **Seite B — läuft weiter.** Der Gruppenchat der Runde, dauerhaft.

Tippen auf die Kassette dreht sie um. Chronologisch, ohne Algorithmus, ohne Werbung,
ohne Zahlen.

**Plattform:** Dieser Prototyp ist eine **PWA** (React + Vite, im Browser und als installierte
Web-App). Die **Zielplattform ist React Native** — der Web-Client hier dient dazu, das Konzept
anfassbar zu machen und mit echten Freundeskreisen zu testen, er ist nicht die Endarchitektur.
Das Backend (Express + SQLite) bleibt davon unberührt.

**Hosting-Modell:** Kliqtape läuft als **zentral betriebener Dienst auf Hetzner** und wird von
dort aus skaliert — wie ein normaler Social-Media-Server. Das ist der Standard für alle:
Nutzer:innen legen keinen eigenen Server an, sie melden sich einfach an. Zielgruppe sind
alle, nicht nur Leute, die selbst hosten würden.

**Selbstbetrieb ist trotzdem erlaubt.** Der Code steht unter AGPL-3.0, Vereine,
Hochschulgruppen oder andere Communities dürfen also eine eigene Instanz betreiben. Ein
dokumentiertes Paket dafür ist geplant. Kliqtape ist bewusst **nicht föderiert**: Eine eigene
Instanz steht für sich und ist nicht mit der zentralen verbunden.

Das `docker-compose.yml` in diesem Repo ist derzeit die **Entwicklungs- und Beta-Umgebung**
(inklusive optionalem Tailscale-Sidecar für den Zugriff im eigenen Tailnet), nicht das
Produktions-Setup.

---

## ⚠️ Was das hier ist — und was nicht

Das ist ein **Gefühls-Prototyp**, kein v0.1. Er existiert, um die Produktidee anfassbar zu
machen: Dreht sich die Kassette gut? Fühlt sich das Zurückspulen echt an? Macht die
Kamera-Beschränkung Spaß oder nervt sie?

**Absichtlich noch nicht drin:**

| Fehlt | Stand im Prototyp |
|---|---|
| Ende-zu-Ende-Verschlüsselung | **Nichts** ist verschlüsselt, auch Seite B nicht. Die App sagt das selbst (Profil → Zahnrad → „Was der Server sieht“). |
| Konten mit Passkey | Ein Name plus Zugangscode pro Gerät, kein Passwort, keine E-Mail |
| Moderationsoberfläche | Melden speichert die Meldung nur, niemand bearbeitet sie automatisch |
| Medien nur für Mitglieder | Bilder sind über ihre zufällige ID abrufbar, auch die aus eigenen, privaten Tapes — außer Film und Imposter-Beiträgen vor der Freigabe |

**Also:** nur im eigenen Tailnet betreiben, keine echten privaten Inhalte reinstellen.

---

## Starten

```bash
cp .env.example .env      # Werte anpassen (mindestens TS_AUTHKEY, falls Tailscale genutzt wird)
docker compose up --build
```

Danach: **http://localhost:8099**

### 📷 Wichtig: Kamera und Mikrofon brauchen HTTPS

Browser geben `getUserMedia` nur in einem *secure context* frei. Das heißt:

- **`http://localhost:8099`** funktioniert vollständig (localhost gilt als sicher).
- **`http://<lan-ip>:8099`** — Kamera und Mikrofon bleiben **blockiert**.
- **`https://kliqtape.<tailnet>.ts.net`** funktioniert — Tailscale Serve liefert ein gültiges
  Zertifikat. Genau dafür ist der Sidecar da.

Ohne Tailscale testest du am besten direkt auf dem Rechner, auf dem Docker läuft.

---

## Für die Demo

Neben Seite A, Seite B, Storys, Mixtapes und Hot Line gibt es ein paar Funktionen, die das
Konzept in wenigen Minuten erklären (Details in `docs/CONCEPT.md`, Abschnitte 5a–5d):

- **Entwickelter Film** — ein Bild pro Woche und Kassette, sichtbar erst Sonntag 19 Uhr für alle
- **Imposter-Woche** — ein Special ab vier Leuten, mit Auflösung, ohne Punkte
- **Album als PDF**, **Einladung als Brief** mit QR-Code, **Mixtape als Bild**
- **Die Kassette altert** alle 10 Tage ein wenig

Damit man in einer Vorführung nicht bis Sonntag warten muss: `DEMO_TOOLS=1` in der `.env`.
Dann kann die Person, die eine Kassette angelegt hat, den Film sofort entwickeln und die
Imposter-Woche auf Sonntagabend vorziehen. Im Betrieb bleibt das leer.

## Testdaten

Damit sich jede Funktion ansehen lässt, ohne alles von Hand anzulegen:

```bash
python3 scripts/seed.py --reset          # anlegen (vorher aufräumen)
python3 scripts/seed.py --reset --me Max # anderer Hauptnutzer
```

Legt fünf Leute mit Profilbildern an und erzeugt **drei Kassetten mit
unterschiedlichen Besetzungen** — Alle Freunde, Freitagsrunde, Die Kliqe —, damit
sichtbar wird, dass sich die Kreise nicht vermischen. Füllt beide Seiten mit Zetteln,
Schnappschüssen und O-Tönen, baut drei Mixtapes (eines geschenkt, eines geteilt, eines
als Entwurf), setzt Reaktionen und legt zwei Hotlines auf den Anrufbeantworter.
Danach in der App als **Aaron** anmelden — das Skript gibt am Ende den Zugangscode aus.
Die Codes aller Testpersonen merkt es sich in `scripts/.seed-tokens.json` (nicht im Repo),
damit `--reset` sie wieder löschen kann. Ist der Name auf dem Server schon vergeben:
`--me-token <Zugangscode>`.

Bilder werden mit Pillow erzeugt, Ton als echtes WAV — beides muss abspielbar
sein, weil der O-Ton-Spieler das Audio tatsächlich dekodiert.
Voraussetzung: Pillow, z. B. in einer venv: `python3 -m venv .venv && .venv/bin/pip install Pillow`.

**Clips fehlen in den Testdaten** — dafür bräuchte es ffmpeg. Videos lassen sich
in der App direkt mit der Kamera aufnehmen.

## Aufbau

```
kliqtape/
├─ backend/                 Node + Express + TypeScript, SQLite (better-sqlite3)
│  ├─ src/server.ts         Einstieg: Middleware, Routen einhängen, Fehlerbehandlung
│  ├─ src/routes/           ein Modul pro Bereich: account, cassettes, posts, tapes,
│  │                        film, imposter, album, letters, reports, stories, news,
│  │                        hotline, mixtapes
│  ├─ src/access.ts         Zugangscode und Mitgliedschaft (requireIdentity, requireMember)
│  ├─ src/media.ts          Upload/Abruf und wann ein Medium (noch) nicht herausgegeben wird
│  ├─ src/time.ts           Tage, Tapes und Sonntagabend in Europe/Berlin
│  ├─ src/db.ts             Schema und Migrationen
│  ├─ src/print/            PDF für Album und Brief — ohne Datenbankzugang
│  └─ tests/                API-Tests gegen einen echten Server, Unit-Tests für die Zeitlogik
├─ frontend/                React 19 + TypeScript + Vite, Tailwind v4, Zustand + TanStack Query, PWA
│  ├─ src/components/       Oberfläche, eine Datei pro Baustein
│  ├─ src/lib/              API-Client, Zeitlogik (Spiegel von backend/src/time.ts), Zeichnen
│  └─ src/store/            kleine Zustand-Stores für flüchtigen UI-Zustand
├─ docs/CONCEPT.md          Produktkonzept, Sicherheitsmodell, offene Punkte
├─ scripts/seed.py          Testdaten mit echten Bildern und Tonaufnahmen
└─ docker-compose.yml       Entwicklungs- und Beta-Umgebung
```

Medien (Fotos, Videos, Mixtapes) landen als Dateien im Volume `kliqtape-media`,
die Metadaten in SQLite unter `kliqtape-data`.

## Entwicklung ohne Docker

Node 22, wie im Docker-Image. `better-sqlite3` 11 baut nicht unter Node 26.

```bash
cd backend  && npm install && npm run dev     # :3000
cd frontend && npm install && npm run dev     # :5173, proxyt /api auf :3000
```

## Tests und CI

```bash
cd backend  && npm test            # API-Tests gegen eine Wegwerf-Datenbank
cd backend  && npm run lint && npm run typecheck
cd frontend && npm run lint && npm run typecheck && npm run build
```

Die Tests starten den echten Server als eigenen Prozess. Jede verändernde Route hat mindestens
einen Test „Fremder darf das nicht“. GitHub Actions führt dasselbe bei jedem Push aus
(`.github/workflows/ci.yml`).

## Gestaltungsregel

**Retro sind die Materialien, modern ist alles andere.** Bandkorn, Filzstift, Fotoabzug — aber
saubere Typografie, großzügige Abstände, flüssige Bewegung. Kein Sepia über allem, keine
Holzoptik, keine künstlichen Kratzer.

## Mitmachen

Wie man das Projekt lokal startet, welche Prüfungen vor einem Commit laufen und welche Regeln im
Code gelten, steht in [CONTRIBUTING.md](CONTRIBUTING.md). Sicherheitslücken bitte nicht als
öffentliches Issue melden, sondern wie in [SECURITY.md](SECURITY.md) beschrieben.

## Lizenz

AGPL-3.0 — wer Kliqtape betreibt, muss seinen Quellcode offenlegen.
