#!/usr/bin/env python3
"""
Demo-Daten fuer Kliqtape: eine kleine, stimmige Geschichte zum Vorzeigen.

Eine Freundesgruppe (Mira, Jonas, Tarek, Lena und du), drei Kassetten:

- Alle Freunde: Mira hat eine Wohnung gefunden. Kartons am ersten Tag, der
  erste Abend auf ihrem Dach, Helfer fuer den Schrank, ein geteiltes Mixtape.
- Die Kliqe: der enge Kreis. Mira kann nachts nicht schlafen und will
  kuendigen, auf Seite B wird darueber geredet.
- Freitagsrunde: Jonas, Tarek und du in der Kneipe.

Dazu ein Mixtape von Mira fuer dich, zwei Hot-Line-Verlaeufe, ein eigenes
Tape ("Sommer am See") und eine gesammelte Kassette im Regal. Wenig Inhalt,
aber jeder hat seinen Platz, auch auf den Website-Screens
(kliqtape-website/tools/app-screens nutzt genau dieses Skript).

Fotos: echte Stockfotos von Pexels (Pexels-Lizenz, frei nutzbar,
https://www.pexels.com/license/). Sie liegen NICHT im Repo, sondern werden
beim ersten Lauf geladen und unter scripts/.cache/photos zwischengespeichert.
Die Profilbilder von Mira, Jonas, Tarek und Lena sind Ausschnitte aus
derselben Fotoserie wie das Gruppenfoto (cottonbro studio, Abend auf dem
Dach), es sind also wirklich dieselben Leute. Alle anderen Fotos zeigen keine
erkennbaren Gesichter. Braucht Pillow und beim ersten Lauf Internet.

Seit es Zugangscodes gibt, beansprucht das Skript fuer jede Testperson
einen Namen und merkt sich die Codes in scripts/.seed-tokens.json (nicht im
Repo), damit ein spaeteres --reset dieselben Leute wieder loeschen kann.

    python3 scripts/seed.py                 # anlegen
    python3 scripts/seed.py --reset         # vorher alles von diesen Leuten loeschen
    python3 scripts/seed.py --me Aaron      # Hauptnutzer (Default: Aaron)
    python3 scripts/seed.py --me Aaron --me-token <code>   # Name schon vergeben

O-Toene sind erzeugte Tonfolgen (WAV), damit der Player echte Daten
dekodiert. Videos fehlen bewusst, Clips nimmt man in der App direkt auf.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import os
import random
import struct
import sys
import urllib.error
import urllib.parse
import urllib.request
import wave

try:
    from PIL import Image
except ImportError:
    sys.exit("Fehlt: Pillow.  ->  python3 -m pip install --user Pillow")

BASE = "http://localhost:8099"
random.seed(1990)  # reproduzierbare Testdaten

HERE = os.path.dirname(os.path.abspath(__file__))
TOKEN_FILE = os.path.join(HERE, ".seed-tokens.json")
PHOTO_CACHE = os.path.join(HERE, ".cache", "photos")
TOKENS: dict[str, str] = {}

# Welche Felder in Body oder Query den handelnden Namen tragen — je nach
# Route heisst er anders. Daraus ergibt sich, welcher Zugangscode mitgeht.
ACTOR_KEYS = ("by", "author", "from", "me")


def load_tokens() -> None:
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE) as f:
            TOKENS.update(json.load(f).get(BASE, {}))


def save_tokens() -> None:
    data = {}
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE) as f:
            data = json.load(f)
    data[BASE] = TOKENS
    with open(TOKEN_FILE, "w") as f:
        json.dump(data, f, indent=2)


def ensure_token(name: str) -> str:
    """Zugangscode fuer name — beansprucht den Namen, falls noch frei."""
    if name in TOKENS:
        return TOKENS[name]
    req = urllib.request.Request(BASE + "/api/auth/claim", method="POST",
                                 data=json.dumps({"name": name}).encode())
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            TOKENS[name] = json.loads(res.read())["token"]
    except urllib.error.HTTPError as e:
        if e.code == 409:
            raise SystemExit(f"»{name}« ist auf diesem Server schon vergeben. "
                             f"Für den Hauptnutzer: --me-token <Zugangscode> angeben.")
        raise
    save_tokens()
    return TOKENS[name]


def actor_of(path: str, body) -> str | None:
    if isinstance(body, dict):
        for k in ACTOR_KEYS:
            if body.get(k):
                return body[k]
    query = urllib.parse.parse_qs(urllib.parse.urlparse(path).query)
    for k in ACTOR_KEYS:
        if k in query:
            return query[k][0]
    return None


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

def call(method: str, path: str, body=None, raw: bytes | None = None, mime: str | None = None,
         as_: str | None = None):
    url = BASE + path
    if raw is not None:
        req = urllib.request.Request(url, data=raw, method=method)
        req.add_header("Content-Type", mime or "application/octet-stream")
    else:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method)
        if data:
            req.add_header("Content-Type", "application/json")
    actor = as_ or actor_of(path, body)
    if actor:
        req.add_header("X-Auth-Token", ensure_token(actor))
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            payload = res.read()
            return json.loads(payload) if payload else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise SystemExit(f"{method} {path} -> {e.code}: {detail}")
    except urllib.error.URLError as e:
        raise SystemExit(f"Backend nicht erreichbar unter {BASE} ({e.reason}).\n"
                         f"Läuft 'docker compose up'?")


def upload(blob: bytes, mime: str, duration_ms: int | None = None, as_: str | None = None) -> str:
    url = BASE + "/api/media"
    req = urllib.request.Request(url, data=blob, method="POST")
    req.add_header("Content-Type", mime)
    # Hochladen braucht einen gueltigen Zugangscode, egal von wem.
    req.add_header("X-Auth-Token", ensure_token(as_) if as_ else next(iter(TOKENS.values())))
    if duration_ms is not None:
        req.add_header("X-Duration-Ms", str(duration_ms))
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read())["id"]


# ---------------------------------------------------------------------------
# Fotos (Pexels)
# ---------------------------------------------------------------------------

PEXELS_URL = "https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg?auto=compress&cs=tinysrgb&w={w}"

# name: (Pexels-ID, Ausschnitt)
#   ("face", cx, cy, groesse): Profilbild, Mitte und Kantenlaenge als Anteil
#                              der Bildbreite bzw. -hoehe
#   ("square", lage):          quadratisch, lage 0 = oben/links, 1 = unten/rechts
# Quadratisch wie ein Fotoabzug und wie die alten Testbilder.
PHOTOS: dict[str, tuple[int, tuple]] = {
    # Abend auf dem Dach, cottonbro studio. Dieselben Leute in beiden Bildern.
    "dach_pizza": (4881606, ("square", 0.15)),
    "avatar_mira": (4881665, ("face", 0.572, 0.503, 0.165)),
    "avatar_jonas": (4881665, ("face", 0.452, 0.464, 0.105)),
    "avatar_tarek": (4881665, ("face", 0.693, 0.428, 0.23)),
    "avatar_lena": (4881606, ("face", 0.451, 0.140, 0.22)),
    # Du hast das Gruppenfoto gemacht, deshalb bist du nicht drauf.
    "avatar_ich": (6102858, ("square", 0.2)),
    # Ohne erkennbare Gesichter
    "kartons": (4554249, ("square", 0.6)),
    "regenfenster": (35289998, ("square", 0.5)),
    "bier": (14356408, ("square", 0.5)),
    "tram": (29087119, ("square", 0.6)),
    "oldtimer": (13518783, ("square", 0.5)),
    "steg": (8929569, ("square", 0.5)),
    "see_abend": (11982516, ("square", 0.55)),
    "fensterblick": (9919800, ("square", 0.45)),
    "croissant": (12808650, ("square", 0.9)),
    "pizza": (27349458, ("square", 0.4)),
    "anleitung": (5805491, ("square", 0.5)),
    "pflanze": (12210125, ("square", 0.55)),
    # Familie: eigene Portraets, kommen in keinem Gruppenfoto vor.
    "avatar_mama": (5469670, ("face", 0.338, 0.43, 0.2)),
    "avatar_jule": (1639589, ("square", 0.2)),
    "tomaten": (33984943, ("square", 0.5)),
    # Ben ist der Blonde aus der Dach-Serie, Noor und Papa haben eigene Portraets.
    "avatar_ben": (4881665, ("face", 0.378, 0.497, 0.12)),
    "avatar_noor": (35555197, ("square", 0.15)),
    "avatar_papa": (35187209, ("face", 0.50, 0.365, 0.3)),
    "konzert": (1047442, ("square", 0.5)),
}


def fetch_pexels(pid: int, width: int) -> Image.Image:
    os.makedirs(PHOTO_CACHE, exist_ok=True)
    path = os.path.join(PHOTO_CACHE, f"{pid}-{width}.jpg")
    if not os.path.exists(path):
        req = urllib.request.Request(PEXELS_URL.format(id=pid, w=width),
                                     headers={"User-Agent": "kliqtape-seed"})
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                blob = res.read()
        except urllib.error.URLError as e:
            raise SystemExit(f"Foto {pid} nicht ladbar ({e}). Beim ersten Lauf braucht das Skript Internet.")
        with open(path, "wb") as f:
            f.write(blob)
    return Image.open(path).convert("RGB")


def photo_jpeg(name: str) -> bytes:
    pid, crop = PHOTOS[name]
    if crop[0] == "face":
        _, cx, cy, rel = crop
        img = fetch_pexels(pid, 3000)
        w, h = img.size
        side = int(rel * w)
        x0, y0 = int(cx * w - side / 2), int(cy * h - side / 2)
        out = 400
    else:
        _, pos = crop
        img = fetch_pexels(pid, 1600)
        w, h = img.size
        side = min(w, h)
        x0, y0 = int((w - side) * pos), int((h - side) * pos)
        out = 400 if name.startswith("avatar_") else 1080
    img = img.crop((x0, y0, x0 + side, y0 + side)).resize((out, out), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=86)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Ton
# ---------------------------------------------------------------------------

def wav_take(seconds: float = 7.0, base_hz: float = 196.0) -> tuple[bytes, int]:
    """Erzeugt eine kurze, hoerbare Aufnahme.

    Bewusst eine Tonfolge statt eines Dauertons: beim Spulen soll man hoeren,
    dass man sich an eine andere Stelle des Bandes bewegt.
    """
    rate = 22050
    total = int(rate * seconds)
    steps = [1.0, 1.25, 1.5, 1.335, 1.0, 0.75, 1.125, 1.5]
    frames = bytearray()

    for n in range(total):
        t = n / rate
        step = steps[min(int(t / seconds * len(steps)), len(steps) - 1)]
        f = base_hz * step

        # Grundton plus zwei leise Obertoene — klingt nach Stimme, nicht nach Sinus-Test
        v = math.sin(2 * math.pi * f * t)
        v += 0.35 * math.sin(2 * math.pi * f * 2 * t)
        v += 0.18 * math.sin(2 * math.pi * f * 3 * t)

        # Huellkurve pro Ton, damit es nicht klickt
        local = (t / seconds * len(steps)) % 1.0
        env = min(1.0, local * 8) * min(1.0, (1 - local) * 8)
        # sanftes Ein- und Ausblenden ueber die ganze Aufnahme
        env *= min(1.0, t * 4) * min(1.0, (seconds - t) * 4)

        v = v * env * 0.22 + random.uniform(-0.004, 0.004)  # Hauch Bandrauschen
        frames += struct.pack("<h", max(-32767, min(32767, int(v * 32767))))

    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(bytes(frames))
    return buf.getvalue(), int(seconds * 1000)


# ---------------------------------------------------------------------------
# Inhalte
# ---------------------------------------------------------------------------

PEOPLE = ["Mira", "Jonas", "Tarek", "Lena"]
# Deine Familie: eine eigene Kassette und eigene Leitungen in der Hot Line,
# damit die App aussieht wie im echten Gebrauch.
FAMILY = ["Mama", "Papa", "Jule"]
# Zwei weitere aus dem Freundeskreis, nur in "Alle Freunde" und in der Hot Line.
# Ben ist auf den Dach-Fotos mit drauf (blond, olivgruene Jacke).
FRIENDS_MORE = ["Ben", "Noor"]

TRACKS = [
    ("Teardrop", "Massive Attack", "https://open.spotify.com/track/67Hna13dNDkZvBpTXRIaOJ"),
    ("Protection", "Massive Attack", "https://music.apple.com/de/album/protection/1440788304"),
    ("Glory Box", "Portishead", "https://www.youtube.com/watch?v=b7ArPZRoEjc"),
    ("Around the World", "Daft Punk", "https://open.spotify.com/track/1pKYYY0dkg23sQQXi0Q5zN"),
    ("Bizarre Love Triangle", "New Order", "https://www.deezer.com/track/659757"),
    ("Rebel Girl", "Bikini Kill", "https://bikinikill.bandcamp.com"),
    ("Nightswimming", "R.E.M.", "https://open.spotify.com/track/6RQwbYFUYFrqJBiFxLXHmZ"),
    ("Windowlicker", "Aphex Twin", "https://soundcloud.com/aphextwin"),
]

# Feste Bandsorten aus den sechs Kernfarben (cassetteLook.ts): Type I/Amber,
# Ice, Atomic Purple, Tabak, Kiwi, Berry. Ohne Wahl haengt das Aussehen an der
# zufaelligen Kassetten-ID, bei jedem --reset also ein neues Los.
RUNDEN_FARBE = {"Alle Freunde": 0, "Die Kliqe": 2, "Freitagsrunde": 3, "Familie": 5}


def main() -> None:
    global BASE
    ap = argparse.ArgumentParser()
    ap.add_argument("--me", default="Aaron", help="Hauptnutzer, für den alles ankommt")
    ap.add_argument("--base", default=BASE, help="Adresse des Backends")
    ap.add_argument("--reset", action="store_true", help="Daten dieser Leute vorher löschen")
    ap.add_argument("--me-token", help="Zugangscode des Hauptnutzers, falls der Name schon vergeben ist")
    ap.add_argument("--admin", default="Kliqtape",
                    help="Name des Kliqtape-Kanal-Accounts (ADMIN_NAME im Backend), plant die Wochen-Challenges")
    args = ap.parse_args()
    BASE = args.base.rstrip("/")

    me = args.me
    everyone = [me] + PEOPLE + FRIENDS_MORE + FAMILY

    call("GET", "/api/health")
    print(f"Backend erreichbar: {BASE}")

    load_tokens()
    if args.me_token:
        TOKENS[me] = args.me_token

    if args.reset:
        # Nur wen wir kennen: ohne Code laesst sich niemand loeschen. Das
        # Loeschen gibt auch den Namen frei, er wird gleich neu beansprucht.
        for person in everyone:
            if person in TOKENS:
                call("DELETE", "/api/me?me=" + urllib.parse.quote(person))
                TOKENS.pop(person, None)
        save_tokens()
        # Verwaiste Kassetten mitnehmen: wer keine Mitglieder mehr hat, wird
        # serverseitig beim Austritt entfernt — hier bleibt nichts uebrig.
        print("Alte Testdaten entfernt")

    def photo(name: str, as_: str | None = None) -> str:
        return upload(photo_jpeg(name), "image/jpeg", as_=as_)

    # --- Profile ----------------------------------------------------------
    print("Profilbilder …", end="", flush=True)
    avatars = {me: "avatar_ich", "Mira": "avatar_mira", "Jonas": "avatar_jonas",
               "Tarek": "avatar_tarek", "Lena": "avatar_lena",
               "Mama": "avatar_mama", "Papa": "avatar_papa", "Jule": "avatar_jule",
               "Ben": "avatar_ben", "Noor": "avatar_noor"}
    for person in everyone:
        pid = photo(avatars[person], as_=person)
        call("PUT", "/api/profiles/" + urllib.parse.quote(person), {"avatarId": pid}, as_=person)
        print(".", end="", flush=True)
    # Die Freunde melden sich nie selbst an, ihre Einfuehrung gilt als erledigt.
    # Der Hauptnutzer bleibt offen: die Website nimmt dessen Einfuehrung auf.
    for person in PEOPLE + FRIENDS_MORE + FAMILY:
        call("PUT", "/api/me/onboarding",
             {"me": person, "ageConfirmed": True, "termsAccepted": True, "done": True})
    print(f" {len(everyone)} Leute")

    # --- Kassetten -------------------------------------------------------
    # Eine Kassette ist eine Runde. Bewusst mit unterschiedlichen Besetzungen,
    # damit man sieht, dass sich die Kreise nicht vermischen.
    print("Kassetten …", end="", flush=True)
    RUNDEN = [
        ("Alle Freunde", [me] + PEOPLE + FRIENDS_MORE),
        ("Freitagsrunde", [me, "Jonas", "Tarek"]),
        ("Die Kliqe", [me, "Mira", "Lena"]),
        ("Familie", [me] + FAMILY),
    ]
    tapes_by_name: dict[str, str] = {}
    for name, members in RUNDEN:
        c = call("POST", "/api/cassettes", {"name": name, "by": me})
        tapes_by_name[name] = c["id"]
        for person in members:
            if person != me:
                # Mitglied wird man nur noch per Einladung + Zustimmen.
                inv = call("POST", f"/api/cassettes/{c['id']}/invites", {"invitee": person, "by": me})
                call("POST", f"/api/invites/{inv['id']}/accept", {"me": person})
        call("PATCH", f"/api/cassettes/{c['id']}", {"colorIndex": RUNDEN_FARBE[name], "by": me})
    print(f" {len(RUNDEN)} Runden")

    posts: dict[str, str] = {}

    def post(cassette, side, author, kind, body="", media=None, tape=None, key=None, note_style=None,
             quoted=None):
        payload = {"cassetteId": tapes_by_name[cassette], "side": side,
                   "author": author, "kind": kind, "body": body}
        if quoted:
            # Antwort auf einen Seite-A-Beitrag: steht im Gruppenchat mit Zitat
            # und unter dem Beitrag selbst (Vorschau, alle Antworten auf Tipp).
            payload["quotedPostId"] = posts[quoted]
        if note_style:
            # Zettel-Art: tape, pin, staple, clip, fold oder label (Etikett)
            payload["noteStyle"] = note_style
        if media:
            payload["mediaId"] = media
        if tape:
            payload["tapeId"] = tape
        res = call("POST", "/api/posts", payload)
        if key:
            posts[key] = res["id"]
        return res["id"]

    def voice(cassette, side, author, body, seconds, hz, key=None):
        take, ms = wav_take(seconds, hz)
        return post(cassette, side, author, "voice", body, media=upload(take, "audio/wav", ms), key=key)

    # --- Alle Freunde: Mira zieht um ------------------------------------
    print("Alle Freunde …", end="", flush=True)
    post("Alle Freunde", "a", "Mira", "text",
         "Ich hab die Wohnung. Dritter Stock, Altbau, viel zu teuer. Egal.", key="wohnung", note_style="tape")
    post("Alle Freunde", "a", "Tarek", "photo", "Tag eins. Kein Sofa, aber Kartons.",
         media=photo("kartons"), key="kartons")
    post("Alle Freunde", "a", me, "photo", "Erster Abend auf Miras Dach",
         media=photo("dach_pizza"), key="dach")

    # Antworten auf die Beitraege, im Gruppenchat mit Zitat.
    for who, key, body in [
        ("Tarek", "wohnung", "Altbau! Wie hoch sind die Decken?"),
        ("Mira", "wohnung", "3,40. Ich brauch eine Leiter."),
        ("Jonas", "kartons", "Brauchst du noch Hände?"),
        ("Noor", "kartons", "Ich hab noch Kartons im Keller."),
        ("Lena", "dach", "Bestes Foto des Jahres."),
        ("Ben", "dach", "Ich bin halb drauf, zählt das?"),
        ("Noor", "dach", "Ohne mich?!"),
        ("Mira", "dach", "Nächstes Mal mit Lichterkette."),
    ]:
        post("Alle Freunde", "b", who, "text", body, quoted=key)

    post("Alle Freunde", "b", "Mira", "text", "Wer hilft Samstag beim Schrank? Pizza geht auf mich.", key="schrank")
    post("Alle Freunde", "b", "Tarek", "text", "Ich, ab 11.")
    post("Alle Freunde", "b", "Jonas", "text", "Ich bring den Akkuschrauber mit.")
    print(" fertig")

    # --- Die Kliqe: das Vertrauliche -------------------------------------
    print("Die Kliqe …", end="", flush=True)
    post("Die Kliqe", "a", "Mira", "photo", "3 Uhr, konnte nicht schlafen", media=photo("regenfenster"),
         key="dreiuhr")
    # Etikett: der Streifen nimmt das Lila der Kliqe an.
    post("Die Kliqe", "a", "Lena", "text", "Du kannst immer anrufen. Auch um 3.", note_style="label")
    post("Die Kliqe", "b", me, "text", "Ich war auch wach. Nächstes Mal schreib einfach.", quoted="dreiuhr")

    post("Die Kliqe", "b", "Mira", "text",
         "Ich glaub ich kündige wirklich. Können wir morgen telefonieren?", key="kuendigen")
    voice("Die Kliqe", "b", "Mira", "zu lang für einen Zettel", 6.0, 165.0)
    post("Die Kliqe", "b", "Lena", "text", "Ja. Ich ruf dich nach der Arbeit an.")
    post("Die Kliqe", "b", me, "text", "Ich auch. Und wenn du es machst, feiern wir das.")
    post("Die Kliqe", "b", "Mira", "text", "Ihr seid echt die Besten.")
    post("Die Kliqe", "b", "Lena", "text", "Wissen wir.")
    print(" fertig")

    # --- Freitagsrunde: kleiner Kreis ------------------------------------
    print("Freitagsrunde …", end="", flush=True)
    post("Freitagsrunde", "a", "Jonas", "photo", "Nur eins, haben wir gesagt.", media=photo("bier"), key="bier")
    post("Freitagsrunde", "a", "Jonas", "text", "Deckel: 14 Kölsch. Wer hat mitgezählt?", note_style="clip")
    post("Freitagsrunde", "b", "Tarek", "text", "Nur eins. Klar.", quoted="bier")
    post("Freitagsrunde", "b", "Tarek", "text", "Nächsten Freitag wieder?")
    voice("Freitagsrunde", "b", "Jonas", "kurz zum Freitag", 5.0, 220.0)
    print(" fertig")

    # --- Familie --------------------------------------------------------
    print("Familie …", end="", flush=True)
    post("Familie", "a", "Mama", "photo", "Die Tomaten sind dieses Jahr was geworden.",
         media=photo("tomaten", as_="Mama"), key="tomaten")
    post("Familie", "a", "Mama", "text",
         "Für Sonntag: Rouladen, Gurken, Senf, Rotkohl. Nachtisch macht Jule.", note_style="staple")
    for who, body in [("Jule", "Mama, das sind ja Riesen."), ("Papa", "Das war ich."), ("Mama", "Ich hab gegossen.")]:
        post("Familie", "b", who, "text", body, quoted="tomaten")
    post("Familie", "b", "Mama", "text", "Sonntag Essen bei uns? Papa macht Rouladen.")
    post("Familie", "b", "Papa", "text", "Die Rouladen sind schon eingelegt.")
    post("Familie", "b", "Jule", "text", "Bin dabei. Ich bring Nachtisch mit.")
    post("Familie", "b", me, "text", "Ich auch.")
    print(" fertig")

    # --- Tonfetzen: kurze Sprachreaktionen statt "da war ich" ---------------
    for key, who in [
        ("wohnung", ["Jonas", "Tarek", me]),
        ("dach", ["Mira", "Lena"]),
        ("kuendigen", [me, "Lena"]),
        ("schrank", ["Tarek"]),
        ("tomaten", ["Jule", me]),
    ]:
        for person in who:
            take, ms = wav_take(1.5, 180.0)
            aid = upload(take, "audio/wav", ms)
            call("POST", f"/api/posts/{posts[key]}/react", {"author": person, "mediaId": aid})
    print("Tonfetzen gesetzt")

    # --- Mixtapes ---------------------------------------------------------
    print("Mixtapes …", end="", flush=True)

    def build_tape(sender, receiver, title, note, tracks, cover=None, seal=True):
        tape = call("POST", "/api/mixtapes", {"from": sender, "to": receiver, "title": title})
        patch = {"note": note, "me": sender}
        if cover:
            patch["coverId"] = photo(cover, as_=sender)
        call("PATCH", f"/api/mixtapes/{tape['id']}", patch)
        for t, a, u in tracks:
            call("POST", f"/api/mixtapes/{tape['id']}/tracks", {"title": t, "artist": a, "url": u, "me": sender})
        if seal:
            call("POST", f"/api/mixtapes/{tape['id']}/seal", {"me": sender})
        return tape["id"]

    # Von Mira an dich, liegt im Regal unter "Für dich". Track 7 ist Nightswimming.
    build_tape("Mira", me, "Für den Heimweg",
               "Track 7 ist wichtig. Hör ihn laut und allein.",
               TRACKS[:7], cover="tram")

    # Von dir an Lena, wird gleich auch in "Alle Freunde" geteilt
    shared = build_tape(me, "Lena", "Sommer 99",
                        "Alles, was damals im Autoradio lief.",
                        TRACKS[1:6], cover="oldtimer")

    # Von Ben, kommt per Hot Line an (zweites Tape unter "Für dich")
    ben_tape = build_tape("Ben", me, "Für Donnerstag",
                          "Für die Bahn zum Kino. Lauter als nötig.", TRACKS[2:6])

    # Ein Entwurf, damit "In Arbeit" nicht leer ist
    build_tape(me, "Jonas", "Noch ohne Namen", "", TRACKS[5:8], seal=False)

    post("Alle Freunde", "a", me, "tape", tape=shared)
    print(" 4 Stück")

    # --- Hot Line -----------------------------------------------------------
    # Echte Verlaeufe mit allem, was die Hot Line kann: Text, Foto, O-Ton und
    # ein Mixtape. Die erste Nachricht eroeffnet die Leitung, der Rest ist Hin
    # und Her. Die Liste sortiert nach der neuesten Nachricht, oben zuerst:
    # Lena (1 neu), Papa (1 neu), Mama (2 neu), Noor (1 neu), dann gelesen:
    # Mira, Jule, Ben, Tarek, Jonas.
    def hotline(sender, receiver, body="", kind="text", media=None, tape=None):
        msg = {"from": sender, "to": receiver, "body": body, "kind": kind}
        if media:
            msg["mediaId"] = media
        if tape:
            msg["tapeId"] = tape
        return call("POST", "/api/hotlines/threads", msg)["threadId"]

    def heard(thread_id):
        call("POST", f"/api/hotlines/threads/{thread_id}/heard", {"me": me})

    def hotline_voice(sender, receiver, body, seconds, hz):
        take, ms = wav_take(seconds, hz)
        return hotline(sender, receiver, body, "voice", media=upload(take, "audio/wav", ms, as_=sender))

    # Jonas: der Schrank. Praktisch, ein bisschen Galgenhumor.
    t = hotline("Jonas", me, "Samstag beim Schrank bist du dabei, oder?")
    hotline(me, "Jonas", "Klar, ab 11.")
    hotline("Jonas", me, "Die Anleitung. 64 Schritte.", "photo", media=photo("anleitung", as_="Jonas"))
    hotline(me, "Jonas", "Dann bring ich zwei Pizzen mit. Für danach.")
    hotline_voice("Jonas", me, "", 3.0, 200.0)
    hotline("Jonas", me, "Top. Ich bring Kaffee mit.")
    heard(t)

    # Tarek: Alltag.
    t = hotline("Tarek", me, "Hast du noch mein Ladekabel?")
    hotline(me, "Tarek", "Liegt bei mir auf dem Schreibtisch.")
    hotline("Tarek", me, "Hol ich Freitag ab.")
    heard(t)

    # Ben: Kino, und das Mixtape fuer den Weg dahin kommt gleich mit.
    t = hotline("Ben", me, "Kino am Donnerstag? Der neue läuft im Odeon.")
    hotline(me, "Ben", "Bin dabei. 20 Uhr?")
    hotline("Ben", me, "20 Uhr. Für die Bahn hin:")
    hotline("Ben", me, kind="tape", tape=ben_tape)
    hotline(me, "Ben", "Track 2 läuft schon in Dauerschleife.")
    heard(t)

    # Jule: die kleine Schwester hat bestanden, Mama weiss es noch nicht.
    t = hotline("Jule", me, "Rate mal, wer bestanden hat.")
    hotline(me, "Jule", "NEIN. Glückwunsch!!")
    hotline_voice("Jule", me, "", 4.0, 240.0)
    hotline(me, "Jule", "Sonntag stoßen wir an.")
    hotline("Jule", me, "Mama weiß es noch nicht. Pssst.")
    heard(t)

    # Mira: was in der Kliqe angefangen hat, geht hier unter vier Augen weiter.
    t = hotline("Mira", me, "Danke, dass du gestern drangegangen bist.")
    hotline(me, "Mira", "Immer.")
    hotline("Mira", me, "Ich hab heute mit meiner Chefin geredet.")
    hotline_voice("Mira", me, "zu lang zum Tippen", 8.0, 175.0)
    hotline(me, "Mira", "Und? Erzähl!")
    hotline("Mira", me, "Ende Januar bin ich raus. Fühlt sich richtig an.")
    hotline(me, "Mira", "Das feiern wir. Auf deinem Dach.")
    hotline("Mira", me, "Mein Ausblick ab Februar. Ausgeschlafen.", "photo",
            media=photo("fensterblick", as_="Mira"))
    hotline("Mira", me, "Hab dir übrigens was ins Regal gelegt.")
    hotline(me, "Mira", "Gerade gesehen. Track 7 hör ich auf dem Heimweg.")
    heard(t)

    # Noor: war ohne dich auf dem Konzert. Die letzte Nachricht ist neu.
    t = hotline("Noor", me, "Rate mal, wo ich gestern war.", "photo", media=photo("konzert", as_="Noor"))
    hotline(me, "Noor", "Neid. Wie war's?")
    hotline_voice("Noor", me, "immer noch heiser", 5.0, 210.0)
    heard(t)
    hotline("Noor", me, "Nächstes Mal kommst du mit. Keine Ausreden.")

    # Mama: die zwei letzten Nachrichten sind noch neu.
    t = hotline("Mama", me, "Hast du schon gegessen?")
    hotline(me, "Mama", "Ja, Mama.")
    hotline("Mama", me, "Was denn?")
    hotline(me, "Mama", "Pizza. Auf Miras Dach.")
    heard(t)
    hotline("Mama", me, "Das ist kein Essen.")
    hotline("Mama", me, "Sonntag kochen wir richtig.")

    # Papa: kurz und praktisch, die letzte Nachricht ist neu.
    t = hotline("Papa", me, "Die Rouladen sind eingelegt.")
    hotline(me, "Papa", "Ich freu mich schon.")
    heard(t)
    hotline("Papa", me, "Bring Jule mit, die geht nicht ans Handy.")

    # Lena: das Mixtape kommt per Hot Line an. Ihre letzte Antwort ist noch neu.
    t = hotline("Lena", me, "Die Bäckerei an der Ecke hat wieder auf.", "photo",
                media=photo("croissant", as_="Lena"))
    hotline(me, "Lena", "Morgen um 9?")
    hotline("Lena", me, "Deal. Du zahlst.")
    heard(t)
    # Eine Mixtape-Nachricht zeigt nur die Karte, der Satz dazu kommt davor.
    hotline(me, "Lena", "Hab dir was versiegelt. Für die Fahrt zum See.")
    hotline(me, "Lena", kind="tape", tape=shared)
    hotline("Lena", me, "Track 3!! Wie hast du das noch gewusst?")
    print("9 Leitungen mit Verlauf")

    # --- Regal: eigenes Tape und gesammelte Kassette -------------------------
    print("Regal …", end="", flush=True)
    own = call("POST", "/api/me/tapes", {"me": me, "title": "Sommer am See", "colorIndex": 1})
    for kind, body, name in [("photo", "Steg um neun", "steg"),
                             ("text", "Wasser 19 Grad. Trotzdem rein.", None),
                             ("photo", "letztes Licht", "see_abend")]:
        item = {"me": me, "kind": kind, "body": body}
        if kind == "text":
            item["noteStyle"] = "pin"  # Klebezettel
        if name:
            item["mediaId"] = photo(name, as_=me)
        call("POST", f"/api/me/tapes/{own['id']}/items", item)

    # Seite A von "Alle Freunde" ist Tape 01: fuer alle benannt, und du hast
    # es dir mit eigener Beschriftung ins Regal gelegt (sonst steht dort
    # "beschriften").
    alle = tapes_by_name["Alle Freunde"]
    call("PUT", f"/api/cassettes/{alle}/tapes/1", {"by": me, "name": "Miras Einzug"})
    call("POST", f"/api/cassettes/{alle}/tapes/1/favorite", {"by": me, "label": "Kartons, dann Pizza"})
    print(" fertig")

    # --- Storys -------------------------------------------------------------
    # Kassettenuebergreifend, 24 Stunden sichtbar.
    print("Storys …", end="", flush=True)
    for person, name in [("Mira", "pflanze"), ("Jonas", "anleitung"), ("Tarek", "pizza")]:
        call("POST", "/api/stories", {"author": person, "kind": "photo", "mediaId": photo(name, as_=person)})
    print(" 3 Stück")

    # --- Wochen-Challenge ------------------------------------------------------
    # Der Kliqtape-Kanal plant die naechsten Wochen, je ein Typ. Laeuft das
    # Backend mit einem anderen ADMIN_NAME, bleibt die Planung einfach leer.
    print("Wochen-Challenges …", end="", flush=True)
    plan = [
        ("photo", "Etwas, das gerade Sonne abbekommt"),
        ("super8", "Zehn Sekunden von deinem Lieblingsgeräusch"),
        ("damals", "Ein Ort, der dir fehlt"),
        ("mixtape", "Lieder für den Herbst"),
        ("imposter", ""),
    ]
    try:
        weeks = call("GET", f"/api/challenges?me={urllib.parse.quote(args.admin)}", as_=args.admin)["weeks"]
        planned = 0
        for week, (kind, theme) in zip(weeks, plan):
            if week["started"]:
                continue
            call("PUT", f"/api/challenges/{week['releaseAt']}",
                 {"me": args.admin, "type": kind, "theme": theme}, as_=args.admin)
            planned += 1
        print(f" {planned} Wochen geplant")
    except SystemExit as e:
        print(f" übersprungen ({e})")

    print(f"\nFertig. Melde dich in der App als »{me}« an.")
    print(f"Zugangscode für »{me}«: {TOKENS[me]}")
    print("Zum Aufräumen:  python3 scripts/seed.py --reset")


if __name__ == "__main__":
    main()
