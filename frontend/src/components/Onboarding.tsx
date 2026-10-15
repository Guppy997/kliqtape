import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptInvite,
  ApiError,
  createCassette,
  fetchInvites,
  redeemLetter,
  renameIdentity,
  requestLetter,
  saveOnboarding,
  saveProfile,
  setCassetteColorIndex,
  uploadMedia,
  type Cassette,
} from '@/lib/api';
import { lookFor, PAIR_COUNT } from '@/lib/cassetteLook';
import { clearLetterToken, pendingLetterToken } from '@/lib/letter';
import { useApp } from '@/store/appStore';
import Avatar from './Avatar';
import CameraCapture from './CameraCapture';
import { CassetteFacePreview } from './CassetteHeader';
import { MiniCassette, useCassettes } from './CassetteDeck';
import { MiniBag } from './ChallengeCard';
import InviteLinkButton from './InviteLinkButton';
import Sheet from './Sheet';

/*
 * Onboarding, einmal nach der ersten Anmeldung. Die Einfuehrung (was
 * Kliqtape ist, das Versprechen, Datenschutz) und das Profil lassen sich
 * ueberspringen, das Mindestalter und die Rechtstexte nicht. Danach geht es
 * mit einer Einladung direkt in die Kassette, sonst wird die erste angelegt.
 *
 * In den Einstellungen laesst sich die Einfuehrung nochmal ansehen (replay):
 * dann nur die erklaerenden Screens, ohne Profil, Haken und Start.
 *
 * Schreibregel fuer alle Texte hier: kurz, keine Gedankenstriche. Kein
 * Fortschrittsbalken, nur "Weiter" und "Ueberspringen".
 */

type Step = 'what' | 'sides' | 'challenge' | 'promise' | 'privacy' | 'profile' | 'consent' | 'start';
const INTRO: Step[] = ['what', 'sides', 'challenge', 'promise', 'privacy'];

export default function Onboarding({ replay = false, onDone }: { replay?: boolean; onDone: () => void }) {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('what');

  async function finish() {
    if (!replay) {
      await saveOnboarding(me, { done: true });
      await qc.invalidateQueries({ queryKey: ['onboarding', me] });
    }
    onDone();
  }

  function next() {
    const i = INTRO.indexOf(step);
    if (i >= 0 && i < INTRO.length - 1) return setStep(INTRO[i + 1]!);
    if (step === 'privacy') return replay ? onDone() : setStep('profile');
    if (step === 'profile') return setStep('consent');
    if (step === 'consent') return setStep('start');
  }

  function skipIntro() {
    if (replay) return onDone();
    setStep('profile');
  }

  switch (step) {
    case 'what':
      return (
        <Frame
          art={
            <div className="mx-auto">
              <CassetteFacePreview
                side="a"
                cassetteId="onboarding"
                pairIndex={0}
                label="Eure Runde"
                count={0}
                width={240}
              />
            </div>
          }
          title="Eine Kassette ist ein fester Freundeskreis."
          primary="Weiter"
          onPrimary={next}
          secondary="Überspringen"
          onSecondary={skipIntro}
        >
          Für jede Runde gibt es ein eigenes Band. Was drauf ist, sehen nur die Leute, die auch drauf sind.
        </Frame>
      );
    case 'sides':
      return (
        <Frame
          art={<SidesArt />}
          title="Seite A bleibt. Seite B läuft."
          primary="Weiter"
          onPrimary={next}
          secondary="Überspringen"
          onSecondary={skipIntro}
        >
          Auf Seite A sammelt ihr, was bleiben soll: euer gemeinsames Archiv. Seite B ist euer Gruppenchat.
        </Frame>
      );
    case 'challenge':
      return (
        <Frame
          art={
            <div className="mx-auto [zoom:1.8]">
              <MiniBag />
            </div>
          }
          title="Jede Woche eine Challenge."
          primary="Weiter"
          onPrimary={next}
          secondary="Überspringen"
          onSecondary={skipIntro}
        >
          Ein Foto, ein kurzer Clip, ein Mixtape oder ein Spiel. Aufgelöst wird sonntags um 19 Uhr, für alle
          gleichzeitig.
        </Frame>
      );
    case 'promise':
      return (
        <Frame
          title="Was es hier nicht gibt."
          primary="Weiter"
          onPrimary={next}
          secondary="Überspringen"
          onSecondary={skipIntro}
        >
          <List
            items={[
              'Keinen Feed, der dich festhält.',
              'Keine Likes und keine Zahlen.',
              'Keine Werbung.',
              'Kein Tracking.',
            ]}
          />
          <p className="mt-5">
            Und keinen Zwang: Die Challenge ist freiwillig. Sehen dürfen alle, auch wer nicht mitmacht.
          </p>
        </Frame>
      );
    case 'privacy':
      return (
        <Frame
          title="Deine Daten."
          primary={replay ? 'Fertig' : 'Weiter'}
          onPrimary={next}
          secondary={replay ? undefined : 'Überspringen'}
          onSecondary={skipIntro}
        >
          <List
            items={[
              'Der Chat ist Ende-zu-Ende-verschlüsselt.',
              'Das Archiv liegt verschlüsselt auf Servern in Deutschland.',
              'Wir schauen nicht rein, außer jemand meldet einen Inhalt. Jeder Zugriff wird veröffentlicht.',
            ]}
          />
          {/* Ehrlich bleiben: Das oben ist das Ziel, nicht der heutige Stand. */}
          <div
            className="mt-6 rounded-xl px-4 py-3 text-sm leading-relaxed"
            style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-line)', color: 'var(--danger)' }}
          >
            <strong className="block tracking-[0.12em]">DEMO-VERSION</strong>
            So soll es sein, umgesetzt ist es noch nicht. Heute ist nichts verschlüsselt, und ein öffentliches
            Zugriffsprotokoll gibt es noch nicht. Was wirklich gilt, steht jederzeit in den Einstellungen unter „Was der
            Server sieht“.
          </div>
        </Frame>
      );
    case 'profile':
      return <ProfileStep onNext={next} />;
    case 'consent':
      return <ConsentStep onNext={next} />;
    case 'start':
      return <StartStep onFinish={() => void finish()} />;
  }
}

