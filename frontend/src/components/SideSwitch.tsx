import { useApp, SIDE_LABEL, type Side } from '@/store/appStore';

const SIDES: Side[] = ['a', 'b'];

/**
 * A|B-Schalter in der Kassetten-Zeile (App.tsx): ein Tipp wechselt die Seite.
 * Vorher brauchte das bis zu drei Tipps — Kassette aufklappen, umdrehen,
 * wieder zuklappen. Die kleine Kassette dreht sich beim Wechsel mit (App.tsx),
 * das Umdrehen bleibt also spuerbar. Optik wie die Reiter im Profil
 * (ProfileView.tsx), Semantik wie die Gruende beim Melden (ReportForm.tsx).
 */
export default function SideSwitch() {
  const side = useApp((s) => s.side);
  const setSide = useApp((s) => s.setSide);

  return (
    <div
      role="radiogroup"
      aria-label="Seite"
      className="grid shrink-0 grid-cols-2 rounded-full p-0.5"
      style={{ background: 'color-mix(in srgb, var(--ink) 7%, transparent)' }}
    >
      {SIDES.map((s) => {
        const on = side === s;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`Seite ${s.toUpperCase()} · ${SIDE_LABEL[s]}`}
            onClick={() => {
              if (!on) setSide(s);
            }}
            // w-11: volle 44 pt Breite, damit sich die Tippflaechen der beiden
            // Segmente nicht ueberlappen; .hit ergaenzt nur die Hoehe.
            className="hit grid h-8 w-11 place-items-center rounded-full text-sm font-medium transition-colors"
            style={{
              background: on ? 'var(--accent)' : 'transparent',
              color: on ? 'var(--on-accent)' : 'var(--dim)',
            }}
          >
            {s.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
