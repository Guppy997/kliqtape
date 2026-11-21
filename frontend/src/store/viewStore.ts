import { create } from 'zustand';
import { useBottomNav, type NavId } from './navStore';

export type ViewMode = 'cassette' | 'story' | 'news';

interface ViewState {
  /** 'story'/'news' zeigen den jeweiligen Vollbild-Bereich statt der
   *  eingelegten Kassette — `cassetteId` in appStore bleibt dabei
   *  unangetastet im Hintergrund stehen, damit man beim Verlassen genau
   *  dorthin zurueckkommt. */
  viewMode: ViewMode;
  /** Von wo die Ansicht geoeffnet wurde (z. B. das Fach): das X fuehrt
   *  dorthin zurueck statt auf das Band. null = einfach zur Kassette. */
  returnTo: NavId | null;
  /** Oeffnet eine Ansicht. `from` merkt sich den Reiter, aus dem sie kam. */
  setViewMode: (mode: ViewMode, from?: NavId | null) => void;
  /** Das X: zurueck zur Kassette und, falls gemerkt, wieder in den Reiter. */
  closeView: () => void;
}

/**
 * Eigener, nicht-persistenter Store wie navStore.ts — reiner
 * Oberflaechen-Zustand: ein Reload mitten im Story-Modus soll nicht
 * automatisch wieder hineinspringen.
 */
export const useViewMode = create<ViewState>((set, get) => ({
  viewMode: 'cassette',
  returnTo: null,
  setViewMode: (viewMode, from = null) => set({ viewMode, returnTo: from }),
  closeView: () => {
    const { returnTo } = get();
    set({ viewMode: 'cassette', returnTo: null });
    if (returnTo) useBottomNav.getState().setActive(returnTo);
  },
}));
