import type { CSSProperties, ReactNode } from 'react';
import type { NoteStyle } from '@/lib/api';

export const NOTE_STYLE_LABEL: Record<NoteStyle, string> = {
  tape: 'Tesa',
  pin: 'Pin',
  staple: 'Tacker',
  clip: 'Klammer',
  fold: 'Eselsohr',
  label: 'Etikett',
};

/* ---------------------------------------------------------------------------
 * Zettel sollen aussehen, als haette jemand sie in die Runde geworfen: schief,
 * leicht versetzt, Tesa und Klammern mal hier, mal da, Kanten nicht ganz
 * gerade, jedes Papier mit Struktur, verschiedene Stifte. Alles leitet sich
 * aus der Post-ID ab: derselbe Zettel sieht bei jedem Rendern gleich aus,
 * aber jeder anders als der naechste.
 * ------------------------------------------------------------------------- */

/** Stabile Zahl aus der Post-ID. */
function seedFrom(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Kleiner deterministischer Generator (mulberry32): viele unabhaengige Werte
 *  aus einer Saat, statt alles aus `seed % n` zu ziehen. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const between = (r: Rand, a: number, b: number) => a + r() * (b - a);
function pick<T>(r: Rand, list: readonly T[]): T {
  return list[Math.floor(r() * list.length)]!;
}

/** Stifte: jede Art hat ihren typischen, ein paar Zettel nehmen einen anderen. */
const INK = {
  felt: '#3B3226',
  ballpoint: '#24357A',
  pencil: '#4D4B46',
  marker: '#1E1A15',
} as const;

/** Feines Papierkorn als SVG-Rauschen, ohne Bilddatei. */
function noise(alpha: number, freq: number): string {
  return (
    `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>` +
    `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='2' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 .25  0 0 0 0 .2  0 0 0 0 .12  0 0 0 ${alpha} 0'/></filter>` +
    `<rect width='100%' height='100%' filter='url(%23n)'/></svg>")`
  );
}
const GRAIN = noise(0.1, 0.85);
const FIBER = noise(0.2, 0.55);

/** Licht faellt schraeg aufs Papier, jedes Mal aus einer etwas anderen Richtung. */
const light = (r: Rand) =>
  `linear-gradient(${Math.round(between(r, 100, 170))}deg, rgba(255,255,255,.16), rgba(255,255,255,0) 45%, rgba(0,0,0,.07))`;

/** Kein Papier ist ganz gerade geschnitten: Ecken um bis zu `j` px versetzt. */
function roughEdges(r: Rand, j = 2): string {
  const o = () => `${(r() * j).toFixed(1)}px`;
  return `polygon(${o()} ${o()}, calc(100% - ${o()}) ${o()}, calc(100% - ${o()}) calc(100% - ${o()}), ${o()} calc(100% - ${o()}))`;
}

/** Oben aus dem Block gerissen: unregelmaessige Zacken statt gerader Kante. */
function tornTop(r: Rand, steps = 24, depth = 5): string {
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) pts.push(`${((i / steps) * 100).toFixed(1)}% ${(r() * depth).toFixed(1)}px`);
  return `polygon(${pts.join(', ')}, 100% 100%, 0% 100%)`;
}

interface Look {
  r: Rand;
  rotate: number;
  shift: number;
  width: number;
  size: number;
  tilt: number;
}

/** Was jeder Zettel hat: Lage, Breite, Schriftgroesse. `flat` fuer das
 *  Etikett, das ordentlicher klebt als ein hingeworfener Zettel. */
function lookFor(id: string, style: NoteStyle, flat = false): Look {
  // Art einmischen, damit die Vorschau-Kacheln nicht alle gleich schief haengen.
  const r = rng(seedFrom(`${style}:${id}`));
  const max = flat ? 1.2 : 4.5;
  let rotate = between(r, -max, max);
  if (!flat && Math.abs(rotate) < 0.8) rotate = rotate < 0 ? -0.8 - r() : 0.8 + r();
  const width = between(r, 88, 100);
  // Je breiter, desto weniger seitlicher Spielraum, sonst ragt er aus der Karte.
  const room = (100 - width) / 2 + 2;
  return { r, rotate, shift: between(r, -room, room), width, size: between(r, 1.35, 1.6), tilt: between(r, -1, 1) };
}

