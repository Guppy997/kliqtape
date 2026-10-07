import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  deleteEverything,
  downloadExport,
  fetchAlbumOptOut,
  renameIdentity,
  saveProfile,
  setAlbumOptOut,
  uploadMedia,
} from '@/lib/api';
import { useApp, SIDE_LABEL, SIDE_HINT, type Side } from '@/store/appStore';
import Avatar, { useProfiles } from './Avatar';
import CameraCapture from './CameraCapture';
import Sheet from './Sheet';
import Lockup from './Lockup';
import VersionLog from './VersionLog';
import { VERSION } from '@/changelog';

/** Was der Server bei Funktionen sieht, die nicht an eine Seite gebunden
 *  sind. Ehrlich halten: lieber unangenehm als geschoent (CONCEPT.md §3). */
const SERVER_SEES_EXTRA: [string, string][] = [
  [
    'Film',
    'im Klartext. Bis Sonntagabend gibt der Server das Bild an niemanden heraus, auch nicht an dich — gespeichert ist es aber sofort',
  ],
  [
    'Imposter-Woche',
    'im Klartext: Aufgabe, wer Imposter ist, alle Beiträge und wer auf wen getippt hat. Andere sehen vor der Auflösung nur ihre eigene Karte',
  ],
  ['Meldungen', 'im Klartext: wer was gemeldet hat, Grund und Notiz. Die gemeldete Person erfährt es nicht'],
  [
    'Einladungsbrief',
    'wer wann einen Brief für welche Kassette gedruckt hat und wer ihn einlöst. Den Code im QR-Code selbst speichert der Server nicht, nur einen Fingerabdruck davon',
  ],
  ['Mixtape als Bild', 'nichts Neues — die Karte entsteht nur auf deinem Gerät aus dem, was du ohnehin siehst'],
  [
    'Album-Export',
    'das PDF entsteht auf dem Server aus Seite A — Seite B und Hot Line kann der Export-Code gar nicht lesen. Gespeichert wird das PDF nicht',
  ],
];

/** Einstellungen als Blatt — geoeffnet ueber das Zahnrad im Profil
 *  (ProfileView.tsx), nicht mehr ueber einen eigenen Knopf in der Leiste. */
