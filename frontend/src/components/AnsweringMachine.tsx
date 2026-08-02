import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteHotline, fetchHotlines, markHeard, type Hotline } from '@/lib/api';
import { useApp } from '@/store/appStore';
import Avatar from './Avatar';
import Sheet from './Sheet';

const KIND_LABEL: Record<string, string> = {
  text: 'Notiz',
  photo: 'Foto',
  video: 'Video',
  mixtape: 'Mixtape',
};

function restlaufzeit(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'gleich weg';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `noch ${h} Std.`;
  return `noch ${Math.max(1, Math.floor(ms / 60_000))} Min.`;
}

/**
 * Anrufbeantworter — der Posteingang fuer Hot Lines.
 *
 * Kein Chat-Verlauf, sondern ein Stapel Nachrichten mit Ablaufdatum. Die rote
 * LED blinkt, solange etwas Unabgehoertes daliegt. Genau wie das Geraet, das
 * in den Neunzigern neben dem Telefon stand.
 */
export default function AnsweringMachine() {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: lines = [] } = useQuery({
    queryKey: ['hotlines', me],
    queryFn: () => fetchHotlines(me),
    enabled: Boolean(me),
    refetchInterval: 20_000,
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ['hotlines', me] });
  const heard = useMutation({ mutationFn: markHeard, onSuccess: refresh });
  const remove = useMutation({ mutationFn: deleteHotline, onSuccess: refresh });

  const unheard = lines.filter((l) => !l.heard).length;

  return (
    <>
      <button
        type="button"
        aria-label={unheard > 0 ? `Anrufbeantworter, ${unheard} neu` : 'Anrufbeantworter'}
        onClick={() => {
          setOpen(true);
          lines.filter((l) => !l.heard).forEach((l) => heard.mutate(l.id));
        }}
        className="flex h-10 items-center gap-2 rounded-md px-2.5"
        style={{
          background: 'linear-gradient(180deg, #35302A, #1E1B17)',
          boxShadow: '0 2px 0 rgba(0,0,0,.45), 0 1px 0 rgba(255,255,255,.1) inset',
        }}
      >
        <span
          className={`size-2.5 rounded-full ${unheard > 0 ? 'blink' : ''}`}
          style={{
            background: unheard > 0 ? '#E0402A' : '#4A423A',
            boxShadow: unheard > 0 ? '0 0 0.5rem rgba(224,64,42,.9)' : 'none',
          }}
        />
        <span
          className="font-mono text-[0.72rem] tabular-nums"
          style={{ color: unheard > 0 ? '#E0402A' : 'var(--dim)' }}
        >
          {String(unheard).padStart(2, '0')}
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Anrufbeantworter">
        {lines.length === 0 ? (
          <p className="font-hand py-10 text-center text-lg" style={{ color: 'var(--dim)' }}>
            Keine Nachrichten.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {lines.map((l) => (
              <Entry key={l.id} line={l} onDelete={() => remove.mutate(l.id)} />
            ))}
          </ul>
        )}
        <p className="font-mono mt-4 text-[0.6rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
          Hot Lines verfallen nach 24 Stunden. Es gibt keinen Verlauf — das ist Absicht.
        </p>
      </Sheet>
    </>
  );
}

function Entry({ line, onDelete }: { line: Hotline; onDelete: () => void }) {
  return (
    <li
      className="rise flex flex-col gap-2 rounded-xl p-3"
      style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      <div className="flex items-center gap-2">
        <Avatar name={line.from} side={line.post.side} size={1.6} />
        <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {line.from}
        </span>
        <span className="font-mono ml-auto text-[0.6rem]" style={{ color: 'var(--accent)' }}>
          {restlaufzeit(line.expiresAt)}
        </span>
        <button type="button" onClick={onDelete} aria-label="Löschen" className="px-1 text-xs" style={{ color: 'var(--dim)' }}>
          ✕
        </button>
      </div>

      <p className="text-[0.92rem] leading-relaxed" style={{ color: 'var(--ink)' }}>
        {line.body}
      </p>

      <p className="font-mono truncate text-[0.6rem] uppercase tracking-[0.1em]" style={{ color: 'var(--dim)' }}>
        wegen Seite {line.post.side.toUpperCase()} · {KIND_LABEL[line.post.kind] ?? line.post.kind}
        {line.post.body ? ` · ${line.post.body}` : ''}
      </p>
    </li>
  );
}
