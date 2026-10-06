import { useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteCassette,
  fetchFeed,
  fetchMembers,
  inviteMember,
  KIND_LABEL,
  removeMember,
  renameCassette,
  startImposter,
  type Cassette,
  type FeedItem,
} from '@/lib/api';
import { berlinDateLabel } from '@/lib/berlinDay';
import { useApp } from '@/store/appStore';
import { useJump } from '@/store/jumpStore';
import Avatar, { useProfiles } from './Avatar';
import { CassetteFacePreview } from './CassetteHeader';
import { useImposter } from './ImposterCard';
import AlbumExport from './AlbumExport';
import ReportForm from './ReportForm';

interface Props {
  cassette: Cassette;
  pairIndex?: number;
  /** Einladen gleich aufgeklappt — aus dem Leerzustand "allein auf dem Band". */
  startInviting?: boolean;
  onBack: () => void;
  /** Kassette ist fuer mich weg — verlassen oder geloescht. */
  onGone: () => void;
  /** Ein Suchtreffer wurde angetippt, das Fach soll zugehen. */
  onJump: () => void;
}

/**
 * Die Kassetten-Ansicht im Fach, aufgebaut wie die Gruppeninfo bei WhatsApp:
 * oben die Kassette mit Namen und Suche ueber das Band, darunter Mitglieder
 * und Einladen, ganz unten abgesetzt Verlassen, Melden und Loeschen.
 * Loeschen sieht nur, wer die Kassette angelegt hat — der Server prueft das
 * ohnehin (DELETE /api/cassettes/:id).
 */
