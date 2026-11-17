import { useEffect, useRef, useState } from 'react';
import { pickAudioMime, baseMime } from '@/lib/tapeAudio';
import TapePlayer from './TapePlayer';
import { ensurePermission } from '@/store/permissionStore';

const MAX_MS = 90_000; // Ein Band hat eine Laufzeit. 90 Sekunden, dann ist Schluss.

interface Props {
  onCancel: () => void;
  onSend: (blob: Blob, durationMs: number, caption: string) => Promise<void>;
}

export default function MixtapeRecorder({ onCancel, onSend }: Props) {
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);

  const [state, setState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; url: string; ms: number } | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );

  // Laufzeitanzeige und harte Kappung bei 90 Sekunden.
  useEffect(() => {
    if (state !== 'recording') return;
    const id = window.setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      if (ms >= MAX_MS) stop();
    }, 100);
    return () => window.clearInterval(id);
  }, [state]);

  async function start() {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Mikrofon nicht verfügbar. Browser geben es nur über https oder localhost frei.');
      }
      if (!(await ensurePermission('microphone'))) return;
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
      rec.onstop = () => {
        const type = baseMime(rec.mimeType || mime || 'audio/webm');
        const blob = new Blob(chunks.current, { type });
        const ms = Math.min(MAX_MS, Date.now() - startedAt.current);
        setResult({ blob, url: URL.createObjectURL(blob), ms });
        setState('done');
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      rec.start(250);
      recRef.current = rec;
      startedAt.current = Date.now();
      setElapsed(0);
      setState('recording');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aufnahme nicht möglich');
    }
  }

  function stop() {
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    recRef.current = null;
  }

  const left = Math.max(0, MAX_MS - elapsed);
  const fill = elapsed / MAX_MS;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-2xs" style={{ color: 'var(--dim)' }}>
        O-Ton · 90 Sekunden
      </p>

      {/* Die Spulen zeigen, wie viel Band noch uebrig ist. */}
      <div className="flex items-center justify-center gap-8 py-2">
        <RecReel fill={1 - fill} live={state === 'recording'} />
        <div className="text-center">
          <div className="text-3xl font-medium tabular-nums" style={{ color: 'var(--ink)' }}>
            {String(Math.floor(left / 60000)).padStart(2, '0')}:
            {String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}
          </div>
          <div className="text-2xs" style={{ color: 'var(--dim)' }}>
            {state === 'recording' ? 'läuft' : state === 'done' ? 'Band voll' : 'bereit'}
          </div>
        </div>
        <RecReel fill={fill} live={state === 'recording'} />
      </div>

      {error && (
        <p className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {state === 'done' && result && (
        <div className="flex flex-col gap-3">
          <TapePlayer src={result.url} hintMs={result.ms} />
          <p className="text-2xs" style={{ color: 'var(--dim)' }}>
            Zieh am Band — vor und zurück.
          </p>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={60}
            placeholder="Beschriften …"
            className="rounded-lg px-3 py-2 text-base outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />
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

        {state === 'idle' && (
          <button
            type="button"
            onClick={start}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            Aufnahme starten
          </button>
        )}

        {state === 'recording' && (
          <button
            type="button"
            onClick={stop}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium"
            style={{ background: '#B8462C', color: '#FFF3EC' }}
          >
            Stopp
          </button>
        )}

        {state === 'done' && result && (
          <button
            type="button"
            disabled={sending}
            onClick={async () => {
              setSending(true);
              try {
                await onSend(result.blob, result.ms, caption.trim());
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
                setSending(false);
              }
            }}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            {sending ? 'Wird überspielt …' : 'Aufs Band'}
          </button>
        )}
      </div>
    </div>
  );
}

function RecReel({ fill, live }: { fill: number; live: boolean }) {
  const r = 10 + 16 * Math.max(0, Math.min(1, fill));
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="32" fill="none" stroke="var(--line)" strokeWidth="1" />
      <circle cx="36" cy="36" r={r} fill="var(--accent)" opacity="0.75" />
      <circle cx="36" cy="36" r="9" fill="var(--card)" stroke="var(--line)" />
      <g className={live ? 'spin' : ''} style={{ transformOrigin: '36px 36px' }}>
        {[0, 60, 120, 180, 240, 300].map((d) => (
          <rect key={d} x="35" y="28" width="2" height="5" fill="var(--dim)" transform={`rotate(${d} 36 36)`} />
        ))}
      </g>
    </svg>
  );
}
