import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { claimName, deletePost, fetchFeed, fetchTapes, whoami, ApiError, KIND_LABEL, type FeedItem, type Kind } from '@/lib/api';
import { useApp, SIDE_LABEL } from '@/store/appStore';
import { useBottomNav } from '@/store/navStore';
import { useViewMode } from '@/store/viewStore';
import { berlinDateLabel, tapeIndexOf } from '@/lib/berlinDay';
import CassetteHeader from '@/components/CassetteHeader';
import { useCassettes, useLookIndex } from '@/components/CassetteDeck';
import { lookFor } from '@/lib/cassetteLook';
import ChatThread from '@/components/ChatThread';
import Composer from '@/components/Composer';
import PostCard from '@/components/PostCard';
import BottomBar from '@/components/BottomBar';
import Lockup from '@/components/Lockup';
import Settings from '@/components/Settings';
import Shelf from '@/components/Shelf';
import NewsView from '@/components/NewsView';
import StoryView from '@/components/StoryView';
import TapeHeader, { defaultTapeName, tapeDisplayName } from '@/components/TapeHeader';
import UpdateNotification from '@/components/UpdateNotification';

export default function App() {
  const me = useApp((s) => s.me);
  const token = useApp((s) => s.token);
  const side = useApp((s) => s.side);
  const cassetteId = useApp((s) => s.cassetteId);

  // Die Farbwelt der eingelegten Kassette landet auf dem Wurzelknoten, nicht
  // auf einem Container — sonst bekaemen die per Portal ausgelagerten Blaetter
  // sie nicht ab. (Frueher stand hier zusaetzlich eine .side-a/.side-b-Klasse
  // auf einem Kind-Element mit denselben Variablen fest verdrahtet — die hat
  // dieses Inline-Style hier IMMER ueberschrieben, Seite B zeigte deshalb nie
  // die eigene Bandfarbe. Jetzt gibt es nur noch diesen einen Ort.)
  // useLayoutEffect statt useEffect: die Variablen muessen vor dem naechsten
  // Bildaufbau stehen, sonst blitzt beim Kassetten-/Seitenwechsel kurz die
  // vorherige Farbe auf.
  const looks = useLookIndex();
  useLayoutEffect(() => {
    const { type, case: shell } = lookFor(cassetteId ?? '', cassetteId ? looks.get(cassetteId) : undefined);
    const root = document.documentElement.style;
    // Sehr leicht an die Kassette angepasst, aber dunkel gehalten: nur ein
    // Hauch der Bandfarbe wird in den Hintergrund gemischt, kein Wechsel auf
    // eine fremde Palette.
    const vars: Record<string, string> =
      side === 'a'
        ? {
            '--screen': `color-mix(in srgb, ${type.shell} 15%, #14120f)`,
            '--accent': type.stripe,
            '--card': `color-mix(in srgb, ${type.shell} 28%, #201d19)`,
            '--line': `color-mix(in srgb, ${type.shellHi} 32%, #322c25)`,
          }
        : {
            '--screen': shell.screen,
            '--accent': shell.glow,
            '--ink': shell.ink,
            '--dim': shell.dim,
            '--card': `${shell.shell}33`,
            '--line': `${shell.shellHi}44`,
            // Das satte Innenplastik der Kassette, dunkler als --screen — fuer
            // Flaechen, die sich als eigenes Bauteil vom Bildschirm abheben
            // sollen, statt mit ihm zu verschmelzen (siehe ChatThread.tsx).
            '--deck': shell.inner,
          };
    for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
    return () => {
      for (const k of Object.keys(vars)) root.removeProperty(k);
    };
  }, [cassetteId, side, looks]);

  // Beim Start immer auf der eingestellten Seite landen, nicht dort, wo man
  // beim letzten Mal aufgehoert hat.
  useEffect(() => {
    const { startSide, setSide } = useApp.getState();
    setSide(startSide);
  }, []);

  // Der Rahmen ist immer derselbe — nur die Seitentokens wechseln. Sonst
  // springt das Layout zwischen Anmeldung und App.
  // me OHNE token heisst: dieses Geraet stammt noch von vor dem
  // Zugangscode-System (oder der Code ist verlorengegangen) — jede
  // identitaetsgebundene Anfrage wuerde sonst still mit 401 fehlschlagen,
  // ohne dass man je einen Hinweis darauf sieht. Zurueck zu NameGate statt
  // eines Geistermodus.
  return (
    <div style={{ background: 'var(--screen)', minHeight: '100%' }}>
      <UpdateNotification />
      {me && token ? <Deck /> : <NameGate prefill={me} />}
    </div>
  );
}

