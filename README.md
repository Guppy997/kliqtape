# Kliqtape

Ein Regal voller Kassetten. **Jede Kassette ist eine Runde von Leuten** — du legst die
ein, mit der du gerade redest. Man hat nicht *einen* Freundeskreis, sondern mehrere,
und die zu vermischen funktioniert nicht.

Jede Kassette hat zwei Seiten:

- **Seite A — bleibt.** Das Archiv der Runde: Bilder, Absprachen, Infos. Filterbar nach Art.
- **Seite B — läuft weiter.** Der Gruppenchat der Runde, dauerhaft.

Tippen auf die Kassette dreht sie um. Chronologisch, ohne Algorithmus, ohne Werbung,
ohne Zahlen.

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

| Fehlt | Warum |
|---|---|
| Login / Passkeys | Du tippst beim Start einfach einen Namen ein |
| Ende-zu-Ende-Verschlüsselung | Seite B ist hier **nicht** verschlüsselt |
| Freundschaften, Einladungen | jeder sieht alles |
| Löschkonzept, Datenexport | kommt mit v0.1 |

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
Danach in der App als **Aaron** anmelden.

Bilder werden mit Pillow erzeugt, Ton als echtes WAV — beides muss abspielbar
sein, weil der O-Ton-Spieler das Audio tatsächlich dekodiert.
Voraussetzung: `python3 -m pip install --user Pillow`.

**Clips fehlen in den Testdaten** — dafür bräuchte es ffmpeg. Videos lassen sich
in der App direkt mit der Kamera aufnehmen.

## Aufbau

```
kliqtape/
├─ backend/     Node + Express + TypeScript, SQLite (better-sqlite3)
├─ frontend/    React 19 + TypeScript + Vite, Tailwind v4, Zustand + TanStack Query, PWA
├─ docs/        CONCEPT.md — Produktkonzept, Sicherheitsmodell, Roadmap
└─ docker-compose.yml
```

Medien (Fotos, Videos, Mixtapes) landen als Dateien im Volume `kliqtape-media`,
die Metadaten in SQLite unter `kliqtape-data`.

## Entwicklung ohne Docker

```bash
cd backend  && npm install && npm run dev     # :3000
cd frontend && npm install && npm run dev     # :5173, proxyt /api auf :3000
```

## Gestaltungsregel

**Retro sind die Materialien, modern ist alles andere.** Bandkorn, Filzstift, Fotoabzug — aber
saubere Typografie, großzügige Abstände, flüssige Bewegung. Kein Sepia über allem, keine
Holzoptik, keine künstlichen Kratzer.

## Lizenz

AGPL-3.0 — wer Kliqtape betreibt, muss seinen Quellcode offenlegen.
