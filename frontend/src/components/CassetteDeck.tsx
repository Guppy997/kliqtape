import { useEffect, useId, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCassette, fetchCassettes, setCassetteColorIndex, type Cassette } from '@/lib/api';
import { useApp } from '@/store/appStore';
import { useBottomNav } from '@/store/navStore';
import { useViewMode } from '@/store/viewStore';
import { assignPairs, lookFor } from '@/lib/cassetteLook';
import BandPicker from './BandPicker';
import CassetteInfo from './CassetteInfo';
import { CassetteFacePreview } from './CassetteHeader';
import NavButton from './NavButton';
import Sheet from './Sheet';

/** Alle Kassetten dieser Person. Zentral, weil App und Fach sie brauchen. */
export function useCassettes() {
  const me = useApp((s) => s.me);
  return useQuery({
    queryKey: ['cassettes', me],
    queryFn: () => fetchCassettes(me),
    enabled: Boolean(me),
    // Regelmaessig nachsehen, ob auf einer anderen Kassette etwas Neues
    // ankam — sonst wuerde die Neuigkeiten-Anzeige nur beim Seitenwechsel
    // aktualisieren.
    refetchInterval: 30_000,
  });
}

/**
 * Kassetten mit unsichtbarem "Neues seit dem letzten Einlegen" — die
 * eingelegte Kassette zaehlt nie mit, die sieht man ja gerade.
 */
export function useCassetteNews(): Cassette[] {
  const cassettes = useCassettes().data;
  const cassetteId = useApp((s) => s.cassetteId);
  const seenAt = useApp((s) => s.cassetteSeenAt);
  return useMemo(
    () => (cassettes ?? []).filter((c) => c.id !== cassetteId && c.lastAt != null && c.lastAt > (seenAt[c.id] ?? 0)),
    [cassettes, cassetteId, seenAt],
  );
}

/**
 * Welches Band welche Sorte bekommt — im Regal nie zweimal dieselbe.
 *
 * Drei Ebenen, in dieser Reihenfolge:
 * 1. colorIndex — fest von Hand gewaehlt (siehe Farb-Schritt beim Anlegen),
 *    zeigt IMMER genau diese Sorte, keine Kollisions-Logik.
 * 2. colorSeed — manueller Hash-Override (z. B. um zwei Baender zu tauschen),
 *    zaehlt statt der ID.
 * 3. sonst die ID selbst.
 * Von Hand gewaehlte Sorten (1.) reservieren ihren Platz auch fuer die
 * automatisch zugewiesenen (2./3.) — sonst koennte ein frisch angelegtes Band
 * zufaellig dieselbe Sorte hashen, die jemand bewusst gewaehlt hat.
 */
export function useLookIndex(): Map<string, number> {
  const { data: cassettes = [] } = useCassettes();
  return useMemo(() => {
    const out = new Map<string, number>();
    const fixed = new Set<number>();
    const auto: Cassette[] = [];
    for (const c of cassettes) {
      if (c.colorIndex != null) {
        out.set(c.id, c.colorIndex);
        fixed.add(c.colorIndex);
      } else {
        auto.push(c);
      }
    }
    const keys = auto.map((c) => c.colorSeed || c.id);
    const byKey = assignPairs(keys, fixed);
    auto.forEach((c) => {
      const idx = byKey.get(c.colorSeed || c.id);
      if (idx != null) out.set(c.id, idx);
    });
    return out;
  }, [cassettes]);
}

/**
 * Das Kassettenfach.
 *
 * Eine Kassette ist eine Runde von Leuten. Man hat nicht einen Freundeskreis,
 * sondern mehrere — und die zu vermischen funktioniert nicht. Also legt man die
 * Kassette der Runde ein, mit der man gerade redet.
 */
