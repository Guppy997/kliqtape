import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHotlineThreads } from '@/lib/api';
import { useApp } from '@/store/appStore';
import Avatar, { useProfiles } from './Avatar';
import HotlineThread, { HOTLINE_AMBER } from './HotlineThread';
import Sheet from './Sheet';

/**
 * Der Hot-Line-Knopf — wie eine Kurzwahltaste an einem Walkman.
 *
 * Antippen zeigt erst, mit wem gerade eine Leitung offen ist (weiterschreiben)
 * und mit wem man neu anfangen kann. Wählt man jemanden, öffnet sich direkt
 * der Verlauf — laufender Chat ist jetzt der Normalfall, keine Einzelnachricht
 * mehr.
 */
export default function HotlineComposer() {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);

  const [open, setOpen] = useState(false);
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
      {/* Beschriftung ueber der Taste, wie an einem Walkman. Vollflaechig
          gelb mit einem leichten schwarzen Rahmen — Definition ohne
          Gehaeuse oder Platte drumherum. */}
      <span className="flex shrink-0 flex-col items-center gap-1">
        <span className="font-mono text-[0.5rem] uppercase tracking-[0.18em]" style={{ color: HOTLINE_AMBER }}>
          Hot Line
        </span>
        <button
          type="button"
          aria-label={unread > 0 ? `Hot Line, ${unread} neu` : 'Hot Line — jemandem direkt und privat schreiben'}
          onClick={() => {
            setTarget(null);
            setOpen(true);
          }}
          className={`grid h-9 w-9 place-items-center rounded-[3px] transition-transform active:translate-y-px active:scale-95 ${unread > 0 ? 'blink' : ''}`}
          style={{
            background: HOTLINE_AMBER,
            border: '1px solid rgba(0,0,0,.4)',
            boxShadow: `0 0 0.35rem ${HOTLINE_AMBER}80`,
          }}
        />
      </span>

      <Sheet open={open} onClose={() => setOpen(false)} variant="full" title={target ? undefined : 'Hot Line'}>
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
            <HotlineThread
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
                      <p className="truncate text-[0.78rem]" style={{ color: 'var(--dim)' }}>{t.lastBody}</p>
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
              Nur Text. Eine Leitung lebt, solange geschrieben wird — nur die letzten 24 Stunden
              bleiben sichtbar.
            </p>
          </div>
        )}
      </Sheet>
    </>
  );
}
