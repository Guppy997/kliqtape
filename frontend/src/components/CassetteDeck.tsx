import { useId, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMember,
  createCassette,
  deleteCassette,
  fetchCassettes,
  fetchMembers,
  removeMember,
  renameCassette,
  setCassetteColorIndex,
  type Cassette,
} from '@/lib/api';
import { useApp } from '@/store/appStore';
import { useBottomNav } from '@/store/navStore';
import { useViewMode } from '@/store/viewStore';
import { assignPairs, lookFor, PAIR_COUNT } from '@/lib/cassetteLook';
import Avatar, { useProfiles } from './Avatar';
import NavButton from './NavButton';
import Sheet from './Sheet';

/** Alle Kassetten dieser Person. Zentral, weil App und Fach sie brauchen. */
export function useCassettes() {
  const me = useApp((s) => s.me);
  return useQuery({
    queryKey: ['cassettes', me],
    queryFn: () => fetchCassettes(me),
    enabled: Boolean(me),
    // Regelmaessig nachsehen, ob auf einer anderen Kassette etwas Neues
    // ankam — sonst wuerde die Neuigkeiten-Anzeige nur beim Seitenwechsel
    // aktualisieren.
    refetchInterval: 30_000,
  });
}

/**
 * Kassetten mit unsichtbarem "Neues seit dem letzten Einlegen" — die
 * eingelegte Kassette zaehlt nie mit, die sieht man ja gerade.
 */
export function useCassetteNews(): Cassette[] {
  const cassettes = useCassettes().data ?? [];
  const cassetteId = useApp((s) => s.cassetteId);
  const seenAt = useApp((s) => s.cassetteSeenAt);
  return useMemo(
    () => cassettes.filter((c) => c.id !== cassetteId && c.lastAt != null && c.lastAt > (seenAt[c.id] ?? 0)),
    [cassettes, cassetteId, seenAt],
  );
}

/**
 * Welches Band welche Sorte bekommt — im Regal nie zweimal dieselbe.
 *
 * Drei Ebenen, in dieser Reihenfolge:
 * 1. colorIndex — fest von Hand gewaehlt (siehe Farb-Schritt beim Anlegen),
 *    zeigt IMMER genau diese Sorte, keine Kollisions-Logik.
 * 2. colorSeed — manueller Hash-Override (z. B. um zwei Baender zu tauschen),
 *    zaehlt statt der ID.
 * 3. sonst die ID selbst.
 * Von Hand gewaehlte Sorten (1.) reservieren ihren Platz auch fuer die
 * automatisch zugewiesenen (2./3.) — sonst koennte ein frisch angelegtes Band
 * zufaellig dieselbe Sorte hashen, die jemand bewusst gewaehlt hat.
 */
