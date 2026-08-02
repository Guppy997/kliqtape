import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** 'sheet' faehrt von unten ein, 'full' deckt den Bildschirm komplett ab. */
  variant?: 'sheet' | 'full';
  children: ReactNode;
}

export default function Sheet({ open, onClose, title, variant = 'sheet', children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Hintergrund nicht mitscrollen lassen, solange etwas offen ist.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const full = variant === 'full';

  const header = (
    <div className="mb-4 flex items-center gap-3">
      <p className="font-mono min-w-0 flex-1 text-[0.66rem] uppercase tracking-[0.14em]" style={{ color: 'var(--dim)' }}>
        {title ?? ''}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Schließen"
        className="grid size-9 shrink-0 place-items-center rounded-full text-base"
        style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
      >
        ✕
      </button>
    </div>
  );

  // Per Portal direkt an den body. Sonst haengt das Blatt im Stacking-Kontext
  // seines Elternteils und der Header mit z-30 legt sich darueber — dann ist
  // der Schliessen-Knopf nicht mehr erreichbar.
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex justify-center ${full ? '' : 'items-end'}`}
      // Deutlich dichter als vorher: bei halbdurchsichtigem Hintergrund
      // flimmert der Feed durch die Kamera-Vorschau und stoert beim Aufnehmen.
      style={{ background: full ? 'var(--screen)' : 'rgba(0,0,0,.88)', backdropFilter: full ? 'none' : 'blur(3px)' }}
      onClick={full ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={
          full
            ? 'flex h-full w-full max-w-xl flex-col overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]'
            : 'max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]'
        }
        style={{ background: 'var(--screen)', borderTop: full ? 'none' : '1px solid var(--line)' }}
      >
        {!full && <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--line)' }} />}
        {header}
        {children}
      </div>
    </div>,
    document.body,
  );
}