export default function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useApp((s) => s.me);
  const token = useApp((s) => s.token);
  const setIdentity = useApp((s) => s.setIdentity);
  const side = useApp((s) => s.side);
  const startSide = useApp((s) => s.startSide);
  const setStartSide = useApp((s) => s.setStartSide);
  const qc = useQueryClient();

  const [shooting, setShooting] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [name, setName] = useState(me);
  const [renaming, setRenaming] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Beim Oeffnen frisch anfangen — frueher erledigte das der eigene Knopf.
  useEffect(() => {
    if (!open) return;
    setName(me);
    setNote(null);
    setError(null);
  }, [open, me]);

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

  async function renameMe() {
    const next = name.trim();
    if (!next || next === me) return;
    setRenaming(true);
    setError(null);
    try {
      // Serverseitiger Umzug: cascaded ueber Beitraege, Mixtapes, Hotlines
      // etc. (POST /api/auth/rename) — der Token bleibt derselbe, nur der
      // Name aendert sich.
      const res = await renameIdentity(next);
      if (token) setIdentity(res.name, token);
      setNote(`Ab jetzt heißt du ${res.name}. Alte Aufnahmen behalten den alten Namen.`);
      refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError('Der Name ist schon vergeben.');
      else setError(e instanceof Error ? e.message : 'Umbenennen fehlgeschlagen');
    } finally {
      setRenaming(false);
    }
  }

  async function copyToken() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setNote('Zugangscode kopiert.');
    } catch {
      setError('Kopieren fehlgeschlagen — Zugangscode von Hand markieren.');
    }
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
      alert(`Gelöscht: ${geloescht.posts} Beiträge, ${geloescht.tapes} Mixtapes, ${geloescht.medien} Dateien.`);
      location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Löschen fehlgeschlagen');
    }
  }

  return (
    <>
      {/* Volle Seite in der Farbe der aktuellen Seite — nichts scheint durch. */}
      <Sheet open={open} onClose={onClose} title="Einstellungen" variant="full">
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
                  <span className="truncate text-xl font-semibold" style={{ color: 'var(--ink)' }}>
                    {me}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShooting(true)}
                      className="rounded-lg px-3 py-2 text-sm font-semibold"
                      style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
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
              <p className="text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
                Auch das Profilbild wird aufgenommen, nicht hochgeladen — kein perfektes Bild aus der Galerie.
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
                  disabled={!name.trim() || name.trim() === me || renaming}
                  className="rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                >
                  {renaming ? '…' : 'Ändern'}
                </button>
              </div>
              <Hint>Der Name ist deine Identität — alte Aufnahmen behalten den alten.</Hint>
            </Block>

            <Block title="Zugangscode">
              <div className="flex gap-2">
                <div
                  className="min-w-0 flex-1 truncate rounded-lg px-3 py-2.5 text-sm"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                >
                  {token ? (tokenVisible ? token : '•'.repeat(20)) : '—'}
                </div>
                <button
                  type="button"
                  onClick={() => setTokenVisible((v) => !v)}
                  disabled={!token}
                  className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                >
                  {tokenVisible ? 'Verbergen' : 'Anzeigen'}
                </button>
                <button
                  type="button"
                  onClick={copyToken}
                  disabled={!token}
                  className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                >
                  Kopieren
                </button>
              </div>
              <Hint>
                Beweist, dass du {me} bist — auf einem zweiten Gerät beim Namen "{me}" eintippen, um dort dieselbe
                Identität zu übernehmen. Nicht per E-Mail oder SMS verschicken.
              </Hint>
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
                      color: startSide === s ? 'var(--on-accent)' : 'var(--ink)',
                    }}
                  >
                    <span className="block text-sm font-semibold">Seite {s.toUpperCase()}</span>
                    <span className="block text-2xs opacity-70">{SIDE_LABEL[s]}</span>
                  </button>
                ))}
              </div>
            </Block>

            {/* --- Ehrlichkeit statt Versprechen --- */}
            <Block title="Was der Server sieht">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-meta" style={{ color: 'var(--ink)' }}>
                  <thead>
                    <tr className="text-2xs" style={{ color: 'var(--dim)' }}>
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
                        <td className="py-1.5 pr-2" style={{ color: 'var(--dim)' }}>
                          {a}
                        </td>
                        <td className="py-1.5" style={{ color: 'var(--dim)' }}>
                          {b}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Funktionen, die nicht an Seite A/B haengen — jede neue Funktion
                  bekommt hier eine Zeile, bevor sie ausgeliefert wird. */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-meta" style={{ color: 'var(--ink)' }}>
                  <tbody className="align-top">
                    {SERVER_SEES_EXTRA.map(([k, v]) => (
                      <tr key={k} style={{ borderTop: '1px solid var(--line)' }}>
                        <td className="py-1.5 pr-2">{k}</td>
                        <td className="py-1.5" style={{ color: 'var(--dim)' }}>
                          {v}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p
                className="rounded-lg px-3 py-2.5 text-2xs leading-relaxed"
                style={{ background: 'rgba(184,70,44,.15)', color: 'var(--danger)' }}
              >
                In diesem Prototyp ist <strong>nichts Ende-zu-Ende-verschlüsselt</strong>, auch Seite B nicht. Diese
                Tabelle sagt immer die Wahrheit; wenn Verschlüsselung kommt, ändert sie sich hier zuerst.
              </p>
            </Block>

            {/* --- Deine Daten --- */}
            <Block title="Alben">
              <AlbumOptOut />
            </Block>

            <Block title="Deine Daten">
              <button
                type="button"
                onClick={() => downloadExport(me).catch((e) => setError(e.message))}
                className="rounded-lg px-3 py-2.5 text-left text-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
              >
                Alles herunterladen
                <span className="block text-2xs" style={{ color: 'var(--dim)' }}>
                  Beiträge, Mixtapes, Hotlines und Reaktionen als JSON
                </span>
              </button>
              <button
                type="button"
                onClick={wipe}
                className="rounded-lg px-3 py-2.5 text-left text-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--danger)' }}
              >
                Alles löschen
                <span className="block text-2xs opacity-70">Vom Server entfernt, nicht nur von diesem Gerät</span>
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
                <span className="block text-2xs opacity-70">Deine Aufnahmen bleiben auf dem Server</span>
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
                  <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {s.toUpperCase()} · {SIDE_LABEL[s]}
                  </span>
                  <span className="text-2xs" style={{ color: 'var(--dim)' }}>
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
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-2xs"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--dim)' }}
              >
                <span>
                  Version{' '}
                  <span className="tabular-nums" style={{ color: 'var(--accent)' }}>
                    {VERSION}
                  </span>{' '}
                  · Verlauf
                </span>
                <span aria-hidden="true">{showLog ? '▴' : '▾'}</span>
              </button>
              {showLog && <VersionLog />}
              <p className="text-2xs" style={{ color: 'var(--dim)' }}>
                AGPL-3.0 · kein Tracking, keine Werbung, kein Algorithmus
              </p>
            </section>

            {note && (
              <p className="text-2xs" style={{ color: 'var(--accent)' }}>
                {note}
              </p>
            )}
            {error && (
              <p className="text-2xs" style={{ color: 'var(--danger)' }}>
                {error}
              </p>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}

/** "Meine Beitraege nicht in Alben" — gilt fuer alle Kassetten und fuer
 *  alle, die exportieren. Der Server laesst die Beitraege dann weg. */
function AlbumOptOut() {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['album-opt-out', me], queryFn: () => fetchAlbumOptOut(me) });
  const toggle = useMutation({
    mutationFn: (optOut: boolean) => setAlbumOptOut(me, optOut),
    onSuccess: (r) => qc.setQueryData(['album-opt-out', me], r),
  });
  const on = data?.optOut ?? false;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={!data || toggle.isPending}
      onClick={() => toggle.mutate(!on)}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left disabled:opacity-60"
      style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm" style={{ color: 'var(--ink)' }}>
          Meine Beiträge nicht in Alben
        </span>
        <span className="block text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
          Wer ein Tape als PDF-Album speichert, bekommt deine Beiträge dann nicht mit.
        </span>
      </span>
      <span
        aria-hidden="true"
        className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
        style={{ background: on ? 'var(--accent)' : 'var(--line)' }}
      >
        <span
          className="absolute top-0.5 size-4 rounded-full bg-white transition-[left]"
          style={{ left: on ? '1.1rem' : '0.125rem' }}
        />
      </span>
    </button>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
      {children}
    </p>
  );
}
