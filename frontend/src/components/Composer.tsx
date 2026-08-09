import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createPost, fetchMixtapes, mediaUrl, uploadMedia, NOTE_STYLES, type Kind, type NoteStyle } from '@/lib/api';
import { useApp, SIDE_LABEL } from '@/store/appStore';
import MixtapeRecorder from './MixtapeRecorder';
import CameraCapture from './CameraCapture';
import Sheet from './Sheet';
import Zettel, { NOTE_STYLE_LABEL } from './Zettel';

type Step = null | 'choose' | Kind;

interface Props {
  onPosted: () => void;
}

const CHOICES: { kind: Kind; label: string; description: string }[] = [
  { kind: 'tape', label: 'Mixtape', description: 'Eines deiner versiegelten Mixtapes mit der ganzen Runde teilen.' },
  { kind: 'voice', label: 'O-Ton', description: 'Bis zu 90 Sekunden deine Stimme — nur auf Seite B, fürs laufende Gespräch.' },
  { kind: 'photo', label: 'Schnappschuss', description: 'Ein Foto direkt mit der Kamera. Kein Hochladen aus der Galerie — nur der Moment gerade jetzt.' },
  { kind: 'video', label: 'Clip', description: 'Ein kurzes Video, maximal 10 Sekunden.' },
  { kind: 'text', label: 'Zettel', description: 'Ein paar geschriebene Zeilen — nur auf Seite A, im bleibenden Archiv.' },
];

/** Handgezeichnete Icons je Beitragsart, gleicher Strichstil wie die untere
 *  Leiste (siehe NavButton.tsx/BottomBar.tsx) — das Mixtape-Icon ist wörtlich
 *  dasselbe wie in BottomBar.tsx, nicht neu erfunden. */
const ICONS: Record<Kind, ReactNode> = {
  tape: (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <rect x="0.65" y="0.65" width="14.7" height="10.7" rx="1.5" />
      <circle cx="4.5" cy="6" r="1.6" />
      <circle cx="11.5" cy="6" r="1.6" />
      <path d="M6.3 6h3.4" />
    </svg>
  ),
  voice: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <line x1="2" y1="6" x2="2" y2="10" />
      <line x1="5.5" y1="3" x2="5.5" y2="13" />
      <line x1="9" y1="1" x2="9" y2="15" />
      <line x1="12.5" y1="4" x2="12.5" y2="12" />
    </svg>
  ),
  photo: (
    <svg width="16" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M1 4.2h2.6l1-1.6h4.8l1 1.6H15v8.4H1z" />
      <circle cx="8" cy="8.4" r="2.6" />
    </svg>
  ),
  video: (
    <svg width="17" height="13" viewBox="0 0 17 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <rect x="0.65" y="2.4" width="9.5" height="8.2" rx="1.2" />
      <path d="M10.15 5.4l5.2-2.6v8.4l-5.2-2.6z" />
    </svg>
  ),
  text: (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M1 0.7h8.4L13 4.3v11H1z" />
      <path d="M9.4 0.7v3.6H13" />
      <path d="M3.4 7.4h7.2M3.4 10h5.2" />
    </svg>
  ),
};

/**
 * Ein einziger REC-Knopf statt vieler Schaltflaechen.
 *
 * Alles landet auf demselben Band — was genau, entscheidet man erst danach.
 * Antippen fuehrt auf eine eigene Seite, die jeden Modus kurz erklaert (nicht
 * nur den Namen zeigt) — bei fuenf Auswahlmoeglichkeiten reicht ein kleines
 * Ausklapp-Feld nicht mehr aus, um verstaendlich zu sein.
 */
