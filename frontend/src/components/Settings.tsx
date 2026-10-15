import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  deleteEverything,
  downloadExport,
  fetchAlbumOptOut,
  fetchPronouns,
  renameIdentity,
  savePronouns,
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
import SwitchRow from './SwitchRow';
import Onboarding from './Onboarding';
import { VERSION } from '@/changelog';
import { disableReminder, enableReminder, fetchReminder, pushSupported } from '@/lib/push';

/** Was der Server bei Funktionen sieht, die nicht an eine Seite gebunden
 *  sind. Ehrlich halten: lieber unangenehm als geschoent (CONCEPT.md §3). */
const SERVER_SEES_EXTRA: [string, string][] = [
  [
    'Wochen-Challenge',
    'im Klartext: dein Beitrag und in welche deiner Kassetten du ihn gelegt hast. Bis Sonntag 19 Uhr gibt der Server ihn an niemanden heraus, auch nicht an dich — gespeichert ist er aber sofort. Wer sonst mitmacht, verrät er niemandem',
  ],
  [
    'Imposter-Woche',
    'im Klartext: die Aufgabe jeder Runde, wer Imposter ist, alle Beiträge und wer auf wen getippt hat. Vor der Auflösung sieht jede Person nur ihre eigene Karte; wer schon getippt hat, zeigt die App nicht',
  ],
  [
    'Challenge „Damals“',
    'nur das Aufnahmedatum, das dein Handy aus dem Foto liest oder das du angibst — nicht die Bilddaten selbst. Prüfen kann der Server das Datum nicht',
  ],
  [
    'Verwalten & Stummschalten',
    'wer eine Runde mitverwaltet und ob du die Wochen-Challenge dort für dich stummgeschaltet hast. Dein Stummschalter ist für niemanden sonst sichtbar',
  ],
  [
    'Wochen-Erinnerung',
    'nur die Push-Adresse deines Geräts, wenn du sie erlaubst. Die Erinnerung läuft über den Push-Dienst von Apple oder Google und enthält einen festen Satz, nie Inhalte',
  ],
  ['Onboarding', 'wann du das Mindestalter bestätigt und die Rechtstexte akzeptiert hast, und in welcher Fassung'],
  [
    'Pronomen',
    'nur wenn du welche einträgst: im Klartext. Andere sehen sie nur in der Mitgliederliste deiner Kassetten; die App verwendet sie für nichts anderes',
  ],
  ['Meldungen', 'im Klartext: wer was gemeldet hat, Grund und Notiz. Die gemeldete Person erfährt es nicht'],
  [
    'Einladung als Brief oder Link',
    'wer wann einen Brief gedruckt oder einen Link erstellt hat, für welche Kassette, und wer ihn einlöst. Den Code selbst speichert der Server nicht, nur einen Fingerabdruck davon',
  ],
  [
    'Eigenes Regal',
    'im Klartext: welche Tapes du gesammelt und wie du sie beschriftet hast. Die Runde sieht davon nichts, auch nicht, dass oder wie viele gesammelt haben',
  ],
  [
    'Eigene Tapes',
    'im Klartext: Titel, Zettel, Fotos, Clips und O-Töne. In der App nur für dich — die Bilder sind aber wie alle Medien über ihre zufällige Adresse abrufbar',
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
  const [replay, setReplay] = useState(false);
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
      {replay && <Onboarding replay onDone={() => setReplay(false)} />}
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

            <Block title="Pronomen">
              <PronounsField />
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

            {/* --- Wochen-Erinnerung (Web-Push, hoechstens eine pro Woche) --- */}
            <Block title="Erinnerung">
              <ReminderSwitch />
            </Block>

            {/* --- Einfuehrung nochmal ansehen (Onboarding.tsx, nur die Erklaerungen) --- */}
            <Block title="Einführung">
              <button
                type="button"
                onClick={() => setReplay(true)}
                className="rounded-lg px-3 py-2.5 text-left text-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
              >
                Einführung nochmal ansehen
              </button>
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

/** Pronomen, freiwillig und als Freitext. Sehen nur die Mitglieder der
 *  eigenen Kassetten in der Mitgliederliste; die App verwendet sie fuer
 *  nichts anderes. Bewusst nicht im Onboarding. */
function PronounsField() {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['pronouns', me], queryFn: () => fetchPronouns(me) });
  // null = noch nichts getippt, dann steht der gespeicherte Wert im Feld.
  const [draft, setDraft] = useState<string | null>(null);
  const saved = data?.pronouns ?? '';
  const value = draft ?? saved;
  const save = useMutation({
    mutationFn: (next: string) => savePronouns(me, next),
    onSuccess: (r) => {
      qc.setQueryData(['pronouns', me], r);
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ['members'] });
    },
  });
  const dirty = value.trim() !== saved;
  return (
    <>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) save.mutate(value);
        }}
      >
        <input
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!data}
          maxLength={30}
          aria-label="Pronomen"
          placeholder="z. B. sie/ihr, er/ihm, they/them"
          className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-base outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
        <button
          type="submit"
          disabled={!dirty || save.isPending}
          className="rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
          style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        >
          {save.isPending ? '…' : 'Speichern'}
        </button>
      </form>
      {save.error && (
        <p className="text-2xs" style={{ color: 'var(--danger)' }}>
          {(save.error as Error).message}
        </p>
      )}
      <Hint>Freiwillig. Sehen nur die Leute aus deinen Kassetten, in der Mitgliederliste. Für nichts anderes.</Hint>
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
    <SwitchRow
      title="Meine Beiträge nicht in Alben"
      hint="Wer ein Tape als PDF-Album speichert, bekommt deine Beiträge dann nicht mit."
      on={on}
      disabled={!data || toggle.isPending}
      onToggle={(next) => toggle.mutate(next)}
    />
  );
}

function ReminderSwitch() {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();
  const supported = pushSupported();
  const { data } = useQuery({
    queryKey: ['reminder', me],
    queryFn: () => fetchReminder(me),
    enabled: supported,
  });
  const toggle = useMutation({
    mutationFn: async (on: boolean) => {
      if (on) {
        if (!(await enableReminder(me))) throw new Error('Benachrichtigungen sind für Kliqtape nicht erlaubt.');
      } else {
        await disableReminder(me);
      }
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['reminder', me] }),
  });
  const on = Boolean(data?.subscribed) && supported && Notification.permission === 'granted';

  if (!supported) {
    return (
      <p
        className="rounded-lg px-3 py-2.5 text-2xs leading-relaxed"
        style={{ border: '1px solid var(--line)', color: 'var(--dim)' }}
      >
        Die Wochen-Erinnerung geht nur in der installierten App. Auf dem iPhone über „Teilen“ und „Zum Home-Bildschirm“.
      </p>
    );
  }
  return (
    <>
      <SwitchRow
        title="Wochen-Erinnerung"
        hint="Sonntags, wenn die Challenge aufgelöst ist. Höchstens eine pro Woche."
        on={on}
        disabled={!data || toggle.isPending}
        onToggle={(next) => toggle.mutate(next)}
      />
      {toggle.error && (
        <p className="px-1 text-2xs" style={{ color: 'var(--danger)' }}>
          {(toggle.error as Error).message}
        </p>
      )}
    </>
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
