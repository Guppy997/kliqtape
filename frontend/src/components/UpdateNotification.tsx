import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Update-Banner.
 *
 * Der Service Worker laeuft mit registerType 'prompt' — eine neue Version
 * installiert sich im Hintergrund, uebernimmt aber erst auf Zuruf. Ohne diese
 * Komponente wartet sie ewig und man sieht dauerhaft die alte App. Genau das
 * ist einmal passiert.
 */
export default function UpdateNotification() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 top-3 z-[60] mx-auto flex max-w-xl items-center gap-3 rounded-xl px-4 py-3"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--accent)',
        boxShadow: '0 0.6rem 1.6rem rgba(0,0,0,.5)',
      }}
    >
      <span className="min-w-0 flex-1 text-[0.86rem]" style={{ color: 'var(--ink)' }}>
        Neue Version liegt bereit.
      </span>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        className="font-mono shrink-0 px-2 text-[0.66rem] uppercase tracking-widest"
        style={{ color: 'var(--dim)' }}
      >
        Später
      </button>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="font-disp shrink-0 rounded-lg px-3 py-1.5 text-[0.8rem] font-bold uppercase tracking-[0.1em]"
        style={{ background: 'var(--accent)', color: '#17130E' }}
      >
        Band wechseln
      </button>
    </div>
  );
}
