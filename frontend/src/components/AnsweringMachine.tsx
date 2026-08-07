import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHotlineThreads } from '@/lib/api';
import { previewFor } from '@/lib/chat';
import { useApp } from '@/store/appStore';
import { useBottomNav } from '@/store/navStore';
import { useCassetteNews } from './CassetteDeck';
import Avatar from './Avatar';
import ChatThread, { HOTLINE_AMBER } from './ChatThread';
import NavButton from './NavButton';
import Sheet from './Sheet';

/**
 * Die Benachrichtigung — was ist neu, egal auf welchem Band.
 *
 * Frueher eine blinkende Lampe (ja/nein), jetzt wie Hot Line eine Zahl oben
 * rechts am Icon — wie viele Neuigkeiten insgesamt anstehen, "wer dir
 * schreiben will" (Leitungen) und "wer was gepostet hat" (Kassetten)
 * zusammengezaehlt. Die Unterscheidung bleibt beim Oeffnen im Sheet erhalten,
 * nur der Zaehler selbst fasst sie zu einer Zahl zusammen.
 */
export default function AnsweringMachine() {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const setCassette = useApp((s) => s.setCassette);
  const navActive = useBottomNav((s) => s.active);
  const setActiveNav = useBottomNav((s) => s.setActive);
  const open = navActive === 'notify';
  const [threadId, setThreadId] = useState<string | null>(null);

  const { data: threads = [] } = useQuery({
    queryKey: ['hotline-threads', me],
    queryFn: () => fetchHotlineThreads(me),
    enabled: Boolean(me),
    refetchInterval: 20_000,
  });
  const cassetteNews = useCassetteNews();

  const unreadLines = threads.reduce((n, t) => n + t.unread, 0);
  const notifCount = unreadLines + cassetteNews.length;

  return (
    <>
      <NavButton
        icon={
          <svg width="15" height="16" viewBox="0 0 15 16" fill="currentColor" aria-hidden="true">
            <path d="M7.5 0a4.25 4.25 0 0 0-4.25 4.25v2.36c0 .58-.22 1.14-.63 1.55L1.4 9.4a1 1 0 0 0 .7 1.7h10.8a1 1 0 0 0 .7-1.7l-1.22-1.24a2.2 2.2 0 0 1-.63-1.55V4.25A4.25 4.25 0 0 0 7.5 0Z" />
            <path d="M5.3 12.2a2.2 2.2 0 0 0 4.4 0h-4.4Z" />
          </svg>
        }
        label="Benachrichtigung"
        badge={notifCount > 0 ? notifCount : undefined}
        active={open}
        onClick={() => {
          setThreadId(null);
          setActiveNav('notify');
        }}
      />

      {/* reserveBottomNav nur in der Uebersicht — sobald ein konkretes
          Gespraech offen ist (threadId gesetzt), volle Konzentration aufs
          Schreiben, genau wie im Gruppenchat auf Seite B. */}
      <Sheet
        open={open}
        onClose={() => setActiveNav(null)}
        variant="full"
        reserveBottomNav={!threadId}
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
            <ChatThread variant="hotline" threadId={threadId} />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {notifCount === 0 && (
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
                      setActiveNav(null);
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
                            {previewFor(t.lastKind ?? 'text', t.lastBody)}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
