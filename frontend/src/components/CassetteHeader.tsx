import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useApp, SIDE_LABEL, type Side } from '@/store/appStore';
import { lookFor, type CassetteLook } from '@/lib/cassetteLook';
import { ageStageOf } from '@/lib/berlinDay';
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
  /** Gruendung — daraus die Altersstufe (ageStageOf, berlinDay.ts). */
  createdAt?: number;
  /** Gezeichnete Breite in px. Die Kassette entsteht immer auf
   *  DECK_REF_WIDTH und wird per zoom auf diese Breite gebracht. */
  width: number;
}

/** Zeichenbreite der ausgeklappten Kassette (24rem). Wie gross sie wirklich
 *  erscheint, bestimmt App.tsx ueber `width` — inzwischen die volle Breite
 *  der Leiste, per zoom auf diese Breite gebracht. */
const DECK_REF_WIDTH = 24 * 16;

const R_MAX = 26;
const R_MIN = 10;

/* Umdrehen in zwei Haelften: hinaus bis hochkant (beschleunigend), dort
 * wechselt die Seite, dann von der Gegenseite wieder herein (abbremsend).
 * Zusammen ergibt das EINE durchgehende Drehung mit der hoechsten
 * Geschwindigkeit genau im unsichtbaren Moment. Vorher drehte die Kassette
 * in 180 ms auf 90° und auf demselben Weg zurueck — das las sich als
 * Wackeln, nicht als Umdrehen, und war in beide Richtungen identisch. */
const FLIP_OUT_MS = 230;
export const FLIP_IN_MS = 320;
const EASE_OUT_HALF = 'cubic-bezier(.45,0,.9,.55)';
const EASE_IN_HALF = 'cubic-bezier(.1,.45,.55,1)';

/** Wo die Drehung gerade steht. 'enter' ist der eine Frame, in dem die
 *  Kassette ohne Uebergang auf die Gegenseite springt, bevor sie hereindreht. */
type FlipPhase = 'idle' | 'out' | 'enter' | 'in';

/** Transform + Transition fuer eine Phase. A→B dreht nach rechts weg,
 *  B→A spiegelbildlich zurueck — wie eine echte Kassette, die man umdreht
 *  und wieder zuruecklegt. Im Ruhezustand 'none' statt rotateY(0) — siehe
 *  Kommentar am transform in CassetteFace. */
function flipStyle(phase: FlipPhase, dir: 1 | -1): { transform: string; transition?: string } {
  switch (phase) {
    case 'out':
      return {
        transform: `rotateY(${dir * 90}deg) scale(.94)`,
        transition: `transform ${FLIP_OUT_MS}ms ${EASE_OUT_HALF}`,
      };
    case 'enter':
      return { transform: `rotateY(${-dir * 90}deg) scale(.94)`, transition: 'none' };
    case 'in':
      return { transform: 'rotateY(0deg) scale(1)', transition: `transform ${FLIP_IN_MS}ms ${EASE_IN_HALF}` };
    default:
      return { transform: 'none' };
  }
}

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
 * Der Kopf klebt NICHT mehr oben — er steht im normalen Fluss und scrollt
 * weg. Es gibt deshalb keinen halb eingeklappten Zwischenzustand mehr: die
 * Kassette ist ganz da oder ganz weg, zurueck geholt ueber das kleine
 * Kassetten-Symbol in der oberen Leiste (App.tsx, CassetteFacePreview unten).
 *
 * Die eigentliche Zeichnung steckt in CassetteFace — diese Komponente hier
 * liefert nur noch Zustand (Scroll-Fuellstand, Umdrehen-Animation) und
 * Interaktivitaet drumherum.
 */
