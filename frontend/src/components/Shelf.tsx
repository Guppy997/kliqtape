import { useMemo, useState } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import {
  favoriteTape,
  fetchFeed,
  fetchTapes,
  setTapeName,
  unfavoriteTape,
  type Cassette,
  type TapeOverride,
} from '@/lib/api';
import { berlinDateLabel, dateOfTapeIndex } from '@/lib/berlinDay';
import { useApp } from '@/store/appStore';
import { jumpToTape } from '@/store/jumpStore';
import { MiniCassette, useCassettes, useLookIndex } from './CassetteDeck';
import { defaultTapeName, tapeDisplayName } from './TapeHeader';

interface TapeRow {
  cassette: Cassette;
  tapeIndex: number;
  override: TapeOverride | undefined;
  dateMs: number;
}

/**
 * Das Regal — jetzt ein Regal voller Tapes ueber ALLE Kassetten hinweg,
 * nicht nur die gerade eingelegte. Optik wie das Kassettenfach beim Eject:
 * Miniaturband in der echten Farbe der jeweiligen Kassette, Zeile fuer
 * Zeile, nach Datum sortiert — "Alle Freunde · Tape 04" kann direkt neben
 * "Die Kliqe · Tape 02" stehen, je nachdem was aktueller ist.
 *
 * Nur der Inhalt: das Profil (ProfileView.tsx) zeigt ihn im Regal unter
 * "Aus deinen Kassetten". `active` haelt die Abfragen still, solange das
 * Profil zu ist; `onJump` schliesst es, wenn man zu einem Tape springt.
 */
