/**
 * Ein Schalter mit Titel und Erklaerung — fuer Einstellungen wie "Meine
 * Beitraege nicht in Alben" (Settings.tsx) oder die Wochen-Challenge einer
 * Runde (CassetteChallengeSettings.tsx).
 */
export default function SwitchRow({
  title,
  hint,
  on,
  disabled,
  onToggle,
}: {
  title: string;
  hint: string;
  on: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onToggle(!on)}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left disabled:opacity-60"
      style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm" style={{ color: 'var(--ink)' }}>
          {title}
        </span>
        <span className="block text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
          {hint}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
        style={{ background: on ? 'var(--accent)' : 'var(--line)' }}
      >
        <span
          className="absolute top-0.5 size-4 rounded-full bg-white transition-[left]"
          style={{ left: on ? '1.1rem' : '0.125rem' }}
        />
      </span>
    </button>
  );
}
