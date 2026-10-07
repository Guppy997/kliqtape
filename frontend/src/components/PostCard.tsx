import { useEffect, useRef, useState } from 'react';
import { fetchTonfetzen, mediaUrl, sendTonfetzen, uploadMedia, type FeedItem, type Tonfetzen } from '@/lib/api';
import { berlinTimeLabel, filmStampLabel, takenLabel } from '@/lib/berlinDay';
import { baseMime, pickAudioMime } from '@/lib/tapeAudio';
import { useApp, type Side } from '@/store/appStore';
import { useQuote } from '@/store/quoteStore';
import Avatar from './Avatar';
import ReportForm from './ReportForm';
import Sheet from './Sheet';
import TapePlayer from './TapePlayer';
import TapeView from './TapeView';
import Zettel from './Zettel';

interface Props {
  item: FeedItem;
  onReacted: () => void;
  onDelete: (id: string) => void;
}

export default function PostCard({ item, onReacted, onDelete }: Props) {
  const me = useApp((s) => s.me);
  const setSide = useApp((s) => s.setSide);
  const setPendingQuote = useQuote((s) => s.setPending);
  const [openTape, setOpenTape] = useState(false);
  const [listening, setListening] = useState(false);
  const [reporting, setReporting] = useState(false);
  const side = item.side;
  const mine = item.author === me;

  async function sendReaction(blob: Blob, ms: number) {
    const mediaId = await uploadMedia(blob, ms);
    await sendTonfetzen(item.id, me, mediaId);
    onReacted();
  }

  // Bruecke zu Seite B: den Beitrag als Zitat anheften und rueberklappen —
  // der Composer dort greift die Vorschau aus dem Store direkt ab, keine
  // Nachfrage noetig. Nur auf Seite A sinnvoll, siehe backend/src/routes/posts.ts (nur
  // Seite-A-Beitraege lassen sich aufgreifen).
  function reactInChat() {
    setPendingQuote({ postId: item.id, author: item.author, kind: item.kind, body: item.body, mediaId: item.mediaId });
    setSide('b');
  }

  return (
    <article
      id={`post-${item.id}`}
      // scroll-mt: App.tsx springt beim Ankommen zum ersten ungesehenen
      // Beitrag. Ohne diesen Abstand landet der genau unter der klebenden
      // Bedienzeile und ist halb verdeckt.
      // Kein Kartenrahmen mehr: der Abzug, der Zettel ist das Material und
      // liegt frei auf der Flaeche — die Bedienung drumherum bleibt leise.
      className="rise scroll-mt-[calc(3.5rem+env(safe-area-inset-top))] py-2"
    >
      <div className="flex items-center gap-2.5">
        <Avatar name={item.author} side={side} size={1.75} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
            {item.author}
          </span>
          {/* Track-Nummer und Uhrzeit — das Datum steht schon im Tape-Kopf
              darueber. Die Art nur, wenn sie besonders ist. */}
          <span className="block text-2xs leading-tight" style={{ color: 'var(--dim)' }}>
            <span className="font-mono tabular-nums">
              {item.track} · {berlinTimeLabel(item.created_at)}
            </span>
            {item.source === 'film' && ' · Film'}
            {item.source === 'imposter' && ' · Imposter-Woche'}
          </span>
        </span>
        <PostMenu mine={mine} onDelete={() => onDelete(item.id)} onReport={() => setReporting(true)} />
      </div>

      <div className="mt-2.5 flex flex-col gap-2.5">
        {item.kind === 'text' && item.source !== 'imposter' && (
          <Zettel id={item.id} style={item.noteStyle} text={item.body} />
        )}

        {/* Live aufgenommen: Fotoabzug mit weissem Rand und Filzstiftzeile.
            Aus der Galerie: schlichter Rahmen, gedruckte Bildunterschrift.
            Kein Verbot — aber man sieht, was gerade passiert ist und was nicht. */}
        {/* Imposter-Woche: wie ein Abzug, nach der Aufloesung mit Stempel
            auf dem Bild der Person, die nur den Hinweis hatte. */}
        {item.source === 'imposter' && (
          <div className="print relative mx-auto w-full max-w-[17rem]">
            {item.mediaId ? (
              <img src={mediaUrl(item.mediaId)} alt={item.body || 'Imposter-Beitrag'} loading="lazy" />
            ) : (
              <p className="font-hand grid min-h-[8rem] place-items-center px-3 text-center text-[1.15rem] text-[#3B3226]">
                {item.body}
              </p>
            )}
            {item.mediaId && item.body && (
              <p className="font-hand mt-2 text-center text-[0.95rem] text-[#3B3226]">{item.body}</p>
            )}
            {item.imposterMark === 'imposter' && (
              <span
                className="font-disp absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded border-2 px-2 py-0.5 text-base font-bold uppercase tracking-[0.16em]"
                style={{ borderColor: '#C8402A', color: '#C8402A', background: 'rgba(236,229,214,.55)' }}
              >
                Imposter
              </span>
            )}
            <p className="mt-1 text-center text-2xs text-[#3B3226]/60">Imposter-Woche</p>
          </div>
        )}

        {item.kind === 'photo' && item.mediaId && item.source === 'camera' && (
          <div className="print mx-auto w-full max-w-[17rem]">
            <img src={mediaUrl(item.mediaId)} alt={item.body || 'Schnappschuss'} loading="lazy" />
            {item.body && <p className="font-hand mt-2 text-center text-[0.95rem] text-[#3B3226]">{item.body}</p>}
          </div>
        )}

        {/* Entwickelter Film: Abzug mit dem orangen Datumsaufdruck einer
            Einwegkamera — das Datum der Belichtung, nicht der Freigabe. */}
        {item.kind === 'photo' && item.mediaId && item.source === 'film' && (
          <div className="print mx-auto w-full max-w-[17rem]">
            <div className="relative">
              <img src={mediaUrl(item.mediaId)} alt={item.body || 'Filmbild'} loading="lazy" />
              {item.takenAt && (
                <span
                  className="font-mono absolute bottom-1.5 right-2 text-[0.7rem] font-bold tracking-[0.12em]"
                  style={{ color: '#FF9A3C', textShadow: '0 0 4px rgba(255,120,30,.7)' }}
                >
                  {filmStampLabel(item.takenAt)}
                </span>
              )}
            </div>
            {item.body && <p className="font-hand mt-2 text-center text-[0.95rem] text-[#3B3226]">{item.body}</p>}
            <p className="mt-1 text-center text-2xs text-[#3B3226]/60">
              Film{item.takenAt ? ` · belichtet ${takenLabel(item.takenAt)}` : ''}
            </p>
          </div>
        )}

        {item.kind === 'photo' && item.mediaId && item.source === 'upload' && (
          <figure className="mx-auto w-full max-w-[17rem]">
            <img
              src={mediaUrl(item.mediaId)}
              alt={item.body || 'Bild'}
              loading="lazy"
              className="w-full rounded-lg"
              style={{ border: '1px solid var(--line)' }}
            />
            <figcaption className="mt-1.5 flex items-baseline gap-2">
              <span className="shrink-0 text-2xs" style={{ color: 'var(--dim)' }}>
                Galerie
              </span>
              {item.body && (
                <span className="min-w-0 flex-1 text-meta" style={{ color: 'var(--dim)' }}>
                  {item.body}
                </span>
              )}
            </figcaption>
          </figure>
        )}

        {item.kind === 'video' && item.mediaId && (
          <div className="print mx-auto w-full max-w-[17rem]">
            <video src={mediaUrl(item.mediaId)} controls playsInline preload="metadata" />
            {item.body && <p className="font-hand mt-2 text-center text-[0.95rem] text-[#3B3226]">{item.body}</p>}
          </div>
        )}

        {item.kind === 'voice' && item.mediaId && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,.2)', border: '1px solid var(--line)' }}>
            {item.body && (
              <p className="mb-2 text-sm" style={{ color: 'var(--ink)' }}>
                {item.body}
              </p>
            )}
            <TapePlayer src={mediaUrl(item.mediaId)} hintMs={item.durationMs} />
          </div>
        )}

        {item.kind === 'tape' && item.tape && (
          <button
            type="button"
            onClick={() => setOpenTape(true)}
            className="flex items-center gap-3 rounded-lg p-2.5 text-left"
            style={{ background: 'rgba(0,0,0,.2)', border: '1px solid var(--line)' }}
          >
            <span
              className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg"
              style={{ background: '#D8CFBB' }}
            >
              {item.tape.coverId ? (
                <img src={mediaUrl(item.tape.coverId)} alt="" className="size-full object-cover" />
              ) : (
                <span className="font-hand text-xl text-[#3B3226]">♪</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-hand block truncate text-[1.05rem]" style={{ color: 'var(--ink)' }}>
                {item.tape.title}
              </span>
              <span className="block text-2xs" style={{ color: 'var(--dim)' }}>
                {item.tape.trackCount} Titel · Tracklist ansehen
              </span>
            </span>
            <span className="shrink-0 text-2xs" style={{ color: 'var(--accent)' }}>
              ▸
            </span>
          </button>
        )}
      </div>

      {/* Tonfetzen ersetzt "da war ich": statt eines oeffentlichen Zaehlers eine
          private, 3 Sekunden kurze Sprachreaktion. Halten statt Seitenwechsel
          — die Geste bleibt auf der Karte, keine eigene Seite dafuer. Nur die
          postende Person erfaehrt, dass — und kann anhoeren, wer. */}
      <div className="mt-2 flex items-center gap-1">
        {!mine && <TonfetzenButton disabled={item.iSentTonfetzen} onSend={sendReaction} />}

        {mine && item.tonfetzenCount > 0 && (
          <IconButton label={`${item.tonfetzenCount} Tonfetzen anhören`} onClick={() => setListening(true)} accent>
            <HeadphonesIcon />
            <span className="font-mono text-2xs tabular-nums">{item.tonfetzenCount}</span>
          </IconButton>
        )}

        {/* Nur auf Seite A — klappt zu Seite B und haengt den Beitrag dort
            als Zitat an. Fuer alle da, auch fuer eigene Beitraege. */}
        {side === 'a' && (
          <IconButton label="Im Gruppenchat darauf eingehen" onClick={reactInChat}>
            <ChatIcon />
          </IconButton>
        )}
      </div>

      <Sheet open={reporting} onClose={() => setReporting(false)} title="Beitrag melden">
        {reporting && (
          <ReportForm
            target={{ postId: item.id }}
            what={`diesen Beitrag von ${item.author}`}
            onDone={() => setReporting(false)}
          />
        )}
      </Sheet>

      <Sheet open={openTape} onClose={() => setOpenTape(false)} title={`Mixtape von ${item.author}`}>
        {openTape && item.tapeId && <TapeView id={item.tapeId} />}
      </Sheet>

      {/* Nur fuer die eigene Person erreichbar (mine), aber der Server prueft
          das ohnehin nochmal — siehe fetchTonfetzen. */}
      <Sheet open={listening} onClose={() => setListening(false)} variant="full" title="Tonfetzen">
        {listening && <TonfetzenPlayer postId={item.id} me={me} side={side} />}
      </Sheet>
    </article>
  );
}