export default function CassetteHeader({ cassetteId, pairIndex, label, count, currentTape, createdAt, width }: Props) {
  const side = useApp((s) => s.side);
  const setSide = useApp((s) => s.setSide);

  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<FlipPhase>('idle');
  const [dir, setDir] = useState<1 | -1>(1);
  const timer = useRef<number | null>(null);
  const raf = useRef<number | null>(null);

  // Nur noch der Fuellstand der Spulen haengt am Scrollen. Ungenauigkeiten
  // waehrend nachladender Inhalte sind hier folgenlos — anders als frueher,
  // wo derselbe Wert ueber die Hoehe des Kopfes entschieden hat.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 60 ? Math.min(1, window.scrollY / max) : 0);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [side, count, cassetteId]);

  // Seiten-/Kassettenwechsel startet oben, damit die Kassette sichtbar ist.
  // Fuer den Gruppenchat ist das ausserdem noetig, weil sonst die alte
  // Scrollposition der vorherigen Seite stehen bliebe, bis ChatThread selbst
  // ans Gespraechsende springt. App.tsx (Deck) ueberschreibt das Ziel danach
  // noch mit dem eigentlich richtigen (erster ungesehener Beitrag bzw.
  // Bandende) — aber nur fuer die Karten-Ansicht, nicht fuer den Chat.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
    setProgress(0);
  }, [side, cassetteId]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );

  function flip() {
    if (phase !== 'idle' || !cassetteId) return;
    const next: Side = side === 'a' ? 'b' : 'a';

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSide(next);
      return;
    }
    setDir(side === 'a' ? 1 : -1);
    setPhase('out');
    timer.current = window.setTimeout(() => {
      // Hochkant: Seite wechseln und ohne Uebergang auf die Gegenseite
      // springen. Erst im uebernaechsten Frame hereindrehen — sonst fasst
      // der Browser beide Zustaende zusammen und dreht von 90° nach 0°
      // zurueck, also wieder das alte Wackeln.
      setSide(next);
      setPhase('enter');
      raf.current = requestAnimationFrame(() => {
        raf.current = requestAnimationFrame(() => {
          setPhase('in');
          timer.current = window.setTimeout(() => setPhase('idle'), FLIP_IN_MS);
        });
      });
    }, FLIP_OUT_MS);
  }

  // Linke Spule = Rueckspulen (aeltester Stand), rechte = Vorspulen
  // (aktuellster Stand) — wie an einem echten Deck.
  function scrollToStart(e: React.MouseEvent) {
    e.stopPropagation();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function scrollToEnd(e: React.MouseEvent) {
    e.stopPropagation();
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }

  const rLeft = R_MAX - (R_MAX - R_MIN) * progress;
  const rRight = R_MIN + (R_MAX - R_MIN) * progress;

  return (
    <header className="p-2">
      {/* Feste Zeichenbreite, per zoom verkleinert: zoom statt transform,
          damit auch der belegte Platz schrumpft und das schwebende Feld in
          App.tsx genau so gross wird wie die Kassette darin. */}
      <div style={{ perspective: '1100px', zoom: width / DECK_REF_WIDTH, width: DECK_REF_WIDTH }}>
        <CassetteFace
          side={side}
          cassetteId={cassetteId}
          pairIndex={pairIndex}
          label={label}
          count={count}
          currentTape={currentTape}
          age={createdAt ? ageStageOf(createdAt) : 0}
          reelLeft={rLeft}
          reelRight={rRight}
          flip={flipStyle(phase, dir)}
          onFlip={flip}
          onScrollStart={scrollToStart}
          onScrollEnd={scrollToEnd}
        />
      </div>
    </header>
  );
}

interface FaceProps {
  side: Side;
  cassetteId: string | null;
  pairIndex?: number;
  label: string;
  count: number;
  currentTape?: { dateLabel: string; shortName: string; fullName: string } | null;
  reelLeft: number;
  reelRight: number;
  /** Altersstufe 0..AGE_MAX_STAGE: Etikett vergilbt, Kanten abgegriffen, Korn. */
  age?: number;
  /** Nur beim grossen, interaktiven Kopf gesetzt — waehrend des Umdrehens
   *  kurzzeitig im 3D-Kontext (siehe Kommentar am transform unten). */
  flip?: { transform: string; transition?: string };
  /** Fehlen diese drei, ist die Flaeche rein dekorativ: kein role="button",
   *  keine Spulen-Tasten, kein Cursor. Fuer die kleine Vorschau (App.tsx) —
   *  dort uebernimmt ein umschliessendes <button> das Tippen, verschachtelte
   *  interaktive Elemente waeren ungueltiges HTML. */
  onFlip?: () => void;
  onScrollStart?: (e: React.MouseEvent) => void;
  onScrollEnd?: (e: React.MouseEvent) => void;
}

/**
 * Die eigentliche Zeichnung der Kassette — Gehaeuse, Etikett, Sichtfenster,
 * Fuss. Komplett zustandslos, reine Funktion ihrer Props.
 *
 * Bewusst als einzige Quelle fuer "wie sieht eine Kassette aus": vorher gab
 * es hier eine zweite, vereinfachte Nachbildung fuer die kleine Vorschau
 * (ohne Logo, ohne Tape-Nummer, ohne Datumszeile) — die beiden Versionen
 * liefen bei jeder Detailaenderung am grossen Kopf auseinander. Jetzt nutzt
 * die Vorschau (CassetteFacePreview) exakt dieselbe Funktion, nur skaliert.
 */