export default function CassetteInfo({ cassette, pairIndex, startInviting = false, onBack, onGone, onJump }: Props) {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const fail = (e: Error) => setError(e.message);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['cassettes', me] });
    void qc.invalidateQueries({ queryKey: ['members', cassette.id] });
  };

  const isCreator = cassette.createdBy === me;

  const { data: members = [] } = useQuery({
    queryKey: ['members', cassette.id],
    queryFn: () => fetchMembers(cassette.id, me),
  });

  /* ---- Name -------------------------------------------------------------- */
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cassette.name);
  const doRename = useMutation({
    mutationFn: () => renameCassette(cassette.id, name.trim(), me),
    onSuccess: () => {
      setEditing(false);
      refresh();
    },
    onError: fail,
  });

  /* ---- Suche ------------------------------------------------------------- */
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const searching = q.length >= 2;
  // Dieselben Cache-Schluessel wie der Feed in App.tsx — was schon geladen
  // ist, wird nicht noch einmal geholt. Erst ab zwei Zeichen, damit das
  // blosse Oeffnen der Ansicht nichts laedt.
  const feeds = useQueries({
    queries: (['a', 'b'] as const).map((s) => ({
      queryKey: ['feed', cassette.id, s, me],
      queryFn: () => fetchFeed(cassette.id, s, me),
      enabled: searching,
    })),
  });
  const results = useMemo(() => {
    if (!searching) return [];
    const all = feeds.flatMap((f) => f.data ?? []);
    return all
      .filter(
        (p) =>
          p.body.toLowerCase().includes(q) ||
          p.author.toLowerCase().includes(q) ||
          (p.tape?.title ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 30);
    // feeds aendert bei jedem Rendern die Identitaet, die Daten darin nicht
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, q, feeds[0]?.data, feeds[1]?.data]);
  const searchLoading = searching && feeds.some((f) => f.isLoading);

  function openResult(p: FeedItem) {
    const { cassetteId, setCassette, setSide } = useApp.getState();
    if (cassetteId !== cassette.id) setCassette(cassette.id);
    setSide(p.side);
    useJump.getState().setJump(p.id);
    onJump();
  }

  /* ---- Einladen ---------------------------------------------------------- */
  const [inviting, setInviting] = useState(startInviting);
  const [add, setAdd] = useState('');
  const [invited, setInvited] = useState<string | null>(null);
  const { data: profiles = [] } = useProfiles();
  const known = profiles.map((p) => p.name).filter((n) => !members.some((m) => m.name === n));
  const addQ = add.trim().toLowerCase();
  const foundKnown = addQ ? known.filter((n) => n.toLowerCase().includes(addQ)) : known;
  const isNewName = addQ.length > 0 && !known.some((n) => n.toLowerCase() === addQ) && !members.some((m) => m.name.toLowerCase() === addQ);
  const doInvite = useMutation({
    mutationFn: (who: string) => inviteMember(cassette.id, who, me),
    onSuccess: (_d, who) => {
      setAdd('');
      setInvited(who);
    },
    onError: fail,
  });

  /* ---- Mitglieder, Verlassen, Loeschen ----------------------------------- */
  const doRemove = useMutation({
    mutationFn: (who: string) => removeMember(cassette.id, who, me),
    onSuccess: (_d, who) => {
      refresh();
      if (who === me) onGone();
    },
    onError: fail,
  });
  const doDelete = useMutation({
    mutationFn: () => deleteCassette(cassette.id, me),
    onSuccess: () => {
      refresh();
      onGone();
    },
    onError: fail,
  });
  const [reporting, setReporting] = useState(false);
  const [albumOpen, setAlbumOpen] = useState(false);

  function leave() {
    const others = members.filter((m) => m.name !== me);
    // Members kommen nach joined_at sortiert — die erste andere Person
    // uebernimmt, genau wie serverseitig in handOver().
    const heir = others[0]?.name;
    const question =
      others.length === 0
        ? `Du bist allein auf "${cassette.name}". Wenn du gehst, wird das Band mit allem darauf gelöscht.`
        : isCreator
          ? `"${cassette.name}" verlassen? Du hast das Band angelegt — danach darf ${heir} es löschen.`
          : `"${cassette.name}" verlassen? Du siehst danach nichts mehr davon, bis dich jemand wieder einlädt.`;
    if (confirm(question)) doRemove.mutate(me);
  }

  return (
    <div className="flex flex-col gap-7">
      <button
        type="button"
        onClick={onBack}
        className="font-mono self-start text-[0.62rem] uppercase tracking-[0.12em]"
        style={{ color: 'var(--dim)' }}
      >
        ← Fach
      </button>

      {/* ---- Kopf: Kassette, Name, Eckdaten ------------------------------ */}
      <div className="flex flex-col items-center gap-3 text-center">
        <span style={{ filter: 'drop-shadow(0 0.6rem 1.2rem rgba(0,0,0,.45))' }}>
          <CassetteFacePreview
            side="a"
            cassetteId={cassette.id}
            pairIndex={pairIndex}
            label={cassette.name}
            count={cassette.sideA + cassette.sideB}
            currentTape={null}
            width={188}
          />
        </span>

        {editing ? (
          <form
            className="flex w-full max-w-xs gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() && name.trim() !== cassette.name) doRename.mutate();
              else setEditing(false);
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoFocus
              aria-label="Name der Kassette"
              className="font-hand min-w-0 flex-1 rounded-lg px-3 py-2 text-center text-[1.15rem] outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--accent)', color: 'var(--ink)' }}
            />
            <button
              type="submit"
              disabled={!name.trim() || doRename.isPending}
              className="rounded-lg px-3 text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#17130E' }}
            >
              OK
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="font-hand text-[1.6rem] leading-tight" style={{ color: 'var(--ink)' }}>
              {cassette.name}
            </h2>
            <button
              type="button"
              onClick={() => {
                setName(cassette.name);
                setEditing(true);
              }}
              aria-label="Namen ändern"
              title="Namen ändern"
              className="grid size-7 place-items-center rounded-full"
              style={{ border: '1px solid var(--line)', color: 'var(--dim)' }}
            >
              <PencilIcon />
            </button>
          </div>
        )}

        <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em]" style={{ color: 'var(--dim)' }}>
          Kassette · {cassette.memberCount} {cassette.memberCount === 1 ? 'Person' : 'Leute'} · seit{' '}
          {berlinDateLabel(cassette.createdAt)}
        </p>
      </div>

      {/* ---- Suche über das Band ----------------------------------------- */}
      <section className="flex flex-col gap-2">
        <label
          className="flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
        >
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Auf diesem Band suchen"
            aria-label="Auf diesem Band suchen"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--ink)' }}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Suche leeren" style={{ color: 'var(--dim)' }}>
              ×
            </button>
          )}
        </label>

        {searching && (
          <div className="flex flex-col gap-1">
            {searchLoading && (
              <p className="font-mono py-2 text-[0.62rem]" style={{ color: 'var(--dim)' }}>
                Spule durch …
              </p>
            )}
            {!searchLoading && results.length === 0 && (
              <p className="font-mono py-2 text-[0.62rem]" style={{ color: 'var(--dim)' }}>
                Nichts gefunden — gesucht wird in Text, Bildunterschriften, Namen und Mixtape-Titeln.
              </p>
            )}
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openResult(p)}
                className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left"
                style={{ border: '1px solid var(--line)' }}
              >
                <span
                  className="font-mono mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[0.56rem] uppercase"
                  style={{ border: '1px solid var(--line)', color: 'var(--accent)' }}
                >
                  {p.track}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm" style={{ color: 'var(--ink)' }}>
                    <Highlight text={snippetOf(p)} q={q} />
                  </span>
                  <span className="font-mono block text-[0.56rem]" style={{ color: 'var(--dim)' }}>
                    {p.author} · {berlinDateLabel(p.created_at)} · Seite {p.side.toUpperCase()}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ---- Mitglieder und Einladen ------------------------------------- */}
      <section className="flex flex-col gap-1.5">
        <h3 className="font-disp mb-1 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--dim)' }}>
          {members.length} {members.length === 1 ? 'Person' : 'Leute'} auf dem Band
        </h3>

        <button
          type="button"
          onClick={() => {
            setInviting((v) => !v);
            setInvited(null);
          }}
          aria-expanded={inviting}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left"
          style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
        >
          <span
            className="grid size-[1.6rem] shrink-0 place-items-center rounded-full"
            style={{ background: 'var(--accent)', color: '#17130E' }}
            aria-hidden="true"
          >
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M7 1v12M1 7h12" />
            </svg>
          </span>
          <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
            Jemanden einladen
          </span>
        </button>

        {inviting && (
          <div className="flex flex-col gap-1.5 rounded-lg p-2" style={{ border: '1px dashed var(--line)' }}>
            <input
              value={add}
              onChange={(e) => {
                setAdd(e.target.value);
                setInvited(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && add.trim() && !doInvite.isPending) doInvite.mutate(add.trim());
              }}
              autoFocus
              maxLength={40}
              placeholder="Name suchen oder neu eintippen"
              className="rounded-lg px-3 py-2 text-base outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            />
            {invited && (
              <p className="font-mono px-1 text-[0.62rem]" style={{ color: 'var(--accent)' }}>
                {invited} ist eingeladen und muss noch zustimmen.
              </p>
            )}
            {foundKnown.slice(0, 8).map((n) => (
              <button
                key={n}
                type="button"
                disabled={doInvite.isPending}
                onClick={() => doInvite.mutate(n)}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left disabled:opacity-50"
              >
                <Avatar name={n} side={side} size={1.4} />
                <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--ink)' }}>
                  {n}
                </span>
                <span aria-hidden="true" className="font-disp text-base font-bold" style={{ color: 'var(--accent)' }}>
                  +
                </span>
              </button>
            ))}
            {isNewName && (
              <button
                type="button"
                disabled={doInvite.isPending}
                onClick={() => doInvite.mutate(add.trim())}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left disabled:opacity-50"
              >
                <Avatar name={add.trim()} side={side} size={1.4} />
                <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--ink)' }}>
                  „{add.trim()}“ neu einladen
                </span>
              </button>
            )}
            <p className="font-mono px-1 text-[0.58rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
              Jedes Mitglied darf einladen. Dabei ist die Person erst, wenn sie zustimmt.
            </p>
          </div>
        )}

        {members.map((m) => {
          const creator = m.name === cassette.createdBy;
          return (
            <div key={m.name} className="flex items-center gap-2.5 rounded-lg px-3 py-2">
              <Avatar name={m.name} side={side} size={1.6} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm" style={{ color: 'var(--ink)' }}>
                  {m.name}
                  {m.name === me && ' (du)'}
                </span>
                <span className="font-mono block text-[0.56rem]" style={{ color: 'var(--dim)' }}>
                  {creator ? 'hat das Band angelegt' : `eingeladen von ${m.addedBy}`}
                </span>
              </span>
              {m.name !== me && !creator && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`${m.name} vom Band nehmen?`)) doRemove.mutate(m.name);
                  }}
                  className="font-mono shrink-0 px-1 text-[0.6rem] uppercase"
                  style={{ color: 'var(--dim)' }}
                >
                  raus
                </button>
              )}
            </div>
          );
        })}
      </section>

      {/* ---- Aus dem Band etwas machen ------------------------------------ */}
      <section className="flex flex-col gap-1.5">
        <h3 className="font-disp mb-1 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--dim)' }}>
          Zum Mitnehmen
        </h3>
        <button
          type="button"
          onClick={() => setAlbumOpen(true)}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left"
          style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
        >
          <AlbumIcon />
          <span className="min-w-0 flex-1">
            <span className="block text-sm" style={{ color: 'var(--ink)' }}>
              Album als PDF
            </span>
            <span className="font-mono block text-[0.56rem]" style={{ color: 'var(--dim)' }}>
              Tapes von Seite A zum Ausdrucken
            </span>
          </span>
        </button>
      </section>
      <AlbumExport open={albumOpen} cassette={cassette} onClose={() => setAlbumOpen(false)} />

      {/* ---- Special: Imposter-Woche ------------------------------------- */}
      <ImposterSpecial cassette={cassette} onStarted={onJump} onError={fail} />

      {error && (
        <p className="text-sm" style={{ color: '#F0B5A5' }}>
          {error}
        </p>
      )}

      {/* ---- Abgesetzt: Verlassen, Melden, Loeschen ---------------------- */}
      <section
        className="mt-4 flex flex-col overflow-hidden rounded-xl"
        style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
      >
        <DangerRow icon={<LeaveIcon />} label="Kassette verlassen" onClick={leave} disabled={doRemove.isPending} />
        <div style={{ borderTop: '1px solid var(--line)' }}>
          {reporting ? (
            <ReportForm target={{ cassetteId: cassette.id }} what="diese Kassette" onDone={() => setReporting(false)} />
          ) : (
            <DangerRow icon={<FlagIcon />} label="Kassette melden" onClick={() => setReporting(true)} />
          )}
        </div>
        {isCreator && (
          <div style={{ borderTop: '1px solid var(--line)' }}>
            <DangerRow
              icon={<TrashIcon />}
              label="Kassette löschen"
              disabled={doDelete.isPending}
              onClick={() => {
                if (
                  confirm(
                    `"${cassette.name}" für alle löschen? Beiträge, Fotos, Clips und O-Töne darauf sind danach weg. Mixtapes bleiben, die gehören nicht zur Kassette.`,
                  )
                ) {
                  doDelete.mutate();
                }
              }}
            />
          </div>
        )}
      </section>
      <p className="font-mono -mt-4 px-1 text-[0.58rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
        {isCreator
          ? 'Löschen kannst nur du, weil du das Band angelegt hast. Gehst du, übernimmt das dienstälteste Mitglied.'
          : `Löschen kann nur ${cassette.createdBy}, die Person, die das Band angelegt hat.`}
      </p>
    </div>
  );
}

