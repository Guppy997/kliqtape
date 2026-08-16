import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** 'sheet' faehrt von unten ein, 'full' deckt den Bildschirm komplett ab. */
  variant?: 'sheet' | 'full';
  /** Nur fuer variant 'full': laesst die untere Navigations-Leiste sichtbar
   *  (niedrigerer z-index als normal, mehr Platz am unteren Rand), statt sie
   *  wie sonst komplett zu verdecken. Fuer Eject/Hot-Line-Liste/Neuigkeiten
   *  gedacht — dort soll man sehen, wo man gerade "drin" ist, waehrend man
   *  noch auswaehlt. Sobald es dort tatsaechlich in ein fokussiertes
   *  Gespraech geht (ChatThread), schaltet der jeweilige Aufrufer das wieder
   *  ab, genau wie beim Gruppenchat auf Seite B. */
  reserveBottomNav?: boolean;
  /** Blendet das Schliessen-Kreuz aus. Fuer die Hauptseiten gedacht, die man
   *  ohnehin ueber die untere Leiste wechselt (Fach, Hot Line, Neuigkeiten) —
   *  dort waere ein X neben der Leiste ein zweiter Weg fuer dieselbe Sache.
   *  Unterseiten behalten das X bzw. ihren eigenen Zurueck-Pfeil. */
  hideClose?: boolean;
  children: ReactNode;
}

export default function Sheet({ open, onClose, title, variant = 'sheet', reserveBottomNav, hideClose, children }: Props) {
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
  const navAware = full && reserveBottomNav;

  const header = (
    <div className="mb-4 flex items-center gap-3">
      <p className="font-mono min-w-0 flex-1 text-[0.66rem] uppercase tracking-[0.14em]" style={{ color: 'var(--dim)' }}>
        {title ?? ''}
      </p>
      {!hideClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="grid size-9 shrink-0 place-items-center rounded-full text-base"
          style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        >
          ✕
        </button>
      )}
    </div>
  );

  // Per Portal direkt an den body. Sonst haengt das Blatt im Stacking-Kontext
  // seines Elternteils und der Header mit z-30 legt sich darueber — dann ist
  // der Schliessen-Knopf nicht mehr erreichbar.
  //
  // --screen, --card, --ink & Co. kommen inzwischen per Inline-Style direkt
  // von App.tsx auf <html> — die vererben sich an jeden Nachfahren, auch an
  // per Portal ausgelagerte Knoten wie diesen hier. Keine eigene Seitenklasse
  // mehr noetig (die hat die Kassettenfarbe frueher sogar verdeckt).
  return createPortal(
    <div
      className={`fixed inset-0 flex justify-center ${full ? '' : 'items-end'}`}
      style={{
        // navAware sitzt bewusst unter der BottomBar (z-45), aber weiter ueber
        // dem Kassetten-Kopf (z-30) — der bleibt verdeckt wie bisher, nur die
        // Leiste unten schaut noch durch. Normale Sheets bleiben bei z-50,
        // decken alles ab wie eh und je.
        zIndex: navAware ? 35 : 50,
        background: full ? 'var(--screen)' : 'rgba(0,0,0,.88)',
        backdropFilter: full ? 'none' : 'blur(3px)',
      }}
      onClick={full ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={
          full
            ? 'flex h-full w-full max-w-xl flex-col overflow-y-auto px-4 pt-[max(1rem,env(safe-area-inset-top))]'
            : 'glass max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]'
        }
        style={{
          background: full ? 'var(--screen)' : undefined,
          paddingBottom: full
            ? navAware
              ? 'calc(var(--bottombar-h, 6rem) + 1rem)'
              : 'max(1.5rem, env(safe-area-inset-bottom))'
            : undefined,
        }}
      >
        {!full && <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--line)' }} />}
        {header}
        {children}
      </div>
    </div>,
    document.body,
  );
}
