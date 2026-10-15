import { createPortal } from 'react-dom';
import { usePermission, type PermissionKind } from '@/store/permissionStore';

const TEXT: Record<PermissionKind, { title: string; why: string }> = {
  camera: {
    title: 'Kamera',
    why: 'Für Fotos braucht Kliqtape deine Kamera. Ein Bild verlässt dein Handy erst, wenn du es abschickst.',
  },
  video: {
    title: 'Kamera und Mikrofon',
    why: 'Für Clips braucht Kliqtape Kamera und Mikrofon. Ein Clip verlässt dein Handy erst, wenn du ihn abschickst.',
  },
  microphone: {
    title: 'Mikrofon',
    why: 'Für Sprachnachrichten braucht Kliqtape dein Mikrofon. Aufgenommen wird nur, solange du es willst.',
  },
};

/**
 * Die eine Erklaerung vor einer Berechtigungsabfrage (permissionStore.ts).
 * Liegt ueber allem, auch ueber dem Onboarding, weil dort das Profilbild
 * schon die Kamera braucht.
 */
export default function PermissionHost() {
  const ask = usePermission((s) => s.ask);
  const close = usePermission((s) => s.close);
  if (!ask) return null;
  const t = TEXT[ask.kind];
  const answer = (ok: boolean) => {
    close();
    ask.answer(ok);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      style={{ background: 'rgba(0,0,0,.7)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        className="glass flex w-full max-w-sm flex-col gap-3 rounded-2xl p-5"
      >
        <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
          {t.title}
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--dim)' }}>
          {t.why}
        </p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => answer(false)}
            className="hit px-1 text-sm"
            style={{ color: 'var(--dim)' }}
          >
            Nicht jetzt
          </button>
          <button
            type="button"
            onClick={() => answer(true)}
            className="rounded-full px-5 py-2.5 text-sm font-semibold"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            Erlauben
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
