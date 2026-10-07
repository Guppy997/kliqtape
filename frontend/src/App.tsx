import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deletePost, fetchFeed, fetchTapes, KIND_LABEL, type FeedItem, type Kind } from '@/lib/api';
import { useApp, SIDE_LABEL } from '@/store/appStore';
import { useBottomNav } from '@/store/navStore';
import { jumpTo, useJump } from '@/store/jumpStore';
import { useViewMode } from '@/store/viewStore';
import { berlinDateLabel, tapeIndexOf } from '@/lib/berlinDay';
import CassetteHeader, { CassetteFacePreview, FLIP_IN_MS } from '@/components/CassetteHeader';
import { useCassettes, useLookIndex } from '@/components/CassetteDeck';
import { lookFor } from '@/lib/cassetteLook';
import ChatThread from '@/components/ChatThread';
import Composer from '@/components/Composer';
import PostCard from '@/components/PostCard';
import BottomBar from '@/components/BottomBar';
import AnsweringMachine from '@/components/AnsweringMachine';
import Lockup from '@/components/Lockup';
import SideSwitch from '@/components/SideSwitch';
import NewsView from '@/components/NewsView';
import StoryView from '@/components/StoryView';
import TapeHeader, { defaultTapeName, tapeDisplayName } from '@/components/TapeHeader';
import UpdateNotification from '@/components/UpdateNotification';
import NameGate from '@/components/NameGate';
import { EmptyBand, NoCassette } from '@/components/EmptyState';
import FilmBag from '@/components/FilmBag';
import ImposterCard from '@/components/ImposterCard';
import LetterRedeemer from '@/components/LetterRedeemer';

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
            '--screen': `color-mix(in srgb, ${type.shell} 15%, #181615)`,
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
    <div
      style={{
        backgroundColor: 'var(--screen)',
        minHeight: '100%',
        // Beim Umdrehen gleitet der Grundton mit, statt im Moment des
        // Hochkant-Stehens hart umzuspringen (CassetteHeader, FLIP_IN_MS).
        transition: `background-color ${FLIP_IN_MS + 80}ms ease-out`,
      }}
    >
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
/** Auf Seite A ist "Zettel" ein bewusst gestalteter Beitragstyp (Tesa/Pin/
 *  Tacker-Optik). Auf Seite B ist reiner Text aber der Normalfall jeder
 *  Nachricht, keine besondere Kategorie — als Filter zeigt er dort einfach
 *  den ganzen Chat, nur in der falschen (Zettel-)Optik statt als Sprechblase.
 *  Foto/O-Ton/Mixtape/Clip bleiben, weil die auf beiden Seiten dasselbe
 *  bedeuten: ein echter, seltener Sonderfall innerhalb des Bands. */
const FILTERS_B = FILTERS.filter((f) => f.key !== 'text');

/** Breite des Kassetten-Symbols oben links und der aufgeklappten Kassette
 *  (CassetteHeader zeichnet bei HEADER_ZOOM rund 200 px) samt Innenabstand. */
