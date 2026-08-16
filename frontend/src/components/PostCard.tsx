import { useEffect, useRef, useState } from 'react';
import {
  fetchTonfetzen,
  mediaUrl,
  sendTonfetzen,
  uploadMedia,
  KIND_LABEL,
  type FeedItem,
  type Tonfetzen,
} from '@/lib/api';
import { berlinDateLabel, berlinTimeLabel } from '@/lib/berlinDay';
import { baseMime, pickAudioMime } from '@/lib/tapeAudio';
import { useApp, type Side } from '@/store/appStore';
import Avatar from './Avatar';
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
  const [openTape, setOpenTape] = useState(false);
  const [listening, setListening] = useState(false);
  const side = item.side;
  const mine = item.author === me;

  async function sendReaction(blob: Blob, ms: number) {
    const mediaId = await uploadMedia(blob, ms);
    await sendTonfetzen(item.id, me, mediaId);
    onReacted();
  }

  return (
    <article
      id={`post-${item.id}`}
      // scroll-mt: App.tsx springt beim Ankommen zum ersten ungesehenen
      // Beitrag. Ohne diesen Abstand landet der genau unter der klebenden
      // Bedienzeile und ist halb verdeckt.
      className="rise scroll-mt-[calc(3.5rem+env(safe-area-inset-top))] rounded-xl p-3"
      style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      <div className="flex items-center gap-2">
        <Avatar name={item.author} side={side} />
        <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {item.author}
        </span>
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.1em]" style={{ color: 'var(--dim)' }}>
          {KIND_LABEL[item.kind]}
        </span>
        {/* Track-Nummer — Position innerhalb des Tapes. Auf Seite A zusaetzlich
            Datum+Uhrzeit, weil ein Tape mehrere Tracks an verschiedenen
            Uhrzeiten desselben Tages haben kann. */}
        <span className="font-mono ml-auto shrink-0 text-right text-[0.66rem] tabular-nums" style={{ color: 'var(--dim)' }}>
          {item.tapeIndex != null ? (
            <>
              {item.track}
              <span className="block text-[0.56rem] opacity-70">
                {berlinDateLabel(item.created_at)} · {berlinTimeLabel(item.created_at)}
              </span>
            </>
          ) : (
            item.track
          )}
        </span>
        {mine && (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            aria-label="Löschen"
            className="ml-1 px-1 text-xs"
            style={{ color: 'var(--dim)' }}
          >
            ✕
          </button>
        )}
      </div>

      <div className="mt-2.5 flex flex-col gap-2.5">
        {item.kind === 'text' && <Zettel id={item.id} style={item.noteStyle} text={item.body} />}

        {/* Live aufgenommen: Fotoabzug mit weissem Rand und Filzstiftzeile.
            Aus der Galerie: schlichter Rahmen, gedruckte Bildunterschrift.
            Kein Verbot — aber man sieht, was gerade passiert ist und was nicht. */}
        {item.kind === 'photo' && item.mediaId && item.source !== 'upload' && (
          <div className="print mx-auto w-full max-w-[17rem]">
            <img src={mediaUrl(item.mediaId)} alt={item.body || 'Schnappschuss'} loading="lazy" />
            {item.body && <p className="font-hand mt-2 text-center text-[0.95rem] text-[#3B3226]">{item.body}</p>}
          </div>
        )}

        {item.kind === 'photo' && item.mediaId && item.source === 'upload' && (
          <figure className="mx-auto w-full max-w-[17rem]">
            <img
              src={mediaUrl(item.mediaId)}
              alt={item.body || 'Bild'}
              loading="lazy"
              className="w-full rounded-md"
              style={{ border: '1px solid var(--line)' }}
            />
            <figcaption className="mt-1.5 flex items-baseline gap-2">
              <span className="font-mono shrink-0 text-[0.54rem] uppercase tracking-[0.14em]" style={{ color: 'var(--dim)' }}>
                Galerie
              </span>
              {item.body && (
                <span className="min-w-0 flex-1 text-[0.82rem]" style={{ color: 'var(--dim)' }}>
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
              <p className="font-hand mb-2 text-[1rem]" style={{ color: 'var(--ink)' }}>
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
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md" style={{ background: '#D8CFBB' }}>
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
              <span className="font-mono block text-[0.6rem] uppercase tracking-[0.1em]" style={{ color: 'var(--dim)' }}>
                {item.tape.trackCount} Titel · Tracklist ansehen
              </span>
            </span>
            <span className="font-mono shrink-0 text-[0.6rem]" style={{ color: 'var(--accent)' }}>
              ▸
            </span>
          </button>
        )}
      </div>

      {/* Tonfetzen ersetzt "da war ich": statt eines oeffentlichen Zaehlers eine
          private, 3 Sekunden kurze Sprachreaktion. Halten statt Seitenwechsel
          — die Geste bleibt auf der Karte, keine eigene Seite dafuer. Nur die
          postende Person erfaehrt, dass — und kann anhoeren, wer. */}
      <div className="mt-3 flex items-center gap-2">
        {!mine && <TonfetzenButton disabled={item.iSentTonfetzen} onSend={sendReaction} />}

        {mine && item.tonfetzenCount > 0 && (
          <button
            type="button"
            onClick={() => setListening(true)}
            className="font-mono flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.62rem] uppercase tracking-widest"
            style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}
          >
            <span aria-hidden="true">🎙</span> {item.tonfetzenCount} Tonfetzen anhören
          </button>
        )}
      </div>

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
function TonfetzenButton({ disabled, onSend }: { disabled: boolean; onSend: (blob: Blob, ms: number) => Promise<void> }) {
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

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

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
  const r = 9;
  const c = 2 * Math.PI * r;
  const label =
    disabled ? 'geschickt'
    : state === 'holding' ? `${(elapsed / 1000).toFixed(1)}s …`
    : state === 'sending' ? 'sendet …'
    : state === 'error' ? 'kein Mikro'
    : 'Tonfetzen';

  return (
    <button
      type="button"
      disabled={disabled || state === 'sending'}
      aria-label={disabled ? 'Tonfetzen geschickt' : 'Gedrückt halten, um einen Tonfetzen zu schicken'}
      title={disabled ? undefined : 'Gedrückt halten, um einen Tonfetzen zu schicken'}
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); void start(); }}
      onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); stop(); }}
      onPointerLeave={() => state === 'holding' && stop()}
      onContextMenu={(e) => e.preventDefault()}
      className="font-mono flex select-none items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.62rem] uppercase tracking-widest transition-colors disabled:opacity-70"
      style={{
        touchAction: 'none',
        border: `1px solid ${state === 'holding' ? '#C7452A' : disabled ? 'transparent' : 'var(--line)'}`,
        background: disabled ? 'var(--accent)' : state === 'holding' ? 'rgba(199,69,42,.18)' : 'transparent',
        color: disabled ? '#17130E' : state === 'holding' ? '#C7452A' : 'var(--dim)',
      }}
    >
      <span className="relative grid size-[1.05rem] shrink-0 place-items-center" aria-hidden="true">
        {state === 'holding' && (
          <svg className="absolute inset-0" width="22" height="22" viewBox="0 0 22 22">
            <circle cx="11" cy="11" r={r} fill="none" stroke="rgba(199,69,42,.3)" strokeWidth="2" />
            <circle
              cx="11"
              cy="11"
              r={r}
              fill="none"
              stroke="#C7452A"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
              transform="rotate(-90 11 11)"
            />
          </svg>
        )}
        🎙
      </span>
      {label}
    </button>
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

  useEffect(() => () => { audioRef.current?.pause(); }, []);

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

  if (error) return <p className="text-sm" style={{ color: '#F0B5A5' }}>{error}</p>;
  if (!reactions) {
    return (
      <p className="font-mono py-8 text-center text-xs" style={{ color: 'var(--dim)' }}>
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
        style={{ background: 'var(--accent)', color: '#17130E' }}
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
            <span className="text-sm" style={{ color: 'var(--ink)' }}>{r.author}</span>
            {playing === i && (
              <span className="font-mono ml-auto text-[0.6rem]" style={{ color: 'var(--accent)' }}>
                läuft
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

