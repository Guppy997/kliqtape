import { create } from 'zustand';
import type { Kind } from '@/lib/api';

/** Kompakte Vorschau eines Seite-A-Beitrags, direkt aus der schon geladenen
 *  Karte uebernommen — keine eigene Nachfrage noetig, um sie sofort ueber
 *  dem Composer zeigen zu koennen. */
export interface QuotedPreview {
  postId: string;
  author: string;
  kind: Kind;
  body: string;
  mediaId: string | null;
}

interface QuoteState {
  pending: QuotedPreview | null;
  setPending: (q: QuotedPreview | null) => void;
}

/**
 * Eigener, nicht-persistenter Store wie navStore.ts/viewStore.ts — traegt
 * "auf diesen Seite-A-Beitrag will ich in Seite B eingehen" ueber den
 * Seitenwechsel hinweg zum Chat-Composer. Rein fluechtiger UI-Zustand: ein
 * Reload soll keine haengengebliebene Anhaengung wieder aufleben lassen.
 */
export const useQuote = create<QuoteState>((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
}));
