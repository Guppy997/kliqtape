import { useEffect, useRef, useState } from 'react';
import { mediaUrl, type FeedItem } from '@/lib/api';
import AnsweringMachine from './AnsweringMachine';
import Composer from './Composer';
import HotlineComposer from './HotlineComposer';

interface Props {
  items: FeedItem[];
  onPosted: () => void;
}

/**
 * Untere Leiste als Laufwerk eines Kassettenrekorders.
 *
 * Jede Taste tut etwas Echtes — dekorative Knoepfe waeren das Gegenteil von
 * dem, was diese App sein will:
 *   ◀◀  an den Bandanfang (aeltester Beitrag)
 *   ▶/⏸ Walkman: alle Mixtapes dieser Seite am Stueck abspielen
 *   ●   aufnehmen
 *   ▶▶  ans Bandende (neuester Beitrag)
 */
export default function BottomBar({ items, onPosted }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  // Der Walkman spielt O-Töne — die Sprachaufnahmen dieser Seite, am Stück.
  const tapes = items.filter((i) => i.kind === 'voice' && i.mediaId);
  const current = track != null ? tapes[track] : undefined;

  // Beim Seitenwechsel oder wenn Aufnahmen verschwinden: Laufwerk anhalten.
  useEffect(() => {
    if (track != null && !tapes[track]) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setTrack(null);
    setPaused(false);
  }

  function playIndex(i: number) {
    audioRef.current?.pause();
    const item = tapes[i];
    if (!item?.mediaId) return stop();

    const audio = new Audio(mediaUrl(item.mediaId));
    audio.onended = () => {
      if (i + 1 < tapes.length) playIndex(i + 1);
      else stop();
    };
    audio.onerror = () => stop();
    void audio.play().catch(() => stop());

    audioRef.current = audio;
    setTrack(i);
    setPaused(false);
  }

  function togglePlay() {
    if (track == null) {
      if (tapes.length > 0) playIndex(0);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setPaused(false);
    } else {
      audio.pause();
      setPaused(true);
    }
  }

  const scrollTo = (top: number) => window.scrollTo({ top, behavior: 'smooth' });

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-6"
      style={{ background: 'linear-gradient(to top, var(--screen) 62%, transparent)' }}
    >
      {/* Laufanzeige, nur wenn der Walkman laeuft */}
      {current && (
        <div
          className="font-mono mx-auto mb-2 flex max-w-xl items-center gap-2 rounded-lg px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.1em]"
          style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--dim)' }}
        >
          <span style={{ color: 'var(--accent)' }}>{paused ? '❚❚' : '▶'}</span>
          <span className="truncate">
            {current.track} · {current.author}
            {current.body ? ` · ${current.body}` : ''}
          </span>
          <button type="button" onClick={stop} className="ml-auto shrink-0" aria-label="Walkman beenden">
            ■
          </button>
        </div>
      )}

      <div className="mx-auto grid max-w-xl grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div className="flex items-end gap-1.5 justify-self-start">
          <AnsweringMachine />
          {/* Zaehlwerk sitzt jetzt hier bei der Lampe: beide sagen "was ist
              gerade los", das eine als Zahl, das andere als Signal. Bleibt
              beim Scrollen sichtbar, anders als die Laufzeile oben. */}
          <span
            className="font-mono grid h-7 min-w-[2.1rem] place-items-center rounded-[3px] px-1 text-[0.66rem] tabular-nums"
            style={{
              background: 'linear-gradient(180deg, #211E1A, #141210)',
              color: 'var(--accent)',
              boxShadow: '0 1px 2px rgba(0,0,0,.5) inset',
            }}
          >
            {String(items.length).padStart(3, '0')}
          </span>
          <DeckKey label="An den Bandanfang" onClick={() => scrollTo(0)}>
            <svg width="15" height="12" viewBox="0 0 15 12" fill="currentColor" aria-hidden="true">
              <path d="M7 0v12L0 6zM14 0v12L7 6z" />
            </svg>
          </DeckKey>
          <DeckKey
            label={track == null ? 'Alle Mixtapes abspielen' : paused ? 'Weiter' : 'Pause'}
            onClick={togglePlay}
            disabled={tapes.length === 0}
            active={track != null && !paused}
          >
            {track != null && !paused ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                <rect x="1" y="0" width="3.5" height="12" rx="0.6" />
                <rect x="7.5" y="0" width="3.5" height="12" rx="0.6" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                <path d="M1 0l10 6-10 6z" />
              </svg>
            )}
          </DeckKey>
          {/* Klassische Tapedeck-Reihe: Rueck-, Play-, Vorlauf nebeneinander,
              statt ueber die Leiste verteilt. */}
          <DeckKey
            label="Ans Bandende"
            onClick={() => scrollTo(document.documentElement.scrollHeight)}
          >
            <svg width="15" height="12" viewBox="0 0 15 12" fill="currentColor" aria-hidden="true">
              <path d="M8 0v12l7-6zM1 0v12l7-6z" />
            </svg>
          </DeckKey>
        </div>

        <Composer onPosted={onPosted} />

        <div className="flex items-end justify-self-end">
          <HotlineComposer />
        </div>
      </div>
    </div>
  );
}

function DeckKey({
  children,
  label,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-md transition-transform active:translate-y-px disabled:opacity-35"
      style={{
        // Klaviertasten-Optik wie an einem Rekorder: leichte Kante oben, Schatten unten.
        background: active ? 'var(--accent)' : 'linear-gradient(180deg, #35302A, #1E1B17)',
        color: active ? '#17130E' : 'var(--ink)',
        boxShadow: '0 2px 0 rgba(0,0,0,.45), 0 1px 0 rgba(255,255,255,.1) inset',
      }}
    >
      {children}
    </button>
  );
}
