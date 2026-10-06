import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createMixtape, fetchMixtapes, mediaUrl, type Mixtape } from '@/lib/api';
import { useApp } from '@/store/appStore';
import Avatar, { useProfiles } from './Avatar';
import Sheet from './Sheet';
import TapeEditor from './TapeEditor';
import TapeView from './TapeView';

type View = null | 'shelf' | 'new' | { open: string } | { edit: string };

/**
 * Mixtapes — eigener Knopf im Laufwerk, nicht mehr im Kassettenfach-Regal
 * (das zeigt jetzt die Tapes der Seite A, siehe Shelf.tsx).
 *
 * Getrennt vom Feed, weil ein Mixtape kein Beitrag ist: es geht an genau eine
 * Person, es entsteht ueber Tage, und es bleibt.
 */
export default function MixtapeShelf() {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const qc = useQueryClient();

  const [view, setView] = useState<View>(null);
  const [to, setTo] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: tapes = [] } = useQuery({
    queryKey: ['mixtapes', me],
    queryFn: () => fetchMixtapes(me),
    enabled: Boolean(me),
  });
  const { data: profiles = [] } = useProfiles();

  const create = useMutation({
    mutationFn: () => createMixtape(me, to.trim(), title.trim()),
    onSuccess: (tape) => {
      void qc.invalidateQueries({ queryKey: ['mixtapes', me] });
      setTo('');
      setTitle('');
      setView({ edit: tape.id });
    },
    onError: (e: Error) => setError(e.message),
  });

  const forMe = tapes.filter((t) => t.to === me && t.sealed);
  const drafts = tapes.filter((t) => t.from === me && !t.sealed);
  const given = tapes.filter((t) => t.from === me && t.sealed);

  const others = profiles.map((p) => p.name).filter((n) => n !== me);

  return (
    <>
      <span className="relative flex shrink-0 flex-col items-center gap-1">
        <button
          type="button"
          aria-label={forMe.length + drafts.length > 0 ? `Mixtapes, ${forMe.length + drafts.length} offen` : 'Mixtapes'}
          title="Mixtapes"
          onClick={() => setView('shelf')}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md transition-transform active:translate-y-px"
          style={{
            background: 'linear-gradient(180deg, #35302A, #1E1B17)',
            color: 'var(--ink)',
            boxShadow: '0 2px 0 rgba(0,0,0,.45), 0 1px 0 rgba(255,255,255,.1) inset',
          }}
        >
          {/* Achtelnoten-Paar statt Kassetten-Symbol — das benutzt jetzt
              schon der Regal-Knopf (Shelf.tsx), Mixtapes brauchen ein
              eigenes Zeichen. */}
          <svg width="15" height="12" viewBox="0 0 11 9" fill="currentColor" aria-hidden="true">
            <ellipse cx="2" cy="7.2" rx="1.6" ry="1.2" />
            <ellipse cx="7" cy="6.5" rx="1.6" ry="1.2" />
            <rect x="3.15" y="1" width="0.75" height="6.2" />
            <rect x="8.15" y="0.3" width="0.75" height="6.2" />
            <path d="M3.15 1 L8.9 0.3 L8.9 1.5 L3.15 2.2 Z" />
          </svg>
        </button>
        {forMe.length + drafts.length > 0 && (
          <span
            className="font-mono absolute -right-1 -top-1 grid size-3.5 place-items-center rounded-full text-[0.5rem] tabular-nums"
            style={{ background: 'var(--accent)', color: '#17130E' }}
          >
            {forMe.length + drafts.length}
          </span>
        )}
      </span>

      {/* Übersicht der eigenen Mixtapes */}
      <Sheet open={view === 'shelf'} onClose={() => setView(null)} variant="full" title="Mixtapes">
        <div className="flex flex-col gap-6">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setView('new');
            }}
            className="font-disp rounded-xl px-4 py-3.5 text-sm font-bold uppercase tracking-[0.12em]"
            style={{ background: 'var(--accent)', color: '#17130E' }}
          >
            Neues Mixtape bauen
          </button>

          <Group
            title="Für dich"
            tapes={forMe}
            side={side}
            empty="Noch nichts geschenkt bekommen."
            onOpen={(id) => setView({ open: id })}
          />
          <Group
            title="In Arbeit"
            tapes={drafts}
            side={side}
            empty="Kein Entwurf offen."
            onOpen={(id) => setView({ edit: id })}
            draft
          />
          <Group
            title="Verschenkt"
            tapes={given}
            side={side}
            empty="Noch nichts verschenkt."
            onOpen={(id) => setView({ open: id })}
          />
        </div>
      </Sheet>

      {/* Neues Tape anlegen */}
      <Sheet open={view === 'new'} onClose={() => setView('shelf')} variant="full" title="Neues Mixtape">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[0.62rem] uppercase tracking-[0.12em]" style={{ color: 'var(--dim)' }}>
              Für wen?
            </label>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              maxLength={40}
              placeholder="Name"
              className="rounded-lg px-3 py-2.5 text-base outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            />
            {others.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {others.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTo(n)}
                    className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[0.72rem]"
                    style={{
                      background: to === n ? 'var(--accent)' : 'var(--card)',
                      border: '1px solid var(--line)',
                      color: to === n ? '#17130E' : 'var(--ink)',
                    }}
                  >
                    <Avatar name={n} side={side} size={1.1} />
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-mono text-[0.62rem] uppercase tracking-[0.12em]" style={{ color: 'var(--dim)' }}>
              Titel
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              placeholder="z. B. Für den Heimweg"
              className="font-hand rounded-lg px-3 py-2.5 text-[1.05rem] outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: '#F0B5A5' }}>
              {error}
            </p>
          )}

          <p className="font-mono text-[0.6rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
            Bis zu 12 Titel. {to.trim() || 'Der Empfänger'} sieht nichts davon, solange du daran baust — erst das
            Versiegeln überreicht das Tape.
          </p>

          <button
            type="button"
            disabled={!to.trim() || !title.trim() || create.isPending}
            onClick={() => create.mutate()}
            className="font-disp rounded-lg px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#17130E' }}
          >
            Band einlegen
          </button>
        </div>
      </Sheet>

      {/* Entwurf bearbeiten */}
      <Sheet
        open={typeof view === 'object' && view !== null && 'edit' in view}
        onClose={() => setView('shelf')}
        variant="full"
        title="Mixtape bauen"
      >
        {typeof view === 'object' && view !== null && 'edit' in view && (
          <TapeEditor id={view.edit} onClose={() => setView('shelf')} />
        )}
      </Sheet>

      {/* Versiegeltes Tape ansehen */}
      <Sheet
        open={typeof view === 'object' && view !== null && 'open' in view}
        onClose={() => setView('shelf')}
        variant="full"
        title="Mixtape"
      >
        {typeof view === 'object' && view !== null && 'open' in view && <TapeView id={view.open} />}
      </Sheet>
    </>
  );
}

function Group({
  title,
  tapes,
  side,
  empty,
  onOpen,
  draft,
}: {
  title: string;
  tapes: Mixtape[];
  side: 'a' | 'b';
  empty: string;
  onOpen: (id: string) => void;
  draft?: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-disp text-sm font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ink)' }}>
        {title}
      </h3>

      {tapes.length === 0 ? (
        <p className="font-mono text-[0.64rem]" style={{ color: 'var(--dim)' }}>
          {empty}
        </p>
      ) : (
        tapes.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onOpen(t.id)}
            className="flex items-center gap-3 rounded-xl p-2.5 text-left"
            style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
          >
            <span
              className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md"
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
                {t.title || 'Ohne Titel'}
              </span>
              <span
                className="font-mono block truncate text-[0.6rem] uppercase tracking-[0.1em]"
                style={{ color: 'var(--dim)' }}
              >
                {draft ? `für ${t.to}` : t.from === t.to ? '' : `von ${t.from} · für ${t.to}`} · {t.trackCount}/12
              </span>
            </span>

            <Avatar name={draft ? t.to : t.from} side={side} size={1.5} />
          </button>
        ))
      )}
    </section>
  );
}