/** Haelt Drehung, Versatz und Schatten. Der Schatten ist ein drop-shadow auf
 *  diesem Wrapper statt box-shadow am Papier: das Papier ist per clip-path
 *  unregelmaessig beschnitten, ein box-shadow wuerde mit abgeschnitten. So
 *  folgt er der echten Kontur und faellt auch unter Tesa und Klammern. */
function Throw({ look, maxWidth = '17rem', children }: { look: Look; maxWidth?: string; children: ReactNode }) {
  return (
    <div className="flex w-full justify-center py-5">
      <div
        className="relative"
        style={{
          width: `${look.width}%`,
          maxWidth,
          transform: `translateX(${look.shift.toFixed(1)}%) rotate(${look.rotate.toFixed(2)}deg)`,
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.35)) drop-shadow(0 7px 9px rgba(0,0,0,.28))',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Handwriting({
  text,
  look,
  ink,
  weight = 500,
  style,
}: {
  text: string;
  look: Look;
  ink: string;
  weight?: number;
  style?: CSSProperties;
}) {
  return (
    <p
      className="font-hand"
      style={{
        margin: 0,
        color: ink,
        fontWeight: weight,
        fontSize: `${look.size.toFixed(2)}rem`,
        lineHeight: 1.18,
        transform: `rotate(${look.tilt.toFixed(2)}deg)`,
        overflowWrap: 'anywhere',
        ...style,
      }}
    >
      {text}
    </p>
  );
}

/** Linienpapier: Zeilenhoehe fest, damit die Schrift auf den Linien sitzt. */
const ROW = '1.9rem';
const lined = (color: string, top: string): CSSProperties => ({
  backgroundImage: `linear-gradient(to bottom, transparent calc(${ROW} - 1px), ${color} calc(${ROW} - 1px))`,
  backgroundSize: `100% ${ROW}`,
  backgroundPosition: `0 ${top}`,
  backgroundRepeat: 'repeat-y',
});
const onLines: CSSProperties = { fontSize: '1.45rem', lineHeight: ROW, transform: 'none' };

/* --- Tesa ------------------------------------------------------------------ */

/** Gezackte Enden wie abgerissenes Klebeband. */
const TAPE_CLIP = 'polygon(3% 0, 97% 0, 100% 22%, 96% 46%, 100% 72%, 97% 100%, 3% 100%, 0 76%, 4% 52%, 0 26%)';

function Strip({ pos, rotate, width }: { pos: CSSProperties; rotate: number; width: number }) {
  const center = pos.left === '50%';
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        width: `${width.toFixed(2)}rem`,
        height: '1.05rem',
        backgroundColor: 'rgba(250,246,232,.55)',
        backgroundImage: GRAIN,
        clipPath: TAPE_CLIP,
        transform: `${center ? 'translateX(-50%) ' : ''}rotate(${rotate.toFixed(1)}deg)`,
        ...pos,
      }}
    />
  );
}

