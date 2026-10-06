import { useEffect, useRef, useState } from 'react';
import { TapeDeck } from '@/lib/tapeAudio';

interface Props {
  src: string;
  /** Bekannte Laenge in ms, falls das Backend sie kennt (fuer die Anzeige vor dem Laden). */
  hintMs?: number | null;
}

const fmt = (s: number) => {
  const total = Math.max(0, Math.round(s));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Abspieler fuer Mixtapes.
 *
 * Ziehen am Band spult vor und zurueck — und macht dabei das Geraeusch, das
 * eine echte Kassette macht. Die Logik dafuer sitzt in TapeDeck; hier geht es
 * nur um Zeigerposition und Bedienung.
 */
export default function TapePlayer({ src, hintMs }: Props) {
  const deckRef = useRef<TapeDeck | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const lastPos = useRef(0);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState((hintMs ?? 0) / 1000);
  const [error, setError] = useState<string | null>(null);

  // Laufender Zeiger waehrend der Wiedergabe.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const d = deckRef.current;
      if (d) setPos(d.position());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => () => deckRef.current?.dispose(), []);

  async function ensureLoaded(): Promise<TapeDeck | null> {
    if (deckRef.current) return deckRef.current;
    try {
      const deck = new TapeDeck();
      await deck.load(src);
      deckRef.current = deck;
      setDur(deck.duration);
      setReady(true);
      return deck;
    } catch {
      setError('Aufnahme lässt sich nicht abspielen');
      return null;
    }
  }

  async function toggle() {
    const deck = await ensureLoaded();
    if (!deck) return;
    if (deck.playing) {
      deck.pause();
      setPlaying(false);
      setPos(deck.position());
    } else {
      deck.play(() => {
        setPlaying(false);
        setPos(0);
      });
      setPlaying(true);
    }
  }

  function posFromEvent(clientX: number): number {
    const el = trackRef.current;
    const deck = deckRef.current;
    if (!el || !deck) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * deck.duration;
  }

  async function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const deck = await ensureLoaded();
    if (!deck) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setPlaying(false);
    lastPos.current = deck.position();
    const target = posFromEvent(e.clientX);
    deck.scrub(target, target - lastPos.current);
    lastPos.current = target;
    setPos(target);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const deck = deckRef.current;
    if (!deck || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const target = posFromEvent(e.clientX);
    deck.scrub(target, target - lastPos.current);
    lastPos.current = target;
    setPos(target);
  }

  const ratio = dur > 0 ? Math.min(1, pos / dur) : 0;

  if (error) {
    return (
      <p className="font-mono text-[0.7rem]" style={{ color: 'var(--dim)' }}>
        {error}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Abspielen'}
        className="grid size-10 shrink-0 place-items-center rounded-full transition-transform active:scale-95"
        style={{ background: 'var(--accent)', color: '#17130E' }}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <rect x="2" y="1" width="4" height="12" rx="1" />
            <rect x="8" y="1" width="4" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <path d="M2 1l11 6-11 6z" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Band spulen"
          aria-valuemin={0}
          aria-valuemax={Math.round(dur)}
          aria-valuenow={Math.round(pos)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onKeyDown={async (e) => {
            const step = e.key === 'ArrowLeft' ? -2 : e.key === 'ArrowRight' ? 2 : 0;
            if (!step) return;
            e.preventDefault();
            const deck = await ensureLoaded();
            if (!deck) return;
            const t = Math.max(0, Math.min(deck.duration, deck.position() + step));
            deck.scrub(t, step / 8);
            setPos(t);
          }}
          className="relative h-8 cursor-ew-resize touch-none select-none rounded"
          style={{ background: 'rgba(0,0,0,.28)' }}
        >
          {/* Das Band selbst */}
          <div
            className="absolute inset-y-3 left-0 rounded-full"
            style={{ width: `${ratio * 100}%`, background: 'var(--accent)', opacity: 0.85 }}
          />
          {/* Tonkopf */}
          <div
            className="absolute inset-y-1 w-0.5 rounded"
            style={{ left: `calc(${ratio * 100}% - 1px)`, background: 'var(--ink)' }}
          />
        </div>
        <div
          className="mt-1 flex justify-between font-mono text-[0.62rem] tabular-nums"
          style={{ color: 'var(--dim)' }}
        >
          <span>{fmt(pos)}</span>
          <span>{ready ? fmt(dur) : '—:—'}</span>
        </div>
      </div>
    </div>
  );
}
