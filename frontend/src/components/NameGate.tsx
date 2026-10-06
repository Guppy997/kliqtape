import { useState } from 'react';
import { claimName, whoami, ApiError } from '@/lib/api';
import { pendingLetterToken } from '@/lib/letter';
import { useApp } from '@/store/appStore';
import Lockup from './Lockup';

export default function NameGate({ prefill }: { prefill?: string }) {
  const setIdentity = useApp((s) => s.setIdentity);
  // Vorausgefuellt, wenn schon ein Name lokal bekannt ist, nur der
  // Zugangscode fehlt (siehe App()) — spart das erneute Eintippen, ein Tipp
  // auf "Band einlegen" reicht, um wieder reinzukommen (oder den bestehenden
  // Code einzutragen, falls der Name schon woanders beansprucht ist).
  const [value, setValue] = useState(prefill ?? '');
  // Ein Name gehoert jetzt genau einer Person — beim ersten Beanspruchen
  // bekommt das Geraet automatisch einen Zugangscode (siehe /api/auth/claim).
  // Ist der Name schon vergeben (z.B. dasselbe Konto auf einem neuen Geraet),
  // fragt die Maske stattdessen nach dem bestehenden Code.
  const [needsToken, setNeedsToken] = useState(false);
  const [tokenValue, setTokenValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const name = value.trim();
    if (!name || busy) return;
    setError(null);
    setBusy(true);
    try {
      if (needsToken) {
        const code = tokenValue.trim();
        if (!code) throw new Error('Zugangscode fehlt');
        const res = await whoami(code);
        if (res.name !== name) throw new Error('Zugangscode passt nicht zu diesem Namen');
        setIdentity(res.name, code);
      } else {
        const res = await claimName(name);
        setIdentity(res.name, res.token);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setNeedsToken(true);
        setError('Name schon vergeben — Zugangscode von deinem anderen Gerät eintragen.');
      } else {
        setError(err instanceof Error ? err.message : 'Etwas ist schiefgelaufen');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-full place-items-center px-6 py-16">
      <form
        className="flex w-full max-w-sm flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h1>
          <Lockup size="clamp(3rem, 17vw, 4.6rem)" />
        </h1>
        <p className="text-sm" style={{ color: 'var(--dim)' }}>
          {prefill
            ? 'Diesem Gerät fehlt noch der Zugangscode zu diesem Namen — einmal bestätigen.'
            : pendingLetterToken()
              ? 'Du hast einen Einladungsbrief bekommen. Tipp deinen Namen ein, dann kannst du zustimmen.'
              : 'Tipp deinen Namen ein — beim ersten Mal wird er für dich reserviert.'}
        </p>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (needsToken) {
              setNeedsToken(false);
              setTokenValue('');
              setError(null);
            }
          }}
          maxLength={40}
          autoFocus
          placeholder="Dein Name"
          className="rounded-lg px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
        {needsToken && (
          <input
            value={tokenValue}
            onChange={(e) => setTokenValue(e.target.value)}
            placeholder="Zugangscode von deinem anderen Gerät"
            className="font-mono rounded-lg px-3 py-3 text-sm outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />
        )}
        {error && (
          <p className="text-sm" style={{ color: '#F0B5A5' }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!value.trim() || busy || (needsToken && !tokenValue.trim())}
          className="rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#FFF3EC' }}
        >
          {busy ? 'Einen Moment …' : 'Band einlegen'}
        </button>
        <p className="font-mono text-[0.62rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
          Dein Zugangscode liegt danach in den Einstellungen — kopier ihn dort, um dich auf einem zweiten Gerät
          anzumelden. Achtung: Inhalte sind noch nicht Ende-zu-Ende-verschlüsselt.
        </p>
      </form>
    </div>
  );
}
