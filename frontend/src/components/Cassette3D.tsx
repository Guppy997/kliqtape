import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { MARGIN_EM } from './tape3d/dims';
import type { Handle, Params } from './tape3d/engine';
import type { Side } from './tape3d/textures';

// three.js liegt in einem eigenen Paket und kommt erst, wenn die erste Kassette erscheint.
let engine: Promise<typeof import('./tape3d/engine')> | null = null;
const loadEngine = () => (engine ??= import('./tape3d/engine'));

/** "Bewegung reduzieren" im System: Spulen stehen, Umdrehen ohne Animation. */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}

/**
 * Weicher Uebergang zu einem Zielwert (zum Umdrehen). Ruhig wie im Rest der
 * App: ease-out, ohne Federn. Bei "Bewegung reduzieren" springt der Wert.
 */
export function useTween(target: number, ms = 650): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const current = useRef(target);
  useEffect(() => {
    if (reduce) {
      current.current = target;
      setValue(target);
      return;
    }
    from.current = current.current;
    const start = performance.now();
    let raf = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      current.current = from.current + (target - from.current) * eased;
      setValue(current.current);
      if (t < 1) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduce]);
  return value;
}

interface Props {
  cassetteId: string;
  /** Gewaehlte Bandsorte (Index in PAIRS), sonst aus der ID */
  pairIndex?: number;
  /** Welche Seite vorne liegt. */
  side?: Side;
  /** Rueckseite als echte zweite Seite (zum Umdrehen). Sonst gleiche Schale ohne Etikett. */
  withBack?: boolean;
  label: string;
  /** Zweite Zeile auf dem Etikett */
  sub?: string;
  /** Ecke rechts im Farbband, z. B. "Position 012" */
  corner?: string;
  /** Altersstufe 0..9 (ageStageOf) */
  age?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  spinning?: boolean;
  /** Weicher Schatten unter der Kassette. */
  ground?: boolean;
  /** Breite in px; alle Masse haengen daran (25em = Breite). */
  width: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Die Kassette als echter Gegenstand, gerendert mit WebGL (tape3d/, dasselbe
 * wie auf der Website): Gehaeuse aus Plastik mit Naht und Schrauben,
 * aufgeklebtes Papieretikett, vertiefte Scheibe, Bandwickel mit Glanz.
 * Ohne WebGL die flache Kassette.
 *
 * Bewusst nur dort, wo man Kassetten anschaut (Fach, Kassetten-Ansicht,
 * Farbauswahl). Im Feed und in den Leisten bleibt die kleine, ruhige Zeichnung.
 */
export default function Cassette3D({
  cassetteId,
  pairIndex,
  side = 'a',
  withBack = false,
  label,
  sub,
  corner = 'Position 000',
  age = 0,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  spinning = false,
  ground = false,
  width,
  className = '',
  style,
}: Props) {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handle = useRef<Handle | null>(null);
  const [mode, setMode] = useState<'loading' | '3d' | 'flat'>('loading');

  // Die Engine fragt die Werte erst beim Zeichnen ab, immer die aktuellen.
  const current = useRef<() => Params>(() => {
    throw new Error('noch nicht bereit');
  });
  useEffect(() => {
    current.current = () => ({
      cassetteId,
      pairIndex,
      age,
      front: side,
      withBack,
      label,
      sub,
      corner,
      rx: rotateX,
      ry: rotateY,
      rz: rotateZ,
      reel: 0.5,
      spinning: spinning && !reduce,
    });
    handle.current?.invalidate();
  }, [cassetteId, pairIndex, age, side, withBack, label, sub, corner, rotateX, rotateY, rotateZ, spinning, reduce]);

  useEffect(() => {
    let cancelled = false;
    loadEngine()
      .then((e) => {
        if (cancelled || !canvasRef.current) return;
        const h = e.supported()
          ? e.register(canvasRef.current, () => current.current(), {
              onFrame: () => setMode('3d'),
              onLost: () => setMode('flat'),
            })
          : null;
        if (h) handle.current = h;
        else setMode('flat');
      })
      .catch(() => {
        if (!cancelled) setMode('flat');
      });
    return () => {
      cancelled = true;
      handle.current?.dispose();
      handle.current = null;
    };
  }, []);

  // Ohne WebGL: flach, gedreht nur in der Ebene, mit der Seite, die gerade vorne waere.
  const flatSide: Side = Math.cos((rotateY * Math.PI) / 180) >= 0 || !withBack ? side : side === 'a' ? 'b' : 'a';
  useEffect(() => {
    if (mode !== 'flat') return;
    let cancelled = false;
    Promise.all([import('./tape3d/flat'), import('./tape3d/textures').then((m) => m.fontsReady())])
      .then(([{ drawFlat }]) => {
        const cv = canvasRef.current;
        if (cancelled || !cv) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.round(cv.clientWidth * dpr);
        cv.height = Math.round(cv.clientHeight * dpr);
        drawFlat(cv, {
          cassetteId,
          pairIndex,
          side: flatSide,
          label,
          sub: flatSide === side ? sub : undefined,
          corner,
          reel: 0.5,
          age,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mode, cassetteId, pairIndex, flatSide, side, label, sub, corner, age]);

  return (
    <div
      aria-hidden="true"
      className={`relative select-none ${className}`}
      style={{ width, height: width * (16 / 25), fontSize: width / 25, ...style }}
    >
      {ground && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: '8%',
            right: '8%',
            bottom: '-1.6em',
            height: '2.6em',
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(0,0,0,.55), rgba(0,0,0,0))',
            filter: 'blur(0.4em)',
            transform: `scaleX(${0.5 + 0.5 * Math.abs(Math.cos((rotateY * Math.PI) / 180))})`,
          }}
        />
      )}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute"
        style={{
          left: `-${MARGIN_EM}em`,
          top: `-${MARGIN_EM}em`,
          width: `calc(100% + ${2 * MARGIN_EM}em)`,
          height: `calc(100% + ${2 * MARGIN_EM}em)`,
          opacity: mode === 'loading' ? 0 : 1,
          transition: 'opacity 0.35s ease',
          transform: mode === 'flat' ? `rotate(${rotateZ}deg)` : undefined,
        }}
      />
    </div>
  );
}
