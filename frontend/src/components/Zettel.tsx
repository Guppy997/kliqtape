import type { CSSProperties, ReactNode } from 'react';
import type { NoteStyle } from '@/lib/api';

export const NOTE_STYLE_LABEL: Record<NoteStyle, string> = {
  tape: 'Tesa',
  pin: 'Pin',
  staple: 'Tacker',
  clip: 'Klammer',
  fold: 'Eselsohr',
};

/** Stabile Pseudo-Zufallszahl aus der Post-ID — dieselbe Karte soll bei jedem
 *  Rendern gleich schief haengen, nicht bei jedem Neuladen neu wackeln. */
function seedFrom(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const INK = '#3B3226';

/** Jede Optik bekommt ihr eigenes, klassisches Papier statt einer
 *  einheitlichen Farbe — kariert und dunkler, liniert, Post-it-Gelb,
 *  Packpapier-Braun, schlichtes Creme. */
const PAPER_LOOK: Record<NoteStyle, CSSProperties> = {
  tape: { background: '#EDE6D6' },
  pin: { background: '#F3CF4B' },
  staple: {
    backgroundColor: '#F1EEE4',
    backgroundImage: `linear-gradient(to right, transparent 26px, rgba(178,64,64,.4) 27px, rgba(178,64,64,.4) 28px, transparent 29px),
      repeating-linear-gradient(to bottom, transparent, transparent 20px, rgba(90,110,160,.4) 21px, transparent 22px)`,
  },
  clip: {
    backgroundColor: '#C4C1B3',
    backgroundImage: `linear-gradient(rgba(70,80,120,.28) 1px, transparent 1px),
      linear-gradient(90deg, rgba(70,80,120,.28) 1px, transparent 1px)`,
    backgroundSize: '9px 9px',
  },
  fold: { background: '#C9A876' },
};

/** Gemeinsame Papier-Basis: eigene Optik pro Stil, leicht schief,
 *  handschriftlicher Text. Die Befestigung (children) liegt IM selben
 *  positionierten Element wie das Papier, nicht in dessen Aussenabstand —
 *  sonst haengt sie in der Luft statt das Papier zu halten. */
function NotePaper({
  seed,
  children,
  text,
  paper,
}: {
  seed: number;
  children?: ReactNode;
  text: string;
  paper: CSSProperties;
}) {
  const rotate = (seed % 7) - 3; // -3..3 Grad
  return (
    <div className="mx-auto w-full max-w-[17rem] px-4 py-6">
      <div className="relative rounded-sm px-4 py-4 shadow-md" style={{ ...paper, transform: `rotate(${rotate}deg)` }}>
        <p className="font-hand text-[1.05rem] leading-snug" style={{ color: INK }}>
          {text}
        </p>
        {children}
      </div>
    </div>
  );
}

function NoteTape({ seed, text }: { seed: number; text: string }) {
  const strip: CSSProperties = {
    position: 'absolute',
    // Ragt oben ueber die Papierkante hinaus und liegt unten auf dem Papier
    // auf — so haelt das Tape sichtbar etwas fest, statt daneben zu schweben.
    top: '-0.5rem',
    width: '2.6rem',
    height: '1rem',
    background: 'rgba(255,255,255,.45)',
    boxShadow: '0 1px 2px rgba(0,0,0,.2)',
  };
  return (
    <NotePaper seed={seed} text={text} paper={PAPER_LOOK.tape}>
      <span style={{ ...strip, left: '0.5rem', transform: `rotate(${-8 - (seed % 5)}deg)` }} />
      <span style={{ ...strip, right: '0.5rem', transform: `rotate(${8 + (seed % 5)}deg)` }} />
    </NotePaper>
  );
}

function NotePin({ seed, text }: { seed: number; text: string }) {
  return (
    <NotePaper seed={seed} text={text} paper={PAPER_LOOK.pin}>
      <span
        className="absolute left-1/2 -top-2 size-3.5 -translate-x-1/2 rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 35%, #E5675A, #A6291D)',
          // Schatten faellt nach unten aufs Papier — verkauft, dass der Pin
          // ueber der Flaeche sitzt und sie hinunterdrueckt.
          boxShadow: '0 3px 4px rgba(0,0,0,.4)',
        }}
      />
    </NotePaper>
  );
}

