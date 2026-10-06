import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { REPORT_REASONS, sendReport, type ReportReason, type ReportTarget } from '@/lib/api';
import { useApp } from '@/store/appStore';

interface Props {
  target: ReportTarget;
  /** Was gemeldet wird, fuer die Ueberschrift: "diese Kassette", "diesen Beitrag". */
  what: string;
  onDone: () => void;
}

/**
 * Melden — fuer eine Kassette (CassetteInfo.tsx) oder einen Beitrag
 * (PostCard.tsx). Bewusst schlicht: Grund waehlen, optional ein Satz dazu,
 * abschicken. Die Bestaetigung sagt ehrlich, was danach passiert — im
 * Prototyp nichts Automatisches, die Meldung liegt nur gespeichert vor.
 */
export default function ReportForm({ target, what, onDone }: Props) {
  const me = useApp((s) => s.me);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');

  const send = useMutation({
    mutationFn: () => sendReport(target, reason!, note.trim(), me),
  });

  if (send.isSuccess) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <p className="font-hand text-lg" style={{ color: 'var(--ink)' }}>
          Gemeldet. Danke.
        </p>
        <p className="font-mono text-[0.62rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
          Die Meldung ist gespeichert. Im Prototyp gibt es noch kein Moderationsteam, das sie automatisch bearbeitet —
          sie liegt bei den Betreiber:innen. Niemand auf dem Band erfährt, dass du gemeldet hast.
        </p>
        <button
          type="button"
          onClick={onDone}
          className="font-mono mt-1 self-start text-[0.62rem] uppercase tracking-[0.12em]"
          style={{ color: 'var(--accent)' }}
        >
          Schließen
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-sm" style={{ color: 'var(--ink)' }}>
        Warum möchtest du {what} melden?
      </p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Grund">
        {REPORT_REASONS.map((r) => {
          const chosen = reason === r.key;
          return (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={chosen}
              onClick={() => setReason(r.key)}
              className="rounded-full px-3 py-1.5 text-[0.78rem]"
              style={{
                background: chosen ? 'color-mix(in srgb, #F0B5A5 22%, transparent)' : 'transparent',
                border: `1px solid ${chosen ? '#F0B5A5' : 'var(--line)'}`,
                color: chosen ? '#F0B5A5' : 'var(--ink)',
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Optional: ein Satz dazu"
        className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
        style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
      />
      {send.error && (
        <p className="text-sm" style={{ color: '#F0B5A5' }}>
          {(send.error as Error).message}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!reason || send.isPending}
          onClick={() => send.mutate()}
          className="font-mono rounded-lg px-3.5 py-2 text-[0.66rem] uppercase tracking-[0.1em] disabled:opacity-40"
          style={{ background: 'rgba(184,70,44,.18)', border: '1px solid #B8462C', color: '#F0B5A5' }}
        >
          Meldung senden
        </button>
        <button
          type="button"
          onClick={onDone}
          className="font-mono text-[0.62rem] uppercase tracking-[0.12em]"
          style={{ color: 'var(--dim)' }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
