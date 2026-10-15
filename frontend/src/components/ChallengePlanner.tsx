import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CHALLENGE_TYPE_LABEL, fetchChallengePlan, planChallenge, type ChallengeType } from '@/lib/api';
import { filmReleaseLabel } from '@/lib/berlinDay';
import { useApp } from '@/store/appStore';

/**
 * Wochen-Challenges planen — nur fuer den Kliqtape-Kanal-Account (NewsView).
 * Die naechsten acht Sonntage, je Typ und Thema. Ohne Eintrag gibt es in der
 * Woche keine Challenge. Hat jemand schon mitgemacht, ist die Woche fest.
 */
export default function ChallengePlanner() {
  const me = useApp((s) => s.me);
  const { data } = useQuery({ queryKey: ['challenge-plan', me], queryFn: () => fetchChallengePlan(me) });
  if (!data) return null;

  return (
    <div
      className="flex flex-col gap-2 rounded-xl p-3"
      style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
        Challenges planen
      </span>
      <span className="text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
        Eine pro Woche, für alle Kassetten gleich. Aufgelöst wird jeweils Sonntag um 19 Uhr.
      </span>
      <ul className="mt-1 flex flex-col gap-2">
        {data.weeks.map((w) => (
          <PlanRow key={w.releaseAt} week={w} types={data.types} />
        ))}
      </ul>
    </div>
  );
}

function PlanRow({
  week,
  types,
}: {
  week: { releaseAt: number; type: ChallengeType | null; theme: string; started: boolean };
  types: ChallengeType[];
}) {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();
  const [type, setType] = useState<ChallengeType | ''>(week.type ?? '');
  const [theme, setTheme] = useState(week.theme);

  useEffect(() => {
    setType(week.type ?? '');
    setTheme(week.theme);
  }, [week.type, week.theme]);

  const save = useMutation({
    mutationFn: () => planChallenge(me, week.releaseAt, type || null, theme.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['challenge-plan', me] });
      void qc.invalidateQueries({ queryKey: ['challenge'] });
    },
  });
  const dirty = (type || null) !== week.type || theme.trim() !== week.theme;

  return (
    <li className="flex flex-col gap-1.5 rounded-lg p-2.5" style={{ border: '1px solid var(--line)' }}>
      <span className="flex items-baseline justify-between gap-2 text-2xs" style={{ color: 'var(--dim)' }}>
        <span>{filmReleaseLabel(week.releaseAt)}</span>
        {week.started && <span>läuft schon — fest</span>}
      </span>
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ChallengeType | '')}
          disabled={week.started}
          aria-label="Typ"
          className="rounded-lg px-2 py-1.5 text-sm outline-none disabled:opacity-60"
          style={{ background: 'var(--screen)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        >
          <option value="">Keine Challenge</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {CHALLENGE_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          disabled={week.started || !type || type === 'imposter'}
          maxLength={120}
          placeholder={type === 'imposter' ? 'Aufgabe zieht jede Runde selbst' : 'Thema'}
          aria-label="Thema"
          className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm outline-none disabled:opacity-60"
          style={{ background: 'var(--screen)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
      </div>
      {dirty && !week.started && (
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="self-end rounded-full px-3 py-1 text-2xs disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          Speichern
        </button>
      )}
      {save.error && (
        <span className="text-2xs" style={{ color: 'var(--danger)' }}>
          {(save.error as Error).message}
        </span>
      )}
    </li>
  );
}
