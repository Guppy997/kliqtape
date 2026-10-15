import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CHALLENGE_TYPE_HINT,
  CHALLENGE_TYPE_LABEL,
  createChallengeEntry,
  fetchChallenge,
  shareChallenge,
  uploadMedia,
} from '@/lib/api';
import { filmReleaseLabel } from '@/lib/berlinDay';
import { useApp } from '@/store/appStore';
import CameraCapture from './CameraCapture';
import { MiniCassette, useCassettes, useLookIndex } from './CassetteDeck';
import DamalsPicker from './DamalsPicker';
import MixtapePick from './MixtapePick';
import Sheet from './Sheet';

/**
 * Mitmachen bei der Wochen-Challenge: einmal aufnehmen, dann aussuchen, in
 * welche eigenen Kassetten der Beitrag kommt. Wer schon mitgemacht hat,
 * landet direkt bei der Auswahl — ein zweites Mal aufnehmen gibt es nicht.
 */
export default function ChallengeFlow({
  open,
  cassetteId,
  onClose,
  onDone,
}: {
  open: boolean;
  /** Von wo aus man kommt — ist in der Auswahl schon angehakt. */
  cassetteId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();
  const { data: cassettes = [] } = useCassettes();
  const looks = useLookIndex();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: status, refetch } = useQuery({
    queryKey: ['challenge', 'me', me],
    queryFn: () => fetchChallenge(me),
    enabled: open,
  });

  // Beim Oeffnen frisch anfangen, die Herkunftskassette vorausgewaehlt.
  useEffect(() => {
    if (!open) return;
    setPicked(new Set(cassetteId ? [cassetteId] : []));
    setError(null);
  }, [open, cassetteId]);

  const week = status?.current ?? null;
  // Nur Runden, in denen die Challenge an und fuer mich nicht stumm ist.
  const openIds = new Set(status?.openCassetteIds ?? []);
  const targets = cassettes.filter((c) => openIds.has(c.id));
  const shared = new Set(status?.mine?.cassetteIds ?? []);
  const fresh = [...picked].filter((id) => openIds.has(id) && !shared.has(id));

  async function send(blob: Blob, caption: string, durationMs?: number, takenAt?: number) {
    const mediaId = await uploadMedia(blob, durationMs);
    await createChallengeEntry(me, { mediaId, caption, takenAt });
    await refetch();
  }

  async function shareAll() {
    setBusy(true);
    setError(null);
    try {
      for (const id of fresh) await shareChallenge(id, me);
      void qc.invalidateQueries({ queryKey: ['challenge'] });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Teilen fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} variant="full" title="Challenge der Woche">
      {!status ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--dim)' }}>
          Lädt …
        </p>
      ) : !week ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--dim)' }}>
          Diese Woche gibt es keine Challenge.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-2xs" style={{ color: 'var(--dim)' }}>
              {CHALLENGE_TYPE_LABEL[week.type]}
            </p>
            <p className="text-lg leading-snug font-semibold" style={{ color: 'var(--ink)' }}>
              {week.theme ? `„${week.theme}“` : CHALLENGE_TYPE_LABEL[week.type]}
            </p>
            <p className="mt-1 text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
              Du machst sie einmal und legst sie in so viele deiner Kassetten, wie du willst. Bis{' '}
              {filmReleaseLabel(week.releaseAt)} sieht es niemand, auch du nicht.
            </p>
          </div>

          {!status.mine ? (
            <>
              <p className="text-sm" style={{ color: 'var(--ink)' }}>
                {CHALLENGE_TYPE_HINT[week.type]}
              </p>
              {week.type === 'imposter' ? (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--dim)' }}>
                  Deine Karte liegt am Ende von Seite A jeder Runde, die mitspielt.
                </p>
              ) : week.type === 'mixtape' ? (
                <MixtapePick
                  onPick={async (tapeId) => {
                    await createChallengeEntry(me, { tapeId });
                    await refetch();
                  }}
                />
              ) : week.type === 'damals' ? (
                <DamalsPicker onSend={(blob, caption, takenAt) => send(blob, caption, undefined, takenAt)} />
              ) : (
                // Foto und Super-8 nur mit der Kamera — der Moment, nicht das Archiv.
                <CameraCapture
                  mode={week.type === 'super8' ? 'video' : 'photo'}
                  allowUpload={false}
                  sendLabel="Weiter"
                  title={CHALLENGE_TYPE_LABEL[week.type]}
                  onCancel={onClose}
                  onSend={(blob, ms, caption) => send(blob, caption, ms)}
                />
              )}
            </>
          ) : (
            <>
              <p className="text-sm" style={{ color: 'var(--ink)' }}>
                Dein Beitrag ist im Kasten. In welche Kassetten soll er?
              </p>
              <ul className="flex flex-col gap-1.5">
                {targets.map((c) => {
                  const done = shared.has(c.id);
                  const on = done || picked.has(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        disabled={done}
                        onClick={() =>
                          setPicked((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.id)) next.delete(c.id);
                            else next.add(c.id);
                            return next;
                          })
                        }
                        className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left disabled:opacity-60"
                        style={{
                          background: 'var(--card)',
                          border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
                        }}
                      >
                        <MiniCassette id={c.id} pairIndex={looks.get(c.id)} active={on} side="a" label={c.name} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: 'var(--ink)' }}>
                          {c.name}
                        </span>
                        <span className="shrink-0 text-2xs" style={{ color: on ? 'var(--accent)' : 'var(--dim)' }}>
                          {done ? 'liegt schon' : on ? '✓' : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {error && (
                <p className="text-sm" style={{ color: 'var(--danger)' }}>
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={() => void shareAll()}
                disabled={busy || fresh.length === 0}
                className="rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                {fresh.length === 0
                  ? 'Keine neue Kassette ausgewählt'
                  : fresh.length === 1
                    ? 'In 1 Kassette legen'
                    : `In ${fresh.length} Kassetten legen`}
              </button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
