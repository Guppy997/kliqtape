# Kliqtape

> Ein soziales Netz mit zwei Seiten — wie ein Mixtape.
> **Seite A** sind alle deine Freunde. **Seite B** sind die wenigen, denen du wirklich alles
> erzählst, Ende-zu-Ende verschlüsselt. Oben umschalten, wie eine Kassette umdrehen.
> Chronologisch. Endlich. Ohne Algorithmus, ohne Werbung, ohne Zahlen.

**Status:** Konzeptphase, kein Code. Stand 2026-08-01.
**Design-Richtung:** siehe [Entwurf 01](https://claude.ai/code/artifact/256c8199-6b83-4916-b1e9-a30f88ea53c4)

**Sprachregelung:** In diesem Dokument stehen die technischen Begriffe *Open Space* und
*Inner Circle* für das, was im Produkt **Seite A** und **Seite B** heißt. In der App tauchen
die technischen Begriffe nie auf.

| Produkt | Heißt in der App | Technisch | Kurz |
|---|---|---|---|
| **Seite A** | Die Crew | Open Space | alle Freunde, server-lesbar, moderierbar |
| **Seite B** | Die Kliqe | Inner Circle | VIPs, Ende-zu-Ende verschlüsselt, verfällt |

*Crew* und *Kliqe* sind bewusst dasselbe Sprachregister — beides geborgter 90er-Slang, der
Unterschied ist nur die Größe. Alternative Schreibweise „Die Krew", passend zur q-Logik von Kliq.

**Wortmarke:** `Kliq` steht, `tape` ist nur Kontur — der bedruckte Teil des Etiketts und der,
den man selbst ausfüllt. Umgesetzt in `frontend/src/components/Lockup.tsx`.

---

## 1. Kurzfassung

Die meisten sozialen Netze sind für Reichweite gebaut und verkaufen Aufmerksamkeit. Dieses hier ist
für **Nähe** gebaut und verkauft nichts. Es ist kein „Twitter, aber datenschutzfreundlich" —
es ist der Ort, an dem du deiner tatsächlichen Peer-Group Dinge zeigst, die du nicht ins Internet
stellen würdest.

Der Produktkern sind zwei Sichtbarkeitsringe:

| | **Inner Circle** | **Open Space** |
|---|---|---|
| Publikum | von dir handverlesen (~5–30) | alle deine bestätigten Freunde |
| Verschlüsselung | **Ende-zu-Ende** | Transport + at-rest |
| Server kann Inhalt lesen | **nein** | ja |
| Moderierbar | nein (per Design) | ja |
| Lebensdauer | verfällt nach 30 Tagen (pinnbar) | bleibt |
| Gefühl | intim, warm, dunkel | offen, hell, luftig |

Ein Post gehört immer genau **einem** Ring. Es gibt kein „öffentlich".

## 2. Warum das funktionieren kann

**Kein Cold-Start-Problem.** Der übliche Killer für neue soziale Netze ist, dass sie mit 10 Nutzern
wertlos sind. Eine Kleingruppen-App ist mit 6 Leuten vollständig. Das Produkt ist ab dem ersten
Freundeskreis fertig — Wachstum passiert über Zellteilung, nicht über kritische Masse.

**E2EE wird erst durch die Kleingruppe machbar.** Verschlüsselung für einen öffentlichen Feed ist
mathematisch nicht sinnvoll (jeder kann Empfänger sein). Verschlüsselung für 20 namentlich bekannte
Leute sind 20 Key-Wraps — gelöste Kryptographie. Die Beschränkung ist die Bedingung des Features.

**Der Verzicht ist kopiersicher.** Instagram kann keinen endlichen Feed einführen und keine
Follower-Zahlen abschaffen — es würde ihr Geschäftsmodell zerstören. Alles, was hier weggelassen
wird, ist ein dauerhafter Graben.

## 3. Positionierung

> **Das soziale Netz, das dich wieder gehen lässt.**

Fünf Regeln, die alle dasselbe sagen — *wir wollen deine Aufmerksamkeit nicht*:

1. **Endlicher Feed.** Strikt chronologisch, kein Infinite Scroll. Du scrollst zum Ende und bist
   fertig: *„Das war's. Bis morgen."*
2. **Freunde-Limit ~150** (Dunbar). Kein Wachstumsrennen, keine Influencer-Ökonomie.
3. **Keine öffentlichen Zahlen.** Keine Follower-Counts, keine Like-Counts. Du siehst *wer*
   reagiert hat, nicht *wie viele*. Bei 30 Leuten ist das ohnehin die interessantere Information.
4. **Datenminimierung als Architektur, nicht als Versprechen.** Login per Passkey — keine E-Mail,
   kein Passwort, keine Telefonnummer. Was nie erhoben wurde, kann nicht geleakt, verkauft oder
   beschlagnahmt werden.
5. **Nachprüfbare Ehrlichkeit.** In der App ein Link „So entsteht dein Feed" → direkt auf die
   Query im Repo. Und ein `THREAT-MODEL.md`, das für jeden Ring exakt sagt, was der Server sieht.
   Das kann keine kommerzielle Plattform, und es kostet ein `<a>`-Tag.

## 4. Was es „cooler" macht

Das war die Vorgabe, und sie ist ernst gemeint zu nehmen — Datenschutz allein hat noch nie jemanden
zum Wechseln gebracht. Konkrete Design-Entscheidungen statt Absichtserklärungen:

**Die Ringe sind fühlbar, nicht ein Dropdown.**
Kein „Wer kann das sehen? ▾". Die beiden Ringe sind zwei visuell komplett verschiedene Welten,
zwischen denen du wischst. Inner Circle: dunkel, warm, körnig, enger Satzspiegel. Open Space: hell,
luftig, weit. Du *spürst*, wo du gerade bist, bevor du irgendetwas liest.

**Das Publikum wird zuerst gewählt, nicht zuletzt.**
Erst den Ring wählen, dann schreiben. Das eliminiert die größte Angst bei Close-Friends-Features
(„habe ich das gerade an die falschen Leute geschickt?") und macht die Entscheidung bewusst statt
beiläufig.

**Verschlüsselung ist sichtbar, nicht ein Schloss-Icon.**
Inner-Circle-Posts haben eine eigene Materialität — Textur, Rahmen, Ton. Sicherheit soll man sehen,
nicht in den Einstellungen nachlesen.

**Reaktionen sind Gesichter, keine Zahlen.**
Unter einem Post stehen die Avatare der Leute, die reagiert haben. Warm statt Metrik — und bei
dieser Gruppengröße auch schlicht nützlicher.

**Der Tag ist die Einheit, nicht der Stream.**
Der Feed ist eine Sitzung, kein Fluss. Es gibt einen Anfang und ein Ende. Kein Pull-to-refresh-Reflex.

**Vergänglich als Default im Inner Circle.**
Posts verfallen nach 30 Tagen, außer jemand pinnt sie. Das ist Datenminimierung *und* es senkt die
Hemmschwelle: kein Archiv-Druck, keine Selbstinszenierung fürs Protokoll.

**Onboarding unter 30 Sekunden.**
Einladungscode → Passkey (Face ID / Fingerabdruck) → Name → drin. Kein Formular, keine
E-Mail-Bestätigung, keine Interessen-Auswahl.

## 5. Sicherheitsmodell — was der Server wirklich sieht

Das gehört als `THREAT-MODEL.md` ins Repo und in die App. Ehrlichkeit über die *Grenzen* ist hier
das Verkaufsargument.

| Datum | Inner Circle | Open Space |
|---|---|---|
| Post-Text | ⛔️ Chiffrat | ✅ im Klartext |
| Bilder | ⛔️ Chiffrat | ✅ im Klartext |
| Autor | ✅ sichtbar | ✅ sichtbar |
| Empfängerliste | ✅ sichtbar | ✅ sichtbar |
| Zeitstempel, Größe | ✅ sichtbar | ✅ sichtbar |
| Freundschaftsgraph | ✅ sichtbar | ✅ sichtbar |

**Was ausdrücklich NICHT geschützt ist** — und exakt so kommuniziert werden muss:

- **Metadaten.** Der Server weiß, *wer wem wann* etwas geschickt hat, auch wenn er den Inhalt nicht
  lesen kann. Metadatenschutz wäre ein eigenes, sehr viel größeres Projekt (Sealed Sender o. ä.).
- **Der Empfänger.** E2EE schützt gegen den Server, nicht gegen Screenshots deiner Freunde.
- **Rückwirkendes Entfernen.** Wer aus deinem Inner Circle entfernt wird, hat alte Content-Keys
  bereits erhalten. Neue Posts werden nicht mehr für ihn verschlüsselt, alte bleiben für ihn
  entschlüsselbar. Das ist eine physikalische Grenze, kein Bug — und muss in der UI stehen.
- **Open Space ist privat vor der Welt, nicht privat vor dem Server.** Genau so formulieren.

## 6. Krypto-Architektur

Bibliothek: **libsodium** (`libsodium-wrappers`) im Browser. Keine Eigenbau-Kryptographie.

**Identität**
- Beim Registrieren erzeugt der Client zwei Schlüsselpaare: Ed25519 (Signieren) und X25519
  (Schlüsselaustausch). Nur die öffentlichen Teile gehen an den Server.
- Der private Schlüssel liegt in IndexedDB, verschlüsselt (`crypto_secretbox`).

**Entsperren via Passkey**
- Die WebAuthn-**PRF-Extension** liefert aus einem Passkey ein stabiles 32-Byte-Geheimnis. Damit
  wird der Identitätsschlüssel entpackt. Ergebnis: Face ID entsperrt deine Kryptographie, der
  Server sieht nie einen Schlüssel und braucht nie eine E-Mail.
- ⚠️ **Vor dem Bau verifizieren:** PRF-Support ist browserabhängig. Fallback ist zwingend
  erforderlich → **Recovery-Phrase** (12 Wörter, Argon2id via `crypto_pwhash`). Die Phrase ist
  gleichzeitig der Weg auf ein zweites Gerät.

**Inner-Circle-Post verschlüsseln**
1. Zufälligen Content-Key erzeugen.
2. Inhalt mit `crypto_aead_xchacha20poly1305_ietf` verschlüsseln.
3. Content-Key pro Empfänger einzeln wrappen (`crypto_box_seal` gegen dessen X25519-Public-Key).
4. Server speichert: Chiffrat + N gewrappte Keys. Bei N ≤ 30 vernachlässigbarer Overhead.
5. Post wird mit Ed25519 signiert → Empfänger kann Urheberschaft prüfen.

**Bilder**
- Inner Circle: Client dekodiert → **EXIF-Stripping per Canvas-Reencode** (muss client-seitig
  passieren, der Server kann das Chiffrat nicht anfassen) → Thumbnail + Vollbild erzeugen → beide
  mit dem Content-Key verschlüsseln → als opake Blobs hochladen.
- Open Space: Server darf verarbeiten. `sharp` für EXIF-Strip, Resize, Thumbnails. Deutlich einfacher.

## 7. Technischer Stack

Folgt der bestehenden Signatur, mit zwei bewussten Abweichungen.

```
circles/
├─ frontend/            React 19 + TypeScript + Vite
│                       Tailwind v4 (@tailwindcss/vite)
│                       Zustand (UI) + TanStack Query (Server)
│                       vite-plugin-pwa, registerType: 'prompt'
│                       libsodium-wrappers, @simplewebauthn/browser
├─ backend/             Node + Express + TypeScript, ein src/server.ts
│                       SQLite via better-sqlite3 (WAL)
│                       @simplewebauthn/server, sharp
├─ docs/                CONCEPT.md, THREAT-MODEL.md, PRIVACY.md
├─ docker-compose.yml   nginx + Tailscale-Sidecar, restart: unless-stopped
└─ LICENSE              AGPLv3
```

**Abweichung 1 — Auth: Passkeys statt JWT+bcrypt.**
Nicht aus Mode, sondern weil es *der USP* ist: „Wir haben deine E-Mail nicht, weil wir sie nie
abgefragt haben" ist überprüfbar. Session danach weiterhin als JWT.

**Abweichung 2 — SQLite bleibt, aber gekapselt.**
Für eine Beta und die ersten Tausend Nutzer richtig (WAL, ein Prozess, kein Ops-Overhead). Der
Bruchpunkt sind nicht Nutzer, sondern gleichzeitige Schreiber. Alle DB-Zugriffe hinter eine dünne
Repository-Schicht → ein späterer Postgres-Wechsel ist Tage statt Wochen. Nicht vorab abstrahieren,
nur nicht überall roh reinschreiben.

**Bewusst nicht im Stack:** kein CDN, keine externen Fonts, kein Analytics, kein Sentry, kein
Cloudflare davor. Jede Third-Party-Verbindung ist ein Datenleck und macht die Datenschutzerklärung
länger als die README.

**Lizenz: AGPLv3.** MIT erlaubte einen geschlossenen, werbefinanzierten Fork — also genau das,
wogegen das Projekt antritt. AGPL zwingt jeden Betreiber, seinen Quellcode offenzulegen.

## 8. Datenmodell (Skizze)

```sql
users(id, handle, display_name, pk_sign, pk_kex, created_at)
credentials(id, user_id, webauthn_id, public_key, sign_count, transports)  -- Passkeys, mehrere pro User
friendships(user_a, user_b, status, created_at)     -- symmetrisch, beidseitig bestätigt
inner_circle(owner_id, member_id, created_at)       -- asymmetrisch, DEINE Liste
posts(id, author_id, ring, parent_id, created_at, expires_at, pinned,
      body_plain, body_cipher, nonce, signature)    -- genau eins von plain/cipher ist gesetzt
post_keys(post_id, recipient_id, wrapped_key)       -- nur bei ring='inner'
media(id, post_id, storage_key, mime, width, height, encrypted, thumb_key)
reactions(post_id, user_id, kind, created_at)       -- Anzeige: Avatare, nie Zählung
invites(code, created_by, used_by, expires_at)
reports(id, post_id, reporter_id, reason, status)   -- nur für ring='open' sinnvoll
```

Antworten sind Posts mit `parent_id` und erben den Ring des Elternposts (eine Antwort darf einen
Inner-Circle-Post niemals in den Open Space heben).

## 9. API-Skizze

```
POST   /api/auth/register/options | /verify     WebAuthn-Registrierung (Invite-Code nötig)
POST   /api/auth/login/options    | /verify
GET    /api/me
POST   /api/invites                             eigenen Einladungscode erzeugen
POST   /api/friends/requests                    anfragen / bestätigen / entfernen
PUT    /api/inner-circle/:userId                jemanden in den Inner Circle holen
GET    /api/feed?ring=open|inner&before=        chronologisch, endlich, cursor-basiert
POST   /api/posts                               inkl. wrapped_keys[] bei ring=inner
DELETE /api/posts/:id
POST   /api/media                               multipart; opaker Blob bei ring=inner
POST   /api/posts/:id/reactions
POST   /api/reports
GET    /api/export                              DSGVO Art. 20 — ab v0.1, nicht „später"
DELETE /api/me                                  Konto + alle Inhalte löschen
```

## 10. Roadmap

**v0.1 — Fundament (Ziel: geschlossene Beta im Freundeskreis)**
Passkey-Auth inkl. Recovery-Phrase · Krypto-Identität ab Tag 1 · Invite-System · Freundschaften ·
Inner Circle als Liste · beide Ringe mit **Textposts**, Inner Circle E2EE · chronologischer,
endlicher Feed · Antworten · Reaktionen als Avatare · Löschen · Datenexport.

**v0.2 — Bilder**
Client-seitiges EXIF-Stripping, verschlüsselte Uploads + Thumbnails im Inner Circle,
server-seitige Verarbeitung im Open Space, Größenlimits, Storage-Quota.

**v0.3 — Alltagstauglichkeit**
Push-Notifications (Web Push, Payload verschlüsselt), Zweitgerät per QR-Code statt Recovery-Phrase,
Mute-Wörter, Ablauf/Pinnen.

**Bewusst nicht auf der Roadmap:** Föderation, Suche über fremde Inhalte, Gruppen als eigenes
Objekt, Video, Mobile-Native-App, öffentliche Profile.

> ⚠️ **Ehrliche Scope-Anmerkung:** Du hast „Text + Bilder" für v0.1 gewählt. Ich habe Bilder nach
> v0.2 geschoben, weil verschlüsselte Uploads mit client-seitigen Thumbnails der mit Abstand größte
> Einzelbrocken sind und die Beta sonst Monate später startet. Wenn du Bilder in v0.1 willst, ist
> das deine Entscheidung — dann ist der Plan derselbe, nur v0.1 und v0.2 zusammengelegt.

## 11. Rechts-Checkliste (Deutschland/EU)

Für die geschlossene Beta überschaubar, vor jeder Öffnung zwingend abzuarbeiten.

**Ab Beta (Betrieb mit echten Nutzerdaten):**
- [ ] Datenschutzerklärung — je Ring getrennt beschreiben, was verarbeitet wird
- [ ] Löschkonzept + funktionierendes `DELETE /api/me`
- [ ] Datenexport (DSGVO Art. 20) — in v0.1, nicht nachgelagert
- [ ] TOM-Dokumentation (Art. 32): Verschlüsselung, Zugriffskontrolle, Backups
- [ ] Verzeichnis von Verarbeitungstätigkeiten (Art. 30)

**Vor öffentlicher Registrierung:**
- [ ] **Impressum** nach DDG — Klarname + ladungsfähige Anschrift. Bei einer Privatperson heißt
      das: deine Wohnadresse steht öffentlich im Netz. Vorher entscheiden, ob das akzeptabel ist.
- [ ] DSA: AGB mit Moderationsregeln, Meldeverfahren (Notice-and-Action), Kontaktstelle
- [ ] Provider-Privileg absichern: dokumentierter, schneller Takedown-Prozess für den Open Space
- [ ] Jugendschutz-Erklärung, Mindestalter

**Der Punkt, an dem Solo-Projekte real scheitern — illegale Bild-Uploads.**
Die Zwei-Ringe-Architektur ist hier ein Vorteil, kein Problem: Der **Open Space ist moderierbar**
(Klartext, Meldefunktion, Löschung möglich). Der **Inner Circle ist verschlüsselte
Individualkommunikation** zwischen bestätigten Freunden — rechtlich näher an einem Messenger als an
einem Hosting-Angebot. Kombiniert mit **Invite-only** (kein anonymer Massen-Signup, jeder Account
hat einen Einladenden) ist das Risiko in einer Beta gering und die Argumentation sauber.
Vor der Öffnung juristisch prüfen lassen — das ist der eine Punkt, an dem ich zu externem Rat rate.

## 11a. Visuelle Identität

Das Interface ist eine Kassette. Oben schaltet man zwischen den Seiten um — die Kassette dreht
sich dabei physisch um 180°, und mit ihr wechselt die gesamte Farbwelt.

**Seite A — Type I, klassisch.** Mattes schwarzes Gehäuse (`#23201C`), Papieretikett in Creme
(`#E4DAC4`), Oxidbraun vom Band (`#5C3A21`), roter Streifen der alten Type-I-Verpackungen
(`#B8462C`). Handschrift auf dem Etikett. Alltäglich, warm, unaufgeregt.

**Seite B — Atomic Purple.** Das durchscheinende Violett des Game Boy Color von 1999
(`#6B4A9E`), milchiger Rand (`#C9AFEF`), Glow (`#A97CE8`), dunkler Innenraum (`#2B1A42`) und
ein Hauch Platinengrün (`#4E7A5E`), das durchs Plastik schimmert.

**Warum das trägt:** Bei transluzentem Plastik *sieht man die Maschine*. Das ist visuell exakt
das Prinzip aus Abschnitt 4 — Verschlüsselung soll sichtbar sein, nicht ein Schloss-Icon in den
Einstellungen. Und weil man eine Kassette physisch umdreht, ist unmittelbar klar, warum es
zwischen den Seiten kein Dazwischen gibt: Ein Post gehört immer genau einer Seite.

**Typografie:** Schmale Grotesk für Labels und Lockup (Kassettenrücken-Optik), Handschrift für
Etiketteninhalte, Monospace für technische Angaben.

## 11b. Namensrechte — Rechercheergebnis (2026-08-01)

| Namensraum | Status |
|---|---|
| `kliqtape.com` · `.io` · `.de` · `.net` · `.social` | frei |
| `kliqtape.app` | unklar, manuell prüfen (RDAP kam nicht durch) |
| `github.com/kliqtape` | frei |
| npm `kliqtape` | frei |

⚠️ **Vor einer Markenanmeldung klären:** „Kliq" allein ist als App-Marke aktiv belegt — es gibt
mindestens zwei Apps dieses Namens (Influencer-Plattform und No-Code-Baukasten, `kliqapp.io`).
„Kliqtape" ist ein anderes Zeichen, aber da beides Apps sind, ist eine Verwechslungsgefahr-Prüfung
in Klasse 9/38/42 bei DPMA und EUIPO nötig. Domains und GitHub sofort sichern (billig), Marke
erst wenn das Projekt läuft.

## 12. Offene Entscheidungen

1. ~~**Name.**~~ Entschieden: **Kliqtape**. Domains/GitHub/npm frei, Marke noch zu prüfen (11b).
2. **Sieht man, dass man auf Seite B ist?** Instagram zeigt den grünen Ring. Vorschlag: **ja,
   sichtbar** — es ist ein warmes Vertrauenssignal, und es heimlich zu führen wäre unangenehm.
3. **Verfall im Inner Circle: 30 Tage Default.** Fest verdrahtet oder pro Post wählbar?
4. **Freunde-Limit 150 — hart oder weich?** Hart ist eine stärkere Aussage, weich weniger frustrierend.
5. **Referenz-Instanz:** erst Tailscale-only (Homelab, wie die anderen PWAs), später öffentlicher VPS.
