import { useEffect, useRef, useState } from 'react';
import { useApp, SIDE_LABEL, type Side } from '@/store/appStore';
import { lookFor } from '@/lib/cassetteLook';
import Lockup from './Lockup';

interface Props {
  /** ID der eingelegten Kassette — bestimmt Bandsorte, Gehäusefarbe und Spuren. */
  cassetteId: string | null;
  /** Beschriftung des Klebebands — der Name der Runde. */
  label: string;
  count: number;
}

const R_MAX = 30;
const R_MIN = 12;
const LABEL_MAX = 128;
const LABEL_MIN = 52;
const FLIP_MS = 180;

/**
 * Der Kassetten-Header — gleichzeitig der Umschalter.
 *
 * Tippen dreht die Kassette um. Auf halbem Weg steht sie hochkant, dort wird
 * die Seite gewechselt — dadurch sieht man den Inhalt nie umklappen. Die Runde
 * bleibt dabei dieselbe: A und B gehoeren zur selben Kassette.
 *
 * Jedes Band hat ein eigenes, festes Aussehen (siehe lib/cassetteLook.ts):
 * Bandsorte, Gehaeusefarbe, Kratzer und ein schief aufgeklebtes Etikett.
 */
export default function CassetteHeader({ cassetteId, label, count }: Props) {
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
      setCollapse(Math.min(1, y / 160));
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

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  function flip() {
    if (flipping || !cassetteId) return;
    const next: Side = side === 'a' ? 'b' : 'a';

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSide(next);
      window.scrollTo({ top: 0 });
      return;
    }

    setFlipping(true);
    timer.current = window.setTimeout(() => {
      setSide(next);
      window.scrollTo({ top: 0 });
      setFlipping(false);
    }, FLIP_MS);
  }

  const look = lookFor(cassetteId ?? '');
  const { type, case: shell, wear } = look;
  const isA = side === 'a';

  const rLeft = R_MAX - (R_MAX - R_MIN) * progress;
  const rRight = R_MIN + (R_MAX - R_MIN) * progress;
  const labelH = LABEL_MAX - (LABEL_MAX - LABEL_MIN) * collapse;

  const shellStyle = isA
    ? {
        background: `linear-gradient(178deg, ${type.shellHi} 0%, ${type.shell} 22%, ${type.shellDark} 100%)`,
        boxShadow:
          '0 0.5rem 1.2rem rgba(0,0,0,.5), 0 1px 0 rgba(255,255,255,.13) inset, 0 -1px 0 rgba(0,0,0,.6) inset',
      }
    : {
        background:
          `radial-gradient(120% 80% at 18% 8%, rgba(255,255,255,.42), rgba(255,255,255,0) 46%),` +
          `radial-gradient(90% 70% at 82% 96%, ${shell.pcb}55, ${shell.pcb}00 55%),` +
          `linear-gradient(172deg, ${shell.shellHi}88 0%, ${shell.shell} 38%, ${shell.inner} 100%)`,
        boxShadow: `0 0.5rem 1.4rem ${shell.inner}99, 0 0 0 1px ${shell.shellHi}88 inset, 0 0.8rem 1.4rem ${shell.inner}99 inset`,
      };

  const paper = isA ? type.label : shell.inner;
  const paperDeep = isA ? type.labelDeep : shell.inner;
  const paperInk = isA ? type.ink : shell.ink;
  const accent = isA ? type.stripe : shell.glow;

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
          className="relative block w-full overflow-hidden rounded-xl p-3 text-left disabled:opacity-60"
          style={{
            ...shellStyle,
            transition: `transform ${FLIP_MS}ms ease-in-out, background 450ms ease`,
            transform: flipping ? 'rotateY(90deg)' : 'rotateY(0deg)',
          }}
        >
          <Wear wear={wear} light={isA ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.3)'} />

          {/* Kopfzeile des Gehaeuses */}
          <div
            className="relative flex items-center justify-between gap-2"
            style={{ color: isA ? '#B9AC93' : shell.ink }}
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <span style={{ '--ink': isA ? '#D9CDB4' : '#FFFFFF' } as React.CSSProperties}>
                <Lockup size="1.15rem" />
              </span>
              <span className="font-disp truncate text-[0.6rem] uppercase tracking-[0.16em] opacity-80">
                {isA ? type.name : shell.name}
              </span>
            </span>
            <span
              className="font-disp shrink-0 font-bold leading-none"
              style={{
                fontSize: '1.7rem',
                color: isA ? type.stripe : '#fff',
                textShadow: isA ? 'none' : `0 0 0.8rem ${shell.glow}`,
              }}
            >
              {side.toUpperCase()}
            </span>
          </div>

          {/* Etikett mit den beiden Spulen */}
          <div
            className="relative mt-2.5 flex items-center justify-around overflow-hidden rounded-sm px-4"
            style={{
              height: labelH,
              transition: 'height 200ms ease',
              background: `linear-gradient(180deg, ${paper}, ${paperDeep})`,
              boxShadow: isA
                ? '0 1px 3px rgba(0,0,0,.45) inset'
                : `0 0 0 1px ${shell.shellHi}55 inset`,
            }}
          >
            <Reel r={rLeft} tape={isA ? type.tape : shell.shell} hub={isA ? type.hub : shell.shellHi} ink={paperInk} />

            {/* Aufgeklebtes Etikett — sitzt nie ganz gerade */}
            <span
              className="relative mx-2 min-w-0 px-3 py-1.5 text-center"
              style={{
                opacity: 1 - collapse * 1.4,
                transform: `rotate(${wear.tilt}deg)`,
                background: isA ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.12)',
                boxShadow: `0 1px 2px rgba(0,0,0,.25), 0 0 0 1px ${isA ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.16)'} inset`,
              }}
            >
              {/* Klebestreifen-Kanten */}
              <i className="absolute inset-y-0 left-0 w-1.5" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,.12), transparent)' }} />
              <i className="absolute inset-y-0 right-0 w-1.5" style={{ background: 'linear-gradient(270deg, rgba(0,0,0,.12), transparent)' }} />
              <span className="font-hand block truncate text-[1.05rem] leading-tight" style={{ color: paperInk }}>
                {label}
              </span>
              <span className="font-mono block text-[0.56rem] uppercase tracking-[0.1em] opacity-60" style={{ color: paperInk }}>
                Seite {side.toUpperCase()} · {SIDE_LABEL[side]} · {count}
              </span>
            </span>

            <Reel r={rRight} tape={isA ? type.tape : shell.shell} hub={isA ? type.hub : shell.shellHi} ink={paperInk} />
          </div>

          {/* Kerben am unteren Rand, dazu der Hinweis zum Umdrehen */}
          <div className="relative mt-2.5 flex items-center gap-2">
            <span className="flex flex-1 gap-1.5">
              <i className="h-1 flex-1 rounded-[1px]" style={{ background: accent, opacity: 0.85 }} />
              <i className="h-1 flex-1 rounded-[1px]" style={{ background: isA ? '#6E6455' : shell.shellHi, opacity: 0.4 }} />
              <i className="h-1 flex-1 rounded-[1px]" style={{ background: isA ? '#6E6455' : shell.shellHi, opacity: 0.4 }} />
            </span>
            <span
              className="font-mono shrink-0 text-[0.52rem] uppercase tracking-[0.14em]"
              style={{ color: isA ? '#8C8272' : `${shell.ink}99` }}
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
function Wear({ wear, light }: { wear: ReturnType<typeof lookFor>['wear']; light: string }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {wear.scratches.map(([x, y, len], i) => (
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
      {wear.specks.map(([x, y, r], i) => (
        <circle key={`p${i}`} cx={x} cy={y} r={r * 0.35} fill={light} opacity={0.35} />
      ))}
      {/* abgegriffene Ecken */}
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

function Reel({ r, tape, hub, ink }: { r: number; tape: string; hub: string; ink: string }) {
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true" className="shrink-0">
      <circle cx="38" cy="38" r="34" fill="none" stroke={ink} strokeWidth="1" opacity="0.3" />
      {/* Bandwickel — der Radius ist der Fuellstand */}
      <circle cx="38" cy="38" r={r} fill={tape} />
      <circle cx="38" cy="38" r="11" fill={hub} />
      <g className="spin" style={{ transformOrigin: '38px 38px' }}>
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <rect key={deg} x="37" y="28" width="2.2" height="6.5" fill={ink} opacity="0.5" transform={`rotate(${deg} 38 38)`} />
        ))}
      </g>
    </svg>
  );
}
