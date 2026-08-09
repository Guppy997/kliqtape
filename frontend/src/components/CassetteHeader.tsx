import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useApp, SIDE_LABEL, type Side } from '@/store/appStore';
import { lookFor, type CassetteLook } from '@/lib/cassetteLook';
import Lockup from './Lockup';

interface Props {
  /** ID der eingelegten Kassette — bestimmt Bandsorte, Gehäusefarbe und Spuren. */
  cassetteId: string | null;
  /** Welche Sorte dieses Band im Regal bekommen hat. */
  pairIndex?: number;
  /** Was auf dem Beschriftungsfeld steht — der Name der Runde. */
  label: string;
  count: number;
  /** Welches Tape heute aktiv ist (Datum + Name/Nummer) — Tage gehoeren zur
   *  Kassette, nicht zur Seite, deshalb auf A und B gleich. */
  currentTape?: { dateLabel: string; shortName: string; fullName: string } | null;
}

const R_MAX = 26;
const R_MIN = 10;
const FIELD_MAX = 72;
const FIELD_MIN = 0;
const FLIP_MS = 180;

/**
 * Der Kassetten-Header — gleichzeitig der Umschalter.
 *
 * Aufgebaut wie eine echte Kassette: geripptes Gehaeuse mit Schrauben, darauf
 * ein aufgeklebtes Etikett mit farbigem Kopfband und liniertem Beschriftungs-
 * feld, darunter das Sichtfenster mit den Spulen.
 *
 * Tippen dreht das Band um. Auf halbem Weg steht es hochkant, dort wechselt
 * die Seite — man sieht den Inhalt nie umklappen. Die Runde bleibt dieselbe:
 * A und B gehoeren zur selben Kassette und haben denselben Farbton.
 *
 * Beim Scrollen faehrt das Beschriftungsfeld ein, das Fenster bleibt: die
 * Spulen laufen weiter mit, links duenner, rechts dicker.
 */
