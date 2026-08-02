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
            <span
              className="font-disp text-sm font-bold tabular-nums tracking-[0.06em]"
              style={{ color: 'var(--ink)' }}
            >
              v{entry.version}
            </span>
            <span className="font-mono text-[0.6rem]" style={{ color: 'var(--dim)' }}>
              {entry.date}
            </span>
            {entry.version === VERSION && (
              <span
                className="font-mono rounded-full px-2 py-0.5 text-[0.54rem] uppercase tracking-widest"
                style={{ background: 'var(--accent)', color: '#17130E' }}
              >
                aktuell
              </span>
            )}
          </div>
          <ul className="flex flex-col gap-1 pl-1">
            {entry.changes.map((c) => (
              <li key={c} className="flex gap-2 text-[0.82rem] leading-snug" style={{ color: 'var(--dim)' }}>
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
