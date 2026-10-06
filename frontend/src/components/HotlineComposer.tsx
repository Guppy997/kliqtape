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
  /** Suche ueber die laufenden Leitungen in der Uebersicht. */
  const [query, setQuery] = useState('');
  /** Eigene Unterseite zum Anfangen einer neuen Leitung (ueber das Plus). */
  const [picking, setPicking] = useState(false);
  const [pickQuery, setPickQuery] = useState('');

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

  const shownThreads = threads.filter((t) => t.other.toLowerCase().includes(query.trim().toLowerCase()));
  const shownFresh = fresh.filter((n) => n.toLowerCase().includes(pickQuery.trim().toLowerCase()));

  return (
    <>
      <NavButton
        icon={
          <svg
            width="17"
            height="15"
            viewBox="0 0 17 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1.5 2.5A1.5 1.5 0 0 1 3 1h11a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 14 11H6.8L3 14v-3H3a1.5 1.5 0 0 1-1.5-1.5v-7Z" />
          </svg>
        }
        label="Hot Line"
        badge={unread > 0 ? unread : undefined}
        active={open}
        onClick={() => {
          setTarget(null);
          setPicking(false);
          setQuery('');
          setPickQuery('');
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
        // Kein X: die Uebersicht ist eine Hauptseite (Wechsel ueber die untere
        // Leiste), und im Gespraech fuehrt der eigene Zurueck-Pfeil heraus.
        hideClose
        title={target ? undefined : picking ? 'Neue Leitung' : 'Hot Line'}
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
        ) : picking ? (
          /* Unterseite: neue Leitung anfangen — eigene Suche ueber die
             Kontakte, mit denen noch keine Leitung laeuft. */
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setPicking(false);
                setPickQuery('');
              }}
              className="font-mono self-start text-[0.62rem] uppercase tracking-[0.12em]"
              style={{ color: 'var(--dim)' }}
            >
              ← Hot Line
            </button>

            <input
              value={pickQuery}
              onChange={(e) => setPickQuery(e.target.value)}
              autoFocus
              placeholder="Kontakt suchen …"
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            />

            {fresh.length === 0 ? (
              <p className="font-mono py-6 text-center text-[0.64rem]" style={{ color: 'var(--dim)' }}>
                Mit allen anderen läuft schon eine Leitung.
              </p>
            ) : shownFresh.length === 0 ? (
              <p className="font-mono py-6 text-center text-[0.64rem]" style={{ color: 'var(--dim)' }}>
                Niemanden gefunden.
              </p>
            ) : (
              shownFresh.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setTarget({ name: n });
                    setPicking(false);
                    setPickQuery('');
                  }}
                  className="flex items-center gap-3 rounded-xl p-2.5 text-left"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
                >
                  <Avatar name={n} side={side} size={1.8} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {n}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Suche ueber die laufenden Leitungen, daneben das Plus fuer eine
                neue — beides in einer Zeile, wie in gaengigen Messengern. */}
            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name suchen …"
                className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
              />
              <button
                type="button"
                onClick={() => {
                  setPickQuery('');
                  setPicking(true);
                }}
                aria-label="Neue Leitung"
                title="Neue Leitung"
                className="grid size-9 shrink-0 place-items-center rounded-full transition-transform active:scale-95"
                // Nimmt die Farbe der eingelegten Kassette an (--accent wird in
                // App.tsx pro Kassette/Seite gesetzt) — wie das Plus im Fach.
                // Das Hot-Line-Gelb bleibt den Ungelesen-Zaehlern vorbehalten.
                style={{ background: 'var(--accent)', color: '#17130E' }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M7 1v12M1 7h12" />
                </svg>
              </button>
            </div>

            {threads.length === 0 ? (
              <p className="font-hand py-10 text-center text-lg" style={{ color: 'var(--dim)' }}>
                Noch keine Leitung offen.
              </p>
            ) : shownThreads.length === 0 ? (
              <p className="font-mono py-10 text-center text-[0.64rem]" style={{ color: 'var(--dim)' }}>
                Niemanden gefunden.
              </p>
            ) : (
              shownThreads.map((t) => (
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
                      <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        {t.other}
                      </span>
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
              ))
            )}

            <p className="font-mono mt-2 text-[0.6rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
              Text, Bild, Clip, O-Ton oder Mixtape. Der Verlauf bleibt dauerhaft.
            </p>
          </div>
        )}
      </Sheet>
    </>
  );
}