export default function CassetteHeader({ cassetteId, pairIndex, label, count, currentTape }: Props) {
  const side = useApp((s) => s.side);
  const setSide = useApp((s) => s.setSide);

  const [collapse, setCollapse] = useState(0);
  const [progress, setProgress] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const timer = useRef<number | null>(null);
  // Waehrend "settling" ignoriert die Scroll-Verfolgung die tatsaechliche
  // Position — siehe Effekt weiter unten.
  const settling = useRef(false);

  // Scroll-Verfolgung UND das kurze "Settling"-Fenster nach einem Wechsel
  // sind bewusst EIN Effekt: das Ende des Fensters muss den Klapp-Zustand
  // aktiv nachholen (sonst bliebe der Kopf aufgeklappt "stehen", falls
  // seitdem kein weiterer Scroll/Resize mehr passiert ist, obwohl die
  // tatsaechliche Position laengst woanders liegt — App.tsx springt beim
  // Ankommen ja direkt zum ersten ungesehenen Beitrag bzw. ans Bandende).
  useEffect(() => {
    let raf = 0;
    let settleTimer: number | null = null;

    const update = () => {
      if (settling.current) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      setCollapse(Math.min(1, y / 150));
      setProgress(max > 60 ? Math.min(1, y / max) : 0);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    // Kurz nach einem Seiten-/Kassettenwechsel (bzw. solange die Seite noch
    // waechst, weil Inhalt nachlaedt — z.B. Chat, der selbst ans Ende
    // springt) bleibt der Kopf aufgeklappt. Erst wenn eine Weile nichts mehr
    // wächst, greift wieder normales Scroll-Verhalten — und zwar sofort mit
    // der dann tatsaechlichen Position, nicht erst beim naechsten Scroll.
    const arm = () => {
      settling.current = true;
      if (settleTimer) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        settling.current = false;
        update();
      }, 200);
    };

    arm();
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const ro = new ResizeObserver(() => {
      setCollapse(0);
      arm();
    });
    ro.observe(document.documentElement);

    return () => {
      cancelAnimationFrame(raf);
      if (settleTimer) window.clearTimeout(settleTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      ro.disconnect();
    };
  }, [side, count, cassetteId]);

  // Seiten-/Kassettenwechsel soll IMMER aufgeklappt und oben starten — sonst
  // bliebe das Beschriftungsfeld bei einem lang gewachsenen Band fuer immer
  // eingeklappt, sobald man einmal tief gescrollt hatte. Wichtig: das gilt
  // AUCH fuer den Gruppenchat (Seite B ungefiltert) — dort bestimmt zwar
  // ChatThread selbst noch das endgueltige Scrollziel (ans Gespraechsende),
  // aber OHNE diesen Reset bliebe bis dahin die alte Scrollposition der
  // vorherigen Seite stehen. Das "Settling"-Fenster unten liest dann kurz
  // danach eine viel zu grosse Position und klappt sofort alles ein, obwohl
  // man gerade erst angekommen ist. App.tsx (Deck) ueberschreibt dieses
  // Ziel danach noch mit dem eigentlich richtigen (erster ungesehener
  // Beitrag bzw. Bandende) — aber eben nur fuer die Karten-Ansicht, nicht
  // fuer den Chat.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
    setCollapse(0);
    setProgress(0);
  }, [side, cassetteId]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  function flip() {
    if (flipping || !cassetteId) return;
    const next: Side = side === 'a' ? 'b' : 'a';

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSide(next);
      return;
    }
    setFlipping(true);
    timer.current = window.setTimeout(() => {
      setSide(next);
      setFlipping(false);
    }, FLIP_MS);
  }

  // Linke Spule = Rueckspulen (aeltester Stand), rechte = Vorspulen
  // (aktuellster Stand) — wie an einem echten Deck. Eigene Tasten statt Teil
  // der Umdrehen-Flaeche, damit beides nebeneinander bedienbar bleibt.
  function scrollToStart(e: React.MouseEvent) {
    e.stopPropagation();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function scrollToEnd(e: React.MouseEvent) {
    e.stopPropagation();
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }

  const look = lookFor(cassetteId ?? '', pairIndex);
  const { type, case: plastic, wear } = look;
  const isA = side === 'a';

  const rLeft = R_MAX - (R_MAX - R_MIN) * progress;
  const rRight = R_MIN + (R_MAX - R_MIN) * progress;
  const fieldH = FIELD_MAX - (FIELD_MAX - FIELD_MIN) * collapse;

  // Gehaeuse: gefaerbtes Plastik, fein gerippt wie eine echte Schale.
  const shellStyle = isA
    ? {
        backgroundImage:
          // Diagonaler Glanzstreifen ganz oben drauf — die zusaetzliche
          // Lichtkante, die aus glattem Verlauf "glaenzendes Plastik" macht.
          `radial-gradient(140% 55% at 20% -8%, rgba(255,255,255,.16), rgba(255,255,255,0) 45%),` +
          `repeating-linear-gradient(180deg, rgba(255,255,255,.035) 0 1px, rgba(0,0,0,0) 1px 5px),` +
          `linear-gradient(178deg, ${type.shellHi} 0%, ${type.shell} 26%, ${type.shellDark} 100%)`,
        // Grosser, weicher Schlagschatten + ein duenner Rand/Glow in der
        // eigenen Akzentfarbe der Kassette (type.stripe) — damit sie sich
        // vom Hintergrund abhebt, unabhaengig davon, wie dunkel der gerade
        // ist (reines "dunkel auf dunkel" reicht sonst nicht als Kontrast).
        boxShadow:
          `0 0.5rem 1.2rem rgba(0,0,0,.5), 0 1.4rem 2.8rem rgba(0,0,0,.55), 0 0 0 1px ${type.stripe}70, 0 0 1.6rem ${type.stripe}2e, 0 1px 0 rgba(255,255,255,.14) inset, 0 -1px 0 rgba(0,0,0,.6) inset`,
      }
    : {
        backgroundImage:
          // Marmor-/Konfetti-Flecken, nur bei gemusterten Sorten — weiche
          // Farbkleckse an denselben (pro Kassette festen) Positionen wie die
          // Gebrauchsspuren, damit es sich nicht bei jedem Rendern verschiebt.
          (plastic.fleck
            ? plastic.fleck
                .map((c, i) => {
                  const [x, y] = wear.specks[i] ?? [30 + i * 25, 45];
                  return `radial-gradient(40% 36% at ${x}% ${y}%, ${c}66 0%, ${c}00 70%)`;
                })
                .join(',') + ','
            : '') +
          `radial-gradient(140% 55% at 20% -8%, rgba(255,255,255,.2), rgba(255,255,255,0) 45%),` +
          `repeating-linear-gradient(180deg, rgba(255,255,255,.05) 0 1px, rgba(0,0,0,0) 1px 5px),` +
          `radial-gradient(120% 80% at 18% 6%, rgba(255,255,255,.45), rgba(255,255,255,0) 46%),` +
          `radial-gradient(90% 70% at 84% 96%, ${plastic.pcb}55, ${plastic.pcb}00 55%),` +
          `linear-gradient(172deg, ${plastic.shellHi}99 0%, ${plastic.shell} 40%, ${plastic.inner} 100%)`,
        // Gleiche Idee wie bei Seite A: grosser Schlagschatten + Rand/Glow
        // in plastic.glow (der Leucht-Akzentfarbe dieser Sorte) fuers Abheben
        // vom Hintergrund.
        boxShadow:
          `0 0.5rem 1.4rem ${plastic.inner}aa, 0 1.4rem 2.8rem rgba(0,0,0,.5), 0 0 0 1px ${plastic.glow}80, 0 0 1.8rem ${plastic.glow}3d, 0 0 0 1px ${plastic.shellHi}88 inset, 0 0.9rem 1.6rem ${plastic.inner}99 inset`,
      };

  const paper = isA ? type.label : `${plastic.inner}dd`;
  const paperDeep = isA ? type.labelDeep : `${plastic.inner}f2`;
  const ink = isA ? type.ink : plastic.ink;
  const rule = isA ? type.rule : `${plastic.shellHi}55`;
  const band = isA ? type.stripe : plastic.shell;
  const bandInk = isA ? type.stripeInk : plastic.ink;
  const windowBg = isA ? type.shellDark : plastic.inner;
  // Rahmenkante um Etikett und Sichtfenster. Beide Gehaeusewelten sind dunkel,
  // also immer eine helle Lichtkante — eine dunkle Kontur ginge im Gehaeuse
  // unter.
  const frame = isA ? 'rgba(255,255,255,.18)' : `${plastic.shellHi}88`;

  // Kein eigenes sticky/Hintergrund mehr hier — App.tsx umschliesst diesen
  // Kopf jetzt zusammen mit der Erstellen/Filter/Regal/Profil-Zeile in EINEM
  // gemeinsamen sticky-Block, damit beide zusammen oben kleben bleiben,
  // statt dass nur der Kopf klebt und die Zeile darunter wegscrollt.
  return (
    <header className="px-3 pb-2 pt-3">
      <div className="mx-auto max-w-xl" style={{ perspective: '900px' }}>
        {/* Kein <button> mehr, sonst duerften die Spulen darin (siehe unten)
            nicht selbst klickbar sein — verschachtelte interaktive Elemente
            sind ungueltig. Tastatur bleibt bedienbar (role/tabIndex/onKeyDown). */}
        <div
          role="button"
          tabIndex={0}
          onClick={flip}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              flip();
            }
          }}
          aria-label={`Seite ${side.toUpperCase()} von ${label} — tippen für Seite ${isA ? 'B' : 'A'}`}
          aria-disabled={!cassetteId}
          className="relative block w-full cursor-pointer overflow-hidden rounded-xl px-3 pb-2.5 pt-3 text-left"
          style={{
            ...shellStyle,
            opacity: cassetteId ? 1 : 0.6,
            transition: `transform ${FLIP_MS}ms ease-in-out, background-image 450ms ease`,
            // Nur WAEHREND des Umdrehens tatsaechlich in einem 3D-Kontext
            // (rotateY) — im Ruhezustand 'none' statt 'rotateY(0deg)'.
            // Dauerhaft aktiver 3D-Transform + das backdrop-filter im
            // sticky Header darueber (siehe <header> oben) ist ein
            // bekanntes WebKit/Blink-Repaint-Problem: der Text-Layer
            // bleibt nach einem Seitenwechsel manchmal leer stehen,
            // obwohl Rahmen/Hintergrund korrekt neu zeichnen — genau das
            // gemeldete Bild. 'none' im Ruhezustand nimmt den Browser aus
            // diesem staendigen 3D-Kontext raus.
            transform: flipping ? 'rotateY(90deg)' : 'none',
          }}
        >
          <Wear wear={wear} light={isA ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.32)'} />
          <Screws tint={isA ? 'rgba(0,0,0,.35)' : `${plastic.inner}88`} />

          {/* ---- Aufgeklebtes Etikett ------------------------------------
              Sichtbarer Rahmen wie am Vorbild-Foto. Auf dem dunklen Gehaeuse
              muss die Kante HELL sein (Lichtkante der Kunststoffform) — eine
              dunkle Kontur wie beim hellen Gehaeuse waere hier schlicht
              unsichtbar, schwarz auf schwarz. */}
          <div
            className="relative overflow-hidden rounded-[3px]"
            style={{
              transform: `rotate(${wear.tilt}deg)`,
              background: `linear-gradient(180deg, ${paper}, ${paperDeep})`,
              border: `1px solid ${frame}`,
              boxShadow: '0 1px 3px rgba(0,0,0,.5)',
            }}
          >
            {/* Farbband oben, wie der bedruckte Kopf einer echten J-Card */}
            <div
              className="flex items-center justify-between gap-2 px-2.5 py-1"
              style={{ background: band, color: bandInk }}
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span style={{ '--ink': bandInk } as React.CSSProperties}>
                  <Lockup size="0.92rem" />
                </span>
                <span className="font-disp truncate text-[0.55rem] uppercase tracking-[0.18em] opacity-90">
                  {isA ? type.name : plastic.name}
                </span>
              </span>
              <span className="font-mono shrink-0 text-[0.5rem] uppercase tracking-[0.16em] opacity-80">
                {/* Ecke zeigt immer nur die kurze Nummernform, nie einen
                    umbenannten Namen — hier ist kein Platz fuers Umbrechen. */}
                {currentTape ? currentTape.shortName : `Position ${count.toString().padStart(3, '0')}`}
              </span>
            </div>

            {/* Beschriftungsfeld mit Linien — hier steht der Name der Runde.
                Klappt komplett ein, wenn man scrollt (siehe fieldH) — das ist
                gewollt, der eigentliche Bug war eine stehengebliebene
                Scrollposition der vorherigen Seite, nicht dass hier ueberhaupt
                etwas einklappt (siehe Reset weiter oben). */}
            <div
              className="overflow-hidden px-3"
              style={{ height: fieldH, transition: 'height 200ms ease', opacity: 1 - collapse * 1.5 }}
            >
              <div className="pt-2" style={{ borderBottom: `1px solid ${rule}` }}>
                <span className="font-hand block truncate pb-0.5 text-[1.25rem] leading-tight" style={{ color: ink }}>
                  {label}
                </span>
              </div>
              <div className="pt-1.5" style={{ borderBottom: `1px solid ${rule}` }}>
                <span className="font-hand block truncate pb-0.5 text-[0.95rem] leading-tight opacity-70" style={{ color: ink }}>
                  {/* Seite A zeigt den (ggf. umbenannten) Tape-Namen, Seite B
                      immer nur "Gruppenchat" — Tape-Namen sind ein Konzept
                      des Archivs, nicht des laufenden Gesprächs. */}
                  {currentTape
                    ? `${currentTape.dateLabel} — ${isA ? currentTape.fullName : SIDE_LABEL.b}`
                    : `Seite ${side.toUpperCase()} — ${SIDE_LABEL[side]}`}
                </span>
              </div>
            </div>
          </div>

          {/* ---- Sichtfenster mit den Spulen ------------------------------
              Derselbe sichtbare Rahmen wie am Etikett — beide zusammen
              lesen sich als EIN gerahmter Bereich, wie beim Vorbild,
              statt als getrennte Bauteile. */}
          <div
            className="relative mt-2.5 flex items-center justify-around rounded-[3px] px-4 py-1"
            style={{
              background: windowBg,
              border: `1px solid ${frame}`,
              boxShadow: `0 1px 0 rgba(255,255,255,.09), 0 2px 6px rgba(0,0,0,.5) inset`,
            }}
          >
            <button
              type="button"
              onClick={scrollToStart}
              aria-label={isA ? 'Zurueck an den Bandanfang' : 'Zum Anfang des Gesprächs'}
              className="shrink-0 rounded-full transition-transform active:scale-90"
            >
              <Reel r={rLeft} tape={isA ? type.tape : plastic.shell} hub={isA ? type.hub : plastic.shellHi} />
            </button>
            {/* Seitenkennung im Kasten, wie aufgedruckt */}
            <span
              className="font-disp grid size-8 shrink-0 place-items-center rounded-[2px] text-[1.15rem] font-bold leading-none"
              style={{
                color: isA ? type.stripe : '#fff',
                border: `1px solid ${isA ? type.stripe : plastic.glow}`,
                textShadow: isA ? 'none' : `0 0 0.6rem ${plastic.glow}`,
              }}
            >
              {side.toUpperCase()}
            </span>
            <button
              type="button"
              onClick={scrollToEnd}
              aria-label={isA ? 'Vor zum aktuellsten Stand' : 'Zum Ende des Gesprächs'}
              className="shrink-0 rounded-full transition-transform active:scale-90"
            >
              <Reel r={rRight} tape={isA ? type.tape : plastic.shell} hub={isA ? type.hub : plastic.shellHi} />
            </button>
          </div>

          {/* Nur noch ein kleines Zeichen statt Text+Balken — im normalen
              Fluss zwischen Fenster und Fuss platziert (nicht absolut ueber
              der vollen Gehaeusehoehe), damit es nicht mit dem jetzt viel
              groesseren Fuss zusammenstoesst. */}
          <p className="relative mt-1 text-right text-[0.95rem] leading-none" aria-hidden="true">
            <span style={{ color: isA ? '#8C8272' : `${plastic.ink}b0` }}>↻</span>
          </p>

          {/* ---- Fuss mit Andockloechern -----------------------------------
              Das charakteristische Detail am unteren Rand einer echten
              Kassette (Bandeinzugsmechanik greift hier ein). */}
          <Foot
            tint={isA ? type.shell : plastic.shell}
            hi={isA ? type.shellHi : plastic.shellHi}
            dark={isA ? type.shellDark : plastic.inner}
          />
        </div>
      </div>
    </header>
  );
}

