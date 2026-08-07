import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      setCollapse(Math.min(1, y / 150));
      setProgress(max > 60 ? Math.min(1, y / max) : 0);
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

  // Seiten-/Kassettenwechsel soll IMMER aufgeklappt und oben starten — sonst
  // bliebe das Beschriftungsfeld bei einem lang gewachsenen Band fuer immer
  // eingeklappt, sobald man einmal tief gescrollt hatte. useLayoutEffect statt
  // useEffect UND getrennt von flip(): der Aufruf muss erst laufen, NACHDEM
  // React den Inhalt der neuen Seite/Kassette schon ins DOM committed hat —
  // vorher gerufen, kann der Browser das Scrollen-auf-0 durch "scroll
  // anchoring" beim anschliessenden Content-Wechsel wieder rueckgaengig machen.
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
          `repeating-linear-gradient(180deg, rgba(255,255,255,.035) 0 1px, rgba(0,0,0,0) 1px 5px),` +
          `linear-gradient(178deg, ${type.shellHi} 0%, ${type.shell} 26%, ${type.shellDark} 100%)`,
        boxShadow:
          '0 0.5rem 1.2rem rgba(0,0,0,.5), 0 1px 0 rgba(255,255,255,.14) inset, 0 -1px 0 rgba(0,0,0,.6) inset',
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
          `repeating-linear-gradient(180deg, rgba(255,255,255,.05) 0 1px, rgba(0,0,0,0) 1px 5px),` +
          `radial-gradient(120% 80% at 18% 6%, rgba(255,255,255,.45), rgba(255,255,255,0) 46%),` +
          `radial-gradient(90% 70% at 84% 96%, ${plastic.pcb}55, ${plastic.pcb}00 55%),` +
          `linear-gradient(172deg, ${plastic.shellHi}99 0%, ${plastic.shell} 40%, ${plastic.inner} 100%)`,
        boxShadow: `0 0.5rem 1.4rem ${plastic.inner}aa, 0 0 0 1px ${plastic.shellHi}88 inset, 0 0.9rem 1.6rem ${plastic.inner}99 inset`,
      };

  const paper = isA ? type.label : `${plastic.inner}dd`;
  const paperDeep = isA ? type.labelDeep : `${plastic.inner}f2`;
  const ink = isA ? type.ink : plastic.ink;
  const rule = isA ? type.rule : `${plastic.shellHi}55`;
  const band = isA ? type.stripe : plastic.shell;
  const bandInk = isA ? type.stripeInk : plastic.ink;
  const windowBg = isA ? type.shellDark : plastic.inner;

  return (
    <header
      className="sticky top-0 z-30 px-3 pb-2 pt-3"
      style={{ background: 'color-mix(in srgb, var(--screen) 90%, transparent)', backdropFilter: 'blur(6px)' }}
    >
      <div className="mx-auto max-w-xl" style={{ perspective: '900px' }}>
        <button
          type="button"
          onClick={flip}
          disabled={!cassetteId}
          aria-label={`Seite ${side.toUpperCase()} von ${label} — tippen für Seite ${isA ? 'B' : 'A'}`}
          className="relative block w-full overflow-hidden rounded-xl px-3 pb-2.5 pt-3 text-left disabled:opacity-60"
          style={{
            ...shellStyle,
            transition: `transform ${FLIP_MS}ms ease-in-out, background-image 450ms ease`,
            transform: flipping ? 'rotateY(90deg)' : 'rotateY(0deg)',
          }}
        >
          <Wear wear={wear} light={isA ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.32)'} />
          <Screws tint={isA ? 'rgba(0,0,0,.35)' : `${plastic.inner}88`} />

          {/* ---- Aufgeklebtes Etikett ------------------------------------ */}
          <div
            className="relative overflow-hidden rounded-[2px]"
            style={{
              transform: `rotate(${wear.tilt}deg)`,
              background: `linear-gradient(180deg, ${paper}, ${paperDeep})`,
              boxShadow: isA
                ? '0 1px 3px rgba(0,0,0,.5), 0 0 0 1px rgba(0,0,0,.12)'
                : `0 1px 3px rgba(0,0,0,.5), 0 0 0 1px ${plastic.shellHi}44`,
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

            {/* Beschriftungsfeld mit Linien — hier steht der Name der Runde */}
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

          {/* ---- Sichtfenster mit den Spulen ------------------------------ */}
          <div
            className="relative mt-2.5 flex items-center justify-around rounded-[3px] px-4 py-1"
            style={{
              background: windowBg,
              boxShadow: `0 1px 0 rgba(255,255,255,.09), 0 2px 6px rgba(0,0,0,.5) inset`,
            }}
          >
            <Reel r={rLeft} tape={isA ? type.tape : plastic.shell} hub={isA ? type.hub : plastic.shellHi} />
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
            <Reel r={rRight} tape={isA ? type.tape : plastic.shell} hub={isA ? type.hub : plastic.shellHi} />
          </div>

          {/* ---- Kerben am unteren Rand ----------------------------------- */}
          <div className="relative mt-2 flex items-center gap-2">
            <span className="flex flex-1 gap-1.5">
              <i className="h-1 flex-1 rounded-[1px]" style={{ background: isA ? type.stripe : plastic.glow, opacity: 0.85 }} />
              <i className="h-1 flex-1 rounded-[1px]" style={{ background: isA ? type.shellHi : plastic.shellHi, opacity: 0.45 }} />
              <i className="h-1 flex-1 rounded-[1px]" style={{ background: isA ? type.shellHi : plastic.shellHi, opacity: 0.45 }} />
            </span>
            <span
              className="font-mono shrink-0 text-[0.52rem] uppercase tracking-[0.14em]"
              style={{ color: isA ? '#8C8272' : `${plastic.ink}99` }}
            >
              ↻ umdrehen
            </span>
          </div>
        </button>
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

function Reel({ r, tape, hub }: { r: number; tape: string; hub: string }) {
  return (
    <svg width="62" height="62" viewBox="0 0 62 62" aria-hidden="true" className="shrink-0">
      {/* Bandwickel — der Radius ist der Fuellstand */}
      <circle cx="31" cy="31" r={r} fill={tape} />
      <circle cx="31" cy="31" r="9" fill={hub} />
      <g className="spin" style={{ transformOrigin: '31px 31px' }}>
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <rect key={deg} x="30.2" y="23" width="1.8" height="5" fill={tape} opacity="0.8"
                transform={`rotate(${deg} 31 31)`} />
        ))}
      </g>
    </svg>
  );
}
