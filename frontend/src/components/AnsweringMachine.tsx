import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHotlineThreads } from '@/lib/api';
import { useApp } from '@/store/appStore';
import Avatar from './Avatar';
import HotlineThread, { HOTLINE_AMBER } from './HotlineThread';
import Sheet from './Sheet';

function restlaufzeit(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'schließt gleich';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `noch ${h} Std.`;
  return `noch ${Math.max(1, Math.floor(ms / 60_000))} Min.`;
}

/**
 * Anrufbeantworter — der Posteingang für Hot Lines.
 *
 * Zeigt die offenen Leitungen, neueste zuerst, mit der roten LED für
 * Ungelesenes. Antippen öffnet den Verlauf mit dieser Person — das ist jetzt
 * der Normalfall: ein echtes Hin-und-her, das nach 24 Stunden von selbst
 * verschwindet.
 */
export default function AnsweringMachine() {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  const { data: threads = [] } = useQuery({
    queryKey: ['hotline-threads', me],
    queryFn: () => fetchHotlineThreads(me),
    enabled: Boolean(me),
    refetchInterval: 20_000,
  });

  const unread = threads.reduce((n, t) => n + t.unread, 0);

  return (
    <>
      <button
        type="button"
        aria-label={unread > 0 ? `Anrufbeantworter, ${unread} neu` : 'Anrufbeantworter'}
        onClick={() => {
          setThreadId(null);
          setOpen(true);
        }}
        className="flex h-10 items-center gap-2 rounded-md px-2.5"
        style={{
          background: 'linear-gradient(180deg, #35302A, #1E1B17)',
          boxShadow: '0 2px 0 rgba(0,0,0,.45), 0 1px 0 rgba(255,255,255,.1) inset',
        }}
      >
        <span
          className={`size-2.5 rounded-full ${unread > 0 ? 'blink' : ''}`}
          style={{
            background: unread > 0 ? '#E0402A' : '#4A423A',
            boxShadow: unread > 0 ? '0 0 0.5rem rgba(224,64,42,.9)' : 'none',
          }}
        />
        <span
          className="font-mono text-[0.72rem] tabular-nums"
          style={{ color: unread > 0 ? '#E0402A' : 'var(--dim)' }}
        >
          {String(unread).padStart(2, '0')}
        </span>
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        variant="full"
        title={threadId ? undefined : 'Anrufbeantworter'}
      >
        {threadId ? (
          <div className="flex h-[calc(100vh-8rem)] flex-col">
            <button
              type="button"
              onClick={() => setThreadId(null)}
              className="font-mono mb-2 self-start text-[0.62rem] uppercase tracking-[0.12em]"
              style={{ color: 'var(--dim)' }}
            >
              ← Leitungen
            </button>
            <HotlineThread threadId={threadId} />
          </div>
        ) : threads.length === 0 ? (
          <p className="font-hand py-10 text-center text-lg" style={{ color: 'var(--dim)' }}>
            Keine offene Leitung.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setThreadId(t.id)}
                  className="rise flex w-full items-center gap-3 rounded-xl p-3 text-left"
                  style={{
                    background: 'var(--card)',
                    border: `1px solid ${t.unread > 0 ? HOTLINE_AMBER : 'var(--line)'}`,
                  }}
                >
                  <Avatar name={t.other} side={side} size={2} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        {t.other}
                      </span>
                      {t.unread > 0 && (
                        <span
                          className="font-mono shrink-0 rounded-full px-1.5 py-0.5 text-[0.56rem]"
                          style={{ background: HOTLINE_AMBER, color: '#20180A' }}
                        >
                          {t.unread}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[0.8rem]" style={{ color: 'var(--dim)' }}>
                      {t.lastFrom === me ? 'Du: ' : ''}
                      {t.lastBody}
                    </p>
                  </div>
                  <span className="font-mono shrink-0 text-[0.6rem]" style={{ color: HOTLINE_AMBER }}>
                    {restlaufzeit(t.expiresAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {!threadId && (
          <p className="font-mono mt-4 text-[0.6rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
            Eine Leitung schließt 24 Stunden nach der ersten Nachricht — Antworten
            verlängern sie nicht.
          </p>
        )}
      </Sheet>
    </>
  );
}