function NoteStaple({ seed, text }: { seed: number; text: string }) {
  return (
    <NotePaper seed={seed} text={text} paper={PAPER_LOOK.staple}>
      {/* Die Klammer liegt flach auf dem Papier, nicht darueber — ein
          Tacker durchdringt die Seite, statt drauf zu schweben. */}
      <span
        className="absolute left-3 top-3 h-2 w-4 rounded-[1px]"
        style={{
          background: 'linear-gradient(180deg, #C7C2B8, #8A8578)',
          boxShadow: '0 1px 1px rgba(0,0,0,.45)',
          transform: `rotate(${-20 - (seed % 15)}deg)`,
        }}
      />
    </NotePaper>
  );
}

function NoteClip({ seed, text }: { seed: number; text: string }) {
  return (
    <NotePaper seed={seed} text={text} paper={PAPER_LOOK.clip}>
      <svg
        className="absolute -top-3.5 left-4"
        width="20"
        height="28"
        viewBox="0 0 20 28"
        style={{ transform: `rotate(${-6 - (seed % 8)}deg)`, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.4))' }}
        aria-hidden="true"
      >
        <path
          d="M6 6a4 4 0 0 1 8 0v14a2.5 2.5 0 0 1-5 0V9a1 1 0 0 1 2 0v10.5"
          fill="none"
          stroke="#9AA0A6"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </NotePaper>
  );
}

function NoteFold({ seed, text }: { seed: number; text: string }) {
  return (
    <div className="mx-auto w-full max-w-[17rem] px-4 py-6">
      <div
        className="relative overflow-hidden rounded-sm shadow-md"
        style={{ ...PAPER_LOOK.fold, transform: `rotate(${(seed % 5) - 2}deg)` }}
      >
        <div className="px-4 py-4">
          <p className="font-hand text-[1.05rem] leading-snug" style={{ color: INK }}>
            {text}
          </p>
        </div>
        {/* Umgeknickte Ecke oben rechts, mit Schatten unter der Falte. */}
        <span
          className="absolute right-0 top-0 size-5"
          style={{ background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,.22) 50%)' }}
        />
        <span
          className="absolute right-0 top-0 size-5"
          style={{
            background: `linear-gradient(225deg, ${PAPER_LOOK.fold.background} 50%, transparent 50%)`,
            boxShadow: '-1px 1px 2px rgba(0,0,0,.25)',
          }}
        />
      </div>
    </div>
  );
}

const NOTE_RENDERERS: Record<NoteStyle, typeof NoteTape> = {
  tape: NoteTape,
  pin: NotePin,
  staple: NoteStaple,
  clip: NoteClip,
  fold: NoteFold,
};

interface ZettelProps {
  id: string;
  style: NoteStyle | null;
  text: string;
  /** Fuer kleine Vorschau-Kacheln: verkleinert dieselbe echte Darstellung
   *  statt eine zweite, separat gepflegte Mini-Version zu bauen — Vorschau
   *  und tatsächliches Aussehen können so nie auseinanderlaufen. */
  scale?: number;
}

export default function Zettel({ id, style, text, scale = 1 }: ZettelProps) {
  const Renderer = NOTE_RENDERERS[style ?? 'tape'];
  const inner = <Renderer seed={seedFrom(id)} text={text} />;
  if (scale === 1) return inner;
  // Feste Breite VOR dem Skalieren — sonst quetscht sich die Karte in einen
  // kleinen Container, statt als verkleinerte Kopie ihrer echten Groesse zu
  // erscheinen. 17rem entspricht der max-w der Karte selbst.
  return <div style={{ width: '17rem', transform: `scale(${scale})`, transformOrigin: 'top left' }}>{inner}</div>;
}
