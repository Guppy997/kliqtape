import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createMixtape, fetchMixtapes, mediaUrl, recipientOf } from '@/lib/api';
import { useApp } from '@/store/appStore';
import Sheet from './Sheet';
import TapeEditor from './TapeEditor';

/**
 * Mixtape-Challenge: eins der eigenen versiegelten Tapes waehlen — oder
 * gleich ein neues "fuer die Runde" bauen. Wer es bekommt, entscheidet erst
 * das Teilen in die Kassetten, deshalb steht kein Name auf dem Tape.
 */
export default function MixtapePick({ onPick }: { onPick: (tapeId: string) => Promise<void> }) {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: tapes = [] } = useQuery({ queryKey: ['mixtapes', me], queryFn: () => fetchMixtapes(me) });
  const sealed = tapes.filter((t) => t.from === me && t.sealed);
  const drafts = tapes.filter((t) => t.from === me && !t.sealed && t.to === '');

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hat nicht geklappt');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {sealed.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {sealed.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => onPick(t.id))}
                className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left disabled:opacity-50"
                style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
              >
                <span
                  className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg"
                  style={{ background: '#D8CFBB' }}
                >
                  {t.coverId ? (
                    <img src={mediaUrl(t.coverId)} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="font-hand text-lg text-[#3B3226]">♪</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-hand block truncate text-[1.02rem]" style={{ color: 'var(--ink)' }}>
                    {t.title}
                  </span>
                  <span className="block text-2xs" style={{ color: 'var(--dim)' }}>
                    für {recipientOf(t)} · {t.trackCount}/12
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {drafts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setEditing(t.id)}
          className="rounded-xl p-3 text-left text-sm"
          style={{ border: '1px dashed var(--line)', color: 'var(--ink)' }}
        >
          Weiterbauen: <span className="font-hand">{t.title || 'Ohne Titel'}</span> · {t.trackCount}/12
        </button>
      ))}

      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          placeholder="Neues Mixtape für die Runde …"
          aria-label="Titel des neuen Mixtapes"
          className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-base outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
        <button
          type="button"
          disabled={busy || !title.trim()}
          onClick={() =>
            void run(async () => {
              const tape = await createMixtape(me, '', title.trim(), true);
              void qc.invalidateQueries({ queryKey: ['mixtapes', me] });
              setTitle('');
              setEditing(tape.id);
            })
          }
          className="shrink-0 rounded-lg px-4 text-sm font-medium disabled:opacity-40"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          Bauen
        </button>
      </div>
      <p className="text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
        Versiegelt taucht es oben in der Liste auf. Mitmachen kannst du nur mit einem versiegelten Tape.
      </p>

      {error && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} variant="full" title="Mixtape für die Runde">
        {editing && (
          <TapeEditor
            id={editing}
            onClose={() => {
              setEditing(null);
              void qc.invalidateQueries({ queryKey: ['mixtapes', me] });
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
