import type { ReactNode } from 'react';
import type { Kind } from '@/lib/api';

/** Handgezeichnete Icons je Beitragsart, gleicher Strichstil wie die untere
 *  Leiste (siehe NavButton.tsx/BottomBar.tsx) — das Mixtape-Icon ist wörtlich
 *  dasselbe wie in BottomBar.tsx, nicht neu erfunden. */
const ICONS: Record<Kind, ReactNode> = {
  tape: (
    <svg
      width="16"
      height="12"
      viewBox="0 0 16 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="0.65" y="0.65" width="14.7" height="10.7" rx="1.5" />
      <circle cx="4.5" cy="6" r="1.6" />
      <circle cx="11.5" cy="6" r="1.6" />
      <path d="M6.3 6h3.4" />
    </svg>
  ),
  voice: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="2" y1="6" x2="2" y2="10" />
      <line x1="5.5" y1="3" x2="5.5" y2="13" />
      <line x1="9" y1="1" x2="9" y2="15" />
      <line x1="12.5" y1="4" x2="12.5" y2="12" />
    </svg>
  ),
  photo: (
    <svg
      width="16"
      height="14"
      viewBox="0 0 16 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M1 4.2h2.6l1-1.6h4.8l1 1.6H15v8.4H1z" />
      <circle cx="8" cy="8.4" r="2.6" />
    </svg>
  ),
  video: (
    <svg
      width="17"
      height="13"
      viewBox="0 0 17 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="0.65" y="2.4" width="9.5" height="8.2" rx="1.2" />
      <path d="M10.15 5.4l5.2-2.6v8.4l-5.2-2.6z" />
    </svg>
  ),
  text: (
    <svg
      width="14"
      height="16"
      viewBox="0 0 14 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M1 0.7h8.4L13 4.3v11H1z" />
      <path d="M9.4 0.7v3.6H13" />
      <path d="M3.4 7.4h7.2M3.4 10h5.2" />
    </svg>
  ),
};

/** Symbol je Beitragsart — im Aufnehmen-Blatt (Composer.tsx) und beim
 *  Einkleben in ein eigenes Tape (PrivateTapeView.tsx). */
export default function KindIcon({ kind }: { kind: Kind }) {
  return ICONS[kind];
}
