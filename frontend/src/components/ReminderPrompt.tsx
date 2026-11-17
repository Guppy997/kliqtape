import { useState } from 'react';
import { useCassettes } from './CassetteDeck';
import { enableReminder, pushSupported } from '@/lib/push';
import { useApp } from '@/store/appStore';

const ASKED_KEY = 'kliqtape-reminder-asked';

function askedBefore(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === '1';
  } catch {
    return true;
  }
}

function markAsked() {
  try {
    localStorage.setItem(ASKED_KEY, '1');
  } catch {
    /* ohne Speicher fragt die App eben nicht nochmal */
  }
}

/**
 * Die Frage nach der Wochen-Erinnerung — nicht im Onboarding, sondern erst
 * nach dem ersten Beitritt (sobald man auf einer Kassette ist), einmal, mit
 * dem Hinweis "hoechstens eine pro Woche". Nur wo Push ueberhaupt geht und
 * noch nicht entschieden ist; spaeter jederzeit in den Einstellungen.
 */
export default function ReminderPrompt() {
  const me = useApp((s) => s.me);
  const { data: cassettes = [] } = useCassettes();
  const [hidden, setHidden] = useState(askedBefore);
  const [busy, setBusy] = useState(false);

  const show = !hidden && cassettes.length > 0 && pushSupported() && Notification.permission === 'default';
  if (!show) return null;

  function close() {
    markAsked();
    setHidden(true);
  }

  return (
    <div
      role="dialog"
      aria-label="Wochen-Erinnerung"
      className="glass fixed inset-x-3 bottom-[calc(var(--bottombar-h,4rem)+0.75rem)] z-[46] mx-auto flex max-w-xl flex-col gap-3 rounded-2xl p-4"
    >
      <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
        Erinnerung, wenn die Challenge aufgelöst ist?
      </p>
      <p className="text-meta leading-relaxed" style={{ color: 'var(--dim)' }}>
        Sonntags um 19 Uhr sagen wir kurz Bescheid. Höchstens eine Erinnerung pro Woche, nie mehr.
      </p>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={close} className="hit px-1 text-sm" style={{ color: 'var(--dim)' }}>
          Nein danke
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            enableReminder(me)
              .catch(() => false)
              .finally(close);
          }}
          className="rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          Erlauben
        </button>
      </div>
    </div>
  );
}
