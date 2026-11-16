import { useEffect } from 'react';
import { create } from 'zustand';

interface CoverState {
  /** Wie viele Vollbild-Ebenen gerade ein X oben links zeigen. */
  count: number;
  change: (delta: 1 | -1) => void;
}

/**
 * Das X oben links (Sheet.tsx, Fototuete, Imposter-Aufloesung) sitzt
 * pixelgenau dort, wo in der Leiste das Plus steht, und ist dasselbe Zeichen:
 * beim Oeffnen dreht es vom Plus aus herein. Solange so eine Ebene offen ist,
 * steht auch das Plus der Leiste (Composer.tsx) darunter schon auf X — beim
 * Schliessen dreht es im Uhrzeigersinn weiter zum Plus (nie zurueck, siehe
 * PlusMark.tsx), ganz gleich, ob die Ebene ueber "Aufnehmen", die Glocke oder
 * sonstwo aufging.
 *
 * Nicht-persistenter Store wie navStore.ts: reiner Oberflaechen-Zustand.
 */
export const useCoverStore = create<CoverState>((set) => ({
  count: 0,
  change: (delta) => set((s) => ({ count: Math.max(0, s.count + delta) })),
}));

/** Meldet eine offene Ebene mit X oben links an, solange `active` gilt. */
export function useCoverX(active: boolean): void {
  const change = useCoverStore((s) => s.change);
  useEffect(() => {
    if (!active) return;
    change(1);
    return () => change(-1);
  }, [active, change]);
}
