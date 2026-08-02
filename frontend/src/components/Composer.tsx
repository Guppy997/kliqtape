import { useState } from 'react';
import { createPost, uploadMedia, type Kind } from '@/lib/api';
import { useApp } from '@/store/appStore';
import MixtapeRecorder from './MixtapeRecorder';
import CameraCapture from './CameraCapture';
import Sheet from './Sheet';

type Step = null | 'choose' | 'text' | 'photo' | 'video' | 'mixtape';

interface Props {
  onPosted: () => void;
}

const CHOICES: { kind: Exclude<Step, null | 'choose'>; label: string; hint: string }[] = [
  { kind: 'mixtape', label: 'Mixtape', hint: '90 Sekunden Stimme' },
  { kind: 'photo', label: 'Foto', hint: 'nur jetzt, kein Upload' },
  { kind: 'video', label: 'Video', hint: 'max. 10 Sekunden' },
  { kind: 'text', label: 'Notiz', hint: 'ein paar Zeilen' },
];

/**
 * Ein einziger REC-Knopf statt vier Schaltflaechen.
 *
 * Alles landet auf demselben Band — was genau, entscheidet man erst danach.
 * Das haelt die Leiste ruhig und macht die Metapher konsequent: ein Mixtape
 * ist eine Zusammenstellung, keine Sammlung getrennter Formate.
 */
export default function Composer({ onPosted }: Props) {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const [step, setStep] = useState<Step>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMedia(kind: Kind, blob: Blob, durationMs: number | undefined, caption: string) {
    const mediaId = await uploadMedia(blob, durationMs);
    await createPost({ side, author: me, kind, body: caption, mediaId });
    setStep(null);
    onPosted();
  }

  async function sendText() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createPost({ side, author: me, kind: 'text', body: text.trim() });
      setText('');
      setStep(null);
      onPosted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Aufnehmen"
        onClick={() => {
          setError(null);
          setStep('choose');
        }}
        className="grid size-16 place-items-center rounded-full transition-transform active:scale-95"
        style={{
          background: 'linear-gradient(180deg, #2E2925, #1A1714)',
          boxShadow: '0 0.4rem 1rem rgba(0,0,0,.5), 0 1px 0 rgba(255,255,255,.12) inset',
        }}
      >
        {/* Roter Punkt wie die Aufnahmetaste an einem Tapedeck */}
        <span
          className="size-7 rounded-full"
          style={{ background: '#C7452A', boxShadow: '0 0 0.7rem rgba(199,69,42,.7)' }}
        />
      </button>

      <Sheet open={step === 'choose'} onClose={() => setStep(null)} title={`Aufs Band · Seite ${side.toUpperCase()}`}>
        <div className="flex flex-col gap-2">
          {CHOICES.map((c) => (
            <button
              key={c.kind}
              type="button"
              onClick={() => setStep(c.kind)}
              className="flex items-baseline gap-3 rounded-xl px-4 py-3.5 text-left"
              style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
            >
              <span className="font-disp text-base font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--ink)' }}>
                {c.label}
              </span>
              <span className="font-mono text-[0.64rem]" style={{ color: 'var(--dim)' }}>
                {c.hint}
              </span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={step === 'text'} onClose={() => setStep(null)} title="Notiz">
        <div className="flex flex-col gap-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={500}
            autoFocus
            placeholder="Was ist gerade?"
            className="resize-none rounded-lg p-3 text-[0.95rem] outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />
          {error && <p className="text-sm" style={{ color: '#F0B5A5' }}>{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('choose')}
              className="rounded-lg px-4 py-2.5 text-sm"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--dim)' }}
            >
              Zurück
            </button>
            <button
              type="button"
              onClick={sendText}
              disabled={busy || !text.trim()}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#17130E' }}
            >
              Aufs Band
            </button>
          </div>
        </div>
      </Sheet>

      <Sheet open={step === 'photo' || step === 'video'} onClose={() => setStep(null)}>
        {(step === 'photo' || step === 'video') && (
          <CameraCapture
            mode={step}
            onCancel={() => setStep('choose')}
            onSend={(blob, ms, caption) => sendMedia(step, blob, ms, caption)}
          />
        )}
      </Sheet>

      <Sheet open={step === 'mixtape'} onClose={() => setStep(null)}>
        {step === 'mixtape' && (
          <MixtapeRecorder
            onCancel={() => setStep('choose')}
            onSend={(blob, ms, caption) => sendMedia('mixtape', blob, ms, caption)}
          />
        )}
      </Sheet>
    </>
  );
}