function CassetteFace({
  side,
  cassetteId,
  pairIndex,
  label,
  count,
  currentTape,
  reelLeft,
  reelRight,
  age = 0,
  flip,
  onFlip,
  onScrollStart,
  onScrollEnd,
}: FaceProps) {
  const look = lookFor(cassetteId ?? '', pairIndex);
  const { type, case: plastic, wear } = look;
  const isA = side === 'a';
  const interactive = Boolean(onFlip);

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
        boxShadow: `0 0.5rem 1.2rem rgba(0,0,0,.5), 0 1.4rem 2.8rem rgba(0,0,0,.55), 0 0 0 1px ${type.stripe}70, 0 0 1.6rem ${type.stripe}2e, 0 1px 0 rgba(255,255,255,.14) inset, 0 -1px 0 rgba(0,0,0,.6) inset`,
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
        boxShadow: `0 0.5rem 1.4rem ${plastic.inner}aa, 0 1.4rem 2.8rem rgba(0,0,0,.5), 0 0 0 1px ${plastic.glow}80, 0 0 1.8rem ${plastic.glow}3d, 0 0 0 1px ${plastic.shellHi}88 inset, 0 0.9rem 1.6rem ${plastic.inner}99 inset`,
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

  return (
    <div
      {...(interactive
        ? {
            role: 'button' as const,
            tabIndex: 0,
            onClick: onFlip,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onFlip?.();
              }
            },
            'aria-label': `Seite ${side.toUpperCase()} von ${label} — tippen für Seite ${isA ? 'B' : 'A'}`,
            'aria-disabled': !cassetteId,
          }
        : { 'aria-hidden': true })}
      className={`relative block w-full overflow-hidden rounded-xl px-3 pb-2.5 pt-3 text-left ${interactive ? 'cursor-pointer' : ''}`}
      style={{
        ...shellStyle,
        opacity: cassetteId ? 1 : 0.6,
        transition: flip?.transition,
        // Nur WAEHREND des Umdrehens tatsaechlich in einem 3D-Kontext
        // (rotateY) — im Ruhezustand 'none' statt 'rotateY(0deg)'.
        // Dauerhaft aktiver 3D-Transform + das backdrop-filter im
        // sticky Header darueber ist ein bekanntes WebKit/Blink-Repaint-
        // Problem: der Text-Layer bleibt nach einem Seitenwechsel manchmal
        // leer stehen, obwohl Rahmen/Hintergrund korrekt neu zeichnen.
        // 'none' im Ruhezustand nimmt den Browser aus diesem staendigen
        // 3D-Kontext raus. Die Vorschau ist nie im 3D-Kontext.
        transform: flip?.transform ?? 'none',
      }}
    >
      <Wear wear={wear} age={age} light={isA ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.32)'} />
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
            Mit dem Alter verblasst der Filzstift ein wenig. */}
        <div className="overflow-hidden px-3 pb-1" style={{ opacity: 1 - age * 0.012 }}>
          <div className="pt-2" style={{ borderBottom: `1px solid ${rule}` }}>
            <span className="font-hand block truncate pb-0.5 text-[1.25rem] leading-tight" style={{ color: ink }}>
              {label}
            </span>
          </div>
          <div className="pt-1.5" style={{ borderBottom: `1px solid ${rule}` }}>
            <span
              className="font-hand block truncate pb-0.5 text-[0.95rem] leading-tight opacity-70"
              style={{ color: ink }}
            >
              {/* Seite A zeigt den (ggf. umbenannten) Tape-Namen, Seite B
                  immer nur "Gruppenchat" — Tape-Namen sind ein Konzept
                  des Archivs, nicht des laufenden Gesprächs. */}
              {currentTape
                ? `${currentTape.dateLabel} · ${isA ? currentTape.fullName : SIDE_LABEL.b}`
                : `Seite ${side.toUpperCase()} · ${SIDE_LABEL[side]}`}
            </span>
          </div>
        </div>

        {/* Altern: Papier vergilbt von der Ecke her, die Kanten dunkeln nach,
            ab Stufe 4 hat es unten rechts ein Eselsohr (oben rechts stuende
            es auf der Tape-Nummer). Nur auf Seite A — das
            Etikett von Seite B ist Plastik, das vergilbt nicht. */}
        {isA && age > 0 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                `radial-gradient(130% 100% at 92% 8%, rgba(150,108,38,${0.022 * age}), rgba(150,108,38,0) 62%),` +
                `linear-gradient(180deg, rgba(150,108,38,${0.008 * age}), rgba(110,74,28,${0.02 * age}))`,
              boxShadow: `inset 0 0 ${2 + age}px rgba(90,60,20,${0.035 * age})`,
              mixBlendMode: 'multiply',
            }}
          />
        )}
        {isA && age >= 4 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 right-0"
            style={{
              width: 4 + age * 1.6,
              height: 4 + age * 1.6,
              background: `linear-gradient(315deg, ${type.shellDark} 0 50%, ${type.labelDeep} 50% 100%)`,
              boxShadow: '-1px -1px 2px rgba(0,0,0,.25)',
            }}
          />
        )}
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
        {/* Bandkorn: mit jeder Altersstufe etwas dichter. Zwei versetzte
            Raster, damit es nicht wie ein Gitter wirkt. */}
        {age > 0 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[3px]"
            style={{
              backgroundImage:
                'radial-gradient(rgba(255,255,255,.55) 0.5px, transparent 0.7px),' +
                'radial-gradient(rgba(0,0,0,.6) 0.6px, transparent 0.8px)',
              backgroundSize: '3px 5px, 7px 4px',
              backgroundPosition: '0 0, 2px 1px',
              opacity: 0.011 * age,
            }}
          />
        )}
        <ReelButton onClick={onScrollStart} label={isA ? 'Zurueck an den Bandanfang' : 'Zum Anfang des Gesprächs'}>
          <Reel r={reelLeft} tape={isA ? type.tape : plastic.shell} hub={isA ? type.hub : plastic.shellHi} />
        </ReelButton>
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
        <ReelButton onClick={onScrollEnd} label={isA ? 'Vor zum aktuellsten Stand' : 'Zum Ende des Gesprächs'}>
          <Reel r={reelRight} tape={isA ? type.tape : plastic.shell} hub={isA ? type.hub : plastic.shellHi} />
        </ReelButton>
      </div>

      {/* Nur ein kleines Zeichen statt Text+Balken — im normalen Fluss
          zwischen Fenster und Fuss platziert. */}
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
  );
}

