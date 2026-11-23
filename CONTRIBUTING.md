# Mitmachen bei Kliqtape

Kliqtape ist ein Prototyp in aktiver Entwicklung. Beiträge sind willkommen. Am besten vorher ein
Issue aufmachen, damit wir kurz abstimmen, ob die Idee zum Konzept passt
([docs/CONCEPT.md](docs/CONCEPT.md)).

## Lokal starten

Voraussetzung ist **Node 22** (wie im Docker-Image). `better-sqlite3` 11 lässt sich mit neueren
Node-Versionen nicht bauen; ohne Node 22 im Pfad hilft `npx -p node@22 -- <befehl>`.

```bash
cd backend  && npm install && npm run dev     # API auf :3000
cd frontend && npm install && npm run dev     # App auf :5173, leitet /api an :3000 weiter
python3 scripts/seed.py --base http://localhost:3000   # Testdaten (braucht Pillow)
```

## Vor jedem Commit

```bash
cd backend  && npm run format:check && npm run typecheck && npm run lint && npm test
cd frontend && npm run format:check && npm run typecheck && npm run lint && npm run build
```

GitHub Actions führt genau das bei jedem Push aus. `npm run format` formatiert mit Prettier.

## Regeln im Code

- **Jede verändernde Route bekommt einen Test „Fremder darf das nicht“** und eine Gegenprobe,
  dass die berechtigte Person es darf (`backend/tests/`). Der Grund steht in CONCEPT.md §16.1:
  fehlende Berechtigungsprüfungen waren die häufigste Lücke.
- **Berechtigungen nur über `backend/src/access.ts`** (`requireIdentity`, `requireMember`,
  `creatorOf`), nicht von Hand in der Route nachgebaut.
- **Zeit nur über die Berlin-Helfer:** `backend/src/time.ts` und `frontend/src/lib/berlinDay.ts`.
  Beide rechnen dasselbe; `backend/tests/time.test.ts` prüft das gegeneinander.
- **Druckmodule (`backend/src/print/`) bekommen ihre Daten übergeben** und importieren die
  Datenbank nicht. So bleiben Seite B und Hot Line für den Export unerreichbar (Lint-Regel).
- **Keine Verbindungen zu Dritten:** kein CDN, keine externen Schriften, kein Tracking.
- **Ehrlichkeit in der App:** Nichts behauptet Verschlüsselung, solange es keine gibt. Neue
  Funktionen bekommen eine Zeile in „Was der Server sieht“ (`Settings.tsx`).
- **Kommentare auf Deutsch**, und sie erklären das *Warum*, nicht das *Was*.
- **Texte in der App:** duzen und geschlechtsneutral, ohne Personenbezeichnungen. Statt
  „Ersteller“ heißt es „hat die Kassette angelegt“, statt „Teilnehmer“ „Mitglieder“, statt
  „Admin“ „verwaltet die Runde“; „Person“, „Leute“, „wer …“ und „alle“ gehen immer. Es gibt
  keine Geschlechtsabfrage. Im Onboarding zusätzlich: kurz und ohne Gedankenstriche.
- **Gestaltung:** Retro sind die Materialien, modern ist alles andere. Konkret (CONCEPT.md §13):
  Systemschrift in der Bedienung, Handschrift nur auf Material, Schreibmaschine nur für Zahlen;
  nichts unter `text-2xs` (11 px); kleine Icon-Knöpfe mit `.hit`; Farben über die Tokens
  (`--accent`, `--danger`, `--on-accent`), nicht als feste Hex-Werte.

## Versionen

Versioniert wird von Hand: Version in `backend/package.json` und `frontend/package.json`
synchron halten und einen Eintrag in `frontend/src/changelog.ts` ergänzen (der erscheint in der
App). Fehlerbehebung = Patch, neue Funktion = Minor. Pro Funktion ein Commit.
