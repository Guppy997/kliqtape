/**
 * Plus, das sich zum X dreht — dasselbe Zeichen fuer "Aufnehmen" (Composer.tsx)
 * und jedes Schliessen-X oben links (Sheet.tsx, Fototuete, Imposter-
 * Aufloesung). Strich in currentColor, die Farbe setzt der Knopf.
 *
 * `enter`: dreht beim Erscheinen vom Plus aus herein (.plus-turn in
 * index.css) — so sieht das X in "Aufnehmen" aus wie das Plus der Leiste,
 * das sich gerade umdreht.
 */
export default function PlusMark({ turned, enter }: { turned: boolean; enter?: boolean }) {
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
      style={{ transform: turned ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}
    >
      <path d="M7 1v12M1 7h12" />
    </svg>
  );
}
