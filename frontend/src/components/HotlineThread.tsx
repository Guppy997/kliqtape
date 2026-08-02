import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchHotlineThread,
  markThreadHeard,
  sendHotlineMessage,
  HOTLINE_MAX,
} from '@/lib/api';
import { useApp } from '@/store/appStore';
import Avatar from './Avatar';

/** Sony-Sports-Walkman-Gelb. Warm, leuchtend, klar vom roten REC unterscheidbar. */
export const HOTLINE_AMBER = '#F5B324';

function restlaufzeit(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'schließt gleich';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `noch ${h} Std. offen`;
  return `noch ${Math.max(1, Math.floor(ms / 60_000))} Min. offen`;
}

interface Props {
  /** Bereits bestehende Leitung öffnen. */
  threadId?: string;
  /** Noch keine Leitung — direkt mit dieser Person beginnen. */
  startWith?: string;
  onStarted?: (threadId: string) => void;
}

/**
 * Der Verlauf einer Leitung — das ist jetzt der Normalfall von Hot Line.
 *
 * Erste Nachricht eröffnet die Leitung, danach ein echter Hin-und-her wie
 * ein Gespräch. Die 24-Stunden-Frist steht sichtbar oben und läuft ab der
 * ERSTEN Nachricht — Antworten verlängern sie nicht, sonst würde eine aktive
 * Leitung nie schließen. Bewusst weiterhin nur Text.
 */
export default function HotlineThread({ threadId, startWith, onStarted }: Props) {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const qc = useQueryClient();

  const [id, setId] = useState(threadId ?? null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: thread } = useQuery({
    queryKey: ['hotline-thread', id],
    queryFn: () => fetchHotlineThread(id!, me),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  });

  const heard = useMutation({
    mutationFn: () => markThreadHeard(id!, me),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hotline-threads', me] }),
  });

  // Beim Öffnen als gelesen markieren — nur wenn tatsächlich was Ungelesenes da ist.
  useEffect(() => {
    if (thread?.messages.some((m) => m.from !== me && !m.heard)) heard.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, thread?.messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [thread?.messages.length]);

  const send = useMutation({
    mutationFn: (body: string) => sendHotlineMessage({ from: me, to: startWith ?? thread!.other, body }),
    onSuccess: (res) => {
      setText('');
      setError(null);
      if (!id) {
        setId(res.threadId);
        onStarted?.(res.threadId);
      }
      void qc.invalidateQueries({ queryKey: ['hotline-thread', res.threadId] });
      void qc.invalidateQueries({ queryKey: ['hotline-threads', me] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const other = thread?.other ?? startWith ?? '';
  const left = HOTLINE_MAX - text.length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid var(--line)' }}>
        <Avatar name={other} side={side} size={2.2} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
            {other}
          </p>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em]" style={{ color: HOTLINE_AMBER }}>
            {thread ? restlaufzeit(thread.expiresAt) : 'neue Leitung'}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto py-3">
        {!thread || thread.messages.length === 0 ? (
          <p className="font-hand py-10 text-center text-lg" style={{ color: 'var(--dim)' }}>
            {other ? `Noch nichts mit ${other}.` : 'Wähl jemanden.'}
          </p>
        ) : (
          thread.messages.map((m) => {
            const mine = m.from === me;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[78%] rounded-xl px-3 py-2 text-[0.9rem] leading-relaxed"
                  style={{
                    background: mine ? HOTLINE_AMBER : 'var(--card)',
                    color: mine ? '#20180A' : 'var(--ink)',
                    border: mine ? 'none' : '1px solid var(--line)',
                  }}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex flex-col gap-1.5 pt-2" style={{ borderTop: '1px solid var(--line)' }}>
        {error && <p className="text-xs" style={{ color: '#F0B5A5' }}>{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, HOTLINE_MAX))}
            rows={1}
            placeholder={other ? `An ${other} …` : 'Erst jemanden wählen …'}
            disabled={!other}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (text.trim()) send.mutate(text.trim());
              }
            }}
            className="min-w-0 flex-1 resize-none rounded-lg p-2.5 text-[0.9rem] outline-none disabled:opacity-50"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />
          <button
            type="button"
            disabled={!text.trim() || !other || send.isPending}
            onClick={() => send.mutate(text.trim())}
            className="font-disp shrink-0 rounded-lg px-3.5 py-2.5 text-sm font-bold uppercase tracking-[0.08em] disabled:opacity-40"
            style={{ background: HOTLINE_AMBER, color: '#20180A' }}
          >
            Senden
          </button>
        </div>
        <p className="font-mono text-right text-[0.58rem]" style={{ color: left < 30 ? HOTLINE_AMBER : 'var(--dim)' }}>
          {left} · nur Text · verfällt {thread ? restlaufzeit(thread.expiresAt) : 'nach 24 Std.'}
        </p>
      </div>
    </div>
  );
}
