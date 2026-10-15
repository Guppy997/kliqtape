import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchImposter,
  mediaUrl,
  revealImposter,
  submitImposterEntry,
  uploadMedia,
  voteImposter,
  type Cassette,
  type ImposterEntry,
  type ImposterWeek,
} from '@/lib/api';
import { filmReleaseLabel } from '@/lib/berlinDay';
import { useApp } from '@/store/appStore';
import Avatar from './Avatar';
import CameraCapture from './CameraCapture';
import PlusMark from './PlusMark';
import Sheet from './Sheet';

const STAMP_RED = '#C8402A';
/** Wie lange eine aufgeloeste Woche noch auf Seite A steht. */
const SHOW_RESULT_MS = 7 * 86_400_000;

const SEEN_KEY = 'kliqtape-imposter-seen';
function revealSeen(cassetteId: string): string | null {
  try {
    return (JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, string>)[cassetteId] ?? null;
  } catch {
    return null;
  }
}
function markRevealSeen(cassetteId: string, weekId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, string>;
    all[cassetteId] = weekId;
    localStorage.setItem(SEEN_KEY, JSON.stringify(all));
  } catch {
    /* ohne Speicher eben noch einmal */
  }
}

/** Gemeinsamer Query-Hook — Seite A und die Kassetten-Ansicht lesen dasselbe. */
function useImposter(cassetteId: string) {
  const me = useApp((s) => s.me);
  return useQuery({
    queryKey: ['imposter', cassetteId, me],
    queryFn: () => fetchImposter(cassetteId, me),
    refetchInterval: 60_000,
  });
}

/**
 * Die laufende Imposter-Woche auf Seite A. Drei Zustaende: Aufgabe (bzw.
 * Hinweis) und Abgabe — alle Beitraege und Tippen — Aufloesung. Gestartet
 * wird in der Kassetten-Ansicht (CassetteInfo.tsx), weil es eine Entscheidung
 * fuer die ganze Runde ist und selten vorkommt.
 */
export default function ImposterCard({ cassette, onChanged }: { cassette: Cassette; onChanged: () => void }) {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();
  const { data } = useImposter(cassette.id);
  const [revealing, setRevealing] = useState(false);
  const [, rerender] = useState(0);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['imposter', cassette.id] });
    onChanged();
  };

  const week = data?.week;
  if (!week) return null;
  // Stummgeschaltet: waehrend des Spiels nichts — die Challenge-Karte sagt es.
  if (week.phase === 'playing' && !week.card) return null;
  if (week.phase === 'revealed' && week.result && Date.now() - week.result.revealedAt > SHOW_RESULT_MS) return null;

  return (
    <section
      className="rise my-3 flex flex-col gap-3 rounded-xl p-3.5"
      style={{
        background: 'var(--card)',
        border: `1px solid ${week.phase === 'playing' && week.card?.imposter ? STAMP_RED : 'var(--line)'}`,
      }}
    >
      <header className="flex items-center gap-2.5">
        <MaskIcon />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold" style={{ color: 'var(--ink)' }}>
            Imposter-Woche
          </span>
          <span className="block text-2xs" style={{ color: 'var(--dim)' }}>
            {week.phase === 'playing'
              ? `Challenge der Woche · aufgedeckt ${filmReleaseLabel(week.revealAt)}`
              : week.phase === 'voting'
                ? 'Alle Beiträge sind da · wer war’s?'
                : 'Aufgelöst'}
          </span>
        </span>
      </header>

      {week.phase === 'playing' && week.card && (
        <Playing week={week} card={week.card} cassette={cassette} onChanged={refresh} />
      )}
      {week.phase === 'voting' && <Voting week={week} cassette={cassette} onChanged={refresh} />}
      {week.phase === 'revealed' && week.result && (
        <div className="flex flex-col gap-2">
          {revealSeen(cassette.id) === week.id ? (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--ink)' }}>
              <strong>{week.result.imposter === me ? 'Du' : week.result.imposter}</strong>{' '}
              {week.result.imposter === me ? 'warst' : 'war'} Imposter —{' '}
              {week.result.caught ? 'die Runde lag richtig.' : 'und kam durch.'}
            </p>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink)' }}>
              Die Auflösung ist da.
            </p>
          )}
          <button
            type="button"
            onClick={() => setRevealing(true)}
            className="self-start rounded-full px-3.5 py-1.5 text-2xs"
            style={
              revealSeen(cassette.id) === week.id
                ? { border: '1px solid var(--line)', color: 'var(--dim)' }
                : { background: STAMP_RED, color: '#FFF4EC' }
            }
          >
            {revealSeen(cassette.id) === week.id ? 'Nochmal ansehen' : 'Auflösung ansehen'}
          </button>
        </div>
      )}

      {revealing && week.result && (
        <ImposterReveal
          week={week}
          me={me}
          onClose={() => {
            markRevealSeen(cassette.id, week.id);
            setRevealing(false);
            rerender((n) => n + 1);
          }}
        />
      )}
    </section>
  );
}

