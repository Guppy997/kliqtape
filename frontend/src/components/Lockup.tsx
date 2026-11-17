interface Props {
  /** Schriftgrad des Lockups, z. B. '3rem' oder 'clamp(2rem,12vw,4rem)'. */
  size?: string;
  className?: string;
}

/**
 * Wortmarke: KLIQ steht, TAPE ist nur Kontur. Masse laut Markenskill:
 * Archivo 700, Breite 75, Laufweite +0.01em, Zeilenhoehe 0.84 (Utility
 * `wortmarke` in index.css), Kontur 0.032em.
 *
 * Das Bild dahinter ist das Kassettenetikett — der bedruckte Teil und der
 * Teil, den man selbst ausfuellt. Deshalb ist genau die zweite Haelfte offen.
 */
export default function Lockup({ size = '3.4rem', className = '' }: Props) {
  return (
    <span className={`wortmarke inline-block ${className}`} style={{ fontSize: size }}>
      <span style={{ color: 'var(--ink)' }}>Kliq</span>
      <span
        style={{
          color: 'transparent',
          WebkitTextStroke: `max(1px, 0.032em) var(--ink)`,
        }}
      >
        tape
      </span>
    </span>
  );
}
