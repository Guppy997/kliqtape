import { useEffect, useRef, useState } from 'react';
import { useApp, SIDE_LABEL, type Side } from '@/store/appStore';
import Lockup from './Lockup';

interface Props {
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
 * Es gibt keine Schaltflaechen mehr: man tippt auf die Kassette, und sie dreht
 * sich um. Auf halbem Weg steht sie hochkant, dort wird die Seite gewechselt —
 * dadurch sieht man den Inhalt nie umklappen, sondern immer nur die neue Seite.
 *
 * Beim Scrollen faehrt das Etikett zusammen und die Spulen laufen mit: links
 * wird duenner, rechts dicker. Der endliche Feed ist so die ganze Zeit sichtbar.
 */
export default function CassetteHeader({ count }: Props) {
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
  }, [side, count]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  function flip() {
    if (flipping) return;
    const next: Side = side === 'a' ? 'b' : 'a';

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
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

  const rLeft = R_MAX - (R_MAX - R_MIN) * progress;
  const rRight = R_MIN + (R_MAX - R_MIN) * progress;
  const labelH = LABEL_MAX - (LABEL_MAX - LABEL_MIN) * collapse;
  const isA = side === 'a';

  return (
    <header
      className="sticky top-0 z-30 px-3 pb-2 pt-3"
      style={{ background: 'color-mix(in srgb, var(--screen) 90%, transparent)', backdropFilter: 'blur(6px)' }}
    >
      <div className="mx-auto max-w-xl" style={{ perspective: '900px' }}>
        <button
          type="button"
          onClick={flip}
          aria-label={`Seite ${side.toUpperCase()} — tippen für Seite ${isA ? 'B' : 'A'}`}
          className={`block w-full rounded-xl p-3 text-left ${isA ? 'cass-a' : 'cass-b'}`}
          style={{
            transition: `transform ${FLIP_MS}ms ease-in-out, background 450ms ease`,
            transform: flipping ? 'rotateY(90deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Kopfzeile des Gehaeuses */}
          <div
            className="flex items-center justify-between gap-2"
            style={{ color: isA ? '#B9AC93' : 'var(--color-b-ink)' }}
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <span style={{ '--ink': isA ? '#D9CDB4' : '#FFFFFF' } as React.CSSProperties}>
                <Lockup size="1.15rem" />
              </span>
              <span className="font-disp truncate text-[0.6rem] uppercase tracking-[0.16em] opacity-80">
                {isA ? 'Type I Normal' : 'Ende-zu-Ende'}
              </span>
            </span>
            <span
              className="font-disp shrink-0 font-bold leading-none"
              style={{
                fontSize: '1.7rem',
                color: isA ? 'var(--color-a-stripe)' : '#fff',
                textShadow: isA ? 'none' : '0 0 0.8rem var(--color-b-glow)',
              }}
            >
              {side.toUpperCase()}
            </span>
          </div>

          {/* Etikett mit den beiden Spulen */}
          <div
            className={`mt-2.5 flex items-center justify-around overflow-hidden rounded-sm px-4 ${isA ? 'label-a' : 'label-b'}`}
            style={{ height: labelH, transition: 'height 200ms ease' }}
          >
            <Reel r={rLeft} side={side} />
            <div
              className="font-hand min-w-0 px-2 text-center leading-tight"
              style={{
                opacity: 1 - collapse * 1.4,
                fontSize: '1.05rem',
                color: isA ? '#3B3226' : '#E9DCFF',
                textShadow: isA ? 'none' : '0 0 0.5rem rgba(169,124,232,.8)',
              }}
            >
              {SIDE_LABEL[side]}
              <br />
              <span className="text-[0.85rem] opacity-70">— {count} —</span>
            </div>
            <Reel r={rRight} side={side} />
          </div>

          {/* Kerben am unteren Rand, dazu der Hinweis zum Umdrehen */}
          <div className="mt-2.5 flex items-center gap-2">
            <span className="flex flex-1 gap-1.5">
              <i className="h-1 flex-1 rounded-[1px]" style={{ background: 'var(--accent)', opacity: 0.85 }} />
              <i className="h-1 flex-1 rounded-[1px]" style={{ background: isA ? '#6E6455' : 'rgba(233,220,255,.35)', opacity: 0.5 }} />
              <i className="h-1 flex-1 rounded-[1px]" style={{ background: isA ? '#6E6455' : 'rgba(233,220,255,.35)', opacity: 0.5 }} />
            </span>
            <span
              className="font-mono shrink-0 text-[0.52rem] uppercase tracking-[0.14em]"
              style={{ color: isA ? '#8C8272' : 'rgba(233,220,255,.6)' }}
            >
              ↻ umdrehen
            </span>
          </div>
        </button>
      </div>
    </header>
  );
}

function Reel({ r, side }: { r: number; side: Side }) {
  const tape = side === 'a' ? '#5C3A21' : 'rgba(107,74,158,.9)';
  const hub = side === 'a' ? '#F0E9D8' : 'rgba(233,220,255,.92)';
  const rim = side === 'a' ? 'rgba(0,0,0,.32)' : 'rgba(201,175,239,.45)';
  const spoke = side === 'a' ? '#8E8471' : '#6A4E96';

  return (
    <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true" className="shrink-0">
      <circle cx="38" cy="38" r="34" fill="none" stroke={rim} strokeWidth="1" />
      {/* Bandwickel — der Radius ist der Fuellstand */}
      <circle cx="38" cy="38" r={r} fill={tape} />
      <circle cx="38" cy="38" r="11" fill={hub} />
      <g className="spin" style={{ transformOrigin: '38px 38px' }}>
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <rect key={deg} x="37" y="28" width="2.2" height="6.5" fill={spoke} transform={`rotate(${deg} 38 38)`} />
        ))}
      </g>
    </svg>
  );
}