export function useLookIndex(): Map<string, number> {
  const { data: cassettes = [] } = useCassettes();
  return useMemo(() => {
    const out = new Map<string, number>();
    const fixed = new Set<number>();
    const auto: Cassette[] = [];
    for (const c of cassettes) {
      if (c.colorIndex != null) {
        out.set(c.id, c.colorIndex);
        fixed.add(c.colorIndex);
      } else {
        auto.push(c);
      }
    }
    const keys = auto.map((c) => c.colorSeed || c.id);
    const byKey = assignPairs(keys, fixed);
    auto.forEach((c) => {
      const idx = byKey.get(c.colorSeed || c.id);
      if (idx != null) out.set(c.id, idx);
    });
    return out;
  }, [cassettes]);
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

  // Echte Tableiste: der Store haelt, welcher der drei unteren Knoepfe gerade
  // offen ist — nie mehrere gleichzeitig (siehe navStore.ts).
  const navActive = useBottomNav((s) => s.active);
  const setActiveNav = useBottomNav((s) => s.setActive);
  const setViewMode = useViewMode((s) => s.setViewMode);
  const open = navActive === 'eject';
  const [manage, setManage] = useState<string | null>(null);
  // Nach "Einlegen" haelt das die ID des frisch angelegten Bands, solange
  // der Farb-Schritt offen ist — danach (fertig oder uebersprungen) wieder null.
  const [pickColor, setPickColor] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [invite, setInvite] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: cassettes = [] } = useCassettes();
  const looks = useLookIndex();

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
      // Nicht sofort schliessen — erst die Farbe anbieten, kann aber
      // uebersprungen werden (dann bleibt die automatisch gewuerfelte Sorte).
      setPickColor(c.id);
    },
    onError: fail,
  });

  const chooseColor = useMutation({
    mutationFn: (idx: number) => setCassetteColorIndex(pickColor!, idx, me),
    onSuccess: () => {
      refresh();
      setPickColor(null);
      setActiveNav(null);
    },
    onError: fail,
  });

  return (
    <>
      <NavButton
        icon={
          <svg width="16" height="13" viewBox="0 0 16 13" fill="currentColor" aria-hidden="true">
            <path d="M8 0l8 8H0z" />
            <rect x="0" y="10.5" width="16" height="2.5" rx="1" />
          </svg>
        }
        label="Eject"
        active={open}
        onClick={() => {
          setError(null);
          setManage(null);
          setPickColor(null);
          setActiveNav('eject');
        }}
      />

      <Sheet
        open={open}
        onClose={() => setActiveNav(null)}
        variant="full"
        reserveBottomNav
        title={pickColor ? 'Farbe wählen' : 'Kassettenfach'}
      >
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
        ) : pickColor ? (
          <div className="flex flex-col gap-5">
            <div>
              <p className="font-hand text-lg" style={{ color: 'var(--ink)' }}>
                Welche Farbe soll das Band haben?
              </p>
              <p className="font-mono mt-1 text-[0.62rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
                Ohne Auswahl bleibt die automatisch zugewiesene Sorte.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: PAIR_COUNT }, (_, idx) => {
                const { case: c } = lookFor(pickColor, idx);
                const isCurrent = looks.get(pickColor) === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={chooseColor.isPending}
                    onClick={() => chooseColor.mutate(idx)}
                    className="flex flex-col items-center gap-1.5 rounded-xl p-2 disabled:opacity-50"
                    style={{
                      background: 'var(--card)',
                      border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--line)'}`,
                    }}
                  >
                    {/* Immer als Seite B gezeigt (unabhaengig davon, auf
                        welcher Seite man gerade steht) — nur dort tragen die
                        Sorten ihre Muster, und genau darum geht es hier. */}
                    <MiniCassette id={pickColor} pairIndex={idx} active side="b" />
                    <span className="font-mono text-center text-[0.52rem] uppercase tracking-[0.06em]" style={{ color: 'var(--dim)' }}>
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {error && <p className="text-sm" style={{ color: '#F0B5A5' }}>{error}</p>}

            <button
              type="button"
              onClick={() => {
                setPickColor(null);
                setActiveNav(null);
              }}
              className="font-mono rounded-lg px-4 py-2.5 text-[0.66rem] uppercase tracking-[0.1em]"
              style={{ border: '1px solid var(--line)', color: 'var(--dim)' }}
            >
              Überspringen
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              {/* Immer da, unabhaengig davon ob schon Storys existieren —
                  bewusst NICHT wie eine normale Kassette gefaerbt (die
                  Bandsorten-Palette ist absichtlich gedeckt/vintage), sondern
                  eine eigene, schimmernde Optik — soll auf den ersten Blick
                  als "das ist was anderes" auffallen. */}
              <button
                type="button"
                onClick={() => {
                  setViewMode('story');
                  setActiveNav(null);
                }}
                className="flex items-center gap-3 rounded-xl p-2.5 text-left"
                style={{
                  background: 'var(--card)',
                  border: '1px solid color-mix(in srgb, #E0568C 45%, var(--line))',
                  boxShadow: '0 0 0.9rem rgba(224,86,140,.16)',
                }}
              >
                <StoryCassetteIcon />
                <span className="min-w-0 flex-1">
                  <span className="font-hand block truncate text-[1.05rem]" style={{ color: '#E0568C' }}>
                    Story
                  </span>
                  <span
                    className="font-mono block truncate text-[0.58rem] uppercase tracking-[0.1em]"
                    style={{ color: 'var(--dim)' }}
                  >
                    Foto &amp; Video · 24 Stunden sichtbar
                  </span>
                </span>
              </button>

              {/* Der offizielle Kanal — ebenfalls immer da, unabhaengig von
                  eigenen Kassetten. Eigene Optik ueber das echte Wortmarke-
                  Logo statt erfundener Farben, damit sofort klar ist: das
                  ist die App selbst, nicht irgendeine besondere Gruppe. */}
              <button
                type="button"
                onClick={() => {
                  setViewMode('news');
                  setActiveNav(null);
                }}
                className="flex items-center gap-3 rounded-xl p-2.5 text-left"
                style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
              >
                <KliqtapeCassetteIcon />
                <span className="min-w-0 flex-1">
                  <span className="font-hand block truncate text-[1.05rem]" style={{ color: 'var(--ink)' }}>
                    Kliqtape
                  </span>
                  <span
                    className="font-mono block truncate text-[0.58rem] uppercase tracking-[0.1em]"
                    style={{ color: 'var(--dim)' }}
                  >
                    News, Insights &amp; unterstütze das Projekt
                  </span>
                </span>
              </button>

              <h3
                className="font-disp mt-1 text-xs font-bold uppercase tracking-[0.14em]"
                style={{ color: 'var(--dim)' }}
              >
                Gruppen
              </h3>

              {cassettes.length === 0 && (
                <p className="font-hand py-6 text-center text-lg" style={{ color: 'var(--dim)' }}>
                  Noch kein Band im Fach.
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
                      setActiveNav(null);
                      window.scrollTo({ top: 0 });
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <MiniCassette id={c.id} pairIndex={looks.get(c.id)} active={c.id === cassetteId} side={side} pop />
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
                    aria-label={`${c.name} bearbeiten`}
                    title="Bearbeiten"
                    className="grid size-7 shrink-0 place-items-center rounded-full"
                    style={{ border: '1px solid var(--line)', color: 'var(--dim)' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                         strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M11 2l3 3-8 8-3.5.5.5-3.5z" />
                      <path d="M9.5 3.5l3 3" />
                    </svg>
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
    const query = add.trim().toLowerCase();
    const foundKnown = query ? known.filter((n) => n.toLowerCase().includes(query)) : known;
    const isNewName = query.length > 0 && !known.some((n) => n.toLowerCase() === query);

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
    const doDelete = useMutation({
      mutationFn: () => deleteCassette(cassette.id, me),
      onSuccess: () => {
        refresh();
        // Dieselbe Aufraeum-Logik wie beim Verlassen: Fach schliesst die
        // Ansicht, und falls es die gerade eingelegte Kassette war, wird
        // sie ausgelegt.
        onLeft();
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
          <input
            value={add}
            onChange={(e) => setAdd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && add.trim() && !doAdd.isPending) doAdd.mutate(add.trim());
            }}
            maxLength={40}
            placeholder="Suchen oder neuen Namen eintippen"
            className="rounded-lg px-3 py-2.5 text-base outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />

          <div className="flex flex-col gap-1.5">
            {foundKnown.map((n) => (
              <button
                key={n}
                type="button"
                disabled={doAdd.isPending}
                onClick={() => doAdd.mutate(n)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left disabled:opacity-50"
                style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
              >
                <Avatar name={n} side={side} size={1.4} />
                <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--ink)' }}>{n}</span>
                <span aria-hidden="true" className="font-disp text-base font-bold" style={{ color: 'var(--accent)' }}>+</span>
              </button>
            ))}

            {isNewName && (
              <button
                type="button"
                disabled={doAdd.isPending}
                onClick={() => doAdd.mutate(add.trim())}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left disabled:opacity-50"
                style={{ background: 'var(--card)', border: '1px dashed var(--line)' }}
              >
                <Avatar name={add.trim()} side={side} size={1.4} />
                <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--ink)' }}>
                  „{add.trim()}“ neu holen
                </span>
                <span aria-hidden="true" className="font-disp text-base font-bold" style={{ color: 'var(--accent)' }}>+</span>
              </button>
            )}

            {!query && known.length === 0 && (
              <p className="font-mono py-1 text-[0.62rem]" style={{ color: 'var(--dim)' }}>
                Noch niemand sonst bekannt — einfach oben einen Namen eintippen.
              </p>
            )}
          </div>

          <p className="font-mono text-[0.6rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
            Jedes Mitglied darf jemanden holen — wer wen geholt hat, steht oben und bleibt sichtbar.
          </p>
        </section>

        <section className="flex flex-col gap-2 border-t pt-5" style={{ borderColor: 'var(--line)' }}>
          <h3 className="font-disp text-sm font-bold uppercase tracking-[0.14em]" style={{ color: '#F0B5A5' }}>
            Gefahrenzone
          </h3>
          <p className="font-mono text-[0.6rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
            Löscht das Band für alle Mitglieder — Beiträge, Fotos, Videos und O-Töne darauf sind
            danach weg. Mixtapes bleiben, die gehören nicht zu einer Kassette.
          </p>
          <button
            type="button"
            disabled={doDelete.isPending}
            onClick={() => {
              if (
                confirm(
                  `"${cassette.name}" endgültig löschen? Das lässt sich nicht rückgängig machen.`,
                )
              ) {
                doDelete.mutate();
              }
            }}
            className="font-mono inline-flex w-fit shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-[0.66rem] uppercase tracking-[0.1em] disabled:opacity-50"
            style={{ background: 'rgba(184,70,44,.18)', border: '1px solid #B8462C', color: '#F0B5A5' }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                 strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 4.5h10" />
              <path d="M6.3 4.5V2.8h3.4v1.7" />
              <path d="M4.2 4.5l.6 8.4a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.6-8.4" />
              <path d="M6.5 7v4M8 7v4M9.5 7v4" />
            </svg>
            Kassette löschen
          </button>
        </section>
      </div>
    );
  }
}

/** Eigene, schimmernde Optik fuer die Story-Zeile — bewusst NICHT aus der
 *  Bandsorten-Palette (lookFor/PAIRS), die ist absichtlich gedeckt/vintage.
 *  Gold-Pink-Lila-Verlauf + kleine Glanzpunkte statt Marmor-Sprenkel, damit
 *  sofort klar ist: das ist keine Kassette wie die anderen. */
function StoryCassetteIcon() {
  return (
    <svg width="46" height="32" viewBox="0 0 46 32" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="story-shell" x1="0" y1="0" x2="46" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5C86B" />
          <stop offset="45%" stopColor="#E0568C" />
          <stop offset="100%" stopColor="#7C5CE0" />
        </linearGradient>
        <linearGradient id="story-label" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF6E9" />
          <stop offset="100%" stopColor="#FBD9C0" />
        </linearGradient>
      </defs>
      <rect width="46" height="32" rx="3" fill="url(#story-shell)" />
      <circle cx="6" cy="5" r="0.8" fill="#fff" opacity="0.9" />
      <circle cx="40" cy="27" r="0.7" fill="#fff" opacity="0.8" />
      <circle cx="41.5" cy="6" r="0.5" fill="#fff" opacity="0.7" />
      <rect x="4" y="6" width="38" height="16" rx="1.5" fill="url(#story-label)" />
      <circle cx="16" cy="14" r="4.5" fill="#F5C86B" />
      <circle cx="30" cy="14" r="4.5" fill="#E0568C" />
      <circle cx="16" cy="14" r="1.6" fill="url(#story-label)" />
      <circle cx="30" cy="14" r="1.6" fill="url(#story-label)" />
      <rect x="4" y="25" width="38" height="2" rx="1" fill="#fff" opacity="0.85" />
    </svg>
  );
}

/** Eigene Optik fuer die Kliqtape-Zeile, im Stil des Wortmarke-Logos
 *  (Lockup.tsx): dort ist "Kliq" voll eingefaerbt, "tape" nur Kontur — genau
 *  dieselbe Zweiteilung wandert hier auf die Spulen: linke Spule voll
 *  (wie "Kliq"), rechte Spule nur Umriss (wie "tape"). Bewusst monochrom mit
 *  denselben Theme-Variablen wie das echte Logo, keine erfundene Farbe. */
function KliqtapeCassetteIcon() {
  return (
    <svg width="46" height="32" viewBox="0 0 46 32" aria-hidden="true" className="shrink-0">
      <rect width="46" height="32" rx="3" fill="var(--ink)" />
      <rect x="4" y="6" width="38" height="16" rx="1.5" fill="var(--screen)" />
      {/* linke Spule — voll, wie "Kliq" */}
      <circle cx="16" cy="14" r="4.5" fill="var(--ink)" />
      <circle cx="16" cy="14" r="1.6" fill="var(--screen)" />
      {/* rechte Spule — nur Kontur, wie "tape" */}
      <circle cx="30" cy="14" r="4.5" fill="none" stroke="var(--ink)" strokeWidth="1.4" />
      <rect x="4" y="25" width="38" height="2" rx="1" fill="var(--ink)" />
    </svg>
  );
}

/** Miniaturband — zeigt echte Bandsorte, Spuren und Streifen. Auch vom
 *  Tape-Regal genutzt (Shelf.tsx), daher exportiert. */
export function MiniCassette({ id, pairIndex, active, side, pop }:
  { id: string; pairIndex?: number; active: boolean; side: 'a' | 'b'; pop?: boolean }) {
  const uid = useId();
  const { type, case: plastic, wear } = lookFor(id, pairIndex);
  const onB = active && side === 'b';

  const shell = onB ? plastic.shell : type.shell;
  const paper = onB ? plastic.inner : type.label;
  const tape = onB ? plastic.shellHi : type.tape;
  const stripe = onB ? plastic.glow : type.stripe;
  const shellGrad = `mini-shell-${uid}`;
  const reelGrad = `mini-reel-${uid}`;

  return (
    <svg width="46" height="32" viewBox="0 0 46 32" aria-hidden="true" className="shrink-0"
         style={{
           opacity: active ? 1 : 0.72,
           // Nur in der eigentlichen Fach-Liste (nicht im Farb-Auswahlraster,
           // das waere mit vielen kleinen Glueh-Schatten nebeneinander zu
           // unruhig) — echter Schlagschatten + Akzentfarb-Glow, damit die
           // Kassette sich vom Hintergrund abhebt statt drin zu verschwimmen.
           filter: pop ? `drop-shadow(0 0.2rem 0.4rem rgba(0,0,0,.5)) drop-shadow(0 0 0.35rem ${stripe}70)` : undefined,
         }}>
      <defs>
        {/* Gleiche Lichtrichtung wie beim grossen Kassetten-Kopf — oben
            links hell, unten rechts dunkler, macht aus der flachen Flaeche
            ein leicht gewoelbtes Gehaeuse. */}
        <radialGradient id={shellGrad} cx="24%" cy="10%" r="95%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
        </radialGradient>
        <radialGradient id={reelGrad} cx="36%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="40%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.4" />
        </radialGradient>
      </defs>
      <rect width="46" height="32" rx="3" fill={shell} />
      {/* Marmor-/Konfetti-Sprenkel, nur bei gemusterten Sorten (plastic.fleck)
          und nur auf Seite B — sitzen unter dem Etikett, das Etikett-Rechteck
          deckt die Mitte ab, am Rand bleiben sie sichtbar. */}
      {onB && plastic.fleck && wear.specks.slice(0, 7).map(([x, y, r], i) => (
        <circle key={i} cx={x * 0.46} cy={y * 0.32} r={Math.max(1, r * 0.9)}
                fill={plastic.fleck![i % plastic.fleck!.length]} opacity={0.88} />
      ))}
      <rect width="46" height="32" rx="3" fill={`url(#${shellGrad})`} />
      <rect x="4" y="6" width="38" height="16" rx="1.5" fill={paper} />
      <circle cx="16" cy="14" r="4.5" fill={tape} />
      <circle cx="30" cy="14" r="4.5" fill={tape} />
      <circle cx="16" cy="14" r="4.5" fill={`url(#${reelGrad})`} />
      <circle cx="30" cy="14" r="4.5" fill={`url(#${reelGrad})`} />
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