function NoteTape({ id, text }: { id: string; text: string }) {
  const look = lookFor(id, 'tape');
  const { r } = look;
  const len = () => between(r, 2.4, 3.5);
  const layout = pick(r, ['corners', 'top', 'diag', 'side', 'cross'] as const);
  const strips: { pos: CSSProperties; rotate: number; width: number }[] = {
    corners: [
      { pos: { left: `${between(r, 4, 14)}%`, top: '-0.55rem' }, rotate: -between(r, 8, 24), width: len() },
      { pos: { right: `${between(r, 4, 14)}%`, top: '-0.55rem' }, rotate: between(r, 8, 24), width: len() },
    ],
    top: [{ pos: { left: '50%', top: '-0.6rem' }, rotate: between(r, -7, 7), width: between(r, 3, 4) }],
    diag: [{ pos: { left: '-0.8rem', top: '-0.1rem' }, rotate: -between(r, 34, 50), width: len() }],
    side: [{ pos: { left: '-1rem', top: `${between(r, 25, 55)}%` }, rotate: between(r, 72, 106), width: len() }],
    cross: [
      { pos: { left: '-0.7rem', top: '-0.2rem' }, rotate: -between(r, 32, 46), width: len() },
      { pos: { right: '-0.7rem', bottom: '-0.2rem' }, rotate: -between(r, 32, 46), width: len() },
    ],
  }[layout];
  const ink = r() < 0.75 ? INK.felt : INK.ballpoint;
  return (
    <Throw look={look}>
      <div
        style={{
          backgroundColor: '#EDE6D6',
          backgroundImage: `${GRAIN}, ${light(r)}`,
          clipPath: roughEdges(r),
          padding: '1rem 1.1rem 1.1rem',
        }}
      >
        <Handwriting text={text} look={look} ink={ink} />
      </div>
      {strips.map((s, i) => (
        <Strip key={i} {...s} />
      ))}
    </Throw>
  );
}

/* --- Pin: Klebezettel --------------------------------------------------- */

const STICKY = [
  ['#F6D664', '#EEC544'],
  ['#F6D664', '#EEC544'],
  ['#F6D664', '#EEC544'],
  ['#F7B979', '#EFA25C'],
  ['#F4BCC6', '#EBA2AF'],
] as const;
const PIN_HEADS = ['#C8432F', '#C8432F', '#2F5FA8', '#3E8A5A'] as const;

function NotePin({ id, text }: { id: string; text: string }) {
  const look = lookFor(id, 'pin');
  const { r } = look;
  const [top, bottom] = pick(r, STICKY);
  const head = pick(r, PIN_HEADS);
  const pinX = between(r, 34, 66);
  return (
    <Throw look={{ ...look, width: between(r, 78, 90) }} maxWidth="15rem">
      {/* Die untere Ecke hebt sich: weicher Schatten HINTER dem Papier. */}
      <span
        aria-hidden="true"
        className="absolute"
        style={{
          right: '0.4rem',
          bottom: '0.3rem',
          width: '55%',
          height: '1.2rem',
          background: 'rgba(0,0,0,.5)',
          filter: 'blur(7px)',
          transform: `rotate(${between(r, 2, 5).toFixed(1)}deg) skewX(10deg)`,
        }}
      />
      <div
        className="relative"
        style={{
          aspectRatio: '1 / 1',
          backgroundColor: top,
          backgroundImage: `${GRAIN}, linear-gradient(172deg, ${top} 0%, ${top} 62%, ${bottom} 100%)`,
          borderRadius: '2px 2px 16px 2px / 2px 2px 7px 2px',
          padding: '1.4rem 1.1rem 1rem',
        }}
      >
        <Handwriting
          text={text}
          look={look}
          ink={INK.marker}
          weight={700}
          style={{ fontSize: `${(look.size + 0.15).toFixed(2)}rem`, lineHeight: 1.08 }}
        />
      </div>
      <span
        aria-hidden="true"
        className="absolute size-3.5 rounded-full"
        style={{
          left: `${pinX.toFixed(1)}%`,
          top: '-0.35rem',
          transform: 'translateX(-50%)',
          background: `radial-gradient(circle at 35% 35%, #ffffff66, ${head} 45%, #00000055 100%), ${head}`,
          boxShadow: '1px 3px 3px rgba(0,0,0,.35)',
        }}
      />
    </Throw>
  );
}

/* --- Tacker: Notizbuchseite -------------------------------------------- */

function Staple({ left, top, rotate }: { left: string; top: string; rotate: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute"
      style={{
        left,
        top,
        width: '1rem',
        height: '0.22rem',
        borderRadius: '1px',
        background: 'linear-gradient(180deg, #D3CFC6, #8C887E)',
        boxShadow: '0 1px 1px rgba(0,0,0,.45)',
        transform: `rotate(${rotate.toFixed(1)}deg)`,
      }}
    />
  );
}

