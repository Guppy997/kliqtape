import { create } from 'zustand';

export type NavId = 'eject' | 'hotline' | 'notify';

/** Womit das Fach aufgehen soll, wenn es von aussen geoeffnet wird — etwa aus
 *  dem Leerzustand (EmptyState.tsx) direkt ins Anlegen oder Einladen. */
export type DeckIntent = { kind: 'create' } | { kind: 'invite'; cassetteId: string };

interface NavState {
  /** Welches der drei Sheets in der unteren Leiste gerade offen ist — nie
   *  mehrere gleichzeitig, echte Tableiste statt unabhaengiger Knoepfe. */
  active: NavId | null;
  setActive: (id: NavId | null) => void;
  deckIntent: DeckIntent | null;
  openDeck: (intent: DeckIntent) => void;
  clearDeckIntent: () => void;
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
  deckIntent: null,
  openDeck: (intent) => set({ active: 'eject', deckIntent: intent }),
  clearDeckIntent: () => set({ deckIntent: null }),
}));
