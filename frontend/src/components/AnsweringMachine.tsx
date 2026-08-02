import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHotlineThreads } from '@/lib/api';
import { useApp } from '@/store/appStore';
import { useCassetteNews } from './CassetteDeck';
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
 * Die Anzeigelampe — was ist neu, egal auf welchem Band.
 *
 * Zwei getrennte Rubriken, bewusst nicht zu einer Zahl verrechnet: "wer dir
 * schreiben will" (Leitungen) ist etwas anderes als "wer was gepostet hat"
 * (Kassetten). Die Lampe blinkt nur ja/nein — wie viel genau, sieht man erst
 * beim Öffnen. Keine Zaehlerei, die nach Druck aussieht.
 */
export default function AnsweringMachine() {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const setCassette = useApp((s) => s.setCassette);
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  const { data: threads = [] } = useQuery({
    queryKey: ['hotline-threads', me],
    queryFn: () => fetchHotlineThreads(me),
    enabled: Boolean(me),
    refetchInterval: 20_000,
  });
  const cassetteNews = useCassetteNews();

  const unreadLines = threads.reduce((n, t) => n + t.unread, 0);
  const somethingNew = unreadLines > 0 || cassetteNews.length > 0;

  return (
    <>
      <button
        type="button"
        aria-label={somethingNew ? 'Neuigkeiten vorhanden' : 'Keine Neuigkeiten'}
        onClick={() => {
          setThreadId(null);
          setOpen(true);
        }}
        className="grid h-10 w-10 place-items-center rounded-md"
        style={{
          background: 'linear-gradient(180deg, #35302A, #1E1B17)',
          boxShadow: '0 2px 0 rgba(0,0,0,.45), 0 1px 0 rgba(255,255,255,.1) inset',
        }}
      >
        <span
          className={`size-2.5 rounded-full ${somethingNew ? 'blink' : ''}`}
          style={{
            background: somethingNew ? '#E0402A' : '#4A423A',
            boxShadow: somethingNew ? '0 0 0.5rem rgba(224,64,42,.9)' : 'none',
          }}
        />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        variant="full"
        title={threadId ? undefined : 'Neuigkeiten'}
      >
        {threadId ? (
          <div className="flex h-[calc(100vh-8rem)] flex-col">
            <button
              type="button"
              onClick={() => setThreadId(null)}
              className="font-mono mb-2 self-start text-[0.62rem] uppercase tracking-[0.12em]"
              style={{ color: 'var(--dim)' }}
            >
              ← Neuigkeiten
            </button>
            <HotlineThread threadId={threadId} />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {!somethingNew && (
              <p className="font-hand py-10 text-center text-lg" style={{ color: 'var(--dim)' }}>
                Nichts Neues.
              </p>
            )}

            {cassetteNews.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="font-disp text-sm font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ink)' }}>
                  Kassetten · {cassetteNews.length}
                </h3>
                {cassetteNews.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCassette(c.id);
                      setOpen(false);
                    }}
                    className="rise flex items-center gap-3 rounded-xl p-3 text-left"
                    style={{ background: 'var(--card)', border: '1px solid var(--accent)' }}
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: 'var(--accent)' }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                      {c.name}
                    </span>
                    <span className="font-mono shrink-0 text-[0.6rem] uppercase tracking-[0.08em]" style={{ color: 'var(--dim)' }}>
                      neu
                    </span>
                  </button>
                ))}
              </section>
            )}

            {threads.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="font-disp text-sm font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ink)' }}>
                  Leitungen · {unreadLines}
                </h3>
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
                <p className="font-mono text-[0.6rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
                  Eine Leitung lebt, solange geschrieben wird — nur die letzten 24 Stunden bleiben
                  sichtbar.
                </p>
              </section>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