export default function CassetteDeck() {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const cassetteId = useApp((s) => s.cassetteId);
  const setCassette = useApp((s) => s.setCassette);
  const qc = useQueryClient();

  // Echte Tableiste: der Store haelt, welcher der drei unteren Knoepfe gerade
  // offen ist — nie mehrere gleichzeitig (siehe navStore.ts).
  const navActive = useBottomNav((s) => s.active);
  const setActiveNav = useBottomNav((s) => s.setActive);
  const setViewMode = useViewMode((s) => s.setViewMode);
  const open = navActive === 'eject';
  const [manage, setManage] = useState<string | null>(null);
  // Nach "Einlegen" haelt das die ID des frisch angelegten Bands, solange
  // der Farb-Schritt offen ist — danach (fertig oder uebersprungen) wieder null.
  // Eigene Seite zum Anlegen, statt eines gedraengten Formulars unter der
  // Liste — aufgerufen ueber das Plus in der Gruppen-Ueberschrift. Name UND
  // Bandsorte werden dort zusammen festgelegt; frueher war die Farbe ein
  // zweiter Schritt nach dem Anlegen.
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  /** Gewaehlte Bandsorte, null = automatisch zugewiesene nehmen. */
  const [newLook, setNewLook] = useState<number | null>(null);
  /** Suche ueber die eigenen Gruppen im Fach. */
  const [groupQuery, setGroupQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: cassettes = [] } = useCassettes();
  const looks = useLookIndex();

  // Von aussen mit Absicht geoeffnet (Leerzustand): direkt ins Anlegen bzw.
  // in die Kassetten-Ansicht mit offenem Einladen springen.
  const deckIntent = useBottomNav((s) => s.deckIntent);
  const clearDeckIntent = useBottomNav((s) => s.clearDeckIntent);
  const [inviteFirst, setInviteFirst] = useState(false);
  useEffect(() => {
    if (!open || !deckIntent) return;
    setError(null);
    if (deckIntent.kind === 'create') {
      setManage(null);
      setNewName('');
      setCreating(true);
    } else {
      setCreating(false);
      setManage(deckIntent.cassetteId);
      setInviteFirst(true);
    }
    clearDeckIntent();
  }, [open, deckIntent, clearDeckIntent]);
  // Die eingelegte Kassette steht immer oben, der Rest bleibt in der
  // Reihenfolge, die der Server schon liefert: nach letzter Aktivitaet
  // (ORDER BY last_at DESC, siehe GET /api/cassettes). sort() ist stabil,
  // die Aktivitaets-Reihenfolge bleibt also unter der ersten Zeile erhalten.
  const shownCassettes = cassettes
    .filter((c) => c.name.toLowerCase().includes(groupQuery.trim().toLowerCase()))
    .sort((a, b) => (a.id === cassetteId ? -1 : b.id === cassetteId ? 1 : 0));

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['cassettes', me] });
    void qc.invalidateQueries({ queryKey: ['members'] });
  };
  const fail = (e: Error) => setError(e.message);

  const create = useMutation({
    // Anlegen und Bandsorte in einem Rutsch: die Sorte laesst sich erst nach
    // dem Anlegen setzen (sie haengt an der Kassetten-ID), fuer die Bedienung
    // ist es aber ein einziger Schritt.
    mutationFn: async () => {
      const c = await createCassette(newName.trim(), me);
      if (newLook != null) await setCassetteColorIndex(c.id, newLook, me);
      return c;
    },
    onSuccess: (c) => {
      refresh();
      setNewName('');
      setNewLook(null);
      setCreating(false);
      // Sonst waere das frisch angelegte Band hinter einer alten Suche versteckt.
      setGroupQuery('');
      setCassette(c.id);
      setActiveNav(null);
    },
    onError: fail,
  });

  return (
    <>
      <NavButton
        icon={
          <svg width="16" height="13" viewBox="0 0 16 13" fill="currentColor" aria-hidden="true">
            <path d="M8 0l8 8H0z" />
            <rect x="0" y="10.5" width="16" height="2.5" rx="1" />
          </svg>
        }
        label="Eject"
        active={open}
        onClick={() => {
          setError(null);
          setManage(null);
          setCreating(false);
          setGroupQuery('');
          setActiveNav('eject');
        }}
      />

      <Sheet
        open={open}
        onClose={() => setActiveNav(null)}
        variant="full"
        reserveBottomNav
        // Hauptseite: Wechsel laeuft ueber die untere Leiste, also kein X.
        // Die Unterseiten (Neue Gruppe, Mitglieder) haben ihren eigenen
        // Zurueck-Pfeil zum Fach.
        hideClose
        title={creating ? 'Neue Gruppe' : manage ? 'Kassette' : 'Fach'}
      >
        {creating ? (
          <div className="flex flex-col gap-5">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="self-start text-2xs"
              style={{ color: 'var(--dim)' }}
            >
              ← Fach
            </button>

            <div>
              <p className="text-lg heading" style={{ color: 'var(--ink)' }}>
                Wie soll das Band heißen?
              </p>
              <p className="mt-1 text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
                Der Name steht später auf dem Etikett — änderbar ist er jederzeit.
              </p>
            </div>

            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={40}
              autoFocus
              placeholder="z. B. Freitagsrunde"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim() && !create.isPending) create.mutate();
              }}
              className="w-full rounded-lg px-3 py-3 text-base outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            />

            <div className="flex flex-col gap-2">
              <p className="text-2xs" style={{ color: 'var(--dim)' }}>
                Bandsorte {newLook == null && '· ohne Auswahl automatisch'}
              </p>
              <BandPicker value={newLook} onChange={setNewLook} label={newName.trim() || undefined} />
            </div>

            {error && (
              <p className="text-sm" style={{ color: 'var(--danger)' }}>
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={!newName.trim() || create.isPending}
              onClick={() => create.mutate()}
              className="w-full rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              Einlegen
            </button>

            <p className="text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
              Du bist danach allein auf dem Band und kannst Leute einladen. Jedes Mitglied darf weitere einladen.
            </p>
          </div>
        ) : manage && cassettes.some((c) => c.id === manage) ? (
          <CassetteInfo
            cassette={cassettes.find((c) => c.id === manage)!}
            pairIndex={looks.get(manage)}
            startInviting={inviteFirst}
            onBack={() => {
              setManage(null);
              setInviteFirst(false);
            }}
            onGone={() => {
              setManage(null);
              if (manage === cassetteId) setCassette(null);
              refresh();
            }}
            onJump={() => {
              setManage(null);
              setActiveNav(null);
            }}
          />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              {/* Immer da, unabhaengig davon ob schon Storys existieren —
                  bewusst NICHT wie eine normale Kassette gefaerbt (die
                  Bandsorten-Palette ist absichtlich gedeckt/vintage), sondern
                  eine eigene, schimmernde Optik — soll auf den ersten Blick
                  als "das ist was anderes" auffallen. */}
              <button
                type="button"
                onClick={() => {
                  // Das X der Story fuehrt zurueck ins Fach, nicht aufs Band.
                  setViewMode('story', 'eject');
                  setActiveNav(null);
                }}
                className="flex items-center gap-3 rounded-xl p-2.5 text-left"
                // Bewusst derselbe neutrale Rahmen wie bei Kliqtape: der
                // frueher rosa leuchtende Rand sah aus wie "ausgewaehlt".
                // Leuchten tut jetzt nur noch die eingelegte Gruppe. Story
                // faellt weiterhin ueber Icon und Farbe der Beschriftung auf.
                style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
              >
                <StoryCassetteIcon />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium" style={{ color: '#E0568C' }}>
                    Story
                  </span>
                  <span className="block truncate text-2xs" style={{ color: 'var(--dim)' }}>
                    Foto &amp; Video · 24 Stunden sichtbar
                  </span>
                </span>
              </button>

              {/* Der offizielle Kanal — ebenfalls immer da, unabhaengig von
                  eigenen Kassetten. Eigene Optik ueber das echte Wortmarke-
                  Logo statt erfundener Farben, damit sofort klar ist: das
                  ist die App selbst, nicht irgendeine besondere Gruppe. */}
              <button
                type="button"
                onClick={() => {
                  setViewMode('news', 'eject');
                  setActiveNav(null);
                }}
                className="flex items-center gap-3 rounded-xl p-2.5 text-left"
                style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
              >
                <KliqtapeCassetteIcon />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium" style={{ color: 'var(--ink)' }}>
                    Kliqtape
                  </span>
                  <span className="block truncate text-2xs" style={{ color: 'var(--dim)' }}>
                    News, Insights &amp; unterstütze das Projekt
                  </span>
                </span>
              </button>

              <h3 className="mt-1 text-xs heading" style={{ color: 'var(--dim)' }}>
                Gruppen
              </h3>

              {/* Suche und Anlegen in einer Zeile, wie bei der Hot Line.
                  Das Suchfeld erscheint erst ab dem ersten Band — mit leerem
                  Fach waere es Ballast. Das Plus steht immer da und dank
                  ml-auto immer an derselben Stelle, auch ohne Suchfeld. */}
              <div className="flex items-center gap-2">
                {cassettes.length > 0 && (
                  <input
                    value={groupQuery}
                    onChange={(e) => setGroupQuery(e.target.value)}
                    placeholder="Gruppe suchen …"
                    className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setNewName('');
                    setError(null);
                    setCreating(true);
                  }}
                  aria-label="Neue Gruppe anlegen"
                  title="Neue Gruppe"
                  className="hit ml-auto grid size-9 shrink-0 place-items-center rounded-full transition-transform active:scale-95"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M7 1v12M1 7h12" />
                  </svg>
                </button>
              </div>

              {cassettes.length === 0 && (
                <p className="py-6 text-center text-sm" style={{ color: 'var(--dim)' }}>
                  Noch kein Band im Fach.
                </p>
              )}

              {cassettes.length > 0 && shownCassettes.length === 0 && (
                <p className="py-6 text-center text-2xs" style={{ color: 'var(--dim)' }}>
                  Keine Gruppe gefunden.
                </p>
              )}

              {shownCassettes.map((c) => {
                // Nicht eingelegte Baender zeigen immer Seite A — dieselbe
                // Regel wie vorher bei MiniCassette (onB dort war
                // "active && side === 'b'"): nur das gerade eingelegte Band
                // folgt der tatsaechlichen Seite, alle anderen bleiben auf
                // ihrer Typ-Optik stehen.
                const rowSide = c.id === cassetteId ? side : 'a';
                const { type, case: plastic } = lookFor(c.id, looks.get(c.id));
                const glow = rowSide === 'b' ? plastic.glow : type.stripe;
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded-xl p-2.5"
                    style={{
                      background: 'var(--card)',
                      border: `1px solid ${c.id === cassetteId ? 'var(--accent)' : 'var(--line)'}`,
                      // Nur die eingelegte Kassette leuchtet — das ist jetzt das
                      // einzige "ausgewaehlt"-Signal im Fach.
                      boxShadow:
                        c.id === cassetteId
                          ? '0 0 0.9rem color-mix(in srgb, var(--accent) 28%, transparent)'
                          : undefined,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setCassette(c.id);
                        setActiveNav(null);
                        window.scrollTo({ top: 0 });
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      {/* Dieselbe Zeichnung wie der grosse Kopf und das Symbol
                        oben links (CassetteHeader.tsx) — keine dritte,
                        vereinfachte Nachbildung mehr. Ohne echtes Tape-Datum
                        (das haette pro Zeile eine eigene Abfrage gebraucht)
                        faellt die Vorschau auf "Position NNN" und
                        "Seite X — ..." zurueck, genau wie beim Kopf, bevor
                        ein Tape geladen ist. */}
                      <span
                        className="shrink-0"
                        style={{
                          opacity: c.id === cassetteId ? 1 : 0.72,
                          filter: `drop-shadow(0 0.2rem 0.4rem rgba(0,0,0,.5)) drop-shadow(0 0 0.35rem ${glow}70)`,
                        }}
                      >
                        <CassetteFacePreview
                          side={rowSide}
                          cassetteId={c.id}
                          pairIndex={looks.get(c.id)}
                          label={c.name}
                          count={c.sideA + c.sideB}
                          currentTape={null}
                          createdAt={c.createdAt}
                          width={60}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium" style={{ color: 'var(--ink)' }}>
                          {c.name}
                        </span>
                        <span className="block truncate text-2xs" style={{ color: 'var(--dim)' }}>
                          {c.memberCount} {c.memberCount === 1 ? 'Person' : 'Leute'} · A {c.sideA} · B {c.sideB}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInviteFirst(false);
                        setManage(c.id);
                      }}
                      aria-label={`${c.name} bearbeiten`}
                      title="Bearbeiten"
                      className="hit grid size-7 shrink-0 place-items-center rounded-full"
                      style={{ border: '1px solid var(--line)', color: 'var(--dim)' }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M11 2l3 3-8 8-3.5.5.5-3.5z" />
                        <path d="M9.5 3.5l3 3" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            {error && (
              <p className="text-sm" style={{ color: 'var(--danger)' }}>
                {error}
              </p>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}

/* ---------------------------------------------------------------------------
   Gemeinsame Geometrie aller Mini-Kassetten (Fach, Story, Kliqtape).
   Spiegelt den Aufbau des grossen Kopfes (CassetteHeader.tsx) im Kleinen:
   Etikett mit Farbband obendrauf, darunter das Sichtfenster mit den Spulen,
   ganz unten der Fuss mit den vier Andockloechern — buendig auf der
   Unterkante, genau wie am echten Vorbild.

   Bewusst EINE Quelle fuer die Masse: die drei Icons sahen vorher
   unterschiedlich aus und hatten noch den alten bunten Balken am unteren
   Rand, den es am grossen Kopf laengst nicht mehr gibt.
   --------------------------------------------------------------------------- */
const MINI = {
  label: { x: 3.5, y: 3, w: 39, h: 11.5, bandH: 3.5 },
  window: { x: 3.5, y: 16.5, w: 39, h: 8.5 },
  reel: { left: 13, right: 33, cy: 20.75, r: 3, hub: 1.1 },
  /** Trapez: oben 16-85%, unten etwas breiter 12-90% — wie am Vorbild-Foto. */
  foot: 'M7.4 27 H39.1 L41.4 32 H5.5 Z',
  holes: [10.5, 17.5, 29.5, 36.5],
} as const;

/** Der Fuss samt Andockloechern. Die feine Lichtkante an der Oberkante laesst
 *  ihn als vorstehendes Bauteil lesen, sonst waere er Flaeche auf Flaeche. */
function MiniFoot({ fill, hole }: { fill: string; hole: string }) {
  return (
    <>
      <path d={MINI.foot} fill={fill} />
      <path d="M7.4 27 H39.1" stroke="rgba(255,255,255,.22)" strokeWidth="0.5" fill="none" />
      {MINI.holes.map((x, i) =>
        i === 0 || i === 3 ? (
          <circle key={x} cx={x} cy="29.9" r="0.85" fill={hole} />
        ) : (
          <rect key={x} x={x - 0.35} y="29.3" width="0.7" height="1.25" rx="0.25" fill={hole} />
        ),
      )}
    </>
  );
}

/** Text auf dem Etikett — Bandsorte im Farbband oben, Name im Beschriftungs-
 *  feld darunter. Bewusst NICHT auf Lesbarkeit ausgelegt (Schriftgroesse
 *  liegt weit unter jeder Mindestgroesse) — es geht um die Textur eines
 *  wirklich beschrifteten Etiketts, nicht um Text zum Lesen. Der ueberge-
 *  ordnete clipPath jeder Kassette schneidet zu lange Namen sauber ab, ganz
 *  ohne eigene Kuerzungslogik. */
function MiniLabelText({
  band,
  body,
  bandColor,
  bodyColor,
}: {
  band?: string;
  body?: string;
  bandColor: string;
  bodyColor: string;
}) {
  return (
    <>
      {band && (
        <text
          x={MINI.label.x + 1.6}
          y={MINI.label.y + MINI.label.bandH - 0.9}
          fontSize="2.3"
          fontWeight="700"
          letterSpacing="0.02"
          fill={bandColor}
          // Display-Schnitt laut Marke: Archivo 700, Breite 87.5
          style={{ fontFamily: 'var(--font-sans)', fontStretch: '87.5%' }}
        >
          {band}
        </text>
      )}
      {body && (
        <text
          x={MINI.label.x + 1.6}
          y={MINI.label.y + MINI.label.bandH + 5.7}
          fontSize="4.6"
          fill={bodyColor}
          style={{ fontFamily: 'var(--font-hand)' }}
        >
          {body}
        </text>
      )}
    </>
  );
}

/** Eigene, schimmernde Optik fuer die Story-Zeile — bewusst NICHT aus der
 *  Bandsorten-Palette (lookFor/PAIRS), die ist absichtlich gedeckt/vintage.
 *  Gold-Pink-Lila-Verlauf + kleine Glanzpunkte statt Marmor-Sprenkel, damit
 *  sofort klar ist: das ist keine Kassette wie die anderen. Aufbau (Etikett,
 *  Fenster, Fuss) ist aber derselbe wie bei allen anderen. */
function StoryCassetteIcon() {
  return (
    <svg width="46" height="32" viewBox="0 0 46 32" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="story-shell" x1="0" y1="0" x2="46" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5C86B" />
          <stop offset="45%" stopColor="#E0568C" />
          <stop offset="100%" stopColor="#7C5CE0" />
        </linearGradient>
        <linearGradient id="story-label" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF6E9" />
          <stop offset="100%" stopColor="#FBD9C0" />
        </linearGradient>
        <clipPath id="story-label-clip">
          <rect x={MINI.label.x} y={MINI.label.y} width={MINI.label.w} height={MINI.label.h} rx="1" />
        </clipPath>
      </defs>
      <rect width="46" height="32" rx="3" fill="url(#story-shell)" />
      <circle cx="6" cy="5" r="0.8" fill="#fff" opacity="0.9" />
      <circle cx="44" cy="14" r="0.5" fill="#fff" opacity="0.7" />
      <circle cx="2" cy="20" r="0.6" fill="#fff" opacity="0.6" />

      {/* Etikett mit Farbband oben */}
      <g clipPath="url(#story-label-clip)">
        <rect x={MINI.label.x} y={MINI.label.y} width={MINI.label.w} height={MINI.label.h} fill="url(#story-label)" />
        <rect x={MINI.label.x} y={MINI.label.y} width={MINI.label.w} height={MINI.label.bandH} fill="#E0568C" />
        <MiniLabelText band="STORY" body="24H" bandColor="#FFF6E9" bodyColor="#7A3E58" />
      </g>
      <rect
        x={MINI.label.x}
        y={MINI.label.y}
        width={MINI.label.w}
        height={MINI.label.h}
        rx="1"
        fill="none"
        stroke="rgba(255,255,255,.35)"
        strokeWidth="0.5"
      />

      {/* Sichtfenster mit den Spulen */}
      <rect
        x={MINI.window.x}
        y={MINI.window.y}
        width={MINI.window.w}
        height={MINI.window.h}
        rx="1"
        fill="rgba(52,20,62,.55)"
        stroke="rgba(255,255,255,.35)"
        strokeWidth="0.5"
      />
      <circle cx={MINI.reel.left} cy={MINI.reel.cy} r={MINI.reel.r} fill="#F5C86B" />
      <circle cx={MINI.reel.right} cy={MINI.reel.cy} r={MINI.reel.r} fill="#E0568C" />
      <circle cx={MINI.reel.left} cy={MINI.reel.cy} r={MINI.reel.hub} fill="url(#story-label)" />
      <circle cx={MINI.reel.right} cy={MINI.reel.cy} r={MINI.reel.hub} fill="url(#story-label)" />

      <MiniFoot fill="rgba(255,255,255,.24)" hole="rgba(0,0,0,.4)" />
    </svg>
  );
}

/** Eigene Optik fuer die Kliqtape-Zeile, im Stil des Wortmarke-Logos
 *  (Lockup.tsx): dort ist "Kliq" voll eingefaerbt, "tape" nur Kontur — genau
 *  dieselbe Zweiteilung wandert hier auf die Spulen: linke Spule voll
 *  (wie "Kliq"), rechte Spule nur Umriss (wie "tape"). Bewusst monochrom mit
 *  denselben Theme-Variablen wie das echte Logo, keine erfundene Farbe. */
function KliqtapeCassetteIcon() {
  return (
    <svg width="46" height="32" viewBox="0 0 46 32" aria-hidden="true" className="shrink-0">
      <defs>
        <clipPath id="kliqtape-label-clip">
          <rect x={MINI.label.x} y={MINI.label.y} width={MINI.label.w} height={MINI.label.h} rx="1" />
        </clipPath>
      </defs>
      {/* Umgekehrt zu allen anderen: helles Gehaeuse, dunkle Flaechen — das
          ist die Wortmarke als Kassette, kein echtes Band. */}
      <rect width="46" height="32" rx="3" fill="var(--ink)" />

      <g clipPath="url(#kliqtape-label-clip)">
        <rect x={MINI.label.x} y={MINI.label.y} width={MINI.label.w} height={MINI.label.h} fill="var(--screen)" />
        <rect
          x={MINI.label.x}
          y={MINI.label.y}
          width={MINI.label.w}
          height={MINI.label.bandH}
          fill="var(--ink)"
          opacity="0.35"
        />
        <MiniLabelText band="KLIQTAPE" body="NEWS" bandColor="var(--screen)" bodyColor="var(--ink)" />
      </g>

      <rect
        x={MINI.window.x}
        y={MINI.window.y}
        width={MINI.window.w}
        height={MINI.window.h}
        rx="1"
        fill="var(--screen)"
      />
      {/* linke Spule — voll, wie "Kliq" */}
      <circle cx={MINI.reel.left} cy={MINI.reel.cy} r={MINI.reel.r} fill="var(--ink)" />
      <circle cx={MINI.reel.left} cy={MINI.reel.cy} r={MINI.reel.hub} fill="var(--screen)" />
      {/* rechte Spule — nur Kontur, wie "tape" */}
      <circle
        cx={MINI.reel.right}
        cy={MINI.reel.cy}
        r={MINI.reel.r - 0.4}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.1"
      />

      <MiniFoot fill="var(--ink)" hole="var(--screen)" />
    </svg>
  );
}

/** Miniaturband — zeigt echte Bandsorte, Spuren und Streifen. Auch vom
 *  Tape-Regal genutzt (Shelf.tsx), daher exportiert.
 *
 *  `label` ist der Name der Kassette (oder beim Anlegen der gerade
 *  eingetippte Name) — steht in echt-klein auf dem Etikett, genau wie am
 *  grossen Kopf, nur ohne Anspruch auf Lesbarkeit bei der Groesse. */
export function MiniCassette({
  id,
  pairIndex,
  active,
  side,
  pop,
  label,
}: {
  id: string;
  pairIndex?: number;
  active: boolean;
  side: 'a' | 'b';
  pop?: boolean;
  label?: string;
}) {
  const uid = useId();
  const { type, case: plastic, wear } = lookFor(id, pairIndex);
  const onB = active && side === 'b';

  const shell = onB ? plastic.shell : type.shell;
  const paper = onB ? plastic.inner : type.label;
  const tape = onB ? plastic.shellHi : type.tape;
  const stripe = onB ? plastic.glow : type.stripe;
  const windowBg = onB ? plastic.inner : type.shellDark;
  const ink = onB ? plastic.ink : type.ink;
  const bandInk = onB ? plastic.ink : type.stripeInk;
  const sortName = onB ? plastic.name : type.name;
  const shellGrad = `mini-shell-${uid}`;
  const reelGrad = `mini-reel-${uid}`;
  const labelClip = `mini-label-${uid}`;

  return (
    <svg
      width="46"
      height="32"
      viewBox="0 0 46 32"
      aria-hidden="true"
      className="shrink-0"
      style={{
        opacity: active ? 1 : 0.72,
        // Nur in der eigentlichen Fach-Liste (nicht im Farb-Auswahlraster,
        // das waere mit vielen kleinen Glueh-Schatten nebeneinander zu
        // unruhig) — echter Schlagschatten + Akzentfarb-Glow, damit die
        // Kassette sich vom Hintergrund abhebt statt drin zu verschwimmen.
        filter: pop ? `drop-shadow(0 0.2rem 0.4rem rgba(0,0,0,.5)) drop-shadow(0 0 0.35rem ${stripe}70)` : undefined,
      }}
    >
      <defs>
        {/* Gleiche Lichtrichtung wie beim grossen Kassetten-Kopf — oben
            links hell, unten rechts dunkler, macht aus der flachen Flaeche
            ein leicht gewoelbtes Gehaeuse. */}
        <radialGradient id={shellGrad} cx="24%" cy="10%" r="95%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
        </radialGradient>
        <radialGradient id={reelGrad} cx="36%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="40%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.4" />
        </radialGradient>
        <clipPath id={labelClip}>
          <rect x={MINI.label.x} y={MINI.label.y} width={MINI.label.w} height={MINI.label.h} rx="1" />
        </clipPath>
      </defs>
      <rect width="46" height="32" rx="3" fill={shell} />
      {/* Marmor-/Konfetti-Sprenkel, nur bei gemusterten Sorten (plastic.fleck)
          und nur auf Seite B — sitzen unter dem Etikett, das Etikett-Rechteck
          deckt die Mitte ab, am Rand bleiben sie sichtbar. */}
      {onB &&
        plastic.fleck &&
        wear.specks
          .slice(0, 7)
          .map(([x, y, r], i) => (
            <circle
              key={i}
              cx={x * 0.46}
              cy={y * 0.32}
              r={Math.max(1, r * 0.9)}
              fill={plastic.fleck![i % plastic.fleck!.length]}
              opacity={0.88}
            />
          ))}
      <rect width="46" height="32" rx="3" fill={`url(#${shellGrad})`} />

      {/* Etikett: Papier mit dem Farbband der Bandsorte obendrauf — dieselbe
          J-Card-Aufteilung wie am grossen Kopf. Das Farbband ersetzt den
          frueheren bunten Balken am unteren Rand als Farbtraeger, ueber den
          man seine Kassette im Fach wiedererkennt. */}
      <g clipPath={`url(#${labelClip})`}>
        <rect x={MINI.label.x} y={MINI.label.y} width={MINI.label.w} height={MINI.label.h} fill={paper} />
        <rect x={MINI.label.x} y={MINI.label.y} width={MINI.label.w} height={MINI.label.bandH} fill={stripe} />
        <MiniLabelText band={sortName} body={label} bandColor={bandInk} bodyColor={ink} />
      </g>
      <rect
        x={MINI.label.x}
        y={MINI.label.y}
        width={MINI.label.w}
        height={MINI.label.h}
        rx="1"
        fill="none"
        stroke="rgba(255,255,255,.22)"
        strokeWidth="0.5"
      />

      {/* Sichtfenster mit den Spulen */}
      <rect
        x={MINI.window.x}
        y={MINI.window.y}
        width={MINI.window.w}
        height={MINI.window.h}
        rx="1"
        fill={windowBg}
        stroke="rgba(255,255,255,.22)"
        strokeWidth="0.5"
      />
      <circle cx={MINI.reel.left} cy={MINI.reel.cy} r={MINI.reel.r} fill={tape} />
      <circle cx={MINI.reel.right} cy={MINI.reel.cy} r={MINI.reel.r} fill={tape} />
      <circle cx={MINI.reel.left} cy={MINI.reel.cy} r={MINI.reel.r} fill={`url(#${reelGrad})`} />
      <circle cx={MINI.reel.right} cy={MINI.reel.cy} r={MINI.reel.r} fill={`url(#${reelGrad})`} />
      <circle cx={MINI.reel.left} cy={MINI.reel.cy} r={MINI.reel.hub} fill={paper} />
      <circle cx={MINI.reel.right} cy={MINI.reel.cy} r={MINI.reel.hub} fill={paper} />

      {/* dieselben Gebrauchsspuren wie am grossen Band */}
      {wear.scratches.slice(0, 2).map(([x, y, len], i) => (
        <line
          key={i}
          x1={x * 0.46}
          y1={y * 0.32}
          x2={(x + len) * 0.46}
          y2={y * 0.32 - 1}
          stroke="rgba(255,255,255,.25)"
          strokeWidth="0.4"
        />
      ))}

      <MiniFoot fill={shell} hole="rgba(0,0,0,.6)" />
    </svg>
  );
}
