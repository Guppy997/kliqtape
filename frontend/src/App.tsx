import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deletePost, fetchFeed, toggleReaction, KIND_LABEL, type Kind } from '@/lib/api';
import { useApp, SIDE_HINT, SIDE_LABEL } from '@/store/appStore';
import CassetteHeader from '@/components/CassetteHeader';
import CassetteDeck, { useCassettes, useLookIndex } from '@/components/CassetteDeck';
import Sheet from '@/components/Sheet';
import { lookFor } from '@/lib/cassetteLook';
import PostCard from '@/components/PostCard';
import BottomBar from '@/components/BottomBar';
import Lockup from '@/components/Lockup';
import Settings from '@/components/Settings';
import Shelf from '@/components/Shelf';
import UpdateNotification from '@/components/UpdateNotification';

export default function App() {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const cassetteId = useApp((s) => s.cassetteId);

  // Die Farbwelt der eingelegten Kassette landet auf dem Wurzelknoten, nicht
  // auf einem Container — sonst bekaemen die per Portal ausgelagerten Blaetter
  // sie nicht ab.
  useEffect(() => {
    const { type, case: shell } = lookFor(cassetteId ?? '');
    const root = document.documentElement.style;
    const vars: Record<string, string> =
      side === 'a'
        ? { '--accent': type.stripe }
        : {
            '--screen': shell.screen,
            '--accent': shell.glow,
            '--ink': shell.ink,
            '--dim': shell.dim,
            '--card': `${shell.shell}33`,
            '--line': `${shell.shellHi}44`,
          };
    for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
    return () => {
      for (const k of Object.keys(vars)) root.removeProperty(k);
    };
  }, [cassetteId, side]);

  // Beim Start immer auf der eingestellten Seite landen, nicht dort, wo man
  // beim letzten Mal aufgehoert hat.
  useEffect(() => {
    const { startSide, setSide } = useApp.getState();
    setSide(startSide);
  }, []);

  // Der Rahmen ist immer derselbe — nur die Seitentokens wechseln. Sonst
  // springt das Layout zwischen Anmeldung und App.
  return (
    <div className={side === 'a' ? 'side-a' : 'side-b'} style={{ background: 'var(--screen)', minHeight: '100%' }}>
      <UpdateNotification />
      {me ? <Deck /> : <NameGate />}
    </div>
  );
}

/** Filterleiste auf Seite A — Seite A ist ein Archiv, da will man sortieren. */
const FILTERS: { key: Kind | 'all'; label: string }[] = [
  { key: 'all', label: 'Alles' },
  { key: 'photo', label: KIND_LABEL.photo },
  { key: 'voice', label: KIND_LABEL.voice },
  { key: 'tape', label: KIND_LABEL.tape },
  { key: 'video', label: KIND_LABEL.video },
  { key: 'text', label: KIND_LABEL.text },
];

