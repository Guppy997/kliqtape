import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteEverything, downloadExport, saveProfile, uploadMedia } from '@/lib/api';
import { useApp, SIDE_LABEL, SIDE_HINT, type Side } from '@/store/appStore';
import Avatar, { useProfiles } from './Avatar';
import CameraCapture from './CameraCapture';
import Sheet from './Sheet';
import Lockup from './Lockup';
import VersionLog from './VersionLog';
import { VERSION } from '@/changelog';

export default function Settings() {
  const me = useApp((s) => s.me);
  const setMe = useApp((s) => s.setMe);
  const side = useApp((s) => s.side);
  const startSide = useApp((s) => s.startSide);
  const setStartSide = useApp((s) => s.setStartSide);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [shooting, setShooting] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [name, setName] = useState(me);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: profiles } = useProfiles();
  const myAvatar = profiles?.find((p) => p.name === me)?.avatarId ?? null;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['profiles'] });
    void qc.invalidateQueries({ queryKey: ['feed'] });
  };

  const setAvatar = useMutation({
    mutationFn: (avatarId: string | null) => saveProfile(me, avatarId),
    onSuccess: () => {
      refresh();
      setShooting(false);
      setNote('Profilbild gespeichert');
    },
    onError: (e: Error) => setError(e.message),
  });

  function renameMe() {
    const next = name.trim();
    if (!next || next === me) return;
    // Beitraege haengen im Prototyp am Namen, nicht an einer ID.
    setMe(next);
    setNote(`Ab jetzt heißt du ${next}. Alte Aufnahmen behalten den alten Namen.`);
    refresh();
  }

  async function wipe() {
    const typed = prompt(
      `Alles löschen? Beiträge, Mixtapes, Hotlines und Profilbild werden vom Server entfernt.\n\nTippe zur Bestätigung deinen Namen ein:`,
    );
    if (typed?.trim() !== me) {
      if (typed !== null) setError('Name stimmt nicht — nichts gelöscht.');
      return;
    }
    try {
      const { geloescht } = await deleteEverything(me);
      localStorage.removeItem('kliqtape');
      alert(
        `Gelöscht: ${geloescht.posts} Beiträge, ${geloescht.tapes} Mixtapes, ${geloescht.medien} Dateien.`,
      );
      location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Löschen fehlgeschlagen');
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Profil"
        onClick={() => {
          setName(me);
          setNote(null);
          setError(null);
          setOpen(true);
        }}
        className="flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5"
        style={{ border: '1px solid var(--line)', color: 'var(--dim)' }}
      >
        <Avatar name={me} side={side} size={1.2} />
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em]">Profil</span>
      </button>

      {/* Volle Seite in der Farbe der aktuellen Seite — nichts scheint durch. */}
      <Sheet open={open} onClose={() => setOpen(false)} title="Profil" variant="full">
        {shooting ? (
          <CameraCapture
            mode="photo"
            round
            withCaption={false}
            title="Profilbild · nur jetzt"
            sendLabel="Übernehmen"
            onCancel={() => setShooting(false)}
            onSend={async (blob) => {
              const id = await uploadMedia(blob);
              await setAvatar.mutateAsync(id);
            }}
          />
        ) : (
          <div className="flex flex-col gap-7 pb-4">
            {/* --- Wer du bist --- */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <Avatar name={me} side={side} size={5} />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="font-hand truncate text-2xl" style={{ color: 'var(--ink)' }}>
                    {me}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShooting(true)}
                      className="rounded-lg px-3 py-2 text-sm font-semibold"
                      style={{ background: 'var(--accent)', color: '#17130E' }}
                    >
                      {myAvatar ? 'Neues Bild' : 'Bild aufnehmen'}
                    </button>
                    {myAvatar && (
                      <button
                        type="button"
                        onClick={() => setAvatar.mutate(null)}
                        className="rounded-lg px-3 py-2 text-sm"
                        style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--dim)' }}
                      >
                        Entfernen
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <p className="font-mono text-[0.6rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
                Auch das Profilbild wird aufgenommen, nicht hochgeladen — kein perfektes Bild aus
                der Galerie.
              </p>
            </section>

            <Block title="Name">
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-base outline-none"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                />
                <button
                  type="button"
                  onClick={renameMe}
                  disabled={!name.trim() || name.trim() === me}
                  className="rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                >
                  Ändern
                </button>
              </div>
              <Hint>Im Prototyp ist der Name deine Identität — alte Aufnahmen behalten den alten.</Hint>
            </Block>

            {/* --- Startseite --- */}
            <Block title="Beim Öffnen">
              <div className="grid grid-cols-2 gap-2">
                {(['a', 'b'] as Side[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStartSide(s)}
                    className="rounded-lg px-3 py-2.5 text-left"
                    style={{
                      background: startSide === s ? 'var(--accent)' : 'var(--card)',
                      border: '1px solid var(--line)',
                      color: startSide === s ? '#17130E' : 'var(--ink)',
                    }}
                  >
                    <span className="font-disp block text-sm font-bold uppercase tracking-[0.1em]">
                      Seite {s.toUpperCase()}
                    </span>
                    <span className="font-mono block text-[0.58rem] uppercase tracking-[0.08em] opacity-70">
                      {SIDE_LABEL[s]}
                    </span>
                  </button>
                ))}
              </div>
            </Block>

            {/* --- Ehrlichkeit statt Versprechen --- */}
            <Block title="Was der Server sieht">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[0.78rem]" style={{ color: 'var(--ink)' }}>
                  <thead>
                    <tr className="font-mono text-[0.56rem] uppercase tracking-[0.1em]" style={{ color: 'var(--dim)' }}>
                      <th className="pb-1.5 pr-2 font-normal">&nbsp;</th>
                      <th className="pb-1.5 pr-2 font-normal">A · {SIDE_LABEL.a}</th>
                      <th className="pb-1.5 font-normal">B · {SIDE_LABEL.b}</th>
                    </tr>
                  </thead>
                  <tbody className="align-top">
                    {[
                      ['Texte', 'im Klartext', 'im Klartext'],
                      ['Bilder, Clips, O-Töne', 'im Klartext', 'im Klartext'],
                      ['Wer mit wem', 'sichtbar', 'sichtbar'],
                      ['Hotlines', 'im Klartext', 'im Klartext'],
                    ].map(([k, a, b]) => (
                      <tr key={k} style={{ borderTop: '1px solid var(--line)' }}>
                        <td className="py-1.5 pr-2">{k}</td>
                        <td className="py-1.5 pr-2" style={{ color: 'var(--dim)' }}>{a}</td>
                        <td className="py-1.5" style={{ color: 'var(--dim)' }}>{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p
                className="font-mono rounded-lg px-3 py-2.5 text-[0.62rem] leading-relaxed"
                style={{ background: 'rgba(184,70,44,.15)', color: '#F0B5A5' }}
              >
                Auf dem Gehäuse steht „Ende-zu-Ende" — das stimmt noch nicht. In diesem Prototyp ist
                <strong> nichts verschlüsselt</strong>, auch Seite B nicht. Diese Tabelle sagt immer
                die Wahrheit; wenn Verschlüsselung kommt, ändert sie sich hier zuerst.
              </p>
            </Block>

            {/* --- Deine Daten --- */}
            <Block title="Deine Daten">
              <button
                type="button"
                onClick={() => downloadExport(me).catch((e) => setError(e.message))}
                className="rounded-lg px-3 py-2.5 text-left text-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
              >
                Alles herunterladen
                <span className="font-mono block text-[0.58rem]" style={{ color: 'var(--dim)' }}>
                  Beiträge, Mixtapes, Hotlines und Reaktionen als JSON
                </span>
              </button>
              <button
                type="button"
                onClick={wipe}
                className="rounded-lg px-3 py-2.5 text-left text-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: '#F0B5A5' }}
              >
                Alles löschen
                <span className="font-mono block text-[0.58rem] opacity-70">
                  Vom Server entfernt, nicht nur von diesem Gerät
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('kliqtape');
                  location.reload();
                }}
                className="rounded-lg px-3 py-2.5 text-left text-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--dim)' }}
              >
                Nur abmelden
                <span className="font-mono block text-[0.58rem] opacity-70">
                  Deine Aufnahmen bleiben auf dem Server
                </span>
              </button>
            </Block>

            {/* --- Die zwei Seiten --- */}
            <Block title="Die zwei Seiten">
              {(['a', 'b'] as Side[]).map((s) => (
                <div
                  key={s}
                  className="flex items-baseline gap-2 rounded-lg px-3 py-2.5"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
                >
                  <span className="font-disp text-sm font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--ink)' }}>
                    {s.toUpperCase()} · {SIDE_LABEL[s]}
                  </span>
                  <span className="font-mono text-[0.6rem]" style={{ color: 'var(--dim)' }}>
                    {SIDE_HINT[s]}
                  </span>
                </div>
              ))}
            </Block>

            {/* --- Über --- */}
            <section className="flex flex-col items-start gap-3 border-t pt-5" style={{ borderColor: 'var(--line)' }}>
              <Lockup size="1.7rem" />
              <button
                type="button"
                onClick={() => setShowLog((v) => !v)}
                className="font-mono flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[0.66rem] uppercase tracking-[0.1em]"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--dim)' }}
              >
                <span>
                  Version <span className="tabular-nums" style={{ color: 'var(--accent)' }}>{VERSION}</span> · Verlauf
                </span>
                <span aria-hidden="true">{showLog ? '▴' : '▾'}</span>
              </button>
              {showLog && <VersionLog />}
              <p className="font-mono text-[0.58rem]" style={{ color: 'var(--dim)' }}>
                AGPL-3.0 · self-hosted · kein Tracking, keine Werbung, kein Algorithmus
              </p>
            </section>

            {note && <p className="font-mono text-[0.66rem]" style={{ color: 'var(--accent)' }}>{note}</p>}
            {error && <p className="font-mono text-[0.66rem]" style={{ color: '#F0B5A5' }}>{error}</p>}
          </div>
        )}
      </Sheet>
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-disp text-sm font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ink)' }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[0.6rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
      {children}
    </p>
  );
}
