import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  label: string;
  /** Nur Symbol, ohne sichtbare Beschriftung. Die Beschriftung bleibt als
   *  aria-label. Derzeit ungenutzt: auch Profil hat jetzt Symbol + Text. */
  hideLabel?: boolean;
  /** Kleine Zahl oben rechts am Icon — weggelassen (nicht 0), wenn nichts ansteht. */
  badge?: number;
  /** Das zugehoerige Sheet ist gerade offen. */
  active?: boolean;
  onClick: () => void;
}

/**
 * Ein Bereich der unteren Leiste (Eject, Band, Hot Line, Profil): Icon, kurze
 * Beschriftung darunter, optional ein
 * Zaehler oben rechts. Eject, Hot Line und Neuigkeiten sahen frueher alle
 * unterschiedlich aus (Metallschild, LED, Textpille) — bewusst uneinheitlich.
 * Jetzt wie eine echte Tableiste, angelehnt an Signal & Co.: nur das aktive
 * Icon ist in der Akzentfarbe, keiner traegt einen eigenen Hintergrund — die
 * Leiste selbst (BottomBar, Milchglas) ist die Flaeche.
 */
export default function NavButton({ icon, label, hideLabel, badge, active, onClick }: Props) {
  // Schlank wie bei Instagram: kein Hintergrund ums aktive Symbol, nur die
  // Akzentfarbe — die Leiste soll nicht mehr ein Sechstel des Bildschirms
  // belegen. 44-pt-Tippflaeche bleibt ueber die volle Breite der Spalte.
  return (
    <button
      type="button"
      aria-label={badge ? `${label}, ${badge} neu` : label}
      aria-pressed={active}
      onClick={onClick}
      className="flex min-h-11 w-full flex-col items-center justify-center gap-0.5 transition-transform active:scale-95"
      style={{ color: active ? 'var(--accent)' : 'var(--dim)' }}
    >
      <span className={`relative grid place-items-center ${hideLabel ? '' : 'h-6 w-7'}`}>
        {icon}
        {!!badge && (
          <span
            className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-2xs font-medium tabular-nums"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            {badge}
          </span>
        )}
      </span>
      {!hideLabel && <span className="text-2xs font-medium leading-none">{label}</span>}
    </button>
  );
}