function NoteStaple({ id, text }: { id: string; text: string }) {
  const look = lookFor(id, 'staple');
  const { r } = look;
  const torn = r() < 0.5;
  const pad = torn ? '1.3rem' : '1.6rem';
  const spot = pick(r, ['tl', 'tr', 'lm'] as const);
  const a = -between(r, 10, 35);
  const staples =
    spot === 'tl'
      ? [{ left: '0.7rem', top: torn ? '0.9rem' : '1.1rem', rotate: a }]
      : spot === 'tr'
        ? [{ left: 'calc(100% - 1.9rem)', top: torn ? '0.9rem' : '1.1rem', rotate: -a }]
        : [{ left: '0.45rem', top: `${between(r, 30, 55).toFixed(0)}%`, rotate: 90 + a / 3 }];
  if (r() < 0.3)
    staples.push({ ...staples[0]!, top: `calc(${staples[0]!.top} + 1.1rem)`, rotate: staples[0]!.rotate + 4 });
  const ink = r() < 0.8 ? INK.ballpoint : INK.pencil;
  return (
    <Throw look={look}>
      <div
        className="relative"
        style={{
          backgroundColor: '#F3F0E6',
          backgroundImage: `${GRAIN}, linear-gradient(to right, transparent 2rem, rgba(186,72,64,.5) 2rem, rgba(186,72,64,.5) calc(2rem + 1px), transparent calc(2rem + 1px)), ${lined('rgba(88,112,170,.42)', pad).backgroundImage}`,
          backgroundSize: `auto, auto, ${lined('', pad).backgroundSize}`,
          backgroundPosition: `0 0, 0 0, ${lined('', pad).backgroundPosition}`,
          clipPath: torn ? tornTop(r) : roughEdges(r, 1.5),
          padding: `${pad} 1rem 0.9rem 2.5rem`,
        }}
      >
        {!torn && (
          // Lochrand vom Collegeblock: Loecher in Kartenfarbe, man sieht durch.
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-1.5 h-2.5"
            style={{
              background: 'radial-gradient(circle at 50% 50%, var(--card, #201D19) 2.4px, transparent 3px) repeat-x',
              backgroundSize: '0.85rem 100%',
            }}
          />
        )}
        <Handwriting text={text} look={look} ink={ink} style={onLines} />
      </div>
      {staples.map((s, i) => (
        <Staple key={i} {...s} />
      ))}
    </Throw>
  );
}

/* --- Klammer: Karopapier ------------------------------------------------ */

const CLIP_METAL = ['#A9AFB5', '#A9AFB5', '#A9AFB5', '#C0453A', '#3D6FB0'] as const;

function NoteClip({ id, text }: { id: string; text: string }) {
  const look = lookFor(id, 'clip');
  const { r } = look;
  const x = between(r, 8, 74);
  const metal = pick(r, CLIP_METAL);
  const ink = r() < 0.75 ? INK.pencil : INK.ballpoint;
  return (
    <Throw look={look}>
      <div
        style={{
          backgroundColor: '#E3E0D4',
          backgroundImage: `${GRAIN}, linear-gradient(rgba(70,90,140,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(70,90,140,.2) 1px, transparent 1px), ${light(r)}`,
          backgroundSize: 'auto, 0.6rem 0.6rem, 0.6rem 0.6rem, auto',
          clipPath: roughEdges(r),
          padding: '1.3rem 1.1rem 1.1rem',
        }}
      >
        <Handwriting text={text} look={look} ink={ink} />
      </div>
      <svg
        aria-hidden="true"
        className="absolute"
        width="20"
        height="30"
        viewBox="0 0 20 30"
        style={{ left: `${x.toFixed(1)}%`, top: '-0.95rem', transform: `rotate(${between(r, -14, 14).toFixed(1)}deg)` }}
      >
        <path
          d="M6 6a4 4 0 0 1 8 0v15a2.5 2.5 0 0 1-5 0V9a1 1 0 0 1 2 0v11.5"
          fill="none"
          stroke={metal}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </Throw>
  );
}

/* --- Eselsohr: Packpapier ---------------------------------------------- */

