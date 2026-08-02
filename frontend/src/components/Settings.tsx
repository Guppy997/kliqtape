import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveProfile, uploadMedia } from '@/lib/api';
import { useApp, SIDE_LABEL, SIDE_HINT } from '@/store/appStore';
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
    // Beitraege haengen im Prototyp am Namen, nicht an einer ID. Ein neuer
    // Name ist deshalb faktisch eine neue Identitaet — ehrlich benennen.
    setMe(next);
    setNote(`Ab jetzt heißt du ${next}. Alte Aufnahmen behalten den alten Namen.`);
    refresh();
  }

  function resetDevice() {
    if (!confirm('Name und lokale Einstellungen auf diesem Gerät löschen? Deine Aufnahmen bleiben auf dem Server.')) return;
    localStorage.removeItem('kliqtape');
    location.reload();
  }

  return (
    <>
      <button
        type="button"
        aria-label="Einstellungen"
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

      {/* Volle Seite statt Blatt: das Profil hat genug Inhalt, dass ein halb
          sichtbarer Feed dahinter nur ablenkt. */}
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
          <div className="flex flex-col gap-6">
            {/* --- Profil --- */}
            <section className="flex flex-col gap-3">
              <h3 className="font-disp text-sm font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ink)' }}>
                Profil
              </h3>

              <div className="flex items-center gap-4">
                <Avatar name={me} side={side} size={4.5} />
                <div className="flex flex-col gap-2">
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
              <p className="font-mono text-[0.62rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
                Auch das Profilbild wird aufgenommen, nicht hochgeladen. Kein perfektes Bild aus
                der Galerie — so wie du gerade aussiehst.
              </p>
            </section>

            {/* --- Name --- */}
            <section className="flex flex-col gap-2">
              <h3 className="font-disp text-sm font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ink)' }}>
                Name
              </h3>
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
              <p className="font-mono text-[0.62rem]" style={{ color: 'var(--dim)' }}>
                Im Prototyp ist der Name deine Identität — alte Aufnahmen behalten den alten.
              </p>
            </section>

            {/* --- Seiten --- */}
            <section className="flex flex-col gap-2">
              <h3 className="font-disp text-sm font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ink)' }}>
                Die zwei Seiten
              </h3>
              {(['a', 'b'] as const).map((s) => (
                <div
                  key={s}
                  className="flex items-baseline gap-2 rounded-lg px-3 py-2.5"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
                >
                  <span className="font-disp text-sm font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--ink)' }}>
                    {s.toUpperCase()} · {SIDE_LABEL[s]}
                  </span>
                  <span className="font-mono text-[0.62rem]" style={{ color: 'var(--dim)' }}>
                    {SIDE_HINT[s]}
                  </span>
                </div>
              ))}
              <p
                className="rounded-lg px-3 py-2 font-mono text-[0.62rem] leading-relaxed"
                style={{ background: 'rgba(184,70,44,.15)', color: '#F0B5A5' }}
              >
                Achtung: Seite B ist in diesem Prototyp noch NICHT verschlüsselt. Der Server liest
                alles mit. Keine echten privaten Inhalte einstellen.
              </p>
            </section>

            {/* --- Gerät --- */}
            <section className="flex flex-col gap-2">
              <h3 className="font-disp text-sm font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ink)' }}>
                Dieses Gerät
              </h3>
              <button
                type="button"
                onClick={resetDevice}
                className="rounded-lg px-3 py-2.5 text-left text-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: '#F0B5A5' }}
              >
                Abmelden und lokale Daten löschen
              </button>
            </section>

            {/* --- Über --- */}
            <section className="flex flex-col items-start gap-3 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
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
              <p className="font-mono text-[0.6rem]" style={{ color: 'var(--dim)' }}>
                AGPL-3.0 · self-hosted
              </p>
            </section>

            {note && (
              <p className="font-mono text-[0.66rem]" style={{ color: 'var(--accent)' }}>
                {note}
              </p>
            )}
            {error && (
              <p className="font-mono text-[0.66rem]" style={{ color: '#F0B5A5' }}>
                {error}
              </p>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