const TONFETZEN_MAX_MS = 3_000;
const TONFETZEN_MIN_MS = 350; // kuerzer ist ein versehentliches Antippen, kein Tonfetzen

/**
 * Halten für einen Tonfetzen — kein Sheet, keine eigene Seite. Die Aufnahme
 * passiert direkt am Knopf, wie eine Sprachnachricht: drücken, halten,
 * loslassen, fertig. Kein Vorhoeren, kein Bestaetigen — das waere fuer eine
 * spontane, 3 Sekunden kurze Geste zu viel Umstand.
 */
function TonfetzenButton({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (blob: Blob, ms: number) => Promise<void>;
}) {
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);

  const [state, setState] = useState<'idle' | 'holding' | 'sending' | 'error'>('idle');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (state !== 'holding') return;
    const id = window.setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      if (ms >= TONFETZEN_MAX_MS) stop();
    }, 60);
    return () => window.clearInterval(id);
  }, [state]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function start() {
    if (disabled || state !== 'idle') return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('kein Mikro');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const mime = pickAudioMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const ms = Math.min(TONFETZEN_MAX_MS, Date.now() - startedAt.current);
        if (ms < TONFETZEN_MIN_MS) {
          setState('idle');
          setElapsed(0);
          return;
        }
        const type = baseMime(rec.mimeType || mime || 'audio/webm');
        const blob = new Blob(chunks.current, { type });
        setState('sending');
        try {
          await onSend(blob, ms);
          setState('idle');
        } catch {
          setState('error');
          window.setTimeout(() => setState('idle'), 1500);
        }
        setElapsed(0);
      };

      rec.start(100);
      recRef.current = rec;
      startedAt.current = Date.now();
      setElapsed(0);
      setState('holding');
    } catch {
      setState('error');
      window.setTimeout(() => setState('idle'), 1500);
    }
  }

  function stop() {
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    recRef.current = null;
  }

  const pct = Math.min(1, elapsed / TONFETZEN_MAX_MS);
  const r = 16;
  const c = 2 * Math.PI * r;
  const label = disabled
    ? 'Tonfetzen geschickt'
    : state === 'sending'
      ? 'Tonfetzen wird geschickt'
      : state === 'error'
        ? 'Kein Mikrofon'
        : 'Gedrückt halten für einen Tonfetzen';

  return (
    <button
      type="button"
      disabled={disabled || state === 'sending'}
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        void start();
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        stop();
      }}
      onPointerLeave={() => state === 'holding' && stop()}
      onContextMenu={(e) => e.preventDefault()}
      className="hit relative grid size-9 shrink-0 select-none place-items-center rounded-full transition-colors"
      style={{
        touchAction: 'none',
        background: state === 'holding' ? 'rgba(199,69,42,.18)' : 'transparent',
        color: disabled ? 'var(--accent)' : state === 'holding' || state === 'error' ? '#C7452A' : 'var(--dim)',
      }}
    >
      {state === 'holding' && (
        <svg className="absolute inset-0" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke="#C7452A"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            transform="rotate(-90 18 18)"
          />
        </svg>
      )}
      <MicIcon filled={disabled} />
    </button>
  );
}