/** Filterleiste — auf beiden Seiten, gilt aber jeweils nur fuer die aktuelle. */
const FILTERS: { key: Kind | 'all'; label: string }[] = [
  { key: 'all', label: 'Alles' },
  { key: 'photo', label: KIND_LABEL.photo },
  { key: 'voice', label: KIND_LABEL.voice },
  { key: 'tape', label: KIND_LABEL.tape },
  { key: 'video', label: KIND_LABEL.video },
  { key: 'text', label: KIND_LABEL.text },
];

function Deck() {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const setSide = useApp((s) => s.setSide);
  const cassetteId = useApp((s) => s.cassetteId);
  const setCassette = useApp((s) => s.setCassette);
  const markSideSeen = useApp((s) => s.markSideSeen);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Kind | 'all'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const navActive = useBottomNav((s) => s.active);
  const setActiveNav = useBottomNav((s) => s.setActive);
  const viewMode = useViewMode((s) => s.viewMode);
  const setViewMode = useViewMode((s) => s.setViewMode);

  // Home-Knopf in der BottomBar: zurueck zur Startansicht der eingelegten
  // Kassette, egal von wo (Seite B, aktiver Filter, weit runtergescrollt —
  // UND egal ob gerade Eject/Hot Line/Neuigkeiten offen ist: die Leiste
  // bleibt dort dank reserveBottomNav sichtbar, also muss Home das jeweilige
  // Sheet aktiv schliessen, sonst sieht man weiter dessen Inhalt und es wirkt
  // so, als waere gar nichts passiert).
  const goHome = () => {
    setActiveNav(null);
    setSide('a');
    setFilter('all');
    setFilterOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const { data: cassettes = [], isLoading: loadingTapes } = useCassettes();
  const looks = useLookIndex();
  const current = cassettes.find((c) => c.id === cassetteId);

  // Nie vor dem Nichts stehen: fehlt eine Auswahl oder ist sie ungueltig
  // geworden, wird die zuletzt aktive Kassette eingelegt.
  useEffect(() => {
    if (loadingTapes) return;
    if (!current && cassettes.length > 0) setCassette(cassettes[0]!.id);
    if (current == null && cassettes.length === 0 && cassetteId) setCassette(null);
  }, [loadingTapes, cassettes, current, cassetteId, setCassette]);

  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['feed', cassetteId, side, me],
    queryFn: () => fetchFeed(cassetteId!, side, me),
    enabled: Boolean(cassetteId),
    // Seite B ist jetzt ein laufendes Gespraech — denselben Query-Key nutzt
    // auch useCassetteChat, TanStack Query teilt sich den Cache dann von
    // selbst, kein doppelter Netzwerk-Traffic.
    refetchInterval: side === 'b' ? 15_000 : false,
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['feed', cassetteId, side, me] });

  const remove = useMutation({ mutationFn: (id: string) => deletePost(id), onSuccess: invalidate });

  // Tapes gibt es nur auf Seite A — die kassettenweiten Namen/Favoriten
  // fuer die Kalendertage, ueber die der Feed gruppiert wird.
  const tapesKey = ['tapes', cassetteId, me];
  const { data: tapeOverrides = [] } = useQuery({
    queryKey: tapesKey,
    queryFn: () => fetchTapes(cassetteId!, me),
    enabled: Boolean(cassetteId) && side === 'a',
  });
  const tapeByIndex = useMemo(() => new Map(tapeOverrides.map((t) => [t.tapeIndex, t])), [tapeOverrides]);
  const invalidateTapes = () => void qc.invalidateQueries({ queryKey: tapesKey });

  // Filter gilt je Seite fuer sich — ein Filter aus Seite A soll nicht
  // unsichtbar auf Seite B weiterlaufen, wo er zufaellig alles ausblendet.
  useEffect(() => {
    setFilter('all');
    setFilterOpen(false);
  }, [side, cassetteId]);

  const shown = useMemo(
    () => (filter !== 'all' ? data.filter((p) => p.kind === filter) : data),
    [data, filter],
  );

  // Seite A: Beitraege chronologisch nach Tape (Kalendertag) gruppieren —
  // gilt auch bei aktivem Filter, anders als Seite B gibt es hier keinen
  // Chat-Modus zum Umschalten. `shown` ist schon nach created_at sortiert,
  // die Gruppen entstehen einfach in Auftrags-Reihenfolge.
  const tapeGroups = useMemo(() => {
    if (side !== 'a') return [];
    const groups: { tapeIndex: number; items: FeedItem[] }[] = [];
    for (const item of shown) {
      if (item.tapeIndex == null) continue;
      const last = groups[groups.length - 1];
      if (last && last.tapeIndex === item.tapeIndex) last.items.push(item);
      else groups.push({ tapeIndex: item.tapeIndex, items: [item] });
    }
    return groups;
  }, [shown, side]);

  // Das aktuelle Tape ist eine Eigenschaft des Kalendertags dieser Kassette,
  // nicht der Seite — deshalb auf beiden Seiten berechnet, nicht nur auf A.
  const currentTapeIndex = current ? tapeIndexOf(current.createdAt, Date.now()) : null;
  const currentTape =
    currentTapeIndex != null
      ? {
          dateLabel: berlinDateLabel(Date.now()),
          // Kurz fuer die enge Ecke im Kopf (kein truncate dort), voll fuer
          // die breitere Beschriftungszeile darunter — fullName nur auf
          // Seite A relevant, dort kennt CassetteHeader den Unterschied.
          shortName: defaultTapeName(currentTapeIndex),
          fullName: tapeDisplayName(currentTapeIndex, tapeByIndex.get(currentTapeIndex)?.name),
        }
      : null;

  // Seite B (ungefiltert) ist reiner Chat — volle Konzentration aufs
  // Schreiben statt geteilt mit Action-Button und Navigations-Leiste.
  // Deshalb weder Composer oben noch BottomBar unten in diesem Modus,
  // ChatThread haengt stattdessen sein eigenes Eingabefeld fest an den
  // unteren Rand (siehe dort). Der Inhalt braucht dafuer zusaetzlichen
  // Abstand unten, sonst verschwindet die letzte Nachricht dahinter.
  const isCassetteChat = side === 'b' && filter === 'all';

  // Beim Ankommen auf einer Seite zum ersten UNGESEHENEN Beitrag springen,
  // statt immer ganz oben (aeltester) oder blind ganz unten (aktuellster) zu
  // landen — "ans Ende" allein wuerde alles ueberspringen, was seit dem
  // letzten Mal dazugekommen ist, ist aber der richtige Fallback, wenn es
  // nichts Neues gibt. Zwei Effekte, bewusst getrennt: der erste friert den
  // ALTEN Gesehen-Stand einmal ein, bevor der zweite ihn (durch fortlaufendes
  // Nachziehen waehrend man hier verweilt) ueberschreiben kann — sonst haette
  // der Sprung nichts mehr zum Vergleichen.
  const arrival = useRef<{ key: string; lastSeen: number; jumped: boolean }>({ key: '', lastSeen: 0, jumped: true });
  useLayoutEffect(() => {
    if (!cassetteId) return;
    const key = `${cassetteId}:${side}`;
    arrival.current = { key, lastSeen: useApp.getState().sideSeenAt[key] ?? 0, jumped: false };
  }, [cassetteId, side]);

  useLayoutEffect(() => {
    // Seite B ungefiltert ist Chat — der springt beim Laden schon selbst ans
    // Ende (ChatThread), hier nichts extra tun.
    if (!cassetteId || isCassetteChat || isLoading) return;
    const key = `${cassetteId}:${side}`;
    const a = arrival.current;
    if (a.key !== key) return;

    if (!a.jumped) {
      a.jumped = true;
      const target = data.find((p) => p.created_at > a.lastSeen);
      if (target) document.getElementById(`post-${target.id}`)?.scrollIntoView({ block: 'start' });
      else if (data.length > 0) window.scrollTo({ top: document.documentElement.scrollHeight });
    }

    // Fortlaufend nachziehen, auch nach dem ersten Sprung: was waehrend des
    // Verweilens hier noch nachlaedt (z.B. Hintergrund-Polling auf Seite B),
    // zaehlt beim naechsten Mal nicht mehr als ungesehen.
    const newest = data.reduce((m, p) => Math.max(m, p.created_at), a.lastSeen);
    markSideSeen(cassetteId, side, newest);
  }, [cassetteId, side, isCassetteChat, isLoading, data, markSideSeen]);

  return (
    <>
      {/* Kassetten-Kopf UND die Zeile mit Erstellen/Filter/Regal/Profil
          teilen sich jetzt EINEN sticky-Block, statt dass nur der Kopf oben
          klebt und die Zeile mit dem normalen Inhalt wegscrollt — genau das
          war der gemeldete Bug: "+"/Filter/Regal/Profil waren nur ganz oben
          erreichbar. Der Kopf darf weiterhin einklappen (siehe
          CassetteHeader.tsx), die Zeile darunter bleibt davon unabhaengig
          immer sichtbar, weil beide gemeinsam in normalem Fluss innerhalb
          dieses EINEN sticky-Containers stehen — kein Abgleich zweier
          getrennter sticky-Hoehen noetig. */}
      <div className="glass sticky top-0 z-30">
        <CassetteHeader
          cassetteId={cassetteId}
          pairIndex={cassetteId ? looks.get(cassetteId) : undefined}
          label={current?.name ?? 'Kein Band'}
          count={data.length}
          currentTape={currentTape}
        />

        <div className="mx-auto flex max-w-xl flex-col gap-1.5 px-3 pb-2">
          <div
            className="font-mono flex items-center justify-between gap-1.5 text-[0.64rem] uppercase tracking-[0.11em]"
            style={{ color: 'var(--dim)' }}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {/* Seite B ungefiltert ist reiner Chat (siehe isCassetteChat unten) —
                  dort soll nichts mit dem Schreiben konkurrieren. Ausserdem nur
                  in der Home-Uebersicht (kein Sheet aus der unteren Leiste
                  offen) — sonst schwebt der Knopf noch ueber Eject & Co., weil
                  deren Sheet dort bewusst nicht alles verdeckt (reserveBottomNav). */}
              {!isCassetteChat && navActive === null && <Composer onPosted={invalidate} />}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {/* Auf beiden Seiten filterbar — auch Seite B sammelt sich mit der
                  Zeit, und "was ist grad an O-Toenen da" ist dort genauso eine
                  sinnvolle Frage wie im Archiv. */}
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                aria-expanded={filterOpen}
                className="glass-chip shrink-0 rounded-full px-2 py-1 text-[0.58rem]"
                style={{ color: filter === 'all' ? 'var(--dim)' : 'var(--accent)' }}
              >
                {filter === 'all' ? 'Filter' : FILTERS.find((f) => f.key === filter)?.label} {filterOpen ? '▴' : '▾'}
              </button>
              {/* Regal geht jetzt ueber alle Kassetten — holt sich seine Daten
                  selbst, unabhaengig von der gerade eingelegten. */}
              <Shelf me={me} />
              <Settings />
            </span>
          </div>

          {/* Kleines Fenster, das direkt unter der Zeile aufklappt — kein
              eigener Bildschirm fuer eine so kurze Auswahl. */}
          {filterOpen && (
            <div className="glass-chip flex flex-wrap gap-1.5 rounded-lg p-2">
              {FILTERS.map((f) => {
                const n = f.key === 'all' ? data.length : data.filter((p) => p.kind === f.key).length;
                if (n === 0 && f.key !== 'all') return null;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => {
                      setFilter(f.key);
                      setFilterOpen(false);
                    }}
                    className="font-mono rounded-full px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.08em]"
                    style={{
                      background: filter === f.key ? 'var(--accent)' : 'transparent',
                      border: '1px solid var(--line)',
                      color: filter === f.key ? '#17130E' : 'var(--ink)',
                    }}
                  >
                    {f.label} {n}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <StoryView open={viewMode === 'story'} onClose={() => setViewMode('cassette')} />
      <NewsView open={viewMode === 'news'} onClose={() => setViewMode('cassette')} />

      <main
        className="mx-auto flex max-w-xl flex-col gap-1.5 px-3 pt-2"
        style={{ paddingBottom: isCassetteChat ? 'calc(var(--chatcomposer-h, 5rem) + 1rem)' : '6rem' }}
      >
        {!cassetteId && !loadingTapes && (
          <div className="py-16 text-center">
            <p className="font-hand text-lg" style={{ color: 'var(--dim)' }}>
              Kein Band eingelegt.
            </p>
            <p className="mt-2 font-mono text-[0.64rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
              Eine Kassette ist eine Runde von Leuten.
              <br />
              Öffne oben das Fach und beschrifte dein erstes Band.
            </p>
          </div>
        )}

        {cassetteId && (
          <>
            {/* Seite B ungefiltert ist der Gruppenchat — laufendes Gespraech,
                keine Kartenliste. Mit aktivem Filter (z.B. "nur Fotos")
                wird durchsucht statt geschrieben, dafuer bleibt die
                bestehende Kartenansicht, die auch Seite A schon nutzt. */}
            {isCassetteChat ? (
              <ChatThread variant="cassette" cassetteId={cassetteId} />
            ) : (
              <>
                {isLoading && (
                  <p className="font-mono py-10 text-center text-xs" style={{ color: 'var(--dim)' }}>
                    Band wird eingelegt …
                  </p>
                )}

                {isError && (
                  <p className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(184,70,44,.18)', color: '#F0B5A5' }}>
                    {/* Bandsalat: wenn das Backend nicht antwortet, ist das Band verheddert. */}
                    Bandsalat — {(error as Error).message}
                  </p>
                )}

                {!isLoading && !isError && shown.length === 0 && (
                  <div className="py-16 text-center">
                    <p className="font-hand text-lg" style={{ color: 'var(--dim)' }}>
                      {data.length === 0 ? 'Leeres Band.' : 'Nichts davon auf diesem Band.'}
                    </p>
                    <p className="mt-1 font-mono text-[0.66rem] uppercase tracking-widest" style={{ color: 'var(--dim)' }}>
                      Seite {side.toUpperCase()} · {SIDE_LABEL[side]}
                    </p>
                  </div>
                )}

                {side === 'a'
                  ? tapeGroups.map((group) => (
                      <div key={group.tapeIndex} className="flex flex-col gap-1.5">
                        <TapeHeader
                          cassetteId={cassetteId!}
                          cassetteCreatedAt={current!.createdAt}
                          tapeIndex={group.tapeIndex}
                          override={tapeByIndex.get(group.tapeIndex)}
                          me={me}
                          onChanged={invalidateTapes}
                        />
                        {group.items.map((item) => (
                          <PostCard
                            key={item.id}
                            item={item}
                            onReacted={invalidate}
                            onDelete={(id) => remove.mutate(id)}
                          />
                        ))}
                      </div>
                    ))
                  : shown.map((item) => (
                      <PostCard
                        key={item.id}
                        item={item}
                        onReacted={invalidate}
                        onDelete={(id) => remove.mutate(id)}
                      />
                    ))}

                {shown.length > 0 && (
                  <div className="flex flex-col items-center gap-1.5 pt-8">
                    {/* Bandende: der durchsichtige Vorspann. Hier hoert der Feed auf. */}
                    <div
                      className="h-1 w-24 rounded-full"
                      style={{ background: 'linear-gradient(90deg, var(--accent), transparent)' }}
                    />
                    <p className="font-hand text-base" style={{ color: 'var(--dim)' }}>
                      Bandende.
                    </p>
                    <p className="font-mono text-[0.6rem] uppercase tracking-widest" style={{ color: 'var(--dim)' }}>
                      kein Nachschub
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {!isCassetteChat && <BottomBar onHome={goHome} />}
    </>
  );
}

function NameGate({ prefill }: { prefill?: string }) {
  const setIdentity = useApp((s) => s.setIdentity);
  // Vorausgefuellt, wenn schon ein Name lokal bekannt ist, nur der
  // Zugangscode fehlt (siehe App()) — spart das erneute Eintippen, ein Tipp
  // auf "Band einlegen" reicht, um wieder reinzukommen (oder den bestehenden
  // Code einzutragen, falls der Name schon woanders beansprucht ist).
  const [value, setValue] = useState(prefill ?? '');
  // Ein Name gehoert jetzt genau einer Person — beim ersten Beanspruchen
  // bekommt das Geraet automatisch einen Zugangscode (siehe /api/auth/claim).
  // Ist der Name schon vergeben (z.B. dasselbe Konto auf einem neuen Geraet),
  // fragt die Maske stattdessen nach dem bestehenden Code.
  const [needsToken, setNeedsToken] = useState(false);
  const [tokenValue, setTokenValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const name = value.trim();
    if (!name || busy) return;
    setError(null);
    setBusy(true);
    try {
      if (needsToken) {
        const code = tokenValue.trim();
        if (!code) throw new Error('Zugangscode fehlt');
        const res = await whoami(code);
        if (res.name !== name) throw new Error('Zugangscode passt nicht zu diesem Namen');
        setIdentity(res.name, code);
      } else {
        const res = await claimName(name);
        setIdentity(res.name, res.token);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setNeedsToken(true);
        setError('Name schon vergeben — Zugangscode von deinem anderen Gerät eintragen.');
      } else {
        setError(err instanceof Error ? err.message : 'Etwas ist schiefgelaufen');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-full place-items-center px-6 py-16">
      <form
        className="flex w-full max-w-sm flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h1>
          <Lockup size="clamp(3rem, 17vw, 4.6rem)" />
        </h1>
        <p className="text-sm" style={{ color: 'var(--dim)' }}>
          {prefill
            ? 'Diesem Gerät fehlt noch der Zugangscode zu diesem Namen — einmal bestätigen.'
            : 'Tipp deinen Namen ein — beim ersten Mal wird er für dich reserviert.'}
        </p>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (needsToken) {
              setNeedsToken(false);
              setTokenValue('');
              setError(null);
            }
          }}
          maxLength={40}
          autoFocus
          placeholder="Dein Name"
          className="rounded-lg px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
        {needsToken && (
          <input
            value={tokenValue}
            onChange={(e) => setTokenValue(e.target.value)}
            placeholder="Zugangscode von deinem anderen Gerät"
            className="font-mono rounded-lg px-3 py-3 text-sm outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />
        )}
        {error && (
          <p className="text-sm" style={{ color: '#F0B5A5' }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!value.trim() || busy || (needsToken && !tokenValue.trim())}
          className="rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#FFF3EC' }}
        >
          {busy ? 'Einen Moment …' : 'Band einlegen'}
        </button>
        <p className="font-mono text-[0.62rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
          Dein Zugangscode liegt danach in den Einstellungen — kopier ihn dort, um dich auf einem
          zweiten Gerät anzumelden. Achtung: Inhalte sind noch nicht Ende-zu-Ende-verschlüsselt.
        </p>
      </form>
    </div>
  );
}
