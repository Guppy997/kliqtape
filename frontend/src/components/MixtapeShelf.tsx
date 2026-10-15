import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createMixtape, fetchMixtapes, mediaUrl, recipientOf, type Mixtape } from '@/lib/api';
import { useApp } from '@/store/appStore';
import Avatar, { useProfiles } from './Avatar';
import Sheet from './Sheet';
import TapeEditor from './TapeEditor';
import TapeView from './TapeView';

type View = null | 'new' | { open: string } | { edit: string };

/**
 * Mixtapes im Profil (ProfileView.tsx): bauen, verschenken, erhaltene
 * anhoeren. Lag seit v0.19.6 brach, weil der eigene Knopf in der Leiste
 * wegfiel — jetzt ist das Profil sein Zuhause.
 *
 * Getrennt vom Feed, weil ein Mixtape kein Beitrag ist: es geht an genau eine
 * Person, es entsteht ueber Tage, und es bleibt.
 */
export default function MixtapeList() {
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
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setView('new');
          }}
          className="rounded-xl px-4 py-3.5 text-sm font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
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

      {/* Neues Tape anlegen */}
      <Sheet open={view === 'new'} onClose={() => setView(null)} variant="full" title="Neues Mixtape">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-2xs" style={{ color: 'var(--dim)' }}>
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
                    className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs"
                    style={{
                      background: to === n ? 'var(--accent)' : 'var(--card)',
                      border: '1px solid var(--line)',
                      color: to === n ? 'var(--on-accent)' : 'var(--ink)',
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
            <label className="text-2xs" style={{ color: 'var(--dim)' }}>
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
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}

          <p className="text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
            Bis zu 12 Titel. {to.trim() ? `${to.trim()} sieht` : 'Wer es bekommt, sieht'} nichts davon, solange du daran
            baust — erst das Versiegeln überreicht das Tape.
          </p>

          <button
            type="button"
            disabled={!to.trim() || !title.trim() || create.isPending}
            onClick={() => create.mutate()}
            className="rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            Band einlegen
          </button>
        </div>
      </Sheet>

      {/* Entwurf bearbeiten */}
      <Sheet
        open={typeof view === 'object' && view !== null && 'edit' in view}
        onClose={() => setView(null)}
        variant="full"
        title="Mixtape bauen"
      >
        {typeof view === 'object' && view !== null && 'edit' in view && (
          <TapeEditor id={view.edit} onClose={() => setView(null)} />
        )}
      </Sheet>

      {/* Versiegeltes Tape ansehen */}
      <Sheet
        open={typeof view === 'object' && view !== null && 'open' in view}
        onClose={() => setView(null)}
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
      <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
        {title}
      </h3>

      {tapes.length === 0 ? (
        <p className="text-2xs" style={{ color: 'var(--dim)' }}>
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
                {t.title || 'Ohne Titel'}
              </span>
              <span className="block truncate text-2xs" style={{ color: 'var(--dim)' }}>
                {draft ? `für ${recipientOf(t)}` : t.from === t.to ? '' : `von ${t.from} · für ${recipientOf(t)}`} ·{' '}
                {t.trackCount}/12
              </span>
            </span>

            <Avatar name={draft ? t.to : t.from} side={side} size={1.5} />
          </button>
        ))
      )}
    </section>
  );
}
