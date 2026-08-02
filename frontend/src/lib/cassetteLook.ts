/**
 * Jede Kassette sieht anders aus — aber immer gleich.
 *
 * Aussehen wird aus der ID abgeleitet, nicht gespeichert und nicht gewuerfelt:
 * dieselbe Runde hat auf jedem Geraet dasselbe Band. Dadurch erkennt man sein
 * Band im Regal wieder, ohne den Namen zu lesen.
 *
 * Bewusst KEINE frei waehlbaren Farben: die zwei Welten sind das Produkt. Was
 * variiert, sind fertig abgestimmte Bandsorten und Gehaeusefarben.
 */

export interface TypeLook {
  name: string;
  shell: string;
  shellHi: string;
  shellDark: string;
  label: string;
  labelDeep: string;
  stripe: string;
  tape: string;
  hub: string;
  ink: string;
}

export interface CaseLook {
  name: string;
  shell: string;
  shellHi: string;
  inner: string;
  glow: string;
  ink: string;
  /** Gedaempfte Schrift auf dem Bildschirm dieser Gehaeusefarbe. */
  dim: string;
  screen: string;
  pcb: string;
}

/** Seite A — Bandsorten, wie es sie wirklich gab. */
const TYPES: TypeLook[] = [
  { name: 'Type I Normal', shell: '#23201C', shellHi: '#3E3830', shellDark: '#161310',
    label: '#E4DAC4', labelDeep: '#D0C1A3', stripe: '#B8462C', tape: '#5C3A21', hub: '#F0E9D8', ink: '#3B3226' },
  { name: 'Type II Chrome', shell: '#3F4448', shellHi: '#5B6268', shellDark: '#26292C',
    label: '#DEE3E5', labelDeep: '#C0C8CC', stripe: '#3D8299', tape: '#4A4A4E', hub: '#EDF1F2', ink: '#2C3336' },
  { name: 'Type IV Metal', shell: '#2A333C', shellHi: '#455360', shellDark: '#1A2026',
    label: '#D5DCE2', labelDeep: '#B6C1C9', stripe: '#C4703A', tape: '#3A4A55', hub: '#E9EFF3', ink: '#26313A' },
  { name: 'Ferro Sand', shell: '#463E34', shellHi: '#605546', shellDark: '#2D2822',
    label: '#EFE3CC', labelDeep: '#DBC9A9', stripe: '#A8763C', tape: '#6B5232', hub: '#F6EEDC', ink: '#3E3427' },
  { name: 'Oliv Extra', shell: '#323A2D', shellHi: '#4A553F', shellDark: '#20261D',
    label: '#E1E4D1', labelDeep: '#C6CCB1', stripe: '#8B9C36', tape: '#48522F', hub: '#EEF0E1', ink: '#2E3526' },
  { name: 'Bordeaux HX', shell: '#3B2428', shellHi: '#55363C', shellDark: '#26171A',
    label: '#EDD9D5', labelDeep: '#D8B9B3', stripe: '#C1503F', tape: '#5A3630', hub: '#F7E7E3', ink: '#3A2528' },
];

/** Seite B — durchscheinendes Plastik, wie die Game-Boy-Color-Gehäuse von 1999. */
const CASES: CaseLook[] = [
  { name: 'Atomic Purple', shell: '#6B4A9E', shellHi: '#C9AFEF', inner: '#2B1A42',
    glow: '#A97CE8', ink: '#F2E9FF', dim: '#A48EC4', screen: '#1A1028', pcb: '#4E7A5E' },
  { name: 'Kiwi', shell: '#3F8F58', shellHi: '#AFEFC2', inner: '#10301C',
    glow: '#6FE096', ink: '#E9FFF0', dim: '#84B497', screen: '#0D2216', pcb: '#7A6B4E' },
  { name: 'Berry', shell: '#9E4A6B', shellHi: '#EFAFC7', inner: '#33101F',
    glow: '#E87CA6', ink: '#FFE9F1', dim: '#C48EA4', screen: '#241019', pcb: '#4E7A5E' },
  { name: 'Ice', shell: '#3F7A9E', shellHi: '#AFD9EF', inner: '#10222F',
    glow: '#6FBFE8', ink: '#E9F5FF', dim: '#8EA9C4', screen: '#0D1B24', pcb: '#4E7A5E' },
  { name: 'Amber', shell: '#9E7529', shellHi: '#EFD8A0', inner: '#2F2310',
    glow: '#E8BC5C', ink: '#FFF6E4', dim: '#C4AE8E', screen: '#241B0C', pcb: '#4E7A5E' },
];

export interface CassetteLook {
  type: TypeLook;
  case: CaseLook;
  /** Feste Zufallszahlen fuer Gebrauchsspuren — pro Kassette immer dieselben. */
  wear: { scratches: [number, number, number][]; specks: [number, number, number][]; tilt: number };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Kleiner deterministischer Generator — gleiche Saat, gleiche Spuren. */
function rng(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, CassetteLook>();

export function lookFor(id: string): CassetteLook {
  const hit = cache.get(id);
  if (hit) return hit;

  const h = hash(id || 'kliqtape');
  const r = rng(h);

  // Kratzer: x-Start in Prozent, y in Prozent, Laenge in Prozent
  const scratches: [number, number, number][] = Array.from({ length: 3 + Math.floor(r() * 3) }, () => [
    r() * 88,
    r() * 100,
    6 + r() * 26,
  ]);
  // Staub und kleine Abplatzer
  const specks: [number, number, number][] = Array.from({ length: 8 + Math.floor(r() * 10) }, () => [
    r() * 100,
    r() * 100,
    0.4 + r() * 1.1,
  ]);

  const look: CassetteLook = {
    type: TYPES[h % TYPES.length]!,
    case: CASES[(h >>> 8) % CASES.length]!,
    // Das Klebeband sitzt nie ganz gerade.
    wear: { scratches, specks, tilt: -1.8 + r() * 3.2 },
  };

  cache.set(id, look);
  return look;
}
