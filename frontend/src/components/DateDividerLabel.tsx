/** Tagestrenner im Chat — reine Anzeige, kein eigener Zustand. Wird in
 *  Etappe 4 fuer die Track-Header optisch wiederverwendet (dort mit
 *  echtem, adressierbarem Zustand drumherum). */
export default function DateDividerLabel({ label }: { label: string }) {
  return (
    <div className="my-1 flex items-center gap-2" aria-hidden="true">
      <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
      <span className="shrink-0 text-2xs" style={{ color: 'var(--dim)' }}>
        {label}
      </span>
      <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
    </div>
  );
}
