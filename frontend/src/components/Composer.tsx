import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createPost, fetchMixtapes, mediaUrl, uploadMedia, type Kind } from '@/lib/api';
import { useApp, SIDE_LABEL } from '@/store/appStore';
import MixtapeRecorder from './MixtapeRecorder';
import CameraCapture from './CameraCapture';
import Sheet from './Sheet';

type Step = null | 'choose' | Kind;

interface Props {
  onPosted: () => void;
}

const CHOICES: { kind: Kind; label: string; hint: string }[] = [
  { kind: 'tape', label: 'Mixtape', hint: 'Musik aus deinem Regal teilen' },
  { kind: 'voice', label: 'O-Ton', hint: '90 Sekunden Stimme' },
  { kind: 'photo', label: 'Schnappschuss', hint: 'nur jetzt, kein Upload' },
  { kind: 'video', label: 'Clip', hint: 'max. 10 Sekunden' },
  { kind: 'text', label: 'Zettel', hint: 'ein paar Zeilen' },
];

/**
 * Ein einziger REC-Knopf statt vieler Schaltflaechen.
 *
 * Alles landet auf demselben Band — was genau, entscheidet man erst danach.
 * Die Auswahl kommt als kleiner Kranz aus Feldern direkt um den Knopf herum,
 * nicht als eigene Seite — antippen fuehlt sich dadurch nach einem Ausklappen
 * an, nicht nach einem Wechsel.
 */
export default function Composer({ onPosted }: Props) {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const cassetteId = useApp((s) => s.cassetteId);
  const [step, setStep] = useState<Step>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nur eigene, versiegelte Tapes lassen sich teilen — ein Entwurf ist privat.
  const { data: tapes = [] } = useQuery({
    queryKey: ['mixtapes', me],
    queryFn: () => fetchMixtapes(me),
    enabled: step === 'tape',
  });
  const shareable = tapes.filter((t) => t.from === me && t.sealed);

  async function sendMedia(
    kind: Kind,
    blob: Blob,
    durationMs: number | undefined,
    caption: string,
    source: 'camera' | 'upload' = 'camera',
  ) {
    const mediaId = await uploadMedia(blob, durationMs);
    if (!cassetteId) return;
    await createPost({ cassetteId, side, author: me, kind, body: caption, mediaId, source });
    setStep(null);
    onPosted();
  }

  async function post(kind: Kind, extra: { body?: string; tapeId?: string }) {
    setBusy(true);
    setError(null);
    try {
      if (!cassetteId) throw new Error('Keine Kassette eingelegt');
      await createPost({ cassetteId, side, author: me, kind, ...extra });
      setText('');
      setStep(null);
      onPosted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  const fanOpen = step === 'choose';

  return (
    <div className="relative">
      {/* Sehr leichte Abdunkelung nur zum Wegtippen — bewusst kein Vollbild,
          damit sich das Oeffnen nicht wie ein Seitenwechsel anfuehlt. */}
      {fanOpen && (
        <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,.28)' }} onClick={() => setStep(null)} />
      )}

      <button
        type="button"
        aria-label="Aufnehmen"
        aria-expanded={fanOpen}
        onClick={() => {
          setError(null);
          setStep(fanOpen ? null : 'choose');
        }}
        className="relative z-50 grid size-16 place-items-center rounded-full transition-transform active:scale-95"
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

      {/* Die Optionen kommen als kleine Felder um den Knopf herum. Immer im
          DOM, damit rein und raus weich uebergeht — geschlossen sind sie nur
          geschrumpft, durchsichtig und unklickbar. */}
      <div
        className="pointer-events-none absolute bottom-[calc(100%+0.9rem)] left-1/2 z-50 flex w-60 -translate-x-1/2 flex-wrap justify-center gap-2"
        aria-hidden={!fanOpen}
      >
        {CHOICES.map((c, i) => (
          <button
            key={c.kind}
            type="button"
            tabIndex={fanOpen ? 0 : -1}
            onClick={() => setStep(c.kind)}
            className="rounded-xl px-2.5 py-2 text-center"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              minWidth: '4.6rem',
              pointerEvents: fanOpen ? 'auto' : 'none',
              opacity: fanOpen ? 1 : 0,
              transform: fanOpen ? 'scale(1) translateY(0)' : 'scale(0.3) translateY(0.7rem)',
              transition: `transform 240ms cubic-bezier(.2,1.4,.4,1) ${fanOpen ? i * 25 : 0}ms, opacity 160ms ease ${fanOpen ? i * 25 : 0}ms`,
            }}
          >
            <span className="font-disp block text-[0.74rem] font-bold uppercase tracking-[0.05em]" style={{ color: 'var(--ink)' }}>
              {c.label}
            </span>
          </button>
        ))}
      </div>

      {/* Mixtape aus dem Regal teilen */}
      <Sheet open={step === 'tape'} onClose={() => setStep(null)} variant="full" title={`Mixtape teilen · ${SIDE_LABEL[side]}`}>
        <div className="flex flex-col gap-3">
          {shareable.length === 0 ? (
            <p className="font-hand py-8 text-center text-lg" style={{ color: 'var(--dim)' }}>
              Noch kein versiegeltes Tape im Regal.
            </p>
          ) : (
            shareable.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={busy}
                onClick={() => post('tape', { tapeId: t.id })}
                className="flex items-center gap-3 rounded-xl p-2.5 text-left disabled:opacity-50"
                style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
              >
                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md" style={{ background: '#D8CFBB' }}>
                  {t.coverId ? (
                    <img src={mediaUrl(t.coverId)} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="font-hand text-lg text-[#3B3226]">♪</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-hand block truncate text-[1.02rem]" style={{ color: 'var(--ink)' }}>
                    {t.title}
                  </span>
                  <span className="font-mono block text-[0.6rem] uppercase tracking-[0.1em]" style={{ color: 'var(--dim)' }}>
                    ursprünglich für {t.to} · {t.trackCount}/12
                  </span>
                </span>
              </button>
            ))
          )}
          {error && <p className="text-sm" style={{ color: '#F0B5A5' }}>{error}</p>}
          <p className="font-mono text-[0.6rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
            Geteilt sehen alle auf dieser Seite das Tape — auch wenn du es ursprünglich für eine
            Person gebaut hast.
          </p>
        </div>
      </Sheet>

      <Sheet open={step === 'text'} onClose={() => setStep(null)} variant="full" title="Zettel">
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
              onClick={() => post('text', { body: text.trim() })}
              disabled={busy || !text.trim()}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#17130E' }}
            >
              Aufs Band
            </button>
          </div>
        </div>
      </Sheet>

      {/* Aufnahmen laufen als volle Seite — beim Filmen soll nichts durchscheinen. */}
      <Sheet
        open={step === 'photo' || step === 'video'}
        onClose={() => setStep(null)}
        variant="full"
        title={step === 'photo' ? 'Schnappschuss' : 'Clip'}
      >
        {(step === 'photo' || step === 'video') && (
          <CameraCapture
            mode={step}
            allowUpload={step === 'photo'}
            onCancel={() => setStep('choose')}
            onSend={(blob, ms, caption, source) => sendMedia(step, blob, ms, caption, source)}
          />
        )}
      </Sheet>

      <Sheet open={step === 'voice'} onClose={() => setStep(null)} variant="full" title="O-Ton">
        {step === 'voice' && (
          <MixtapeRecorder
            onCancel={() => setStep('choose')}
            onSend={(blob, ms, caption) => sendMedia('voice', blob, ms, caption)}
          />
        )}
      </Sheet>
    </div>
  );
}