function Playing({
  week,
  card,
  cassette,
  onChanged,
}: {
  week: ImposterWeek;
  card: { imposter: boolean; text: string };
  cassette: Cassette;
  onChanged: () => void;
}) {
  const me = useApp((s) => s.me);
  const [shooting, setShooting] = useState(false);
  const [text, setText] = useState('');
  const submitText = useMutation({
    mutationFn: () => submitImposterEntry(cassette.id, me, { body: text.trim() }),
    onSuccess: () => {
      setText('');
      onChanged();
    },
  });

  async function sendPhoto(blob: Blob, _ms: number | undefined, caption: string) {
    const mediaId = await uploadMedia(blob);
    await submitImposterEntry(cassette.id, me, { mediaId, body: caption });
    setShooting(false);
    onChanged();
  }

  return (
    <>
      <div
        className="rounded-lg px-3 py-2.5"
        style={{
          background: card.imposter ? 'color-mix(in srgb, #C8402A 14%, transparent)' : 'rgba(0,0,0,.18)',
          border: `1px dashed ${card.imposter ? STAMP_RED : 'var(--line)'}`,
        }}
      >
        <p className="text-2xs" style={{ color: card.imposter ? 'var(--danger)' : 'var(--dim)' }}>
          {card.imposter ? 'Du bist Imposter — nur ein Hinweis:' : 'Eure Aufgabe'}
        </p>
        <p className="font-hand mt-1 text-[1.2rem] leading-snug" style={{ color: 'var(--ink)' }}>
          {card.text}
        </p>
        <p className="mt-1.5 text-meta leading-snug" style={{ color: 'var(--dim)' }}>
          {card.imposter
            ? 'Die anderen kennen die genaue Aufgabe. Mach etwas, das nicht auffällt.'
            : 'Eine Person auf dem Band kennt die Aufgabe nicht und bekommt nur einen Hinweis.'}
        </p>
      </div>

      {week.iSubmitted ? (
        <p className="text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
          Abgegeben. Bis Sonntagabend sieht das niemand, auch du nicht.
        </p>
      ) : week.entryKind === 'photo' ? (
        <button
          type="button"
          onClick={() => setShooting(true)}
          className="self-start rounded-full px-3.5 py-1.5 text-2xs"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          Foto machen
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={280}
            placeholder="Deine Antwort"
            className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: 'rgba(0,0,0,.18)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />
          <button
            type="button"
            disabled={!text.trim() || submitText.isPending}
            onClick={() => submitText.mutate()}
            className="rounded-lg px-3.5 text-sm font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            Abgeben
          </button>
        </div>
      )}
      {submitText.error && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          {(submitText.error as Error).message}
        </p>
      )}

      <Sheet open={shooting} onClose={() => setShooting(false)} variant="full" title="Imposter-Woche">
        {shooting && (
          <CameraCapture
            mode="photo"
            allowUpload={false}
            sendLabel="Abgeben"
            title="Imposter-Woche"
            onCancel={() => setShooting(false)}
            onSend={sendPhoto}
          />
        )}
      </Sheet>
    </>
  );
}

