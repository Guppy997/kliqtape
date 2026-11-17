import { useState } from 'react';

/**
 * Plus, das sich zum X dreht — dasselbe Zeichen fuer "Aufnehmen" (Composer.tsx)
 * und jedes Schliessen-X oben links (Sheet.tsx, Fototuete, Imposter-
 * Aufloesung). Strich in currentColor, die Farbe setzt der Knopf.
 *
 * Dreht nur vorwaerts, im Uhrzeigersinn — wie die Spulen in einer Kassette,
 * die auch nie rueckwaerts laufen, nur weiter. Plus → X sind +45°, X → Plus
 * nochmal +45° (ein um 90° gedrehtes Plus sieht aus wie vorher). Der Winkel
 * waechst deshalb einfach weiter, statt auf 0° zurueckzudrehen.
 *
 * `enter`: dreht beim Erscheinen vom Plus aus herein (.plus-turn in
 * index.css) — so sieht das X in "Aufnehmen" aus wie das Plus der Leiste,
 * das sich gerade umdreht.
 */
export default function PlusMark({ turned, enter }: { turned: boolean; enter?: boolean }) {
  // Winkel als Zustand, der bei jedem Wechsel waechst. Waehrend des Renderns
  // nachgezogen (statt im Effect), damit die Drehung im selben Frame startet.
  const [turn, setTurn] = useState({ turned, angle: turned ? 45 : 0 });
  if (turn.turned !== turned) setTurn({ turned, angle: turn.angle + 45 });

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      className={enter ? 'plus-turn' : undefined}
      style={{ transform: `rotate(${turn.angle}deg)`, transition: 'transform 200ms ease' }}
    >
      <path d="M7 1v12M1 7h12" />
    </svg>
  );
}
