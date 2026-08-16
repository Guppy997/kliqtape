import { useQuery } from '@tanstack/react-query';
import { fetchHotlineThreads } from '@/lib/api';
import { useApp } from '@/store/appStore';
import { useBottomNav } from '@/store/navStore';
import { useCassetteNews } from './CassetteDeck';
import { HOTLINE_AMBER } from './ChatThread';
import NavButton from './NavButton';
import Sheet from './Sheet';

/**
 * Die Benachrichtigung — was ist neu, egal auf welchem Band.
 *
 * Reine Uebersicht, keine eigene Inbox: "Leitungen" listete frueher jede
 * Hot-Line-Unterhaltung nochmal einzeln auf — genau dieselben Daten, die
 * der Hot-Line-Knopf selbst schon als "Weiterschreiben" zeigt. Doppelt
 * gepflegt, doppelt zu lesen. Jetzt nur noch eine zusammengefasste Zeile
 * ("Leitungen — 12 ungelesene Nachrichten"), die direkt zu Hot Line
 * springt. Kassetten-Neuigkeiten bleiben einzeln aufgelistet, weil es
 * dafuer sonst nirgends eine Uebersicht gibt (das Regal zeigt alle
 * Kassetten, nicht nur die mit Neuigkeiten).
 */
export default function AnsweringMachine() {
  const me = useApp((s) => s.me);
  const setCassette = useApp((s) => s.setCassette);
  const navActive = useBottomNav((s) => s.active);
  const setActiveNav = useBottomNav((s) => s.setActive);
  const open = navActive === 'notify';

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
        onClick={() => setActiveNav('notify')}
      />

      {/* Hauptseite: wird ueber die untere Leiste gewechselt, deshalb ohne X. */}
      <Sheet open={open} onClose={() => setActiveNav(null)} variant="full" reserveBottomNav hideClose title="Neuigkeiten">
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

          {unreadLines > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="font-disp text-sm font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ink)' }}>
                Leitungen
              </h3>
              <button
                type="button"
                onClick={() => setActiveNav('hotline')}
                className="rise flex items-center gap-3 rounded-xl p-3 text-left"
                style={{ background: 'var(--card)', border: `1px solid ${HOTLINE_AMBER}` }}
              >
                <span
                  className="font-mono shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] tabular-nums"
                  style={{ background: HOTLINE_AMBER, color: '#20180A' }}
                >
                  {unreadLines}
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  {unreadLines === 1 ? 'ungelesene Nachricht' : 'ungelesene Nachrichten'}
                </span>
                <span className="font-mono shrink-0 text-[0.6rem]" style={{ color: 'var(--dim)' }}>
                  →
                </span>
              </button>
            </section>
          )}
        </div>
      </Sheet>
    </>
  );
}
