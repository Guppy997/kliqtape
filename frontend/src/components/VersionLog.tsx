import { CHANGELOG, VERSION } from '@/changelog';

/**
 * Versionsverlauf als reine Liste — bewusst ohne eigenes Blatt, damit sie
 * innerhalb der Einstellungen aufklappen kann. Verschachtelte Modals waeren
 * auf dem Handy eine Sackgasse.
 */
export default function VersionLog() {
  return (
    <ol className="flex flex-col gap-4 pt-1">
      {CHANGELOG.map((entry) => (
        <li key={entry.version} className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
              v{entry.version}
            </span>
            <span className="text-2xs" style={{ color: 'var(--dim)' }}>
              {entry.date}
            </span>
            {entry.version === VERSION && (
              <span
                className="rounded-full px-2 py-0.5 text-2xs"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                aktuell
              </span>
            )}
          </div>
          <ul className="flex flex-col gap-1 pl-1">
            {entry.changes.map((c) => (
              <li key={c} className="flex gap-2 text-meta leading-snug" style={{ color: 'var(--dim)' }}>
                <span>—</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
