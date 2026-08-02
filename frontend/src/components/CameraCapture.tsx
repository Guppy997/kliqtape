import { useEffect, useRef, useState } from 'react';
import { capturePhoto, openCamera } from '@/lib/photo';
import { pickVideoMime, baseMime } from '@/lib/tapeAudio';

const MAX_VIDEO_MS = 10_000;

interface Props {
  mode: 'photo' | 'video';
  onCancel: () => void;
  onSend: (blob: Blob, durationMs: number | undefined, caption: string) => Promise<void>;
  /** Beschriftungszeile ausblenden — z. B. beim Profilbild. */
  withCaption?: boolean;
  /** Runde Vorschau statt Fotoabzug — ebenfalls fuer das Profilbild. */
  round?: boolean;
  sendLabel?: string;
  title?: string;
}

/**
 * Kamera — bewusst OHNE Upload aus der Galerie.
 *
 * Es gibt hier absichtlich kein <input type="file">. Wer etwas zeigen will,
 * muss es jetzt aufnehmen. Das nimmt dem perfekten Bild die Wichtigkeit und
 * verschiebt den Fokus auf den Moment. Das ist der Punkt, nicht eine Huerde.
 */
export default function CameraCapture({
  mode,
  onCancel,
  onSend,
  withCaption = true,
  round = false,
  sendLabel = 'Aufs Band',
  title,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);

  const [facing, setFacing] = useState<'user' | 'environment'>('environment');
  const [shot, setShot] = useState<{ blob: Blob; url: string; ms?: number } | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stream = await openCamera(facing, mode === 'video');
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Kamera nicht verfügbar');
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing, mode]);

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      if (ms >= MAX_VIDEO_MS) stopVideo();
    }, 100);
    return () => window.clearInterval(id);
  }, [recording]);

  async function takePhoto() {
    if (!videoRef.current) return;
    try {
      const { blob, previewUrl } = await capturePhoto(videoRef.current);
      setShot({ blob, url: previewUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bild fehlgeschlagen');
    }
  }

  function startVideo() {
    const stream = streamRef.current;
    if (!stream) return;
    const mime = pickVideoMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
    rec.onstop = () => {
      const type = baseMime(rec.mimeType || mime || 'video/webm');
      const blob = new Blob(chunks.current, { type });
      setShot({ blob, url: URL.createObjectURL(blob), ms: Math.min(MAX_VIDEO_MS, Date.now() - startedAt.current) });
      setRecording(false);
    };
    rec.start(200);
    recRef.current = rec;
    startedAt.current = Date.now();
    setElapsed(0);
    setRecording(true);
  }

  function stopVideo() {
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    recRef.current = null;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em]" style={{ color: 'var(--dim)' }}>
        {title ?? (mode === 'photo' ? 'Foto · nur jetzt' : `Video · max ${MAX_VIDEO_MS / 1000} Sekunden`)}
      </p>

      {error ? (
        <p className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(184,70,44,.18)', color: '#F0B5A5' }}>
          {error}
        </p>
      ) : round ? (
        <div
          className="mx-auto aspect-square w-40 overflow-hidden rounded-full"
          style={{ boxShadow: '0 0 0 3px var(--line)' }}
        >
          {shot ? (
            <img src={shot.url} alt="Profilbild" className="size-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              muted
              playsInline
              className="size-full object-cover"
              style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
            />
          )}
        </div>
      ) : (
        <div className="print mx-auto w-full max-w-[19rem]">
          {shot ? (
            mode === 'photo' ? (
              <img src={shot.url} alt="Aufnahme" />
            ) : (
              <video src={shot.url} controls playsInline className="w-full" />
            )
          ) : (
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full"
              style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
            />
          )}
          {withCaption && (
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={44}
              placeholder="Mit Filzstift beschriften …"
              className="font-hand mt-2 w-full bg-transparent px-1 text-center text-[0.95rem] text-[#3B3226] outline-none placeholder:text-[#3B3226]/40"
            />
          )}
        </div>
      )}

      {recording && (
        <div className="text-center font-mono text-sm tabular-nums" style={{ color: '#E06A4C' }}>
          ● {((MAX_VIDEO_MS - elapsed) / 1000).toFixed(1)}s
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2.5 text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--dim)' }}
        >
          Abbrechen
        </button>

        {!shot && !error && (
          <>
            <button
              type="button"
              onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
              className="rounded-lg px-4 py-2.5 text-sm"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            >
              Drehen
            </button>
            <button
              type="button"
              onClick={mode === 'photo' ? takePhoto : recording ? stopVideo : startVideo}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold"
              style={{
                background: recording ? '#B8462C' : 'var(--accent)',
                color: recording ? '#FFF3EC' : '#17130E',
              }}
            >
              {mode === 'photo' ? 'Auslösen' : recording ? 'Stopp' : 'Aufnehmen'}
            </button>
          </>
        )}

        {shot && (
          <>
            <button
              type="button"
              onClick={() => { URL.revokeObjectURL(shot.url); setShot(null); }}
              className="rounded-lg px-4 py-2.5 text-sm"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            >
              Nochmal
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={async () => {
                setSending(true);
                try {
                  await onSend(shot.blob, shot.ms, caption.trim());
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
                  setSending(false);
                }
              }}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              style={{ background: 'var(--accent)', color: '#17130E' }}
            >
              {sending ? 'Wird überspielt …' : sendLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
