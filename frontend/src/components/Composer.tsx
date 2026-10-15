import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createPost,
  CHALLENGE_TYPE_LABEL,
  fetchChallenge,
  fetchMixtapes,
  mediaUrl,
  uploadMedia,
  NOTE_STYLES,
  type Kind,
  type NoteStyle,
  recipientOf,
} from '@/lib/api';
import { filmReleaseLabel } from '@/lib/berlinDay';
import { useApp, SIDE_LABEL } from '@/store/appStore';
import MixtapeRecorder from './MixtapeRecorder';
import CameraCapture from './CameraCapture';
import ChallengeFlow from './ChallengeFlow';
import { TypeIcon } from './ChallengeCard';
import KindIcon from './KindIcon';
import PlusMark from './PlusMark';
import Sheet from './Sheet';
import Zettel, { NOTE_STYLE_LABEL } from './Zettel';

type Step = null | 'choose' | Kind;

interface Props {
  onPosted: () => void;
}

const CHOICES: { kind: Kind; label: string; description: string }[] = [
  { kind: 'tape', label: 'Mixtape', description: 'Eines deiner versiegelten Mixtapes mit der ganzen Runde teilen.' },
  {
    kind: 'voice',
    label: 'O-Ton',
    description: 'Bis zu 90 Sekunden deine Stimme — nur auf Seite B, fürs laufende Gespräch.',
  },
  {
    kind: 'photo',
    label: 'Schnappschuss',
    description: 'Ein Foto direkt mit der Kamera. Kein Hochladen aus der Galerie — nur der Moment gerade jetzt.',
  },
  { kind: 'video', label: 'Clip', description: 'Ein kurzes Video, maximal 10 Sekunden.' },
  {
    kind: 'text',
    label: 'Zettel',
    description: 'Ein paar geschriebene Zeilen — nur auf Seite A, im bleibenden Archiv.',
  },
];

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
  const [challengeOpen, setChallengeOpen] = useState(false);

  // Die Wochen-Challenge — gleich fuer alle Kassetten. Liegt mein Beitrag
  // schon in dieser Kassette, ist der Eintrag hier zu.
  const { data: challenge } = useQuery({
    queryKey: ['challenge', 'me', me],
    queryFn: () => fetchChallenge(me),
    enabled: step === 'choose' && side === 'a' && Boolean(cassetteId),
  });
  const week = challenge?.current ?? null;
  const sharedHere = Boolean(cassetteId && challenge?.mine?.cassetteIds.includes(cassetteId));

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
        // Nur das Zeichen, ohne runden Knopf darum — wie die Glocke rechts
        // gegenueber, die Titelzeile soll ruhig wirken.
        className="hit relative z-50 grid size-8 place-items-center rounded-full transition-transform active:scale-95"
        style={{ color: 'var(--ink)' }}
      >
        {/* Liegt beim Oeffnen unter der Uebersicht und steht dort schon auf X —
            beim Schliessen dreht es sichtbar zurueck zum Plus. */}
        <PlusMark turned={pageOpen} />
      </button>

      {/* Eigene Seite statt kleinem Fenster — erklaert auch, welcher Modus
          was ist, statt nur die 5 Namen hinzuwerfen. */}
      {/* Das Plus wird zum X an derselben Stelle (Sheet `leading`), das X
          schliesst die Uebersicht wieder; der Titel steht mittig wie die
          Wortmarke darunter. */}
      <Sheet
        open={pageOpen}
        onClose={() => setStep(null)}
        variant="full"
        title="Aufnehmen"
        leading={
          <button
            type="button"
            onClick={() => setStep(null)}
            aria-label="Schließen"
            className="hit grid size-8 place-items-center rounded-full transition-transform active:scale-95"
            style={{ color: 'var(--ink)' }}
          >
            <PlusMark turned enter />
          </button>
        }
      >
        <div className="flex flex-col gap-2">
          {/* Challenge nur auf Seite A: sie landet nach der Aufloesung im Archiv. */}
          {side === 'a' && cassetteId && week && week.type !== 'imposter' && (
            <button
              type="button"
              onClick={() => setChallengeOpen(true)}
              disabled={sharedHere}
              className="flex items-start gap-3 rounded-xl p-3 text-left disabled:opacity-60"
              style={{ background: 'var(--card)', border: '1px dashed var(--accent)' }}
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full"
                style={{ background: 'rgba(0,0,0,.18)', color: 'var(--accent)' }}
              >
                <TypeIcon type={week.type} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  Challenge der Woche
                </span>
                <span className="block text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
                  {CHALLENGE_TYPE_LABEL[week.type]}
                  {week.theme ? ` · „${week.theme}“` : ''} —{' '}
                  {sharedHere
                    ? `liegt schon hier. Aufgelöst ${filmReleaseLabel(week.releaseAt)}.`
                    : `aufgelöst ${filmReleaseLabel(week.releaseAt)}, bis dahin sieht niemand etwas.`}
                </span>
              </span>
            </button>
          )}
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
                <KindIcon kind={c.kind} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  {c.label}
                </span>
                <span className="block text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
                  {c.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>

      {/* Eines der eigenen Mixtapes teilen */}
      <Sheet
        open={step === 'tape'}
        onClose={() => setStep(null)}
        variant="full"
        title={`Mixtape teilen · ${SIDE_LABEL[side]}`}
      >
        <div className="flex flex-col gap-3">
          {shareable.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: 'var(--dim)' }}>
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
                <span
                  className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg"
                  style={{ background: '#D8CFBB' }}
                >
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
                  <span className="block text-2xs" style={{ color: 'var(--dim)' }}>
                    ursprünglich für {recipientOf(t)} · {t.trackCount}/12
                  </span>
                </span>
              </button>
            ))
          )}
          {error && (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
          <p className="text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
            Geteilt sehen alle auf dieser Seite das Tape — auch wenn du es ursprünglich für eine Person gebaut hast.
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
                <span className="text-2xs" style={{ color: noteStyle === s ? 'var(--accent)' : 'var(--dim)' }}>
                  {NOTE_STYLE_LABEL[s]}
                </span>
              </button>
            ))}
          </div>

          {error && (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
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
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
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

      <ChallengeFlow
        open={challengeOpen}
        cassetteId={cassetteId}
        onClose={() => setChallengeOpen(false)}
        onDone={() => {
          setStep(null);
          onPosted();
        }}
      />

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
