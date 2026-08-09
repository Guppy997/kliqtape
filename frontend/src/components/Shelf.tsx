import { useMemo, useState } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { favoriteTape, fetchFeed, fetchTapes, setTapeName, unfavoriteTape, type Cassette, type TapeOverride } from '@/lib/api';
import { berlinDateLabel, dateOfTapeIndex } from '@/lib/berlinDay';
import { useApp } from '@/store/appStore';
import { MiniCassette, useCassettes, useLookIndex } from './CassetteDeck';
import { defaultTapeName, tapeDisplayName } from './TapeHeader';
import Sheet from './Sheet';

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
 * Mixtapes haben seit kurzem einen eigenen Knopf im Laufwerk (siehe
 * MixtapeShelf.tsx) — das hier ist ausschliesslich Seite-A-Archiv.
 */
export default function Shelf({ me }: { me: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [cassetteFilter, setCassetteFilter] = useState<string | 'all'>('all');

  const qc = useQueryClient();
  const { data: cassettes = [] } = useCassettes();
  const looks = useLookIndex();
  const cassetteId = useApp((s) => s.cassetteId);
  const setCassette = useApp((s) => s.setCassette);
  const setSide = useApp((s) => s.setSide);

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
  }

  function jumpTo(row: TapeRow) {
    setCassette(row.cassette.id);
    setSide('a');
    setOpen(false);
    // Bei einem Kassettenwechsel muss der Feed erst laden, bevor der Anker
    // existiert — kurz nachschauen, bis er da ist (bei der schon eingelegten
    // Kassette meist schon beim ersten Versuch).
    let tries = 0;
    const check = () => {
      const el = document.getElementById(`tape-${row.tapeIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (tries++ < 60) requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass-chip font-mono flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.58rem] uppercase tracking-[0.1em]"
        style={{ color: 'var(--dim)' }}
      >
        <svg width="11" height="9" viewBox="0 0 11 9" fill="currentColor" aria-hidden="true">
          <rect x="0" y="0" width="11" height="9" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="3.6" cy="4.5" r="1.5" />
          <circle cx="7.4" cy="4.5" r="1.5" />
        </svg>
        Regal
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} variant="full" title="Regal">
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
              className="font-mono shrink-0 rounded-full px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.1em]"
              style={{
                border: '1px solid var(--line)',
                color: cassetteFilter === 'all' ? 'var(--dim)' : 'var(--accent)',
              }}
            >
              {cassetteFilter === 'all' ? 'Filter' : cassettes.find((c) => c.id === cassetteFilter)?.name ?? 'Filter'}{' '}
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
                className="font-mono rounded-full px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.08em]"
                style={{
                  background: cassetteFilter === 'all' ? 'var(--accent)' : 'transparent',
                  border: '1px solid var(--line)',
                  color: cassetteFilter === 'all' ? '#17130E' : 'var(--ink)',
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
                  className="font-mono rounded-full px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.08em]"
                  style={{
                    background: cassetteFilter === c.id ? 'var(--accent)' : 'transparent',
                    border: '1px solid var(--line)',
                    color: cassetteFilter === c.id ? '#17130E' : 'var(--ink)',
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <p className="font-mono py-6 text-center text-xs" style={{ color: 'var(--dim)' }}>
              Lädt …
            </p>
          )}

          {!loading && filtered.length === 0 && (
            <p className="font-hand py-10 text-center text-lg" style={{ color: 'var(--dim)' }}>
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
      </Sheet>
    </>
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
        <MiniCassette id={cassette.id} pairIndex={pairIndex} active={active} side="a" />
      </button>

      <div className="min-w-0 flex-1">
        <span className="font-mono block truncate text-[0.56rem] uppercase tracking-[0.1em]" style={{ color: 'var(--dim)' }}>
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
            className="font-hand w-full rounded px-1 py-0.5 text-[1.02rem] outline-none"
            style={{ background: 'var(--screen)', border: '1px solid var(--accent)', color: 'var(--ink)' }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(override?.name ?? '');
              setEditing(true);
            }}
            className="font-hand block w-full truncate text-left text-[1.05rem]"
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
          aria-label={override?.favoritedByMe ? 'Favorit entfernen' : 'Als Favorit markieren'}
          className="text-[0.8rem] leading-none disabled:opacity-50"
          style={{ color: override?.favoritedByMe ? 'var(--accent)' : 'var(--dim)' }}
        >
          {override?.favoritedByMe ? '★' : '☆'}
        </button>
        <span className="font-mono text-[0.52rem]" style={{ color: 'var(--dim)' }}>
          {berlinDateLabel(dateMs)}
        </span>
      </div>
    </div>
  );
}