/** Gebrauchsspuren: feine Kratzer und Staub, pro Kassette immer dieselben. */
function Wear({ wear, light }: { wear: CassetteLook['wear']; light: string }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {wear.scratches.map(([x, y, len], i) => (
        <line key={`s${i}`} x1={x} y1={y} x2={x + len} y2={y - len * 0.12}
              stroke={light} strokeWidth="0.35" opacity={0.5} />
      ))}
      {wear.specks.map(([x, y, r], i) => (
        <circle key={`p${i}`} cx={x} cy={y} r={r * 0.35} fill={light} opacity={0.35} />
      ))}
      <rect x="0" y="0" width="100" height="100" fill="url(#scuff)" />
      <defs>
        <radialGradient id="scuff" cx="50%" cy="50%" r="72%">
          <stop offset="70%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,.22)" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** Die vier Gehäuseschrauben. */
function Screws({ tint }: { tint: string }) {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      {[
        'left-1.5 top-1.5',
        'right-1.5 top-1.5',
        'left-1.5 bottom-1.5',
        'right-1.5 bottom-1.5',
      ].map((pos) => (
        <i
          key={pos}
          className={`absolute ${pos} block size-1.5 rounded-full`}
          style={{ background: tint, boxShadow: '0 0.5px 0 rgba(255,255,255,.12)' }}
        />
      ))}
    </span>
  );
}

