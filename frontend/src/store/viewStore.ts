import { create } from 'zustand';

export type ViewMode = 'cassette' | 'story' | 'news';

interface ViewState {
  /** 'story'/'news' zeigen den jeweiligen Vollbild-Bereich statt der
   *  eingelegten Kassette — `cassetteId` in appStore bleibt dabei
   *  unangetastet im Hintergrund stehen, damit man beim Verlassen genau
   *  dorthin zurueckkommt. */
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

/**
 * Eigener, nicht-persistenter Store wie navStore.ts — reiner
 * Oberflaechen-Zustand: ein Reload mitten im Story-Modus soll nicht
 * automatisch wieder hineinspringen.
 */
export const useViewMode = create<ViewState>((set) => ({
  viewMode: 'cassette',
  setViewMode: (viewMode) => set({ viewMode }),
}));
