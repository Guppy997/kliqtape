# Kliqtape

Ein soziales Netz mit zwei Seiten — wie ein Mixtape.
**Seite A („Die Crew")** sind alle deine Freunde. **Seite B („Die Kliqe")** sind die wenigen,
denen du wirklich alles erzählst. Oben umschalten, wie eine Kassette umdrehen.

Chronologisch. Endlich. Ohne Algorithmus, ohne Werbung, ohne Zahlen.

**Hosting-Kontext:** Läuft self-hosted auf dem eigenen Server / Raspberry Pi via Docker.
Kein Vercel, kein Netlify, keine externe Cloud. Zugriff im Tailnet über einen
Tailscale-Sidecar mit eigenem Hostnamen.

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