/** Der nach unten breiter werdende Fuss mit den vier Andockloechern, ueber
 *  die eine echte Bandeinzugsmechanik greifen wuerde — zwei runde aussen,
 *  zwei schmale innen, wie am Vorbild-Foto.
 *
 *  Die negativen Aussenabstaende heben die Innenabstaende des Gehaeuses
 *  (px-3 pb-2.5) wieder auf: der Fuss sitzt dadurch BUENDIG auf der Unterkante
 *  der Kassette, so wie beim echten Vorbild — vorher schwebte er mit Luft
 *  ringsum mittendrin. Die abgerundete Ecke des Gehaeuses beschneidet ihn
 *  unten sauber mit (overflow-hidden am Elternteil).
 *
 *  Das Trapez folgt den gemessenen Proportionen vom Foto: oben 16%-85%,
 *  unten etwas breiter 12%-90%. */
function Foot({ tint, hi, dark }: { tint: string; hi: string; dark: string }) {
  return (
    <div
      className="relative -mx-3 -mb-2.5 mt-2"
      style={{
        height: '2.3rem',
        clipPath: 'polygon(16% 0%, 85% 0%, 90% 100%, 12% 100%)',
        // Lichtkante oben, Schatten unten — laesst den Fuss auch auf einem
        // dunklen Gehaeuse als eigenes, vorstehendes Bauteil lesen statt als
        // schwarze Flaeche auf schwarzer Flaeche.
        background: `linear-gradient(180deg, ${hi} 0%, ${tint} 42%, ${dark} 100%)`,
      }}
      aria-hidden="true"
    >
      <span className="absolute inset-x-0 top-[55%] flex items-center justify-between px-[19%]">
        <Hole round />
        <Hole />
        <Hole />
        <Hole round />
      </span>
    </div>
  );
}