export default function ShelfList({ me, active: open, onJump }: { me: string; active: boolean; onJump: () => void }) {
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [cassetteFilter, setCassetteFilter] = useState<string | 'all'>('all');

  const qc = useQueryClient();
  const { data: cassettes = [] } = useCassettes();
  const looks = useLookIndex();
  const cassetteId = useApp((s) => s.cassetteId);

  // Pro Kassette einmal den Seite-A-Feed (fuer "hat dieses Tape ueberhaupt
  // etwas") und die Tape-Namen/Favoriten holen — nur wenn das Regal offen
  // ist, kein Hintergrund-Traffic fuer eine selten geoeffnete Ansicht. Der
  // Query-Key ist bewusst identisch zu dem, den Deck() fuer die gerade
  // eingelegte Kassette nutzt — TanStack Query teilt sich den Cache dann.
  const feedQueries = useQueries({
    queries: cassettes.map((c) => ({
      queryKey: ['feed', c.id, 'a', me],
      queryFn: () => fetchFeed(c.id, 'a', me),
      enabled: open,
    })),
  });
  const tapeQueries = useQueries({
    queries: cassettes.map((c) => ({
      queryKey: ['tapes', c.id, me],
      queryFn: () => fetchTapes(c.id, me),
      enabled: open,
    })),
  });
  const loading = open && [...feedQueries, ...tapeQueries].some((q) => q.isLoading);

  const rows = useMemo(() => {
    const out: TapeRow[] = [];
    cassettes.forEach((c, i) => {
      const feed = feedQueries[i]?.data ?? [];
      const tapes = tapeQueries[i]?.data ?? [];
      const overrideByIndex = new Map(tapes.map((t) => [t.tapeIndex, t]));
      const withContent = new Set(feed.map((item) => item.tapeIndex).filter((n): n is number => n != null));
      // Leere Tapes tauchen gar nicht erst auf — ein abgeschlossener Tag laesst
      // sich sowieso nicht nachtraeglich befuellen, eine leere Zeile waere
      // reiner Ballast ohne dass man je etwas damit tun koennte.
      for (const idx of withContent) {
        out.push({
          cassette: c,
          tapeIndex: idx,
          override: overrideByIndex.get(idx),
          dateMs: dateOfTapeIndex(c.createdAt, idx).getTime(),
        });
      }
    });
    // Neuestes zuerst, ueber alle Kassetten hinweg gemischt nach echtem Datum.
    out.sort((a, b) => b.dateMs - a.dateMs);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cassettes, feedQueries.map((q) => q.dataUpdatedAt).join(','), tapeQueries.map((q) => q.dataUpdatedAt).join(',')]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (cassetteFilter !== 'all' && r.cassette.id !== cassetteFilter) return false;
      if (!q) return true;
      const tapeName = tapeDisplayName(r.tapeIndex, r.override?.name).toLowerCase();
      return tapeName.includes(q) || r.cassette.name.toLowerCase().includes(q);
    });
  }, [rows, query, cassetteFilter]);

  function invalidateTapesOf(id: string) {
    void qc.invalidateQueries({ queryKey: ['tapes', id, me] });
    void qc.invalidateQueries({ queryKey: ['shelf', me] });
  }

  function jumpTo(row: TapeRow) {
    onJump();
    jumpToTape(row.cassette.id, row.tapeIndex);
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tape oder Kassette suchen …"
        className="rounded-lg px-3 py-2 text-sm outline-none"
        style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
      />

      <div>
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          aria-expanded={filterOpen}
          className="shrink-0 rounded-full px-2.5 py-1 text-2xs"
          style={{
            border: '1px solid var(--line)',
            color: cassetteFilter === 'all' ? 'var(--dim)' : 'var(--accent)',
          }}
        >
          {cassetteFilter === 'all' ? 'Filter' : (cassettes.find((c) => c.id === cassetteFilter)?.name ?? 'Filter')}{' '}
          {filterOpen ? '▴' : '▾'}
        </button>
      </div>

      {/* Ausgeklappt statt einer Dauerreihe — die Auswahl (welche
              Kassette) braucht nicht staendig Platz. */}
      {filterOpen && (
        <div
          className="flex flex-wrap gap-1.5 rounded-lg p-2"
          style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
        >
          <button
            type="button"
            onClick={() => {
              setCassetteFilter('all');
              setFilterOpen(false);
            }}
            className="rounded-full px-2.5 py-1 text-2xs"
            style={{
              background: cassetteFilter === 'all' ? 'var(--accent)' : 'transparent',
              border: '1px solid var(--line)',
              color: cassetteFilter === 'all' ? 'var(--on-accent)' : 'var(--ink)',
            }}
          >
            Alle
          </button>
          {cassettes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCassetteFilter(c.id);
                setFilterOpen(false);
              }}
              className="rounded-full px-2.5 py-1 text-2xs"
              style={{
                background: cassetteFilter === c.id ? 'var(--accent)' : 'transparent',
                border: '1px solid var(--line)',
                color: cassetteFilter === c.id ? 'var(--on-accent)' : 'var(--ink)',
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <p className="py-6 text-center text-xs" style={{ color: 'var(--dim)' }}>
          Lädt …
        </p>
      )}

      {!loading && filtered.length === 0 && (
        <p className="py-10 text-center text-sm" style={{ color: 'var(--dim)' }}>
          Nichts gefunden.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        {filtered.map((row) => (
          <TapeRowItem
            key={`${row.cassette.id}-${row.tapeIndex}`}
            row={row}
            pairIndex={looks.get(row.cassette.id)}
            active={row.cassette.id === cassetteId}
            me={me}
            onJump={() => jumpTo(row)}
            onChanged={() => invalidateTapesOf(row.cassette.id)}
          />
        ))}
      </div>
    </div>
  );
}

function TapeRowItem({
  row,
  pairIndex,
  active,
  me,
  onJump,
  onChanged,
}: {
  row: TapeRow;
  pairIndex: number | undefined;
  active: boolean;
  me: string;
  onJump: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const { cassette, tapeIndex, override, dateMs } = row;
  const name = tapeDisplayName(tapeIndex, override?.name);

  const rename = useMutation({
    mutationFn: (value: string) => setTapeName(cassette.id, tapeIndex, value, me),
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
  });

  const favorite = useMutation({
    mutationFn: () =>
      override?.favoritedByMe ? unfavoriteTape(cassette.id, tapeIndex, me) : favoriteTape(cassette.id, tapeIndex, me),
    onSuccess: onChanged,
  });

  return (
    <div
      className="flex items-center gap-2.5 rounded-xl p-2.5"
      style={{
        background: 'var(--card)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
      }}
    >
      <button type="button" onClick={onJump} aria-label={`${cassette.name}, ${name} ansehen`} className="shrink-0">
        <MiniCassette id={cassette.id} pairIndex={pairIndex} active={active} side="a" label={cassette.name} />
      </button>

      <div className="min-w-0 flex-1">
        <span className="block truncate text-2xs" style={{ color: 'var(--dim)' }}>
          {cassette.name}
        </span>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => rename.mutate(draft.trim())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditing(false);
            }}
            maxLength={60}
            placeholder={defaultTapeName(tapeIndex)}
            className="w-full rounded-lg px-1 py-0.5 text-base outline-none"
            style={{ background: 'var(--screen)', border: '1px solid var(--accent)', color: 'var(--ink)' }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(override?.name ?? '');
              setEditing(true);
            }}
            className="block w-full truncate text-left text-base font-medium"
            style={{ color: 'var(--ink)' }}
          >
            {name}
          </button>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => favorite.mutate()}
          disabled={favorite.isPending}
          aria-label={override?.favoritedByMe ? 'Aus deinem Regal nehmen' : 'In dein Regal legen'}
          title={override?.favoritedByMe ? 'Liegt in deinem Regal' : 'In dein Regal legen'}
          className="text-meta leading-none disabled:opacity-50"
          style={{ color: override?.favoritedByMe ? 'var(--accent)' : 'var(--dim)' }}
        >
          {override?.favoritedByMe ? '★' : '☆'}
        </button>
        <span className="text-2xs" style={{ color: 'var(--dim)' }}>
          {berlinDateLabel(dateMs)}
        </span>
      </div>
    </div>
  );
}
