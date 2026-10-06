#!/usr/bin/env python3
"""
Testdaten fuer Kliqtape.

Legt ein paar Leute mit Profilbildern an, erzeugt drei Kassetten mit
unterschiedlichen Besetzungen und fuellt beide Seiten mit Zetteln,
Schnappschuessen, O-Toenen, Mixtapes, Reaktionen und Hot-Line-Verlaeufen — damit sich
jede Funktion ansehen und bedienen laesst.

Beide Seiten sind dauerhaft: Seite A ist das Archiv, Seite B der Gruppenchat.

Seit es Zugangscodes gibt, beansprucht das Skript fuer jede Testperson
einen Namen und merkt sich die Codes in scripts/.seed-tokens.json (nicht im
Repo), damit ein spaeteres --reset dieselben Leute wieder loeschen kann.

Alle Medien werden hier wirklich erzeugt: Bilder mit PIL, Ton als WAV.
Kein Platzhalter-Muell, denn der O-Ton-Spieler dekodiert das Audio
tatsaechlich, und mit kaputten Daten waere der Player leer.

    python3 scripts/seed.py                 # anlegen
    python3 scripts/seed.py --reset         # vorher alles von diesen Leuten loeschen
    python3 scripts/seed.py --me Aaron      # Hauptnutzer (Default: Aaron)
    python3 scripts/seed.py --me Aaron --me-token <code>   # Name schon vergeben

Videos fehlen bewusst: dafuer braeuchte es ffmpeg, das hier nicht vorhanden
ist. Clips lassen sich in der App direkt mit der Kamera aufnehmen.
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
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    sys.exit("Fehlt: Pillow.  ->  python3 -m pip install --user Pillow")

BASE = "http://localhost:8099"
random.seed(1990)  # reproduzierbare Testdaten

TOKEN_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".seed-tokens.json")
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
# Bilder
# ---------------------------------------------------------------------------

def classic_look(img: Image.Image) -> Image.Image:
    """Dieselbe dezente Anmutung wie die Kamera in der App: leichte
    Entsaettigung, weiche Kontrastkurve, Vignette, feines Korn."""
    w, h = img.size
    px = img.load()
    cx, cy = w / 2, h / 2
    maxd = math.hypot(cx, cy)

    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            r += (lum - r) * 0.12
            g += (lum - g) * 0.12
            b += (lum - b) * 0.12

            vig = 1 - 0.18 * (math.hypot(x - cx, y - cy) / maxd) ** 2.2
            grain = random.uniform(-4.5, 4.5)

            px[x, y] = tuple(
                max(0, min(255, int(c * vig + grain))) for c in (r, g, b)
            )
    return img


def gradient(size, top, bottom) -> Image.Image:
    w, h = size
    img = Image.new("RGB", size)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line(
            [(0, y), (w, y)],
            fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)),
        )
    return img


def scene_sunset(size=(900, 900)) -> Image.Image:
    img = gradient(size, (232, 148, 92), (74, 52, 82))
    d = ImageDraw.Draw(img)
    w, h = size
    d.ellipse([w * 0.32, h * 0.34, w * 0.68, h * 0.70], fill=(250, 214, 150))
    d.rectangle([0, h * 0.72, w, h], fill=(38, 30, 40))
    for i in range(9):  # gespiegeltes Licht auf dem Wasser
        y = h * 0.74 + i * h * 0.028
        d.line([(w * (0.36 + i * 0.012), y), (w * (0.64 - i * 0.012), y)],
               fill=(196, 150, 120), width=3)
    return classic_look(img.filter(ImageFilter.GaussianBlur(0.6)))


def scene_night(size=(900, 900)) -> Image.Image:
    img = gradient(size, (22, 24, 46), (56, 40, 70))
    d = ImageDraw.Draw(img)
    w, h = size
    for _ in range(120):
        x, y = random.uniform(0, w), random.uniform(0, h * 0.65)
        r = random.uniform(0.6, 2.0)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(226, 226, 244))
    for _ in range(14):  # Skyline
        bw = random.uniform(w * 0.05, w * 0.13)
        bx = random.uniform(0, w - bw)
        bh = random.uniform(h * 0.08, h * 0.28)
        d.rectangle([bx, h - bh, bx + bw, h], fill=(16, 14, 26))
        for wy in range(int(h - bh) + 12, int(h) - 8, 22):
            for wx in range(int(bx) + 8, int(bx + bw) - 8, 18):
                if random.random() < 0.45:
                    d.rectangle([wx, wy, wx + 6, wy + 9], fill=(238, 196, 106))
    return classic_look(img)


def scene_kitchen(size=(900, 900)) -> Image.Image:
    img = gradient(size, (206, 188, 158), (128, 110, 90))
    d = ImageDraw.Draw(img)
    w, h = size
    d.rectangle([0, h * 0.62, w, h], fill=(92, 66, 44))
    d.ellipse([w * 0.18, h * 0.40, w * 0.46, h * 0.68], fill=(238, 232, 218))
    d.ellipse([w * 0.22, h * 0.44, w * 0.42, h * 0.64], fill=(112, 74, 46))
    d.rectangle([w * 0.56, h * 0.30, w * 0.72, h * 0.66], fill=(196, 206, 190))
    return classic_look(img.filter(ImageFilter.GaussianBlur(0.5)))


def avatar(name: str, size=(360, 360)) -> Image.Image:
    """Abstraktes Portraetbild — bewusst kein Foto, aber wiedererkennbar."""
    h = sum(ord(c) * (i + 7) for i, c in enumerate(name))
    palette = [
        ((214, 128, 88), (86, 52, 62)),
        ((122, 156, 118), (40, 58, 52)),
        ((160, 128, 196), (48, 36, 74)),
        ((222, 186, 112), (96, 66, 40)),
        ((120, 148, 186), (36, 48, 72)),
    ]
    top, bottom = palette[h % len(palette)]
    img = gradient(size, top, bottom)
    d = ImageDraw.Draw(img)
    w, hh = size
    # Schulter und Kopf als Silhouette
    d.ellipse([w * 0.30, hh * 0.18, w * 0.70, hh * 0.58], fill=tuple(int(c * 0.55) for c in bottom))
    d.ellipse([w * 0.14, hh * 0.62, w * 0.86, hh * 1.25], fill=tuple(int(c * 0.55) for c in bottom))
    return classic_look(img.filter(ImageFilter.GaussianBlur(0.8)))


def as_jpeg(img: Image.Image, quality=86) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality)
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


def main() -> None:
    global BASE
    ap = argparse.ArgumentParser()
    ap.add_argument("--me", default="Aaron", help="Hauptnutzer, für den alles ankommt")
    ap.add_argument("--base", default=BASE, help="Adresse des Backends")
    ap.add_argument("--reset", action="store_true", help="Daten dieser Leute vorher löschen")
    ap.add_argument("--me-token", help="Zugangscode des Hauptnutzers, falls der Name schon vergeben ist")
    args = ap.parse_args()
    BASE = args.base.rstrip("/")

    me = args.me
    everyone = [me] + PEOPLE

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

    # --- Profile ----------------------------------------------------------
    print("Profilbilder …", end="", flush=True)
    for person in everyone:
        pid = upload(as_jpeg(avatar(person)), "image/jpeg", as_=person)
        call("PUT", "/api/profiles/" + urllib.parse.quote(person), {"avatarId": pid}, as_=person)
        print(".", end="", flush=True)
    print(f" {len(everyone)} Leute")

    # --- Kassetten -------------------------------------------------------
    # Eine Kassette ist eine Runde. Bewusst mit unterschiedlichen Besetzungen,
    # damit man sieht, dass sich die Kreise nicht vermischen.
    print("Kassetten …", end="", flush=True)
    RUNDEN = [
        ("Alle Freunde", [me] + PEOPLE),
        ("Freitagsrunde", [me, "Jonas", "Tarek"]),
        ("Die Kliqe", [me, "Mira", "Lena"]),
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

    # Feste Bandsorten fuer die Demo-Kassetten: Aaron wollte "Die Kliqe" lila
    # (Atomic Purple). Ohne Override haengt das Aussehen an der zufaelligen
    # Kassetten-ID — bei jedem --reset also ein neues Los. Ein Tausch der IDs
    # untereinander waere nur RELATIV korrekt und wuerde beim naechsten Reset
    # wieder zufaellig woanders landen. Feste Textwerte machen das Ergebnis
    # unabhaengig vom Zufall der UUIDs.
    COLOR_SEEDS = {
        "Die Kliqe": "kliqtape-look-die-kliqe",          # -> Type IV Metal / Atomic Purple
        "Alle Freunde": "kliqtape-look-alle-freunde",    # -> Type II Chrome / Ice
        "Freitagsrunde": "kliqtape-look-freitagsrunde",  # -> Oliv Extra / Kiwi
    }
    for name, seed in COLOR_SEEDS.items():
        call("PATCH", f"/api/cassettes/{tapes_by_name[name]}", {"colorSeed": seed, "by": me})

    print(f" {len(RUNDEN)} Runden")

    posts: dict[str, str] = {}

    def post(cassette, side, author, kind, body="", media=None, tape=None, key=None):
        payload = {"cassetteId": tapes_by_name[cassette], "side": side,
                   "author": author, "kind": kind, "body": body}
        if media:
            payload["mediaId"] = media
        if tape:
            payload["tapeId"] = tape
        res = call("POST", "/api/posts", payload)
        if key:
            posts[key] = res["id"]
        return res["id"]

    # --- Alle Freunde: Seite A Archiv, Seite B Gruppenchat ------------------
    print("Alle Freunde …", end="", flush=True)
    post("Alle Freunde", "a", "Mira", "text",
         "Ich hab die Wohnung. Dritter Stock, Altbau, viel zu teuer. Egal.", key="wohnung")

    pid = upload(as_jpeg(scene_sunset()), "image/jpeg")
    post("Alle Freunde", "a", "Tarek", "photo", "letztes Licht am See", media=pid, key="see")

    pid = upload(as_jpeg(scene_kitchen()), "image/jpeg")
    post("Alle Freunde", "a", "Mira", "photo", "erster Kaffee in der neuen Küche", media=pid)

    take, ms = wav_take(7.0, 196.0)
    aid = upload(take, "audio/wav", ms)
    post("Alle Freunde", "a", "Lena", "voice", "kurz was zum Samstag", media=aid, key="oton_a")

    post("Alle Freunde", "b", "Jonas", "text", "Jemand heute Abend spontan Zeit?", key="spontan")
    post("Alle Freunde", "b", "Tarek", "text", "Bin ab 8 da")
    print(" fertig")

    # --- Freitagsrunde: kleiner Kreis ------------------------------------
    print("Freitagsrunde …", end="", flush=True)
    post("Freitagsrunde", "a", "Jonas", "text",
         "Samstag Grillen bei mir, 18 Uhr. Adresse steht im Band.", key="grill")
    post("Freitagsrunde", "b", "Tarek", "text", "Ich bring Kohle mit")

    take, ms = wav_take(5.0, 220.0)
    aid = upload(take, "audio/wav", ms)
    post("Freitagsrunde", "b", "Jonas", "voice", "kurz zum Samstag", media=aid)
    print(" fertig")

    # --- Die Kliqe: das Vertrauliche -------------------------------------
    print("Die Kliqe …", end="", flush=True)
    post("Die Kliqe", "a", "Lena", "text", "Danke für gestern. Ernsthaft.")

    pid = upload(as_jpeg(scene_night()), "image/jpeg")
    post("Die Kliqe", "a", "Mira", "photo", "3 Uhr, konnte nicht schlafen", media=pid)

    post("Die Kliqe", "b", "Mira", "text",
         "Ich glaub ich kündige wirklich. Können wir morgen telefonieren?", key="kuendigen")

    take, ms = wav_take(6.0, 165.0)
    aid = upload(take, "audio/wav", ms)
    post("Die Kliqe", "b", "Mira", "voice", "zu lang für einen Zettel", media=aid, key="oton_b")
    print(" fertig")

    # --- Tonfetzen: kurze Sprachreaktionen statt "da war ich" ---------------
    for key, who in [
        ("grill", ["Tarek", me]),
        ("wohnung", ["Jonas", "Tarek", me]),
        ("see", ["Mira", me]),
        ("oton_a", ["Jonas"]),
        ("kuendigen", [me, "Lena"]),
        ("spontan", ["Tarek", me]),
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
            patch["coverId"] = upload(as_jpeg(cover), "image/jpeg", as_=sender)
        call("PATCH", f"/api/mixtapes/{tape['id']}", patch)
        for t, a, u in tracks:
            call("POST", f"/api/mixtapes/{tape['id']}/tracks", {"title": t, "artist": a, "url": u, "me": sender})
        if seal:
            call("POST", f"/api/mixtapes/{tape['id']}/seal", {"me": sender})
        return tape["id"]

    # Eines geschenkt an den Hauptnutzer — liegt im Regal unter "Für dich"
    build_tape("Mira", me, "Für den Heimweg",
               "Track 7 ist wichtig. Hör ihn laut und allein.",
               TRACKS[:7], cover=scene_night())

    # Eines vom Hauptnutzer verschenkt, wird gleich auch geteilt
    shared = build_tape(me, "Lena", "Sommer 99",
                        "Alles, was damals im Autoradio lief.",
                        TRACKS[1:6], cover=scene_sunset())

    # Ein Entwurf, damit "In Arbeit" nicht leer ist
    build_tape(me, "Jonas", "Noch ohne Namen",
               "", TRACKS[5:8], seal=False)

    post("Alle Freunde", "a", me, "tape", tape=shared)
    print(" 3 Stück")

    # --- Hot Line -----------------------------------------------------------
    # Der Normalfall ist jetzt ein echter Verlauf, kein Einzelschuss: die
    # erste Nachricht eroeffnet die Leitung, der Rest ist Hin und Her.
    def hotline(sender, receiver, body):
        call("POST", "/api/hotlines/threads", {"from": sender, "to": receiver, "body": body})

    hotline("Jonas", me, "Samstag klappt bei dir, oder?")
    hotline(me, "Jonas", "Ja, ab 18 Uhr.")
    hotline("Jonas", me, "Perfekt, bring noch wen mit wenn du magst.")

    hotline("Mira", me, "Danke, dass du gestern drangegangen bist.")
    hotline(me, "Mira", "Immer.")

    print("2 offene Leitungen mit Verlauf")

    print(f"\nFertig. Melde dich in der App als »{me}« an.")
    print(f"Zugangscode für »{me}«: {TOKENS[me]}")
    print("Zum Aufräumen:  python3 scripts/seed.py --reset")


if __name__ == "__main__":
    main()