/** Ein Andockloch: dunkle Vertiefung mit feiner Lichtkante an der Unterkante,
 *  damit es auch auf dunklem Kunststoff als Loch und nicht als Fleck liest. */
function Hole({ round }: { round?: boolean }) {
  return (
    <i
      className={`block ${round ? 'size-[0.52rem] rounded-full' : 'h-[0.44rem] w-[0.28rem] rounded-[1px]'}`}
      style={{ background: 'rgba(0,0,0,.72)', boxShadow: '0 0.5px 0 rgba(255,255,255,.18)' }}
    />
  );
}

/** Reine Fuellungen, kein <filter> — der Radius aendert sich staendig beim
 *  Scrollen, ein SVG-Filter wuerde dabei bei jedem Frame neu gerechnet.
 *  Die Tiefe kommt stattdessen aus zwei radialen Verlaufs-Ebenen: Licht oben
 *  links (passend zum Gehaeuse-Glanz), dunkler Rand aussen — wirkt wie ein
 *  echter, gewoelbter Bandwickel statt einer flachen Flaeche. */
function Reel({ r, tape, hub }: { r: number; tape: string; hub: string }) {
  const uid = useId();
  const tapeGrad = `reel-tape-${uid}`;
  const hubGrad = `reel-hub-${uid}`;
  return (
    <svg width="62" height="62" viewBox="0 0 62 62" aria-hidden="true" className="shrink-0">
      <defs>
        <radialGradient id={tapeGrad} cx="36%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
          <stop offset="38%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
        </radialGradient>
        <radialGradient id={hubGrad} cx="34%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.65" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
      </defs>
      {/* Bandwickel — der Radius ist der Fuellstand */}
      <circle cx="31" cy="31" r={r} fill={tape} />
      <circle cx="31" cy="31" r={r} fill={`url(#${tapeGrad})`} />
      <circle cx="31" cy="31" r="9" fill={hub} />
      <circle cx="31" cy="31" r="9" fill={`url(#${hubGrad})`} />
      <g className="spin" style={{ transformOrigin: '31px 31px' }}>
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <rect key={deg} x="30.2" y="23" width="1.8" height="5" fill={tape} opacity="0.8"
                transform={`rotate(${deg} 31 31)`} />
        ))}
      </g>
    </svg>
  );
}
