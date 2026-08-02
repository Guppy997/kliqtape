import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMember,
  createCassette,
  fetchCassettes,
  fetchMembers,
  removeMember,
  renameCassette,
  type Cassette,
} from '@/lib/api';
import { useApp } from '@/store/appStore';
import { lookFor } from '@/lib/cassetteLook';
import Avatar, { useProfiles } from './Avatar';
import Sheet from './Sheet';

/** Alle Kassetten dieser Person. Zentral, weil App und Fach sie brauchen. */
export function useCassettes() {
  const me = useApp((s) => s.me);
  return useQuery({
    queryKey: ['cassettes', me],
    queryFn: () => fetchCassettes(me),
    enabled: Boolean(me),
  });
}

/**
 * Das Kassettenfach.
 *
 * Eine Kassette ist eine Runde von Leuten. Man hat nicht einen Freundeskreis,
 * sondern mehrere — und die zu vermischen funktioniert nicht. Also legt man die
 * Kassette der Runde ein, mit der man gerade redet.
 */
export default function CassetteDeck() {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const cassetteId = useApp((s) => s.cassetteId);
  const setCassette = useApp((s) => s.setCassette);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [manage, setManage] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [invite, setInvite] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: cassettes = [] } = useCassettes();
  const current = cassettes.find((c) => c.id === cassetteId);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['cassettes', me] });
    void qc.invalidateQueries({ queryKey: ['members'] });
  };
  const fail = (e: Error) => setError(e.message);

  const create = useMutation({
    mutationFn: () => createCassette(newName.trim(), me),
    onSuccess: (c) => {
      refresh();
      setNewName('');
      setCassette(c.id);
      setOpen(false);
    },
    onError: fail,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setManage(null);
          setOpen(true);
        }}
        className="font-mono flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.1em]"
        style={{ border: '1px solid var(--line)', color: 'var(--dim)' }}
      >
        <span aria-hidden="true">⏏</span>
        <span className="truncate" style={{ color: 'var(--ink)' }}>
          {current?.name ?? 'Kein Band'}
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} variant="full" title="Kassettenfach">
        {manage ? (
          <Members
            cassette={cassettes.find((c) => c.id === manage)!}
            onBack={() => setManage(null)}
            onLeft={() => {
              setManage(null);
              if (manage === cassetteId) setCassette(null);
              refresh();
            }}
          />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              {cassettes.length === 0 && (
                <p className="font-hand py-6 text-center text-lg" style={{ color: 'var(--dim)' }}>
                  Noch kein Band im Regal.
                </p>
              )}

              {cassettes.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-xl p-2.5"
                  style={{
                    background: 'var(--card)',
                    border: `1px solid ${c.id === cassetteId ? 'var(--accent)' : 'var(--line)'}`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCassette(c.id);
                      setOpen(false);
                      window.scrollTo({ top: 0 });
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <MiniCassette id={c.id} active={c.id === cassetteId} side={side} />
                    <span className="min-w-0 flex-1">
                      <span className="font-hand block truncate text-[1.05rem]" style={{ color: 'var(--ink)' }}>
                        {c.name}
                      </span>
                      <span
                        className="font-mono block truncate text-[0.58rem] uppercase tracking-[0.1em]"
                        style={{ color: 'var(--dim)' }}
                      >
                        {c.memberCount} {c.memberCount === 1 ? 'Person' : 'Leute'} · A {c.sideA} · B {c.sideB}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManage(c.id)}
                    aria-label={`${c.name} verwalten`}
                    className="font-mono shrink-0 rounded-full px-2 py-1 text-[0.56rem] uppercase tracking-[0.1em]"
                    style={{ border: '1px solid var(--line)', color: 'var(--dim)' }}
                  >
                    Leute
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 border-t pt-5" style={{ borderColor: 'var(--line)' }}>
              <label className="font-mono text-[0.62rem] uppercase tracking-[0.12em]" style={{ color: 'var(--dim)' }}>
                Neues Band beschriften
              </label>
              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={40}
                  placeholder="z. B. Freitagsrunde"
                  className="font-hand min-w-0 flex-1 rounded-lg px-3 py-2.5 text-[1.05rem] outline-none"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                />
                <button
                  type="button"
                  disabled={!newName.trim() || create.isPending}
                  onClick={() => create.mutate()}
                  className="font-disp rounded-lg px-4 py-2.5 text-sm font-bold uppercase tracking-[0.1em] disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: '#17130E' }}
                >
                  Einlegen
                </button>
              </div>
              <p className="font-mono text-[0.6rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
                Du bist danach allein auf dem Band und kannst Leute dazuholen. Jedes Mitglied darf
                weitere holen.
              </p>
            </div>

            {invite && <p className="text-sm" style={{ color: 'var(--accent)' }}>{invite}</p>}
            {error && <p className="text-sm" style={{ color: '#F0B5A5' }}>{error}</p>}
          </div>
        )}
      </Sheet>
    </>
  );

  function Members({
    cassette,
    onBack,
    onLeft,
  }: {
    cassette: Cassette;
    onBack: () => void;
    onLeft: () => void;
  }) {
    const [name, setName] = useState(cassette.name);
    const [add, setAdd] = useState('');
    const { data: members = [] } = useQuery({
      queryKey: ['members', cassette.id],
      queryFn: () => fetchMembers(cassette.id),
    });
    const { data: profiles = [] } = useProfiles();
    const known = profiles.map((p) => p.name).filter((n) => !members.some((m) => m.name === n));

    const doAdd = useMutation({
      mutationFn: (who: string) => addMember(cassette.id, who, me),
      onSuccess: () => {
        refresh();
        setAdd('');
        setInvite('');
      },
      onError: fail,
    });
    const doRemove = useMutation({
      mutationFn: (who: string) => removeMember(cassette.id, who, me),
      onSuccess: (_d, who) => {
        refresh();
        if (who === me) onLeft();
      },
      onError: fail,
    });
    const doRename = useMutation({
      mutationFn: () => renameCassette(cassette.id, name.trim(), me),
      onSuccess: refresh,
      onError: fail,
    });

    return (
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={onBack}
          className="font-mono self-start text-[0.62rem] uppercase tracking-[0.12em]"
          style={{ color: 'var(--dim)' }}
        >
          ← Fach
        </button>

        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="font-hand min-w-0 flex-1 rounded-lg px-3 py-2.5 text-[1.05rem] outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />
          <button
            type="button"
            disabled={!name.trim() || name.trim() === cassette.name}
            onClick={() => doRename.mutate()}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          >
            Umbenennen
          </button>
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="font-disp text-sm font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ink)' }}>
            Auf diesem Band
          </h3>
          {members.map((m) => (
            <div
              key={m.name}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2"
              style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
            >
              <Avatar name={m.name} side={side} size={1.6} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm" style={{ color: 'var(--ink)' }}>
                  {m.name}
                  {m.name === me && ' (du)'}
                </span>
                {m.addedBy !== m.name && (
                  <span className="font-mono block text-[0.56rem]" style={{ color: 'var(--dim)' }}>
                    geholt von {m.addedBy}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  const self = m.name === me;
                  const q = self
                    ? `Das Band "${cassette.name}" verlassen?`
                    : `${m.name} vom Band nehmen?`;
                  if (confirm(q)) doRemove.mutate(m.name);
                }}
                className="font-mono shrink-0 px-1 text-[0.6rem] uppercase"
                style={{ color: m.name === me ? '#F0B5A5' : 'var(--dim)' }}
              >
                {m.name === me ? 'verlassen' : 'raus'}
              </button>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="font-disp text-sm font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ink)' }}>
            Jemanden holen
          </h3>
          <div className="flex gap-2">
            <input
              value={add}
              onChange={(e) => setAdd(e.target.value)}
              maxLength={40}
              placeholder="Name"
              className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-base outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            />
            <button
              type="button"
              disabled={!add.trim() || doAdd.isPending}
              onClick={() => doAdd.mutate(add.trim())}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#17130E' }}
            >
              Dazu
            </button>
          </div>
          {known.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {known.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => doAdd.mutate(n)}
                  className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[0.72rem]"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                >
                  <Avatar name={n} side={side} size={1.1} />
                  {n}
                </button>
              ))}
            </div>
          )}
          <p className="font-mono text-[0.6rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
            Jedes Mitglied darf jemanden holen — wer wen geholt hat, steht oben und bleibt sichtbar.
          </p>
        </section>
      </div>
    );
  }
}

