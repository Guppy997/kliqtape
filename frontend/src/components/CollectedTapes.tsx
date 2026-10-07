import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { favoriteTape, fetchMyShelf, mediaUrl, unfavoriteTape, type ShelfEntry } from '@/lib/api';
import { berlinDateLabel } from '@/lib/berlinDay';
import { lookFor } from '@/lib/cassetteLook';
import { jumpToTape } from '@/store/jumpStore';
import { MiniCassette, useLookIndex } from './CassetteDeck';
import { tapeDisplayName } from './TapeHeader';

/**
 * "Gesammelt" im Profil-Regal: Tapes, die man sich mit dem Stern aus seinen
 * Kassetten ins Regal gelegt hat — als Abzug mit dem ersten Foto des Tages
 * und einer Beschriftung mit Filzstift, die nur man selbst sieht. Der
 * kassettenweite Tape-Name bleibt davon unberuehrt.
 */
export default function CollectedTapes({ me, active, onJump }: { me: string; active: boolean; onJump: () => void }) {
  const looks = useLookIndex();
  const { data: entries, isLoading } = useQuery({
    queryKey: ['shelf', me],
    queryFn: () => fetchMyShelf(me),
    enabled: active && Boolean(me),
  });

  if (isLoading) {
    return (
      <p className="py-4 text-center text-xs" style={{ color: 'var(--dim)' }}>
        Lädt …
      </p>
    );
  }

  if (!entries?.length) {
    return (
      <p
        className="rounded-xl px-3 py-4 text-sm leading-relaxed"
        style={{ color: 'var(--dim)', border: '1px dashed var(--line)' }}
      >
        Noch nichts gesammelt. Tipp im Band beim Tape auf ☆ — dann liegt es hier, und du kannst es selbst beschriften.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-5 pt-1">
      {entries.map((entry, i) => (
        <li key={`${entry.cassetteId}-${entry.tapeIndex}`}>
          <CollectedTape
            entry={entry}
            me={me}
            tilt={i % 2 === 0 ? -1.2 : 0.9}
            pairIndex={looks.get(entry.cassetteId)}
            onJump={() => {
              onJump();
              jumpToTape(entry.cassetteId, entry.tapeIndex);
            }}
          />
        </li>
      ))}
    </ul>
  );
}

function CollectedTape({
  entry,
  me,
  tilt,
  pairIndex,
  onJump,
}: {
  entry: ShelfEntry;
  me: string;
  tilt: number;
  pairIndex: number | undefined;
  onJump: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const look = lookFor(entry.cassetteId, pairIndex).type;
  const tapeName = tapeDisplayName(entry.tapeIndex, entry.tapeName);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['shelf', me] });
    void qc.invalidateQueries({ queryKey: ['tapes', entry.cassetteId, me] });
  };

  const relabel = useMutation({
    mutationFn: (label: string) => favoriteTape(entry.cassetteId, entry.tapeIndex, me, label),
    onSuccess: () => {
      setEditing(false);
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: () => unfavoriteTape(entry.cassetteId, entry.tapeIndex, me),
    onSuccess: refresh,
  });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="print" style={{ transform: `rotate(${tilt}deg)`, paddingBottom: '0.55rem' }}>
        <button
          type="button"
          onClick={onJump}
          aria-label={`${entry.cassetteName}, ${tapeName} ansehen`}
          className="relative block aspect-square w-full overflow-hidden"
          style={{ background: look.label }}
        >
          {entry.previewMediaId ? (
            <img src={mediaUrl(entry.previewMediaId)} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            // Kein Foto an dem Tag: die Kassette selbst, auf ihrem Etikettpapier.
            <span className="grid size-full place-items-center">
              <MiniCassette id={entry.cassetteId} pairIndex={pairIndex} active={false} side="a" />
            </span>
          )}
        </button>

        {editing ? (
          <form
            className="mt-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              relabel.mutate(draft.trim());
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
              maxLength={60}
              placeholder="Mit Filzstift …"
              aria-label="Eigene Beschriftung"
              className="font-hand w-full border-b border-[#3B3226]/30 bg-transparent px-0.5 text-center text-[1.05rem] leading-snug text-[#3B3226] outline-none placeholder:text-[#3B3226]/40"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(entry.label ?? '');
              setEditing(true);
            }}
            aria-label={entry.label ? `Beschriftung „${entry.label}“ ändern` : 'Beschriften'}
            className="font-hand mt-1.5 block min-h-7 w-full truncate px-0.5 text-center text-[1.05rem] leading-snug"
            style={{ color: entry.label ? '#3B3226' : 'rgba(59,50,38,.4)' }}
          >
            {entry.label ?? '✎ beschriften'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center justify-between gap-2 px-0.5">
          <button
            type="button"
            onClick={() => relabel.mutate(draft.trim())}
            disabled={relabel.isPending}
            className="hit text-2xs font-medium disabled:opacity-50"
            style={{ color: 'var(--accent)' }}
          >
            Fertig
          </button>
          <button
            type="button"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="hit text-2xs disabled:opacity-50"
            style={{ color: 'var(--danger)' }}
          >
            Aus dem Regal
          </button>
        </div>
      ) : (
        <p className="truncate px-0.5 text-2xs" style={{ color: 'var(--dim)' }}>
          {entry.cassetteName} · <span className="tabular-nums">{berlinDateLabel(entry.dayMs)}</span>
        </p>
      )}
    </div>
  );
}
