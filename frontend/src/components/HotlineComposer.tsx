import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHotlineThreads } from '@/lib/api';
import { previewFor } from '@/lib/chat';
import { useApp } from '@/store/appStore';
import { useBottomNav } from '@/store/navStore';
import Avatar, { useProfiles } from './Avatar';
import ChatThread, { HOTLINE_AMBER } from './ChatThread';
import NavButton from './NavButton';
import Sheet from './Sheet';

/**
 * Der Hot-Line-Knopf — einer von drei gleich gestalteten Bereichen der
 * unteren Leiste (siehe NavButton), Icon + Zaehler statt eigener Optik.
 *
 * Antippen zeigt erst, mit wem gerade eine Leitung offen ist (weiterschreiben)
 * und mit wem man neu anfangen kann. Wählt man jemanden, öffnet sich direkt
 * der Verlauf — laufender Chat ist jetzt der Normalfall, keine Einzelnachricht
 * mehr.
 */
export default function HotlineComposer() {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);

  const navActive = useBottomNav((s) => s.active);
  const setActiveNav = useBottomNav((s) => s.setActive);
  const open = navActive === 'hotline';
  const [target, setTarget] = useState<{ name: string; threadId?: string } | null>(null);

  // Nicht erst beim Oeffnen laden: die Taste soll schon vorher wissen, ob sie
  // blinken muss.
  const { data: threads = [] } = useQuery({
    queryKey: ['hotline-threads', me],
    queryFn: () => fetchHotlineThreads(me),
    enabled: Boolean(me),
    refetchInterval: 20_000,
  });
  const { data: profiles = [] } = useProfiles();

  const inThread = new Set(threads.map((t) => t.other));
  const fresh = profiles.map((p) => p.name).filter((n) => n !== me && !inThread.has(n));
  const unread = threads.reduce((n, t) => n + t.unread, 0);

  return (
    <>
      <NavButton
        icon={
          <svg width="17" height="15" viewBox="0 0 17 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
            <path d="M1.5 2.5A1.5 1.5 0 0 1 3 1h11a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 14 11H6.8L3 14v-3H3a1.5 1.5 0 0 1-1.5-1.5v-7Z" />
          </svg>
        }
        label="Hot Line"
        badge={unread > 0 ? unread : undefined}
        active={open}
        onClick={() => {
          setTarget(null);
          setActiveNav('hotline');
        }}
      />

      {/* reserveBottomNav nur in der Uebersicht — sobald ein konkretes
          Gespraech offen ist (target gesetzt), volle Konzentration aufs
          Schreiben, genau wie im Gruppenchat auf Seite B. */}
      <Sheet
        open={open}
        onClose={() => setActiveNav(null)}
        variant="full"
        reserveBottomNav={!target}
        title={target ? undefined : 'Hot Line'}
      >
        {target ? (
          <div className="flex h-[calc(100vh-8rem)] flex-col">
            <button
              type="button"
              onClick={() => setTarget(null)}
              className="font-mono mb-2 self-start text-[0.62rem] uppercase tracking-[0.12em]"
              style={{ color: 'var(--dim)' }}
            >
              ← Wählen
            </button>
            <ChatThread
              variant="hotline"
              threadId={target.threadId}
              startWith={target.threadId ? undefined : target.name}
              onStarted={(id) => setTarget({ name: target.name, threadId: id })}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {threads.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="font-disp text-sm font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ink)' }}>
                  Weiterschreiben
                </h3>
                {threads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTarget({ name: t.other, threadId: t.id })}
                    className="flex items-center gap-3 rounded-xl p-2.5 text-left"
                    style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
                  >
                    <Avatar name={t.other} side={side} size={1.8} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t.other}</span>
                        {t.unread > 0 && (
                          <span
                            className="font-mono rounded-full px-1.5 py-0.5 text-[0.56rem]"
                            style={{ background: HOTLINE_AMBER, color: '#20180A' }}
                          >
                            {t.unread}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[0.78rem]" style={{ color: 'var(--dim)' }}>
                        {previewFor(t.lastKind ?? 'text', t.lastBody)}
                      </p>
                    </div>
                  </button>
                ))}
              </section>
            )}

            <section className="flex flex-col gap-2">
              <h3 className="font-disp text-sm font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ink)' }}>
                Neue Leitung
              </h3>
              {fresh.length === 0 ? (
                <p className="font-mono text-[0.64rem]" style={{ color: 'var(--dim)' }}>
                  Mit allen anderen läuft schon eine Leitung.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {fresh.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTarget({ name: n })}
                      className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[0.8rem]"
                      style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                    >
                      <Avatar name={n} side={side} size={1.3} />
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <p className="font-mono text-[0.6rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
              Nur Text. Der Verlauf bleibt dauerhaft.
            </p>
          </div>
        )}
      </Sheet>
    </>
  );
}
