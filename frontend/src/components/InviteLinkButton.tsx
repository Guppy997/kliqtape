import { useState } from 'react';
import { createInviteLink, type Cassette } from '@/lib/api';
import { useApp } from '@/store/appStore';

/**
 * Einladung als Link teilen — ueber das Teilen-Menue des Geraets, ohne Menue
 * (Computer) landet der Link in der Zwischenablage. Wie der Brief gilt er
 * einmal, 14 Tage, nur fuer diese Kassette, und wer ihn oeffnet, muss noch
 * zustimmen. Genutzt in der Kassetten-Ansicht und im Onboarding.
 */
export default function InviteLinkButton({
  cassette,
  preview = false,
}: {
  cassette: Pick<Cassette, 'id' | 'name'>;
  /** Onboarding-Vorschau: nichts erzeugen, nur zeigen, was passieren wuerde. */
  preview?: boolean;
}) {
  const me = useApp((s) => s.me);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function share() {
    if (preview) return setNote('Vorschau: Hier würdest du den Link teilen.');
    setBusy(true);
    setNote(null);
    try {
      const { url } = await createInviteLink(cassette.id, me);
      const text = `${me} lädt dich auf „${cassette.name}“ bei Kliqtape ein.`;
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Kliqtape', text, url });
          setNote('Link geteilt. Wer ihn öffnet, muss noch zustimmen.');
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
        }
      }
      await navigator.clipboard.writeText(url);
      setNote('Link kopiert. Wer ihn öffnet, muss noch zustimmen.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Link ließ sich nicht erstellen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void share()}
        disabled={busy}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left disabled:opacity-60"
        style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
      >
        <LinkIcon />
        <span className="min-w-0 flex-1">
          <span className="block text-sm" style={{ color: 'var(--ink)' }}>
            Einladung als Link
          </span>
          <span className="block text-2xs" style={{ color: 'var(--dim)' }}>
            Zum Teilen · gilt einmal, 14 Tage
          </span>
        </span>
      </button>
      {note && (
        <p className="px-1 text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
          {note}
        </p>
      )}
    </>
  );
}

function LinkIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L9.8 5.2" />
      <path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1.2-1.2" />
    </svg>
  );
}
