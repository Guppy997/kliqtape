import { create } from 'zustand';

export type NavId = 'eject' | 'hotline' | 'notify';

interface NavState {
  /** Welches der drei Sheets in der unteren Leiste gerade offen ist — nie
   *  mehrere gleichzeitig, echte Tableiste statt unabhaengiger Knoepfe. */
  active: NavId | null;
  setActive: (id: NavId | null) => void;
}

/**
 * Bewusst ein eigener, nicht-persistenter Store statt eines Feldes in
 * appStore: das ist reiner Oberflaechen-Zustand fuer diesen Moment — ein
 * offen gebliebenes Sheet soll nach einem Reload nicht automatisch wieder
 * aufgehen.
 */
export const useBottomNav = create<NavState>((set) => ({
  active: null,
  setActive: (id) => set({ active: id }),
}));