function Deck() {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const cassetteId = useApp((s) => s.cassetteId);
  const setCassette = useApp((s) => s.setCassette);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Kind | 'all'>('all');
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: cassettes = [], isLoading: loadingTapes } = useCassettes();
  const looks = useLookIndex();
  const current = cassettes.find((c) => c.id === cassetteId);

  // Nie vor dem Nichts stehen: fehlt eine Auswahl oder ist sie ungueltig
  // geworden, wird die zuletzt aktive Kassette eingelegt.
  useEffect(() => {
    if (loadingTapes) return;
    if (!current && cassettes.length > 0) setCassette(cassettes[0]!.id);
    if (current == null && cassettes.length === 0 && cassetteId) setCassette(null);
  }, [loadingTapes, cassettes, current, cassetteId, setCassette]);

  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['feed', cassetteId, side],
    queryFn: () => fetchFeed(cassetteId!, side),
    enabled: Boolean(cassetteId),
    // Seite B laeuft ab — regelmaessig nachsehen, was noch da ist.
    refetchInterval: side === 'b' ? 60_000 : false,
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['feed', cassetteId, side] });

  const react = useMutation({ mutationFn: (id: string) => toggleReaction(id, me), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => deletePost(id), onSuccess: invalidate });

  const shown = useMemo(
    () => (side === 'a' && filter !== 'all' ? data.filter((p) => p.kind === filter) : data),
    [data, side, filter],
  );

  return (
    <>
      <CassetteHeader
        cassetteId={cassetteId}
        pairIndex={cassetteId ? looks.get(cassetteId) : undefined}
        label={current?.name ?? 'Kein Band'}
        count={data.length}
      />

      <main className="mx-auto flex max-w-xl flex-col gap-2.5 px-3 pb-32 pt-2">
        <div
          className="font-mono flex items-center justify-between gap-2 pb-1 text-[0.64rem] uppercase tracking-[0.11em]"
          style={{ color: 'var(--dim)' }}
        >
          <CassetteDeck />
          <span className="flex shrink-0 items-center gap-1.5">
            <Shelf />
            <Settings />
          </span>
        </div>

        {!cassetteId && !loadingTapes && (
          <div className="py-16 text-center">
            <p className="font-hand text-lg" style={{ color: 'var(--dim)' }}>
              Kein Band eingelegt.
            </p>
            <p className="mt-2 font-mono text-[0.64rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
              Eine Kassette ist eine Runde von Leuten.
              <br />
              Öffne oben das Fach und beschrifte dein erstes Band.
            </p>
          </div>
        )}

        {cassetteId && (
          <>
            {/* Seite A ist ein Archiv und darf gefiltert werden — ein Filter, den
                der Nutzer selbst setzt, war nie das Problem. Seite B laeuft ab,
                da zaehlt nur die Restzeit. */}
            {side === 'a' ? (
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className="font-mono self-start rounded-full px-2.5 py-1 text-[0.58rem] uppercase tracking-[0.1em]"
                style={{
                  border: '1px solid var(--line)',
                  color: filter === 'all' ? 'var(--dim)' : 'var(--accent)',
                }}
              >
                Filter{filter === 'all' ? '' : `: ${FILTERS.find((f) => f.key === filter)?.label}`} ▾
              </button>
            ) : (
              <p className="font-mono pb-1 text-[0.6rem] uppercase tracking-[0.11em]" style={{ color: 'var(--accent)' }}>
                {SIDE_HINT.b} · diese Seite wird überspielt
              </p>
            )}

            {isLoading && (
              <p className="font-mono py-10 text-center text-xs" style={{ color: 'var(--dim)' }}>
                Band wird eingelegt …
              </p>
            )}

            {isError && (
              <p className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(184,70,44,.18)', color: '#F0B5A5' }}>
                {/* Bandsalat: wenn das Backend nicht antwortet, ist das Band verheddert. */}
                Bandsalat — {(error as Error).message}
              </p>
            )}

            {!isLoading && !isError && shown.length === 0 && (
              <div className="py-16 text-center">
                <p className="font-hand text-lg" style={{ color: 'var(--dim)' }}>
                  {data.length === 0 ? 'Leeres Band.' : 'Nichts davon auf diesem Band.'}
                </p>
                <p className="mt-1 font-mono text-[0.66rem] uppercase tracking-widest" style={{ color: 'var(--dim)' }}>
                  Seite {side.toUpperCase()} · {SIDE_LABEL[side]}
                </p>
              </div>
            )}

            {shown.map((item) => (
              <PostCard
                key={item.id}
                item={item}
                onReact={(id) => react.mutate(id)}
                onDelete={(id) => remove.mutate(id)}
              />
            ))}

            {shown.length > 0 && (
              <div className="flex flex-col items-center gap-1.5 pt-8">
                {/* Bandende: der durchsichtige Vorspann. Hier hoert der Feed auf. */}
                <div
                  className="h-1 w-24 rounded-full"
                  style={{ background: 'linear-gradient(90deg, var(--accent), transparent)' }}
                />
                <p className="font-hand text-base" style={{ color: 'var(--dim)' }}>
                  Bandende.
                </p>
                <p className="font-mono text-[0.6rem] uppercase tracking-widest" style={{ color: 'var(--dim)' }}>
                  kein Nachschub
                </p>
              </div>
            )}
          </>
        )}
      </main>

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter · Seite A">
        <div className="flex flex-col gap-1.5">
          {FILTERS.map((f) => {
            const n = f.key === 'all' ? data.length : data.filter((p) => p.kind === f.key).length;
            return (
              <button
                key={f.key}
                type="button"
                disabled={n === 0 && f.key !== 'all'}
                onClick={() => {
                  setFilter(f.key);
                  setFilterOpen(false);
                }}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm disabled:opacity-35"
                style={{
                  background: filter === f.key ? 'var(--accent)' : 'var(--card)',
                  border: '1px solid var(--line)',
                  color: filter === f.key ? '#17130E' : 'var(--ink)',
                }}
              >
                <span>{f.label}</span>
                <span className="font-mono text-[0.66rem] tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
      </Sheet>

      <BottomBar items={data} onPosted={invalidate} />
    </>
  );
}

function NameGate() {
  const setMe = useApp((s) => s.setMe);
  const [value, setValue] = useState('');

  return (
    <div className="grid min-h-full place-items-center px-6 py-16">
      <form
        className="flex w-full max-w-sm flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) setMe(value);
        }}
      >
        <h1>
          <Lockup size="clamp(3rem, 17vw, 4.6rem)" />
        </h1>
        <p className="text-sm" style={{ color: 'var(--dim)' }}>
          Prototyp ohne Login. Tipp einen Namen ein — er bleibt nur auf diesem Gerät.
        </p>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={40}
          autoFocus
          placeholder="Dein Name"
          className="rounded-lg px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#FFF3EC' }}
        >
          Band einlegen
        </button>
        <p className="font-mono text-[0.62rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
          Achtung: In diesem Prototyp ist nichts verschlüsselt. Keine echten privaten Inhalte
          einstellen.
        </p>
      </form>
    </div>
  );
}
