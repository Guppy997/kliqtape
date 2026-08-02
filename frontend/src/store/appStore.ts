import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Side = 'a' | 'b';

/**
 * Anzeigenamen der Seiten. Zentral, weil sie an vielen Stellen auftauchen.
 * Crew und Kliqe sind bewusst dasselbe Sprachregister — beides geborgter
 * 90er-Slang, der Unterschied ist nur die Groesse: die vielen, die wenigen.
 * (Alternative Schreibweise "Die Krew" passt zur q-Logik von Kliq.)
 */
export const SIDE_LABEL: Record<Side, string> = {
  a: 'Die Crew',
  b: 'Die Kliqe',
};

export const SIDE_HINT: Record<Side, string> = {
  a: 'alle Freunde',
  b: 'nur die Wenigen',
};

interface AppState {
  /** Kein Login im Prototyp — nur ein Name, der lokal gespeichert wird. */
  me: string;
  side: Side;
  /** Welche Seite beim Öffnen liegt. */
  startSide: Side;
  setMe: (name: string) => void;
  setSide: (side: Side) => void;
  setStartSide: (side: Side) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      me: '',
      side: 'a',
      startSide: 'a',
      setMe: (me) => set({ me: me.trim().slice(0, 40) }),
      setSide: (side) => set({ side }),
      setStartSide: (startSide) => set({ startSide }),
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
