import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Side = 'a' | 'b';

/**
 * Die Seiten unterscheiden sich nach HALTBARKEIT, nicht nach Publikum —
 * wer mitliest, entscheidet die eingelegte Kassette.
 */
export const SIDE_LABEL: Record<Side, string> = {
  a: 'Bleibt',
  b: 'Überspielt',
};

export const SIDE_HINT: Record<Side, string> = {
  a: 'was bleiben soll',
  b: 'weg nach 24 Stunden',
};

interface AppState {
  /** Kein Login im Prototyp — nur ein Name, der lokal gespeichert wird. */
  me: string;
  side: Side;
  /** Welche Seite beim Öffnen liegt. */
  startSide: Side;
  /** Welche Kassette gerade eingelegt ist. */
  cassetteId: string | null;
  /** Wann eine Kassette zuletzt eingelegt war — lokal, nur für die
   *  "Neuigkeiten"-Anzeige, kein Serverzustand. */
  cassetteSeenAt: Record<string, number>;
  setMe: (name: string) => void;
  setSide: (side: Side) => void;
  setStartSide: (side: Side) => void;
  setCassette: (id: string | null) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      me: '',
      side: 'a',
      startSide: 'a',
      cassetteId: null,
      cassetteSeenAt: {},
      setMe: (me) => set({ me: me.trim().slice(0, 40) }),
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