/** Miniaturband fuers Regal — zeigt echte Bandsorte, Spuren und Streifen. */
function MiniCassette({ id, active, side }: { id: string; active: boolean; side: 'a' | 'b' }) {
  const { type, case: plastic, wear } = lookFor(id);
  const onB = active && side === 'b';

  const shell = onB ? plastic.shell : type.shell;
  const paper = onB ? plastic.inner : type.label;
  const tape = onB ? plastic.shellHi : type.tape;
  const stripe = onB ? plastic.glow : type.stripe;

  return (
    <svg width="46" height="32" viewBox="0 0 46 32" aria-hidden="true" className="shrink-0"
         style={{ opacity: active ? 1 : 0.72 }}>
      <rect width="46" height="32" rx="3" fill={shell} />
      <rect x="4" y="6" width="38" height="16" rx="1.5" fill={paper} />
      <circle cx="16" cy="14" r="4.5" fill={tape} />
      <circle cx="30" cy="14" r="4.5" fill={tape} />
      <circle cx="16" cy="14" r="1.6" fill={paper} />
      <circle cx="30" cy="14" r="1.6" fill={paper} />
      {/* dieselben Gebrauchsspuren wie am grossen Band */}
      {wear.scratches.slice(0, 2).map(([x, y, len], i) => (
        <line key={i} x1={x * 0.46} y1={y * 0.32} x2={(x + len) * 0.46} y2={y * 0.32 - 1}
              stroke="rgba(255,255,255,.25)" strokeWidth="0.4" />
      ))}
      <rect x="4" y="25" width="38" height="2" rx="1" fill={stripe} opacity={active ? 0.9 : 0.5} />
    </svg>
  );
}
