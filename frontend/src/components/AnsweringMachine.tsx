import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { acceptInvite, declineInvite, fetchInvites } from '@/lib/api';
import { useApp } from '@/store/appStore';
import { useBottomNav } from '@/store/navStore';
import { MiniCassette, useCassetteNews, useLookIndex } from './CassetteDeck';
import Sheet from './Sheet';

/** "vor 5 Min.", "vor 3 Std." — grob genuegt hier, niemand braucht die
 *  Sekunde genau, ob eine Einladung 2 oder 3 Minuten alt ist. */
function timeAgo(ms: number): string {
  const min = Math.floor((Date.now() - ms) / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const std = Math.floor(min / 60);
  if (std < 24) return `vor ${std} Std.`;
  const tage = Math.floor(std / 24);
  return `vor ${tage} ${tage === 1 ? 'Tag' : 'Tagen'}`;
}

/**
 * Die Benachrichtigung — was ist neu, egal auf welchem Band.
 *
 * Frueher stand hier auch eine zusammengefasste Hot-Line-Zeile
 * ("Leitungen — 12 ungelesene Nachrichten") — dieselbe Zahl zeigt der
 * Hot-Line-Knopf in der unteren Leiste aber schon selbst als Badge, doppelt
 * gepflegt und ohne eigenen Mehrwert hier. Jetzt reine Uebersicht ueber
 * zwei Dinge, fuer die es sonst nirgends eine gibt: offene Einladungen
 * (muessen bestaetigt werden, bevor man wirklich auf einem Band ist — siehe
 * cassette_invites in db.ts) und Kassetten mit ungesehenen Beitraegen.
 *
 * Beide Zeilenarten zeigen die echte Bandsorte der Kassette (MiniCassette,
 * dieselbe Zeichnung wie im Fach) statt eines reinen Text-/Punkt-Eintrags —
 * eine Benachrichtigung ohne jedes Bild ihrer Kassette sah neben dem Rest
 * der App (die ueberall mit der eigenen Bandsorte arbeitet) kahl aus.
 */
export default function AnsweringMachine() {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const setCassette = useApp((s) => s.setCassette);
  const navActive = useBottomNav((s) => s.active);
  const setActiveNav = useBottomNav((s) => s.setActive);
  const open = navActive === 'notify';
  const qc = useQueryClient();

  const { data: invites = [] } = useQuery({
    queryKey: ['invites', me],
    queryFn: () => fetchInvites(me),
    enabled: Boolean(me),
    refetchInterval: 20_000,
  });
  const cassetteNews = useCassetteNews();
  const looks = useLookIndex();

  const notifCount = invites.length + cassetteNews.length;

  const respond = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }): Promise<void> => {
      if (accept) await acceptInvite(id, me);
      else await declineInvite(id, me);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['invites', me] });
      void qc.invalidateQueries({ queryKey: ['cassettes', me] });
    },
  });

  return (
    <>
      {/* Glocke oben rechts in der Titelzeile, wie man es kennt. */}
      <button
        type="button"
        onClick={() => setActiveNav(open ? null : 'notify')}
        aria-label={notifCount > 0 ? `Neues, ${notifCount}` : 'Neues'}
        aria-pressed={open}
        title="Neues"
        className="hit relative grid size-9 shrink-0 place-items-center rounded-full"
        style={{ color: open ? 'var(--accent)' : 'var(--ink)' }}
      >
        <svg width="19" height="20" viewBox="0 0 15 16" fill="currentColor" aria-hidden="true">
          <path d="M7.5 0a4.25 4.25 0 0 0-4.25 4.25v2.36c0 .58-.22 1.14-.63 1.55L1.4 9.4a1 1 0 0 0 .7 1.7h10.8a1 1 0 0 0 .7-1.7l-1.22-1.24a2.2 2.2 0 0 1-.63-1.55V4.25A4.25 4.25 0 0 0 7.5 0Z" />
          <path d="M5.3 12.2a2.2 2.2 0 0 0 4.4 0h-4.4Z" />
        </svg>
        {notifCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-2xs font-semibold tabular-nums"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            {notifCount}
          </span>
        )}
      </button>

      <Sheet open={open} onClose={() => setActiveNav(null)} variant="full" reserveBottomNav title="Neues">
        <div className="flex flex-col gap-6">
          {notifCount === 0 && (
            <p className="py-10 text-center text-sm" style={{ color: 'var(--dim)' }}>
              Nichts Neues.
            </p>
          )}

          {invites.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                Einladungen · {invites.length}
              </h3>
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col gap-3 rounded-xl p-3"
                  style={{ background: 'var(--card)', border: '1px solid var(--accent)' }}
                >
                  <div className="flex items-center gap-3">
                    {/* Ohne fest gewaehlte Bandsorte (colorIndex) faellt das
                        auf denselben Hash-Automatismus zurueck wie im Fach
                        (colorSeed, sonst die ID) — dieselbe Sorte, die die
                        Kassette auch nach dem Zustimmen dort zeigen wird. */}
                    <MiniCassette
                      id={inv.colorIndex != null ? inv.cassetteId : inv.colorSeed || inv.cassetteId}
                      pairIndex={inv.colorIndex ?? undefined}
                      active
                      side="a"
                      label={inv.cassetteName}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug" style={{ color: 'var(--ink)' }}>
                        <span className="font-semibold">{inv.invitedBy}</span> lädt dich zu{' '}
                        <span className="font-semibold">{inv.cassetteName}</span> ein
                      </p>
                      <p className="mt-0.5 text-2xs" style={{ color: 'var(--dim)' }}>
                        {timeAgo(inv.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={respond.isPending}
                      onClick={() => respond.mutate({ id: inv.id, accept: false })}
                      className="shrink-0 px-1.5 text-2xs disabled:opacity-50"
                      style={{ color: 'var(--dim)' }}
                    >
                      Ablehnen
                    </button>
                    <button
                      type="button"
                      disabled={respond.isPending}
                      onClick={() => respond.mutate({ id: inv.id, accept: true })}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                      style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                    >
                      Zustimmen
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {cassetteNews.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
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
                  <MiniCassette id={c.id} pairIndex={looks.get(c.id)} active side={side} label={c.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium" style={{ color: 'var(--ink)' }}>
                      {c.name}
                    </span>
                    <span className="block text-2xs" style={{ color: 'var(--accent)' }}>
                      Neuer Beitrag
                    </span>
                  </span>
                  <span className="shrink-0 text-2xs" style={{ color: 'var(--dim)' }}>
                    →
                  </span>
                </button>
              ))}
            </section>
          )}
        </div>
      </Sheet>
    </>
  );
}
