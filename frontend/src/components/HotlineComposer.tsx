import { useState } from 'react';
import { sendHotline, HOTLINE_MAX } from '@/lib/api';
import { useApp } from '@/store/appStore';
import Avatar, { useProfiles } from './Avatar';
import Sheet from './Sheet';

/** Sony-Sports-Walkman-Gelb. Warm, leuchtend, klar vom roten REC unterscheidbar. */
const HOTLINE_AMBER = '#F5B324';

/**
 * Hot Line — eine direkte, private Nachricht an genau eine Person.
 *
 * Bewusst kein Chat: nur Text, hoechstens 240 Zeichen, kein Verlauf, und nach
 * 24 Stunden ist sie weg. Ein Anruf passiert und ist dann vorbei.
 */
export default function HotlineComposer() {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);

  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { data: profiles = [] } = useProfiles();
  const others = profiles.map((p) => p.name).filter((n) => n !== me);

  function reset() {
    setTo('');
    setText('');
    setError(null);
    setDone(false);
  }

  async function call() {
    if (!to.trim() || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendHotline({ from: me, to: to.trim(), body: text.trim() });
      setDone(true);
      window.setTimeout(() => {
        setOpen(false);
        reset();
      }, 1100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  const left = HOTLINE_MAX - text.length;

  return (
    <>
      {/* Beschriftung auf dem Gehaeuse ueber der Taste — wie an einem Walkman. */}
      <span className="flex shrink-0 flex-col items-center gap-1">
        <span className="font-mono text-[0.5rem] uppercase tracking-[0.18em]" style={{ color: HOTLINE_AMBER }}>
          Hotline
        </span>
        <button
          type="button"
          aria-label="Hotline — jemandem direkt und privat schreiben"
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="grid h-10 w-10 place-items-center rounded-[3px] transition-transform active:translate-y-px"
          style={{
            background: 'linear-gradient(180deg, #3A342E, #211D19)',
            boxShadow: '0 2px 0 rgba(0,0,0,.5), 0 1px 0 rgba(255,255,255,.1) inset',
          }}
        >
          <span
            className="size-4 rounded-[1px]"
            style={{ background: HOTLINE_AMBER, boxShadow: `0 0 0.6rem ${HOTLINE_AMBER}` }}
          />
        </button>
      </span>

      <Sheet open={open} onClose={() => setOpen(false)} variant="full" title="Hot Line">
        {done ? (
          <p
            className="font-hand rounded-lg px-3 py-10 text-center text-xl"
            style={{ background: 'var(--card)', border: `1px solid ${HOTLINE_AMBER}`, color: HOTLINE_AMBER }}
          >
            Durchgestellt.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="font-mono text-[0.62rem] uppercase tracking-[0.12em]" style={{ color: 'var(--dim)' }}>
                An wen?
              </label>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                maxLength={40}
                placeholder="Name"
                className="rounded-lg px-3 py-2.5 text-base outline-none"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
              />
              {others.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {others.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTo(n)}
                      className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[0.75rem]"
                      style={{
                        background: to === n ? HOTLINE_AMBER : 'var(--card)',
                        border: '1px solid var(--line)',
                        color: to === n ? '#20180A' : 'var(--ink)',
                      }}
                    >
                      <Avatar name={n} side={side} size={1.2} />
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, HOTLINE_MAX))}
              rows={4}
              placeholder={to.trim() ? `Kurz an ${to.trim()} …` : 'Kurz und persönlich …'}
              className="resize-none rounded-lg p-3 text-[0.95rem] outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            />

            <div className="font-mono flex items-center justify-between text-[0.62rem]" style={{ color: 'var(--dim)' }}>
              <span>nur Text · verfällt nach 24 Stunden · kein Verlauf</span>
              <span className="tabular-nums" style={{ color: left < 30 ? HOTLINE_AMBER : 'var(--dim)' }}>
                {left}
              </span>
            </div>

            {error && <p className="text-sm" style={{ color: '#F0B5A5' }}>{error}</p>}

            <button
              type="button"
              onClick={call}
              disabled={busy || !to.trim() || !text.trim()}
              className="font-disp rounded-lg px-4 py-3.5 text-sm font-bold uppercase tracking-[0.12em] disabled:opacity-40"
              style={{ background: HOTLINE_AMBER, color: '#20180A' }}
            >
              {busy ? 'Verbinde …' : 'Durchstellen'}
            </button>
          </div>
        )}
      </Sheet>
    </>
  );
}