function Voting({ week, cassette, onChanged }: { week: ImposterWeek; cassette: Cassette; onChanged: () => void }) {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const vote = useMutation({
    mutationFn: (suspect: string) => voteImposter(cassette.id, me, suspect),
    onSuccess: onChanged,
  });
  const reveal = useMutation({ mutationFn: () => revealImposter(cassette.id, me), onSuccess: onChanged });
  // Frueher aufloesen darf, wer die Runde verwaltet, sonst alle, sobald alle getippt haben.
  const canReveal = cassette.iAmAdmin || week.allVoted;

  return (
    <>
      <p className="text-meta leading-snug" style={{ color: 'var(--dim)' }}>
        Tipp auf den Beitrag, dessen Person die Aufgabe nicht kannte. Umentscheiden geht bis zur Auflösung.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {week.entries.map((e) => {
          const chosen = week.myVote === e.author;
          const own = e.author === me;
          return (
            <button
              key={e.postId}
              type="button"
              disabled={own || vote.isPending}
              onClick={() => vote.mutate(e.author)}
              aria-pressed={chosen}
              className="flex flex-col gap-1.5 rounded-lg p-1.5 text-left disabled:cursor-default"
              style={{
                background: 'rgba(0,0,0,.18)',
                border: `1.5px solid ${chosen ? STAMP_RED : 'var(--line)'}`,
              }}
            >
              <EntryThumb entry={e} />
              <span className="flex items-center gap-1.5 px-0.5">
                <Avatar name={e.author} side={side} size={1.1} />
                <span className="min-w-0 flex-1 truncate text-meta" style={{ color: 'var(--ink)' }}>
                  {own ? 'Du' : e.author}
                </span>
                {chosen && (
                  <span className="text-2xs" style={{ color: 'var(--danger)' }}>
                    dein Tipp
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {week.entries.length === 0 && (
        <p className="text-center text-sm" style={{ color: 'var(--dim)' }}>
          Niemand hat etwas abgegeben.
        </p>
      )}

      {canReveal ? (
        <button
          type="button"
          onClick={() => reveal.mutate()}
          disabled={reveal.isPending}
          className="self-start rounded-full px-3.5 py-1.5 text-2xs disabled:opacity-50"
          style={{ background: STAMP_RED, color: '#FFF4EC' }}
        >
          Auflösen
        </button>
      ) : (
        <p className="text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
          Aufgelöst wird, sobald alle getippt haben. Wer die Runde verwaltet, kann früher auflösen. Spätestens{' '}
          {filmReleaseLabel(week.votingEndsAt)} passiert es von selbst.
        </p>
      )}
    </>
  );
}

function EntryThumb({ entry, large = false }: { entry: ImposterEntry; large?: boolean }) {
  if (entry.mediaId) {
    return (
      <img
        src={mediaUrl(entry.mediaId)}
        alt={entry.body || `Beitrag von ${entry.author}`}
        className="aspect-square w-full rounded object-cover"
      />
    );
  }
  return (
    <span
      className={`font-hand grid aspect-square w-full place-items-center rounded p-2 text-center leading-snug ${large ? 'text-[1.35rem]' : 'text-[0.95rem]'}`}
      style={{ background: '#ECE5D6', color: '#3B3226' }}
    >
      {entry.body}
    </span>
  );
}

/**
 * Aufloesung: alle Abzuege liegen da. Nacheinander bekommen die, die die
 * Aufgabe kannten, einen leisen Stempel und treten zurueck — uebrig bleibt
 * der Imposter, auf den ein roter Stempel faellt. Kein Gluecksrad, kein
 * Punktestand: am Ende nur Aufgabe, Hinweis und ob die Runde richtig lag.
 */
function ImposterReveal({ week, me, onClose }: { week: ImposterWeek; me: string; onClose: () => void }) {
  const result = week.result!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const crew = week.entries.filter((e) => e.author !== result.imposter);
  const imposterEntry = week.entries.find((e) => e.author === result.imposter) ?? null;
  // step 0..crew.length: so viele sind schon "freigesprochen"; danach Stempel.
  const [step, setStep] = useState(reduced ? crew.length + 1 : 0);

  useEffect(() => {
    if (step > crew.length) return;
    const t = window.setTimeout(() => setStep((s) => s + 1), step === 0 ? 900 : 700);
    return () => window.clearTimeout(t);
  }, [step, crew.length]);

  const stamped = step > crew.length;
  const imposterName = result.imposter === me ? 'Du' : result.imposter;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Auflösung der Imposter-Woche"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 overflow-y-auto px-5 py-10"
      style={{ background: 'rgba(14,12,10,.985)' }}
      onClick={() => !stamped && setStep(crew.length + 1)}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Schließen"
        // Dasselbe X wie ueberall oben links (Sheet.tsx), an der Stelle des Plus —
        // mt-0.5, weil die Titelzeile dort 36 px hoch ist und das Plus mittig sitzt.
        className="hit absolute left-3 top-[max(0.5rem,env(safe-area-inset-top))] mt-0.5 grid size-8 place-items-center rounded-full text-white"
      >
        <PlusMark turned />
      </button>

      <p className="text-2xs text-white/60">Imposter-Woche · Auflösung</p>

      <div className="grid w-full max-w-sm grid-cols-3 gap-2.5">
        {crew.map((e, i) => {
          const cleared = step > i;
          return (
            <div
              key={e.postId}
              className="relative bg-[#ECE5D6] p-1 pb-4"
              style={{
                transform: cleared ? 'scale(.92)' : 'scale(1)',
                opacity: cleared ? 0.42 : 1,
                transition: 'transform 500ms ease, opacity 500ms ease',
              }}
            >
              <EntryThumb entry={e} />
              <span className="absolute inset-x-0 bottom-0.5 truncate px-1 text-center text-2xs text-[#3B3226]">
                {e.author === me ? 'Du' : e.author}
              </span>
              {cleared && (
                <span
                  className="font-mono absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 whitespace-nowrap rounded border px-1 text-[0.5rem] uppercase tracking-[0.1em]"
                  style={{ borderColor: '#4E7A5E', color: '#4E7A5E', background: 'rgba(236,229,214,.85)' }}
                >
                  kannte die Aufgabe
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="relative w-52"
        style={{
          transform: stamped ? 'scale(1.04)' : 'scale(.9)',
          transition: 'transform 600ms cubic-bezier(.2,.8,.3,1)',
        }}
      >
        <div className="bg-[#ECE5D6] p-1.5 pb-6 shadow-[0_0.8rem_2rem_rgba(0,0,0,.6)]">
          {imposterEntry ? (
            <EntryThumb entry={imposterEntry} large />
          ) : (
            <span className="font-hand grid aspect-square place-items-center text-[#3B3226]">nichts abgegeben</span>
          )}
          <span className="font-hand absolute inset-x-0 bottom-1 text-center text-[1rem] text-[#3B3226]">
            {imposterName}
          </span>
        </div>
        {stamped && (
          <span
            className="imposter-stamp font-disp absolute left-1/2 top-[42%] whitespace-nowrap rounded-md border-[3px] px-3 py-1 text-2xl font-bold uppercase tracking-[0.18em]"
            style={{ borderColor: STAMP_RED, color: STAMP_RED, background: 'rgba(236,229,214,.55)' }}
          >
            Imposter
          </span>
        )}
      </div>

      <div
        className="flex max-w-sm flex-col gap-2 text-center"
        style={{ opacity: stamped ? 1 : 0, transition: 'opacity 500ms ease 400ms' }}
      >
        <p className="text-xl leading-tight font-semibold text-white">
          {result.caught
            ? `${imposterName === 'Du' ? 'Du warst' : `${imposterName} war`} es — die Runde lag richtig.`
            : `${imposterName === 'Du' ? 'Du warst' : `${imposterName} war`} es — und ${imposterName === 'Du' ? 'bist' : 'ist'} durchgekommen.`}
        </p>
        <p className="text-meta leading-relaxed text-white/70">
          Die Aufgabe: „{result.task}“
          <br />
          {imposterName === 'Du' ? 'Du bekamst' : `${imposterName} bekam`} nur: „{result.hint}“
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 self-center rounded-full px-4 py-2 text-2xs"
          style={{ background: '#ECE5D6', color: '#3B3226' }}
        >
          Zurück zum Band
        </button>
        <p className="text-2xs text-white/45">Alle Beiträge liegen im Tape vom Sonntag auf Seite A.</p>
      </div>
    </div>,
    document.body,
  );
}

export function MaskIcon() {
  return (
    <svg width="26" height="20" viewBox="0 0 26 20" fill="none" aria-hidden="true">
      <path
        d="M2 4c4-2.5 7.5-2.5 11 0 3.5-2.5 7-2.5 11 0 .6 6-2.2 11-6.5 11-2.2 0-3.4-1.5-4.5-3.2C11.9 13.5 10.7 15 8.5 15 4.2 15 1.4 10 2 4z"
        stroke={STAMP_RED}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <ellipse cx="8.2" cy="8" rx="2.3" ry="1.5" fill={STAMP_RED} />
      <ellipse cx="17.8" cy="8" rx="2.3" ry="1.5" fill={STAMP_RED} />
    </svg>
  );
}