/** Spulen-Taste: mit Handler ein echter <button>, sonst eine reine <span> —
 *  eine Vorschau ohne eigene Spul-Funktion soll kein eigenes Tipp-Ziel sein,
 *  das nur den umschliessenden Tippbereich stoeren wuerde. */
function ReelButton({
  onClick,
  label,
  children,
}: {
  onClick?: (e: React.MouseEvent) => void;
  label: string;
  children: React.ReactNode;
}) {
  if (!onClick) {
    return <span className="shrink-0">{children}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="shrink-0 rounded-full transition-transform active:scale-90"
    >
      {children}
    </button>
  );
}

/** Referenz-Breite, bei der CassetteFace ihre Masse (Reels, Etikett, Fuss —
 *  alles rem/px-basiert, nicht prozentual) natuerlich rendert. Fuer die
 *  Vorschau wird bei dieser Breite gezeichnet und dann per CSS-Transform auf
 *  die Zielgroesse herunterskaliert — deshalb ist der genaue Wert unkritisch,
 *  er muss nur gross genug sein, dass Reels/Badge nicht zusammenstossen. */
const FACE_REF_WIDTH = 400;
/** Grob gemessenes Seitenverhaeltnis bei der Referenzbreite (Breite/Hoehe) —
 *  legt nur die Groesse des Vorschau-Rahmens fest, damit kein Sprung
 *  entsteht, waehrend das eigentliche Bild laedt. */
const FACE_ASPECT = '400 / 258';

/**
 * Kleine, nicht-interaktive Vorschau der echten Kassette — exakt dieselbe
 * Zeichnung wie der grosse Kopf (CassetteFace), nur herunterskaliert statt
 * separat nachgebaut. Fuer das Kassetten-Symbol in der oberen Leiste
 * (App.tsx): zeigt beim Einklappen des Panels, welche Kassette gerade
 * eingelegt ist, mit echtem Etikett inklusive Logo, Bandsorte, Name und
 * Tape-Nummer — nicht nur einer vereinfachten Nachbildung.
 *
 * Die Spulen stehen auf "halb voll", da eine Vorschau keine eigene
 * Scroll-Position hat, an der sich ein Fuellstand ablesen liesse.
 */