/* --- Bausteine ------------------------------------------------------------- */

function Frame({
  art,
  title,
  children,
  primary,
  onPrimary,
  primaryDisabled,
  secondary,
  onSecondary,
}: {
  art?: ReactNode;
  title: string;
  children?: ReactNode;
  primary: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondary?: string;
  onSecondary?: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[70] flex flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]"
      style={{ background: 'var(--screen)' }}
    >
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 overflow-y-auto py-4">
        {art}
        <h1 className="text-2xl leading-tight font-semibold text-balance" style={{ color: 'var(--ink)' }}>
          {title}
        </h1>
        {children && (
          <div className="text-base leading-relaxed" style={{ color: 'var(--dim)' }}>
            {children}
          </div>
        )}
      </div>
      <div className="mx-auto flex w-full max-w-sm items-center justify-between gap-3 pt-3">
        {secondary ? (
          <button type="button" onClick={onSecondary} className="hit px-1 text-sm" style={{ color: 'var(--dim)' }}>
            {secondary}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled}
          className="rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-40"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          {primary}
        </button>
      </div>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((t) => (
        <li key={t} className="flex gap-3" style={{ color: 'var(--ink)' }}>
          <span
            aria-hidden="true"
            className="mt-2 size-1.5 shrink-0 rounded-full"
            style={{ background: 'var(--accent)' }}
          />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function SidesArt() {
  const card = (side: string, label: string, hint: string) => (
    <span
      className="flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-4"
      style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      <span
        className="grid size-10 place-items-center rounded-full text-base font-semibold"
        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
      >
        {side}
      </span>
      <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
        {label}
      </span>
      <span className="text-2xs" style={{ color: 'var(--dim)' }}>
        {hint}
      </span>
    </span>
  );
  return (
    <div className="flex gap-3">
      {card('A', 'Bleibt', 'euer Archiv')}
      {card('B', 'Läuft', 'euer Gruppenchat')}
    </div>
  );
}

/* --- Profil ------------------------------------------------------------------ */

function ProfileStep({ onNext }: { onNext: () => void }) {
  const me = useApp((s) => s.me);
  const token = useApp((s) => s.token);
  const side = useApp((s) => s.side);
  const setIdentity = useApp((s) => s.setIdentity);
  const qc = useQueryClient();
  const [name, setName] = useState(me);
  const [shooting, setShooting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const next = name.trim();
    if (!next || next === me) return onNext();
    setBusy(true);
    setError(null);
    try {
      const res = await renameIdentity(next);
      if (token) setIdentity(res.name, token);
      onNext();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? 'Der Name ist schon vergeben.' : 'Hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  }

  if (shooting) {
    return (
      <div
        className="fixed inset-0 z-[70] overflow-y-auto px-4 pt-[max(1.5rem,env(safe-area-inset-top))]"
        style={{ background: 'var(--screen)' }}
      >
        <div className="mx-auto max-w-sm">
          <CameraCapture
            mode="photo"
            round
            withCaption={false}
            title="Profilbild"
            sendLabel="Übernehmen"
            onCancel={() => setShooting(false)}
            onSend={async (blob) => {
              const id = await uploadMedia(blob);
              await saveProfile(me, id);
              await qc.invalidateQueries({ queryKey: ['profiles'] });
              setShooting(false);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <Frame
      art={
        <div className="mx-auto">
          <Avatar name={name.trim() || me} side={side} size={5} />
        </div>
      }
      title="Wie sollen dich die anderen sehen?"
      primary="Weiter"
      onPrimary={() => void save()}
      primaryDisabled={busy || !name.trim()}
      secondary="Überspringen"
      onSecondary={onNext}
    >
      <div className="flex flex-col gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          aria-label="Dein Name"
          className="w-full rounded-lg px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
        <button
          type="button"
          onClick={() => setShooting(true)}
          className="self-start text-sm underline"
          style={{ color: 'var(--accent)' }}
        >
          Profilbild aufnehmen (optional)
        </button>
        {error && <span style={{ color: 'var(--danger)' }}>{error}</span>}
      </div>
    </Frame>
  );
}

/* --- Mindestalter und Rechtstexte ------------------------------------------- */

function ConsentStep({ onNext }: { onNext: () => void }) {
  const me = useApp((s) => s.me);
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [legal, setLegal] = useState<null | 'terms' | 'privacy'>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await saveOnboarding(me, { ageConfirmed: true, termsAccepted: true });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Frame
        title="Kurz bestätigen."
        primary="Einverstanden"
        onPrimary={() => void accept()}
        primaryDisabled={busy || !age || !terms}
      >
        <div className="flex flex-col gap-3">
          <Check on={age} onToggle={() => setAge((v) => !v)}>
            Ich bin mindestens 16 Jahre alt.
          </Check>
          <Check on={terms} onToggle={() => setTerms((v) => !v)}>
            Ich akzeptiere die <LegalLink onClick={() => setLegal('terms')}>Nutzungsbedingungen</LegalLink> und die{' '}
            <LegalLink onClick={() => setLegal('privacy')}>Datenschutzerklärung</LegalLink>.
          </Check>
          {error && <span style={{ color: 'var(--danger)' }}>{error}</span>}
        </div>
      </Frame>
      <Sheet
        open={legal !== null}
        onClose={() => setLegal(null)}
        variant="full"
        title={legal === 'terms' ? 'Nutzungsbedingungen' : 'Datenschutzerklärung'}
      >
        <div className="flex flex-col gap-3 text-sm leading-relaxed" style={{ color: 'var(--dim)' }}>
          <p
            className="rounded-xl px-4 py-3"
            style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-line)', color: 'var(--danger)' }}
          >
            <strong className="block tracking-[0.12em]">ENTWURF</strong>
            Kliqtape ist ein Prototyp. Dieser Text entsteht vor dem öffentlichen Start und wird dann von jemandem vom
            Fach geprüft.
          </p>
          <p>
            Bis dahin gilt: Was der Server speichert und wer es sehen kann, steht ehrlich in den Einstellungen unter
            „Was der Server sieht“. Deine Daten kannst du dort jederzeit exportieren oder löschen.
          </p>
        </div>
      </Sheet>
    </>
  );
}

function Check({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        onClick={onToggle}
        className="hit mt-0.5 grid size-6 shrink-0 place-items-center rounded-md"
        style={{
          background: on ? 'var(--accent)' : 'transparent',
          border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
          color: 'var(--on-accent)',
        }}
      >
        {on && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M2 6.5 5 9l5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <span className="text-base leading-snug" style={{ color: 'var(--ink)' }}>
        {children}
      </span>
    </div>
  );
}

function LegalLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="underline" style={{ color: 'var(--accent)' }}>
      {children}
    </button>
  );
}

/* --- Start: Einladung annehmen oder erste Kassette anlegen ---------------------- */

function StartStep({ onFinish }: { onFinish: () => void }) {
  const me = useApp((s) => s.me);
  const setCassette = useApp((s) => s.setCassette);
  const qc = useQueryClient();
  const { data: cassettes, isLoading: loadingCassettes } = useCassettes();
  const [letterNote, setLetterNote] = useState<string | null>(null);
  const [created, setCreated] = useState<Cassette | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kam die Person ueber einen Brief oder Link? Dann wird er jetzt eingeloest
  // und erscheint gleich unten als Einladung zum Beitreten.
  const [redeemed, setRedeemed] = useState(false);
  useEffect(() => {
    const token = pendingLetterToken();
    if (!token) return setRedeemed(true);
    redeemLetter(me, token)
      .catch((err: unknown) => setLetterNote(err instanceof Error ? err.message : null))
      .finally(() => {
        clearLetterToken();
        setRedeemed(true);
      });
  }, [me]);

  const { data: invites = [], isLoading: loadingInvites } = useQuery({
    queryKey: ['invites', me],
    queryFn: () => fetchInvites(me),
    enabled: redeemed,
  });

  async function join(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await acceptInvite(id, me);
      await qc.invalidateQueries({ queryKey: ['cassettes', me] });
      void qc.invalidateQueries({ queryKey: ['invites', me] });
      setCassette(res.cassetteId);
      onFinish();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Beitreten hat nicht geklappt.');
      setBusy(false);
    }
  }

  if (!redeemed || loadingInvites || loadingCassettes) {
    return <Frame title="Einen Moment." primary="Weiter" onPrimary={() => undefined} primaryDisabled />;
  }

  if (created) {
    return (
      <Frame
        title="Hol deine Leute dazu."
        primary="Fertig"
        onPrimary={onFinish}
        secondary="Überspringen"
        onSecondary={onFinish}
      >
        <div className="flex flex-col gap-2">
          <p>Wer die Einladung öffnet, muss noch zustimmen. Erst dann ist die Person auf dem Band.</p>
          <InviteLinkButton cassette={created} />
          <LetterButton cassette={created} />
        </div>
      </Frame>
    );
  }

  if (invites.length > 0) {
    return (
      <Frame title="Du bist eingeladen." primary="Später" onPrimary={onFinish}>
        <div className="flex flex-col gap-2">
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-3 rounded-xl p-3"
              style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
            >
              <MiniCassette
                id={inv.cassetteId}
                pairIndex={inv.colorIndex ?? undefined}
                active
                side="a"
                label={inv.cassetteName}
              />
              <span className="min-w-0 flex-1 text-sm leading-snug" style={{ color: 'var(--ink)' }}>
                {inv.invitedBy} lädt dich auf „{inv.cassetteName}“ ein.
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void join(inv.id)}
                className="shrink-0 rounded-full px-3 py-1.5 text-2xs font-semibold disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                Beitreten
              </button>
            </div>
          ))}
          {error && <span style={{ color: 'var(--danger)' }}>{error}</span>}
        </div>
      </Frame>
    );
  }

  if ((cassettes?.length ?? 0) > 0) {
    return (
      <Frame title="Du bist schon dabei." primary="Los geht's" onPrimary={onFinish}>
        Deine Kassetten liegen im Fach.
      </Frame>
    );
  }

  return (
    <CreateFirst
      note={letterNote}
      onCreated={(c) => {
        setCassette(c.id);
        setCreated(c);
      }}
      onSkip={onFinish}
    />
  );
}

function CreateFirst({
  note,
  onCreated,
  onSkip,
}: {
  note: string | null;
  onCreated: (c: Cassette) => void;
  onSkip: () => void;
}) {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [look, setLook] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const c = await createCassette(name.trim(), me);
      if (look != null) await setCassetteColorIndex(c.id, look, me);
      await qc.invalidateQueries({ queryKey: ['cassettes', me] });
      onCreated(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame
      title="Leg deine erste Kassette an."
      primary="Anlegen"
      onPrimary={() => void create()}
      primaryDisabled={busy || !name.trim()}
      secondary="Später"
      onSecondary={onSkip}
    >
      <div className="flex flex-col gap-4">
        {note && <p style={{ color: 'var(--danger)' }}>{note}</p>}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="z. B. Freitagsrunde"
          aria-label="Name der Kassette"
          className="w-full rounded-lg px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: PAIR_COUNT }, (_, idx) => {
            const chosen = look === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setLook(chosen ? null : idx)}
                aria-pressed={chosen}
                aria-label={lookFor('neu', idx).case.name}
                className="grid place-items-center rounded-xl p-2"
                style={{ background: 'var(--card)', border: `1px solid ${chosen ? 'var(--accent)' : 'var(--line)'}` }}
              >
                <MiniCassette id="neu" pairIndex={idx} active side="b" label={name.trim() || undefined} />
              </button>
            );
          })}
        </div>
        {error && <span style={{ color: 'var(--danger)' }}>{error}</span>}
      </div>
    </Frame>
  );
}

function LetterButton({ cassette }: { cassette: Cassette }) {
  const me = useApp((s) => s.me);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  return (
    <button
      type="button"
      disabled={state === 'busy'}
      onClick={() => {
        setState('busy');
        requestLetter(cassette.id, me)
          .then(() => setState('done'))
          .catch(() => setState('idle'));
      }}
      className="rounded-lg px-3 py-2.5 text-left text-sm disabled:opacity-60"
      style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
    >
      {state === 'done' ? 'Brief gespeichert. Ausdrucken und verschenken.' : 'Einladung als Brief (PDF mit QR-Code)'}
    </button>
  );
}
