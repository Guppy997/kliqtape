import { create } from 'zustand';

interface JumpState {
  /** Beitrag, zu dem nach dem Einlegen gesprungen werden soll — gesetzt von
   *  der Suche in der Kassetten-Ansicht (CassetteInfo.tsx), eingeloest vom
   *  Feed (App.tsx) bzw. vom Gruppenchat (ChatThread.tsx). */
  postId: string | null;
  setJump: (postId: string | null) => void;
}

/** Fluechtig wie quoteStore.ts: ein Reload soll nicht irgendwohin springen. */
export const useJump = create<JumpState>((set) => ({
  postId: null,
  setJump: (postId) => set({ postId }),
}));

/** Springt zum Beitrag und laesst ihn kurz aufleuchten. Gibt zurueck, ob er
 *  im DOM gefunden wurde — sonst bleibt der Sprung offen. */
export function jumpTo(postId: string): boolean {
  const el = document.getElementById(`post-${postId}`);
  if (!el) return false;
  el.scrollIntoView({ block: 'center' });
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#E4DAC4';
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.animate(
      [{ boxShadow: `0 0 0 2px ${accent}`, borderRadius: '0.75rem' }, { boxShadow: '0 0 0 2px transparent', borderRadius: '0.75rem' }],
      { duration: 1800, easing: 'ease-out' },
    );
  }
  return true;
}
