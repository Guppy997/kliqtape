import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Von unten einfahrendes Blatt. Geteilt von Aufnahme, Einstellungen und Verlauf. */
export default function Sheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Hintergrund nicht mitscrollen lassen, solange das Blatt offen ist.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,.62)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        style={{ background: 'var(--screen)', borderTop: '1px solid var(--line)' }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--line)' }} />

        {/* Immer ein sichtbarer Ausgang. Auf dem Handy gibt es kein Escape,
            und der Hintergrund als einzige Schliessflaeche ist zu versteckt. */}
        <div className="mb-4 flex items-center gap-3">
          <p className="font-mono min-w-0 flex-1 text-[0.66rem] uppercase tracking-[0.14em]" style={{ color: 'var(--dim)' }}>
            {title ?? ''}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="grid size-8 shrink-0 place-items-center rounded-full text-base"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          >
            ✕
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