export default function Composer({ onPosted }: Props) {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const cassetteId = useApp((s) => s.cassetteId);
  const [step, setStep] = useState<Step>(null);
  const [text, setText] = useState('');
  const [noteStyle, setNoteStyle] = useState<NoteStyle>('tape');
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

  async function post(kind: Kind, extra: { body?: string; tapeId?: string; noteStyle?: NoteStyle }) {
    setBusy(true);
    setError(null);
    try {
      if (!cassetteId) throw new Error('Keine Kassette eingelegt');
      await createPost({ cassetteId, side, author: me, kind, ...extra });
      setText('');
      setNoteStyle('tape');
      setStep(null);
      onPosted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  // Auf Seite B laeuft Text direkt ueber ChatThreads eigenes Eingabefeld,
  // nicht mehr ueber den REC-Umweg — der Zettel-Eintrag faellt dort weg.
  // Zettel ist nur auf Seite A sinnvoll (Seite B schreibt direkt im Chat),
  // O-Ton umgekehrt nur auf Seite B (laufendes Gespraech) — auf Seite A
  // waere eine Sprachnachricht ein Fremdkoerper im kuratierten Archiv.
  const choices = CHOICES.filter((c) => (side === 'b' ? c.kind !== 'text' : c.kind !== 'voice'));
  const pageOpen = step === 'choose';

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Aufnehmen"
        aria-expanded={pageOpen}
        onClick={() => {
          setError(null);
          setStep(pageOpen ? null : 'choose');
        }}
        className="relative z-50 grid size-8 place-items-center rounded-full transition-transform active:scale-95"
        style={{
          background: 'linear-gradient(180deg, #2E2925, #1A1714)',
          boxShadow: '0 0.25rem 0.6rem rgba(0,0,0,.5), 0 1px 0 rgba(255,255,255,.12) inset',
        }}
      >
        {/* Plus statt REC-Punkt, dreht sich beim Oeffnen zum X. */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
          style={{ transform: pageOpen ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}
        >
          <path d="M7 1v12M1 7h12" />
        </svg>
      </button>

      {/* Eigene Seite statt kleinem Fenster — erklaert auch, welcher Modus
          was ist, statt nur die 5 Namen hinzuwerfen. */}
      <Sheet open={pageOpen} onClose={() => setStep(null)} variant="full" title="Aufnehmen">
        <div className="flex flex-col gap-2">
          {choices.map((c) => (
            <button
              key={c.kind}
              type="button"
              onClick={() => setStep(c.kind)}
              className="flex items-start gap-3 rounded-xl p-3 text-left"
              style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full"
                style={{ background: 'rgba(0,0,0,.18)', color: 'var(--accent)' }}
              >
                {ICONS[c.kind]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-disp block text-sm font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--ink)' }}>
                  {c.label}
                </span>
                <span className="font-mono block text-[0.66rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
                  {c.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>

      {/* Eines der eigenen Mixtapes teilen */}
      <Sheet open={step === 'tape'} onClose={() => setStep(null)} variant="full" title={`Mixtape teilen · ${SIDE_LABEL[side]}`}>
        <div className="flex flex-col gap-3">
          {shareable.length === 0 ? (
            <p className="font-hand py-8 text-center text-lg" style={{ color: 'var(--dim)' }}>
              Noch kein versiegeltes Mixtape.
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
          {/* Echte Vorschau statt Text-Beschreibung — zeigt exakt, was
              nachher auf dem Band landet, live waehrend man tippt. */}
          <div className="rounded-lg py-3" style={{ background: 'rgba(0,0,0,.18)' }}>
            <Zettel id="vorschau" style={noteStyle} text={text.trim() || 'Was ist gerade?'} />
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={500}
            autoFocus
            placeholder="Was ist gerade?"
            className="resize-none rounded-lg p-3 text-[0.95rem] outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />

          {/* Wie der Zettel "befestigt" ist — jede Kachel eine verkleinerte
              echte Vorschau, antippen waehlt den Stil. */}
          <div className="flex justify-between gap-1.5">
            {NOTE_STYLES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setNoteStyle(s)}
                className="flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5"
                style={{
                  background: noteStyle === s ? 'rgba(0,0,0,.18)' : 'transparent',
                  border: `1px solid ${noteStyle === s ? 'var(--accent)' : 'transparent'}`,
                }}
              >
                {/* Breit genug fuer die volle skalierte Kartenbreite (kein
                    seitliches Abschneiden, wichtig fuer Eselsohr oben rechts),
                    unten leicht beschnitten — die Optik zeigt sich oben. */}
                <div className="pointer-events-none h-11 w-[5.8rem] overflow-hidden">
                  <Zettel id={`vorschau-${s}`} style={s} text="Zettel" scale={0.34} />
                </div>
                <span
                  className="font-mono text-[0.56rem] uppercase tracking-[0.06em]"
                  style={{ color: noteStyle === s ? 'var(--accent)' : 'var(--dim)' }}
                >
                  {NOTE_STYLE_LABEL[s]}
                </span>
              </button>
            ))}
          </div>

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
              onClick={() => post('text', { body: text.trim(), noteStyle })}
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