const MINI_WIDTH = 60;
const DECK_WIDTH = 200;
const DECK_PAD = 8;

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
  const [query, setQuery] = useState('');
  // Suche und Filter sind eine zweite Zeile, die nur ueber die Lupe aufgeht —
  // sonst bleibt die obere Leiste einzeilig.
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
    setFilter('all');
    setFilterOpen(false);
  };
  const navActive = useBottomNav((s) => s.active);
  const setActiveNav = useBottomNav((s) => s.setActive);
  const viewMode = useViewMode((s) => s.viewMode);
  const setViewMode = useViewMode((s) => s.setViewMode);
  /** Klappt die grosse Kassette aus. Nur auf Tipp — beim Ankommen und beim
   *  Seitenwechsel bleibt sie zu, die App startet ruhig (Seite wechselt der
   *  A|B-Schalter, siehe SideSwitch.tsx). */
  const [deckOpen, setDeckOpen] = useState(false);
  // Ohne eingelegte Kassette gibt es nichts zu zeigen — die graue
  // "Kein Band"-Kassette verdeckte dort nur den Leerzustand.
  const panelShown = deckOpen && Boolean(cassetteId);

  // Hoehe des ausgeklappten Panels als CSS-Variable: es liegt bewusst UEBER
  // dem Inhalt (Leseposition bleibt), Leerzustaende sollen aber darunter
  // anfangen statt verdeckt zu werden (EmptyState.tsx). ResizeObserver
  // feuert auch waehrend des Auf-/Zuklappens, die Variable gleitet also mit.
  const panelRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<HTMLButtonElement>(null);
  const panelShownRef = useRef(panelShown);
  const updateDeckVars = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    panelShownRef.current = panelShown;
    updateDeckVars.current();
  }, [panelShown]);
  const topbarRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = panelRef.current;
    const bar = topbarRef.current;
    if (!el || !bar) return;
    const root = document.documentElement.style;
    // --topbar-h: Hoehe der klebenden Leiste, damit der Gruppenchat seine
    // Nachrichten unten am Eingabefeld ausrichten kann (ChatThread.tsx).
    // offsetHeight statt getBoundingClientRect: das Feld wird beim Auf- und
    // Zuklappen skaliert, gemeint ist aber seine echte Hoehe.
    const update = () => {
      // Wie weit die offene Kassette unter die Leiste ragt — sie sitzt in der
      // Leiste, nur der Ueberhang verdeckt Inhalt.
      const barRect = bar.getBoundingClientRect();
      const anchorTop = (el.parentElement?.getBoundingClientRect().top ?? barRect.top) - barRect.top;
      const overhang = anchorTop - DECK_PAD + el.offsetHeight - barRect.height;
      root.setProperty('--deck-h', panelShownRef.current ? `${Math.max(0, overhang) + 8}px` : '0px');
      root.setProperty('--topbar-h', `${barRect.height}px`);
    };
    updateDeckVars.current = update;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    ro.observe(bar);
    return () => {
      ro.disconnect();
      root.removeProperty('--deck-h');
      root.removeProperty('--topbar-h');
    };
  }, []);

  // Zuklappen bei ECHTER Nutzereingabe, nicht bei jedem Scroll-Ereignis:
  // beim Ankommen scrollt die App selbst (nach oben, zum ersten ungesehenen
  // Beitrag, im Chat ans Ende) — ein Scroll-Listener wuerde die Kassette
  // dadurch sofort wieder zuklappen. wheel/touchmove loesen nur echte
  // Eingaben aus, damit braucht es weder Schwellwerte noch Zeitfenster.
  // Tipp neben die offene Kassette klappt sie zu (das Symbol selbst liegt
  // darunter und schaltet ohnehin um).
  useEffect(() => {
    if (!panelShown) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || miniRef.current?.contains(t)) return;
      setDeckOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [panelShown]);

  // Haarstrich unter der Leiste nur, solange darunter gescrollt ist — in
  // Ruhe verschmilzt die Leiste mit dem Board (.bar-top in index.css).
  // Gesetzt wird nur beim Ueberschreiten der Kante, nicht bei jedem Pixel.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const close = () => setDeckOpen(false);
    window.addEventListener('wheel', close, { passive: true });
    window.addEventListener('touchmove', close, { passive: true });
    return () => {
      window.removeEventListener('wheel', close);
      window.removeEventListener('touchmove', close);
    };
  }, []);

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
    setQuery('');
    setSearchOpen(false);
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

  const {
    data = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['feed', cassetteId, side, me],
    queryFn: () => fetchFeed(cassetteId!, side, me),
    enabled: Boolean(cassetteId),
    // Seite B ist jetzt ein laufendes Gespraech — denselben Query-Key nutzt
    // auch useCassetteChat, TanStack Query teilt sich den Cache dann von
    // selbst, kein doppelter Netzwerk-Traffic.
    refetchInterval: side === 'b' ? 15_000 : false,
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['feed', cassetteId, side, me] });

  const remove = useMutation({ mutationFn: (id: string) => deletePost(id, me), onSuccess: invalidate });

  // Tapes gibt es nur auf Seite A — die kassettenweiten Namen/Favoriten
  // fuer die Kalendertage, ueber die der Feed gruppiert wird.
  const tapesKey = ['tapes', cassetteId, me];
  const { data: tapeOverrides = [] } = useQuery({
    queryKey: tapesKey,
    queryFn: () => fetchTapes(cassetteId!, me),
    enabled: Boolean(cassetteId) && side === 'a',
  });
  const tapeByIndex = useMemo(() => new Map(tapeOverrides.map((t) => [t.tapeIndex, t])), [tapeOverrides]);
  // Der Stern legt ein Tape ins eigene Regal — das Profil soll es sofort zeigen.
  const invalidateTapes = () => {
    void qc.invalidateQueries({ queryKey: tapesKey });
    void qc.invalidateQueries({ queryKey: ['shelf', me] });
  };

  // Filter gilt je Seite fuer sich — ein Filter aus Seite A soll nicht
  // unsichtbar auf Seite B weiterlaufen, wo er zufaellig alles ausblendet.
  useEffect(() => {
    setFilter('all');
    setFilterOpen(false);
    setQuery('');
    setSearchOpen(false);
  }, [side, cassetteId]);

  // Suche und Filter wirken zusammen: erst die Art, dann der Text (Inhalt,
  // Name, Mixtape-Titel) — rein im Client, die Seite ist schon geladen.
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      data.filter(
        (p) =>
          (filter === 'all' || p.kind === filter) &&
          (!q ||
            p.body.toLowerCase().includes(q) ||
            p.author.toLowerCase().includes(q) ||
            (p.tape?.title ?? '').toLowerCase().includes(q)),
      ),
    [data, filter, q],
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
  const isCassetteChat = side === 'b' && filter === 'all' && !q;

  // Beim Ankommen auf einer Seite zum ersten UNGESEHENEN Beitrag springen,
  // statt immer ganz oben (aeltester) oder blind ganz unten (aktuellster) zu
  // landen — "ans Ende" allein wuerde alles ueberspringen, was seit dem
  // letzten Mal dazugekommen ist, ist aber der richtige Fallback, wenn es
  // nichts Neues gibt. Zwei Effekte, bewusst getrennt: der erste friert den
  // ALTEN Gesehen-Stand einmal ein, bevor der zweite ihn (durch fortlaufendes
  // Nachziehen waehrend man hier verweilt) ueberschreiben kann — sonst haette
  // der Sprung nichts mehr zum Vergleichen.
  const arrival = useRef<{ key: string; lastSeen: number; jumped: boolean }>({ key: '', lastSeen: 0, jumped: true });

  // Der Inhalt der neuen Seite blendet weich ein, waehrend die Kassette
  // hereindreht — vorher stand er schlagartig da, obwohl die Kassette sich
  // noch bewegte. Web Animations statt Klassenwechsel: kein Neu-Einhaengen
  // des ganzen Feeds, kein Flackern.
  const mainRef = useRef<HTMLElement>(null);
  const lastSide = useRef(side);
  useLayoutEffect(() => {
    if (lastSide.current === side) return;
    lastSide.current = side;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Die kleine Kassette dreht von der Gegenseite herein — wie die zweite
    // Haelfte des grossen Umdrehens (CassetteHeader, flipStyle), in dieselbe
    // Richtung, B→A spiegelbildlich. So bleibt der Wechsel ueber den A|B-Schalter
    // spuerbar, ohne dass die grosse Kassette aufgeht.
    const from = side === 'b' ? -90 : 90;
    miniRef.current?.animate(
      [
        { transform: `perspective(400px) rotateY(${from}deg) scale(.94)` },
        { transform: 'perspective(400px) rotateY(0deg) scale(1)' },
      ],
      { duration: FLIP_IN_MS, easing: 'cubic-bezier(.1,.45,.55,1)' },
    );
    mainRef.current?.animate(
      [
        { opacity: 0, transform: 'translateY(0.4rem)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: FLIP_IN_MS, easing: 'cubic-bezier(.1,.45,.55,1)' },
    );
  }, [side]);
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

    // Ein Treffer aus der Suche (CassetteInfo.tsx) geht vor "erster
    // ungesehener Beitrag".
    const jump = useJump.getState().postId;
    if (jump && data.some((p) => p.id === jump)) {
      a.jumped = true;
      useJump.getState().setJump(null);
      requestAnimationFrame(() => jumpTo(jump));
    }

    if (!a.jumped) {
      a.jumped = true;
      const target = data.find((p) => p.created_at > a.lastSeen);
      // Ist der erste ungesehene Beitrag ohnehin der erste des Bandes, gibt es
      // nichts nachzuholen — dann oben bleiben, damit die Kassette im Bild ist.
      // (Frueher egal, weil der Kopf oben klebte; jetzt scrollt er weg.)
      if (target && target !== data[0]) {
        document.getElementById(`post-${target.id}`)?.scrollIntoView({ block: 'start' });
      } else if (!target && data.length > 0) {
        window.scrollTo({ top: document.documentElement.scrollHeight });
      }
    }

    // Fortlaufend nachziehen, auch nach dem ersten Sprung: was waehrend des
    // Verweilens hier noch nachlaedt (z.B. Hintergrund-Polling auf Seite B),
    // zaehlt beim naechsten Mal nicht mehr als ungesehen.
    const newest = data.reduce((m, p) => Math.max(m, p.created_at), a.lastSeen);
    markSideSeen(cassetteId, side, newest);
  }, [cassetteId, side, isCassetteChat, isLoading, data, markSideSeen]);

  return (
    <>
      {/* NUR noch die Bedienzeile klebt oben — der Kassetten-Kopf steht
          darunter im normalen Fluss und scrollt einfach weg. Damit gibt es
          keinen halb eingeklappten Zwischenzustand mehr: die Kassette ist
          entweder ganz da oder ganz weg. Genau diese Zwischenstufe war die
          Quelle der Kopf-Fehler (Hoehen-Interpolation, Settling-Fenster,
          Neuzeichnungs-Problem). Zurueck geholt wird sie ueber das kleine
          Kassetten-Symbol links in dieser Zeile.

          pt mit safe-area-inset-top: index.html setzt viewport-fit=cover, die
          Seite liegt also UNTER Notch/Kamera-Ausschnitt. Ohne dieses Polster
          laeuft die Zeile bei iPhone und Android dort hinein. */}
      <div
        ref={topbarRef}
        className="bar-frost bar-top sticky top-0 z-30 pt-[max(0.5rem,env(safe-area-inset-top))]"
        data-scrolled={scrolled || undefined}
        // Solange die Kassette ausgeklappt ist, faellt die Trennlinie nach
        // unten weg — Leiste und Panel sind dann eine durchgehende Flaeche.
        // Der Grund gleitet beim Umdrehen mit wie der Rahmen (App, FLIP_IN_MS),
        // sonst sprang die Leiste vorab auf die Farbe der anderen Seite.
        style={{
          borderBottomColor: panelShown ? 'transparent' : undefined,
          transition: `background-color ${FLIP_IN_MS + 80}ms ease-out, border-color 160ms ease-out`,
        }}
      >
        <div className="mx-auto flex max-w-xl flex-col gap-1.5 px-3 pb-2">
          {/* Titelzeile wie bei Instagram: links Aufnehmen, Mitte die Wortmarke,
              rechts die Glocke. Seite B ungefiltert ist reiner Chat — dort
              soll nichts mit dem Schreiben konkurrieren, das Plus bleibt dann
              weg (der Platz bleibt, damit die Wortmarke mittig steht). */}
          <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center">
            <span className="flex justify-start">
              {!isCassetteChat && navActive === null ? <Composer onPosted={invalidate} /> : <span className="size-8" />}
            </span>
            <span className="flex justify-center">
              <Lockup size="1.2rem" />
            </span>
            <span className="flex justify-end">
              <AnsweringMachine />
            </span>
          </div>

          {/* Zweite, schmale Zeile: die eingelegte Kassette. Das Symbol waechst
              beim Antippen an Ort und Stelle zur groesseren Kassette; daneben
              Name und Seite, rechts der A|B-Schalter und die Lupe. */}
          {cassetteId && (
            <div className="flex items-center gap-2.5">
              <span className="relative shrink-0">
                <button
                  ref={miniRef}
                  type="button"
                  onClick={() => setDeckOpen((v) => !v)}
                  aria-label={deckOpen ? 'Kassette einklappen' : 'Kassette zeigen'}
                  aria-expanded={deckOpen}
                  title={current?.name ?? 'Kassette'}
                  className="block transition-[transform,opacity] active:scale-95"
                  // Waehrend die grosse Kassette offen ist, ist sie DIESES
                  // Symbol, nur groesser — das kleine verschwindet so lange.
                  style={{ opacity: panelShown ? 0 : 1, transitionDuration: panelShown ? '120ms' : '200ms' }}
                >
                  {/* Dieselbe Zeichnung wie die grosse Kassette, nur herunter-
                                      skaliert (siehe CassetteHeader.tsx). */}
                  <CassetteFacePreview
                    side={side}
                    cassetteId={cassetteId}
                    pairIndex={looks.get(cassetteId)}
                    label={current?.name ?? 'Kein Band'}
                    count={data.length}
                    currentTape={currentTape}
                    createdAt={current?.createdAt}
                    width={MINI_WIDTH}
                  />
                </button>
                {/* Die grosse Kassette waechst aus genau diesem Symbol: gleicher
                                    Ankerpunkt oben links, Start in Symbolgroesse. Sie legt sich
                                    ueber Leiste und Inhalt; Tipp daneben oder Scrollen klappt
                                    sie wieder zu. */}
                <div
                  ref={panelRef}
                  inert={!panelShown}
                  className="glass absolute z-[60] rounded-xl"
                  style={{
                    left: -DECK_PAD,
                    top: -DECK_PAD,
                    transformOrigin: `${DECK_PAD}px ${DECK_PAD}px`,
                    transform: panelShown ? 'scale(1)' : `scale(${MINI_WIDTH / DECK_WIDTH})`,
                    opacity: panelShown ? 1 : 0,
                    visibility: panelShown ? 'visible' : 'hidden',
                    transition: panelShown
                      ? 'transform 360ms cubic-bezier(.2,.8,.2,1), opacity 160ms ease, visibility 0s'
                      : 'transform 260ms cubic-bezier(.4,0,1,1), opacity 200ms ease 60ms, visibility 0s 260ms',
                  }}
                >
                  <CassetteHeader
                    cassetteId={cassetteId}
                    pairIndex={cassetteId ? looks.get(cassetteId) : undefined}
                    label={current?.name ?? 'Kein Band'}
                    count={data.length}
                    currentTape={currentTape}
                    createdAt={current?.createdAt}
                  />
                </div>
              </span>
              <button
                type="button"
                onClick={() => setDeckOpen((v) => !v)}
                className="min-w-0 flex-1 text-left"
                aria-hidden="true"
                tabIndex={-1}
              >
                <span className="block truncate text-sm font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                  {current?.name ?? 'Kassette'}
                </span>
                <span className="block truncate text-2xs leading-tight" style={{ color: 'var(--dim)' }}>
                  {SIDE_LABEL[side]}
                </span>
              </button>
              <SideSwitch />
              <button
                type="button"
                onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
                aria-expanded={searchOpen}
                aria-label={searchOpen ? 'Suche schließen' : 'Beiträge suchen'}
                title="Suchen"
                className="glass-chip hit grid size-9 shrink-0 place-items-center rounded-full"
                // Leuchtet, solange Suche oder Filter etwas ausblenden.
                style={{
                  background: q || filter !== 'all' ? 'var(--accent)' : undefined,
                  color: q || filter !== 'all' ? 'var(--on-accent)' : 'var(--dim)',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M10.5 10.5 14 14" />
                </svg>
              </button>
            </div>
          )}

          {/* Zweite Zeile, nur nach Tipp auf die Lupe: Beitraege durchsuchen,
              Art filtern. Gilt fuer die eingelegte Seite; auf Seite B wird aus
              dem Chat dabei eine Trefferliste. */}
          {cassetteId && searchOpen && (
            <div className="flex items-center gap-2">
              <label
                className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full px-3"
                style={{ background: 'color-mix(in srgb, var(--ink) 7%, transparent)' }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                  style={{ color: 'var(--dim)' }}
                >
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M10.5 10.5 14 14" />
                </svg>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  placeholder={side === 'a' ? 'Auf Seite A suchen' : 'Im Gruppenchat suchen'}
                  aria-label="Beiträge suchen"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  style={{ color: 'var(--ink)' }}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Suche leeren"
                    className="hit text-sm"
                    style={{ color: 'var(--dim)' }}
                  >
                    ✕
                  </button>
                )}
              </label>
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                aria-expanded={filterOpen}
                aria-label={
                  filter === 'all' ? 'Nach Art filtern' : `Filter: ${FILTERS.find((f) => f.key === filter)?.label}`
                }
                title="Nach Art filtern"
                className="hit grid size-9 shrink-0 place-items-center rounded-full"
                style={{
                  background: filter === 'all' ? 'color-mix(in srgb, var(--ink) 7%, transparent)' : 'var(--accent)',
                  color: filter === 'all' ? 'var(--dim)' : 'var(--on-accent)',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M2 4h12M4.5 8h7M7 12h2" />
                </svg>
              </button>
            </div>
          )}

          {filterOpen && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {(side === 'b' ? FILTERS_B : FILTERS).map((f) => {
                const n = f.key === 'all' ? data.length : data.filter((p) => p.kind === f.key).length;
                if (n === 0 && f.key !== 'all') return null;
                const on = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => {
                      setFilter(f.key);
                      setFilterOpen(false);
                    }}
                    aria-pressed={on}
                    className="h-8 shrink-0 rounded-full px-3 text-sm"
                    style={{
                      background: on ? 'var(--accent)' : 'color-mix(in srgb, var(--ink) 7%, transparent)',
                      color: on ? 'var(--on-accent)' : 'var(--ink)',
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <LetterRedeemer />
      <StoryView open={viewMode === 'story'} onClose={() => setViewMode('cassette')} />
      <NewsView open={viewMode === 'news'} onClose={() => setViewMode('cassette')} />

      <main
        ref={mainRef}
        className="mx-auto flex max-w-xl flex-col gap-1.5 px-3 pt-2"
        style={{ paddingBottom: isCassetteChat ? 'calc(var(--chatcomposer-h, 5rem) + 1rem)' : '6rem' }}
      >
        {!cassetteId && !loadingTapes && <NoCassette />}

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
                  <p className="py-10 text-center text-xs" style={{ color: 'var(--dim)' }}>
                    Band wird eingelegt …
                  </p>
                )}

                {isError && (
                  <p
                    className="rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
                  >
                    {/* Bandsalat: wenn das Backend nicht antwortet, ist das Band verheddert. */}
                    Bandsalat — {(error as Error).message}
                  </p>
                )}

                {!isLoading && !isError && data.length === 0 && side === 'a' && current && (
                  <EmptyBand cassette={current} />
                )}

                {!isLoading && !isError && shown.length === 0 && !(data.length === 0 && side === 'a' && current) && (
                  <div className="py-16 text-center">
                    <p className="text-sm" style={{ color: 'var(--dim)' }}>
                      {data.length === 0 ? 'Leeres Band.' : 'Nichts davon auf diesem Band.'}
                    </p>
                    <p className="mt-1 text-2xs" style={{ color: 'var(--dim)' }}>
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
                      <PostCard key={item.id} item={item} onReacted={invalidate} onDelete={(id) => remove.mutate(id)} />
                    ))}

                {/* Film der Woche: am Ende von Seite A, dort wo man beim
                    Einlegen landet (neuester Stand). Nur ohne Filter. */}
                {side === 'a' && filter === 'all' && !q && current && !isLoading && (
                  <>
                    <ImposterCard cassette={current} onChanged={invalidate} />
                    <FilmBag cassette={current} onChanged={invalidate} />
                  </>
                )}

                {shown.length > 0 && (
                  <div className="flex flex-col items-center gap-1.5 pt-8">
                    {/* Bandende: der durchsichtige Vorspann. Hier hoert der Feed auf. */}
                    <div
                      className="h-1 w-24 rounded-full"
                      style={{ background: 'linear-gradient(90deg, var(--accent), transparent)' }}
                    />
                    <p className="text-sm" style={{ color: 'var(--dim)' }}>
                      Bandende.
                    </p>
                    <p className="text-2xs" style={{ color: 'var(--dim)' }}>
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
