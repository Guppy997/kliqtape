import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { redeemLetter } from '@/lib/api';
import { clearLetterToken, pendingLetterToken } from '@/lib/letter';
import { useApp } from '@/store/appStore';
import { useBottomNav } from '@/store/navStore';

/**
 * Loest einen Einladungsbrief ein, sobald jemand angemeldet ist. Daraus wird
 * eine normale Einladung — zugestimmt wird wie immer in der Benachrichtigung,
 * die dafuer gleich aufgeht.
 */
export default function LetterRedeemer() {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();
  const setActive = useBottomNav((s) => s.setActive);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const done = useRef(false);

  useEffect(() => {
    const token = pendingLetterToken();
    if (!token || !me || done.current) return;
    done.current = true;
    clearLetterToken();
    redeemLetter(me, token)
      .then((r) => {
        void qc.invalidateQueries({ queryKey: ['invites', me] });
        setMessage({
          ok: true,
          text: `${r.invitedBy} lädt dich auf „${r.cassetteName}“ ein. Stimm zu, dann bist du dabei.`,
        });
        setActive('notify');
      })
      .catch((e: Error) => setMessage({ ok: false, text: e.message }));
  }, [me, qc, setActive]);

  if (!message) return null;
  return (
    <div
      role="status"
      className="rise fixed inset-x-3 bottom-[calc(5.4rem+env(safe-area-inset-bottom))] z-[75] mx-auto flex max-w-md items-start gap-3 rounded-xl px-3.5 py-3"
      style={{
        background: 'color-mix(in srgb, var(--screen) 92%, white 8%)',
        border: `1px solid ${message.ok ? 'var(--accent)' : '#B8462C'}`,
        boxShadow: '0 0.8rem 2rem rgba(0,0,0,.5)',
      }}
    >
      <span
        className="font-mono shrink-0 pt-0.5 text-[0.56rem] uppercase tracking-[0.12em]"
        style={{ color: message.ok ? 'var(--accent)' : '#F0B5A5' }}
      >
        Brief
      </span>
      <p className="min-w-0 flex-1 text-sm leading-snug" style={{ color: 'var(--ink)' }}>
        {message.text}
      </p>
      <button
        type="button"
        onClick={() => setMessage(null)}
        aria-label="Hinweis schließen"
        style={{ color: 'var(--dim)' }}
      >
        ✕
      </button>
    </div>
  );
}