function snippetOf(p: FeedItem): string {
  if (p.body.trim()) return p.body.trim();
  if (p.kind === 'tape' && p.tape) return `Mixtape: ${p.tape.title}`;
  return KIND_LABEL[p.kind];
}

/** Treffer im Text hervorheben — ohne innerHTML, nur durch Aufteilen. */
function Highlight({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return <>{text}</>;
  // Bei langem Text ab kurz vor dem Treffer zeigen, sonst schneidet truncate ihn ab.
  const start = i > 24 ? i - 18 : 0;
  return (
    <>
      {start > 0 && '…'}
      {text.slice(start, i)}
      <mark style={{ background: 'color-mix(in srgb, var(--accent) 35%, transparent)', color: 'inherit', borderRadius: 2 }}>
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}

function DangerRow({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 px-3.5 py-3 text-left text-sm disabled:opacity-50"
      style={{ color: '#F0B5A5' }}
    >
      {icon}
      {label}
    </button>
  );
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function PencilIcon() {
  return (
    <svg {...iconProps} width={13} height={13}>
      <path d="M11 2l3 3-8 8-3.5.5.5-3.5z" />
      <path d="M9.5 3.5l3 3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg {...iconProps} style={{ color: 'var(--dim)' }}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}

function LeaveIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 2.5H3.5v11H6" />
      <path d="M10 5l3 3-3 3" />
      <path d="M13 8H6.5" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3.5 14V2.5" />
      <path d="M3.5 3h8l-1.6 2.8L11.5 8.5h-8" />
    </svg>
  );
}

function AlbumIcon() {
  return (
    <svg {...iconProps} width={18} height={18} style={{ color: 'var(--accent)' }}>
      <rect x="2.5" y="2" width="11" height="12" rx="1" />
      <path d="M5.5 2v12" />
      <rect x="7.5" y="5" width="4" height="3.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 4.5h10" />
      <path d="M6.3 4.5V2.8h3.4v1.7" />
      <path d="M4.2 4.5l.6 8.4a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.6-8.4" />
    </svg>
  );
}

/** Start der Imposter-Woche. Hier statt auf Seite A, weil es eine
 *  Entscheidung fuer die ganze Runde ist und bewusst selten vorkommt. */
function ImposterSpecial({ cassette, onStarted, onError }: { cassette: Cassette; onStarted: () => void; onError: (e: Error) => void }) {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();
  const { data } = useImposter(cassette.id);
  const start = useMutation({
    mutationFn: () => startImposter(cassette.id, me),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['imposter', cassette.id] });
      const { cassetteId, setCassette, setSide } = useApp.getState();
      if (cassetteId !== cassette.id) setCassette(cassette.id);
      setSide('a');
      onStarted();
    },
    onError,
  });
  if (!data) return null;
  const running = data.week && data.week.phase !== 'revealed';

  let status: string;
  if (running) status = 'Läuft gerade — Aufgabe und Abgabe stehen am Ende von Seite A.';
  else if (cassette.memberCount < data.minMembers) status = `Geht ab ${data.minMembers} Leuten auf dem Band.`;
  else if (!data.canStart && data.nextStartAt) status = `Die nächste geht frühestens am ${berlinDateLabel(data.nextStartAt)}.`;
  else status = '';

  return (
    <section className="flex flex-col gap-2 rounded-xl p-3.5" style={{ border: '1px dashed var(--line)' }}>
      <h3 className="font-disp text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--dim)' }}>
        Special
      </h3>
      <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
        Imposter-Woche
      </p>
      <p className="text-[0.8rem] leading-snug" style={{ color: 'var(--dim)' }}>
        Alle bekommen dieselbe Aufgabe, eine Person nur einen vagen Hinweis. Sonntagabend zeigen alle,
        was sie gemacht haben, und ihr tippt, wer es war. Kein Punktestand, nur der Spaß.
      </p>
      {status ? (
        <p className="font-mono text-[0.6rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
          {status}
        </p>
      ) : (
        <button
          type="button"
          disabled={start.isPending}
          onClick={() => {
            if (confirm(`Imposter-Woche auf "${cassette.name}" starten? Alle auf dem Band bekommen ihre Karte.`)) start.mutate();
          }}
          className="font-mono self-start rounded-full px-3.5 py-1.5 text-[0.62rem] uppercase tracking-[0.12em] disabled:opacity-50"
          style={{ background: '#C8402A', color: '#FFF4EC' }}
        >
          Imposter-Woche starten
        </button>
      )}
    </section>
  );
}
