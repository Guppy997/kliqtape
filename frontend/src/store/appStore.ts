import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Side = 'a' | 'b';

/**
 * Beide Seiten sind dauerhaft — sie unterscheiden sich nach ART, nicht nach
 * Haltbarkeit. Seite A ist das kuratierte Archiv, Seite B das laufende
 * Gespräch der Runde (siehe Etappe 3: eigener Chat statt einzelner Karten).
 */
export const SIDE_LABEL: Record<Side, string> = {
  a: 'Bleibt',
  b: 'Gruppenchat',
};

export const SIDE_HINT: Record<Side, string> = {
  a: 'was bleiben soll',
  b: 'läuft weiter',
};

interface AppState {
  /** Der Name, der lokal gespeichert wird — die eigentliche Identitaet ist
   *  aber `token` (siehe dort), der Name allein reicht seit dem minimalen
   *  Auth-Token nicht mehr. */
  me: string;
  /** Zugangscode aus /api/auth/claim bzw. /api/auth/whoami — beweist, dass
   *  dieses Geraet wirklich `me` ist, nicht nur behauptet es zu sein. Ohne
   *  Token (z.B. altes Geraet vor diesem Update) gilt man als abgemeldet. */
  token: string | null;
  side: Side;
  /** Welche Seite beim Öffnen liegt. */
  startSide: Side;
  /** Welche Kassette gerade eingelegt ist. */
  cassetteId: string | null;
  /** Wann eine Kassette zuletzt eingelegt war — lokal, nur für die
   *  "Neuigkeiten"-Anzeige, kein Serverzustand. */
  cassetteSeenAt: Record<string, number>;
  /** Neuester gesehener Beitrags-Zeitstempel PRO SEITE (Schlüssel
   *  `${cassetteId}:${side}`) — getrennt von cassetteSeenAt (das ist gröber,
   *  pro Kassette, nur für die Neuigkeiten-Lampe). Bestimmt, wohin beim
   *  nächsten Betreten dieser Seite gesprungen wird: zum ersten ungesehenen
   *  Beitrag, oder ans Ende, wenn nichts Neues da ist (siehe App.tsx). */
  sideSeenAt: Record<string, number>;
  /** Name und Token gehoeren zusammen — ein Aufruf statt zwei getrennte
   *  Sets, damit nie eins ohne das andere gesetzt wird. */
  setIdentity: (me: string, token: string) => void;
  setSide: (side: Side) => void;
  setStartSide: (side: Side) => void;
  setCassette: (id: string | null) => void;
  /** Hebt den Gesehen-Stand fuer eine Seite an — nie zurueck, falls ein
   *  aelterer Aufruf spaeter noch nachkommt (siehe App.tsx). */
  markSideSeen: (cassetteId: string, side: Side, at: number) => void;
  /** Lokal abmelden — der Zugangscode bleibt serverseitig gueltig, ein
   *  erneutes Beanspruchen desselben Namens auf diesem Geraet fragt danach. */
  logout: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      me: '',
      token: null,
      side: 'a',
      startSide: 'a',
      cassetteId: null,
      cassetteSeenAt: {},
      sideSeenAt: {},
      setIdentity: (me, token) => set({ me: me.trim().slice(0, 40), token }),
      setSide: (side) => set({ side }),
      setStartSide: (startSide) => set({ startSide }),
      // Einlegen zaehlt als "gesehen" — die Kassette faellt danach aus der
      // Neuigkeiten-Liste, bis wieder etwas Neueres dazukommt.
      setCassette: (cassetteId) =>
        set((s) => ({
          cassetteId,
          side: 'a',
          cassetteSeenAt: cassetteId ? { ...s.cassetteSeenAt, [cassetteId]: Date.now() } : s.cassetteSeenAt,
        })),
      markSideSeen: (cassetteId, side, at) =>
        set((s) => {
          const key = `${cassetteId}:${side}`;
          if (at <= (s.sideSeenAt[key] ?? 0)) return s;
          return { sideSeenAt: { ...s.sideSeenAt, [key]: at } };
        }),
      logout: () => set({ me: '', token: null, cassetteId: null }),
    }),
    { name: 'kliqtape' },
  ),
);

/** Stabile Farbe pro Person, damit Avatare wiedererkennbar bleiben. */
const PALETTE_A = ['#C8B48A', '#B8462C', '#7E9B6A', '#A98D5F', '#8C6E4A'];
const PALETTE_B = ['#C9AFEF', '#A97CE8', '#7E9B6A', '#D9C4F5', '#8B68C2'];

export function colorFor(name: string, side: Side): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const p = side === 'a' ? PALETTE_A : PALETTE_B;
  return p[h % p.length]!;
}

export function initialOf(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}