/** Runder Icon-Knopf der Aktionszeile — 36 px gross, 44 px Tippflaeche. */
function IconButton({
  label,
  onClick,
  accent = false,
  children,
}: {
  label: string;
  onClick: () => void;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="hit flex h-9 min-w-9 shrink-0 items-center justify-center gap-1 rounded-full px-2"
      style={{ color: accent ? 'var(--accent)' : 'var(--dim)' }}
    >
      {children}
    </button>
  );
}

/** "…" mit Melden (fremde Beitraege) bzw. Loeschen (eigene). */
function PostMenu({ mine, onDelete, onReport }: { mine: boolean; onDelete: () => void; onReport: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Mehr"
        aria-expanded={open}
        className="hit grid size-8 place-items-center rounded-full"
        style={{ color: 'var(--dim)' }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
          <circle cx="4" cy="9" r="1.5" />
          <circle cx="9" cy="9" r="1.5" />
          <circle cx="14" cy="9" r="1.5" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-20 min-w-40 overflow-hidden rounded-xl py-1"
          style={{
            background: 'color-mix(in srgb, var(--screen) 88%, white 12%)',
            border: '1px solid var(--line)',
            boxShadow: '0 0.8rem 1.6rem rgba(0,0,0,.45)',
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              if (mine) onDelete();
              else onReport();
            }}
            className="block w-full px-4 py-2.5 text-left text-sm"
            style={{ color: 'var(--danger)' }}
          >
            {mine ? 'Löschen' : 'Melden'}
          </button>
        </div>
      )}
    </div>
  );
}

const iconStroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function MicIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" {...iconStroke}>
      <rect x="7" y="2.5" width="6" height="10" rx="3" fill={filled ? 'currentColor' : 'none'} />
      <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" {...iconStroke}>
      <path d="M3 4.5h14v9.5H8.5L5 17v-3H3Z" />
    </svg>
  );
}

function HeadphonesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" {...iconStroke}>
      <path d="M3.5 13v-2.5a6.5 6.5 0 0 1 13 0V13" />
      <rect x="3" y="12" width="3.5" height="5" rx="1.2" />
      <rect x="13.5" y="12" width="3.5" height="5" rx="1.2" />
    </svg>
  );
}

/** Spielt alle Tonfetzen eines Beitrags nacheinander ab — dieselbe
 *  Verkettung wie beim Walkman in der BottomBar, nur auf eine private Liste
 *  statt auf das ganze Band angewendet. */
function TonfetzenPlayer({ postId, me, side }: { postId: string; me: string; side: Side }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [reactions, setReactions] = useState<Tonfetzen[] | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTonfetzen(postId, me)
      .then(setReactions)
      .catch((err) => setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen'));
  }, [postId, me]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

  function playFrom(i: number) {
    if (!reactions || !reactions[i]) {
      audioRef.current = null;
      setPlaying(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(mediaUrl(reactions[i].mediaId));
    audio.onended = () => playFrom(i + 1);
    audio.onerror = () => playFrom(i + 1);
    void audio.play().catch(() => setPlaying(null));
    audioRef.current = audio;
    setPlaying(i);
  }

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(null);
  }

  if (error)
    return (
      <p className="text-sm" style={{ color: 'var(--danger)' }}>
        {error}
      </p>
    );
  if (!reactions) {
    return (
      <p className="py-8 text-center text-xs" style={{ color: 'var(--dim)' }}>
        Lädt …
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => (playing == null ? playFrom(0) : stop())}
        className="rounded-lg px-4 py-2.5 text-sm font-semibold"
        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
      >
        {playing == null ? `${reactions.length} Tonfetzen abspielen` : '■ Stopp'}
      </button>
      <ul className="flex flex-col gap-1.5">
        {reactions.map((r, i) => (
          <li
            key={r.author}
            className="flex items-center gap-2 rounded-lg p-2"
            style={{
              background: playing === i ? 'var(--card)' : 'transparent',
              border: `1px solid ${playing === i ? 'var(--accent)' : 'var(--line)'}`,
            }}
          >
            <Avatar name={r.author} side={side} size={1.3} />
            <span className="text-sm" style={{ color: 'var(--ink)' }}>
              {r.author}
            </span>
            {playing === i && (
              <span className="ml-auto text-2xs" style={{ color: 'var(--accent)' }}>
                läuft
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