export function CassetteFacePreview({
  side,
  cassetteId,
  pairIndex,
  label,
  count,
  currentTape,
  width,
  createdAt,
  age,
}: {
  side: Side;
  cassetteId: string | null;
  pairIndex?: number;
  label: string;
  count: number;
  currentTape?: { dateLabel: string; shortName: string; fullName: string } | null;
  width: number;
  /** Gruendung, fuer die Altersstufe. */
  createdAt?: number;
  /** Stufe direkt vorgeben — fuer die Vorschau "so altert das Band". */
  age?: number;
}) {
  const scale = width / FACE_REF_WIDTH;
  const mid = (R_MAX + R_MIN) / 2;
  // rounded-xl waere hier ein fixer 12px-Radius, gedacht fuer die grosse,
  // ~400px breite Kassette — auf einem 46-60px-Icon macht dieselben 12px
  // eine auffaellig runde Ecke statt der Kante, die MiniCassette & Co. mit
  // ihrem SVG-rx=3 (3/46 der Breite) zeigen. Deshalb hier proportional zur
  // Breite, im selben Verhaeltnis wie dort.
  const radius = width * (3 / 46);
  return (
    <div className="overflow-hidden" style={{ width, aspectRatio: FACE_ASPECT, borderRadius: radius }}>
      <div style={{ width: FACE_REF_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <CassetteFace
          side={side}
          cassetteId={cassetteId}
          pairIndex={pairIndex}
          label={label}
          count={count}
          currentTape={currentTape}
          age={age ?? (createdAt ? ageStageOf(createdAt) : 0)}
          reelLeft={mid}
          reelRight={mid}
        />
      </div>
    </div>
  );
}

/** Gebrauchsspuren: feine Kratzer und Staub, pro Kassette immer dieselben. */
function Wear({ wear, light, age = 0 }: { wear: CassetteLook['wear']; light: string; age?: number }) {
  const rubId = useId();
  // Mit dem Alter: pro Stufe ein Kratzer und drei Staubkoerner mehr.
  const scratches = [...wear.scratches, ...wear.extraScratches.slice(0, age)];
  const specks = [...wear.specks, ...wear.extraSpecks.slice(0, age * 3)];
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {scratches.map(([x, y, len], i) => (
        <line
          key={`s${i}`}
          x1={x}
          y1={y}
          x2={x + len}
          y2={y - len * 0.12}
          stroke={light}
          strokeWidth="0.35"
          opacity={0.5}
        />
      ))}
      {specks.map(([x, y, r], i) => (
        <circle key={`p${i}`} cx={x} cy={y} r={r * 0.35} fill={light} opacity={0.35} />
      ))}
      <rect x="0" y="0" width="100" height="100" fill="url(#scuff)" />
      {/* Abgegriffene Kanten: an den Ecken, wo man eine Kassette anfasst,
          wird das Plastik mit der Zeit heller und matter. */}
      {age > 0 &&
        [
          [0, 0],
          [100, 0],
          [0, 100],
          [100, 100],
        ].map(([cx, cy]) => (
          <circle
            key={`r${cx}${cy}`}
            cx={cx}
            cy={cy}
            r={10 + age * 1.6}
            fill={`url(#${rubId})`}
            opacity={Math.min(1, age * 0.11)}
          />
        ))}
      <defs>
        <radialGradient id="scuff" cx="50%" cy="50%" r="72%">
          <stop offset="70%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,.22)" />
        </radialGradient>
        <radialGradient id={rubId}>
          <stop offset="0%" stopColor={light} stopOpacity="0.55" />
          <stop offset="100%" stopColor={light} stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** Die vier Gehäuseschrauben. */
function Screws({ tint }: { tint: string }) {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      {['left-1.5 top-1.5', 'right-1.5 top-1.5', 'left-1.5 bottom-1.5', 'right-1.5 bottom-1.5'].map((pos) => (
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
          <rect
            key={deg}
            x="30.2"
            y="23"
            width="1.8"
            height="5"
            fill={tape}
            opacity="0.8"
            transform={`rotate(${deg} 31 31)`}
          />
        ))}
      </g>
    </svg>
  );
}