const KRAFT = '#C9A876';
const KRAFT_BACK = '#B4925E';

function NoteFold({ id, text }: { id: string; text: string }) {
  const look = lookFor(id, 'fold');
  const { r } = look;
  const corner = pick(r, ['tr', 'br', 'bl'] as const);
  const s = `${between(r, 1.1, 1.9).toFixed(2)}rem`;
  // Die Ecke ist weggeschnitten, darauf liegt die umgeknickte Rueckseite.
  const clip = {
    tr: `polygon(0 0, calc(100% - ${s}) 0, 100% ${s}, 100% 100%, 0 100%)`,
    br: `polygon(0 0, 100% 0, 100% calc(100% - ${s}), calc(100% - ${s}) 100%, 0 100%)`,
    bl: `polygon(0 0, 100% 0, 100% 100%, ${s} 100%, 0 calc(100% - ${s}))`,
  }[corner];
  const flap: CSSProperties = {
    tr: { right: 0, top: 0, background: `linear-gradient(to top right, ${KRAFT_BACK} 50%, transparent 50%)` },
    br: { right: 0, bottom: 0, background: `linear-gradient(to bottom right, ${KRAFT_BACK} 50%, transparent 50%)` },
    bl: { left: 0, bottom: 0, background: `linear-gradient(to bottom left, ${KRAFT_BACK} 50%, transparent 50%)` },
  }[corner];
  return (
    <Throw look={look}>
      <div
        style={{
          backgroundColor: KRAFT,
          backgroundImage: `${FIBER}, ${light(r)}`,
          clipPath: clip,
          padding: '1.1rem 1.2rem 1.2rem',
        }}
      >
        <Handwriting text={text} look={look} ink={INK.marker} weight={600} />
      </div>
      <span
        aria-hidden="true"
        className="absolute"
        style={{ width: s, height: s, filter: 'drop-shadow(-1px 1px 1px rgba(0,0,0,.3))', ...flap }}
      />
    </Throw>
  );
}

/* --- Etikett ----------------------------------------------------------- */

/** Wie das Etikett auf der Kassette: oben der Streifen der Bandsorte (die
 *  Akzentfarbe der eingelegten Kassette), darunter Linien zum Beschreiben. */
function NoteLabel({ id, text }: { id: string; text: string }) {
  const look = lookFor(id, 'label', true);
  const { r } = look;
  return (
    <Throw look={look}>
      <div
        style={{
          backgroundColor: '#E4DAC4',
          backgroundImage: GRAIN,
          clipPath: roughEdges(r, 1.5),
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{
            background: 'var(--accent, #B8462C)',
            color: '#FFF1E9',
            padding: '0.28rem 0.7rem',
            fontWeight: 750,
            fontStretch: '75%',
            fontSize: '0.62rem',
            letterSpacing: '0.08em',
          }}
        >
          <span>KLIQTAPE</span>
          <span style={{ opacity: 0.75 }}>Nº {String(1 + Math.floor(r() * 90)).padStart(2, '0')}</span>
        </div>
        <div style={{ ...lined('rgba(140,116,84,.5)', '0.35rem'), padding: '0.35rem 1rem 0.8rem' }}>
          <Handwriting text={text} look={look} ink={INK.felt} style={onLines} />
        </div>
      </div>
    </Throw>
  );
}

const NOTE_RENDERERS: Record<NoteStyle, typeof NoteTape> = {
  tape: NoteTape,
  pin: NotePin,
  staple: NoteStaple,
  clip: NoteClip,
  fold: NoteFold,
  label: NoteLabel,
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
  const inner = <Renderer id={id} text={text} />;
  if (scale === 1) return inner;
  // Feste Breite VOR dem Skalieren — sonst quetscht sich die Karte in einen
  // kleinen Container, statt als verkleinerte Kopie ihrer echten Groesse zu
  // erscheinen. 17rem entspricht der Hoechstbreite des Zettels selbst.
  return <div style={{ width: '17rem', transform: `scale(${scale})`, transformOrigin: 'top left' }}>{inner}</div>;
}
