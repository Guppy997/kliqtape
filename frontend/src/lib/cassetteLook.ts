/**
 * Jede Kassette sieht anders aus — aber immer gleich.
 *
 * Aussehen wird aus der ID abgeleitet, nicht gespeichert und nicht gewuerfelt:
 * dieselbe Runde hat auf jedem Geraet dasselbe Band. Dadurch erkennt man sein
 * Band im Regal wieder, ohne den Namen zu lesen.
 *
 * WICHTIG: Bandsorte und Gehaeusefarbe sind fest gepaart, nicht unabhaengig
 * gezogen. Seite B ist dasselbe Band in durchscheinendem Plastik — also in
 * derselben Farbfamilie wie Seite A, nur als Game-Boy-Gehaeuse.
 *
 * Bewusst KEINE frei waehlbaren Farben: die zwei Welten sind das Produkt. Was
 * variiert, sind fertig abgestimmte Paare.
 */

export interface TypeLook {
  name: string;
  shell: string;
  shellHi: string;
  shellDark: string;
  /** Etikettpapier */
  label: string;
  labelDeep: string;
  /** Linien im Beschriftungsfeld */
  rule: string;
  /** Farbband oben auf dem Etikett */
  stripe: string;
  stripeInk: string;
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
  dim: string;
  screen: string;
  pcb: string;
}

interface Pair {
  type: TypeLook;
  case: CaseLook;
}

/**
 * Sechs Paare. Links die Bandsorte, rechts dasselbe Band als durchscheinendes
 * Gehaeuse — gleicher Farbton, andere Materialitaet.
 */
const PAIRS: Pair[] = [
  {
    // Warmes Schwarz mit Oxidbraun und rotem Streifen → warmes Bernstein
    type: { name: 'Type I Normal', shell: '#23201C', shellHi: '#3E3830', shellDark: '#161310',
      label: '#E4DAC4', labelDeep: '#D0C1A3', rule: '#B7A484', stripe: '#B8462C', stripeInk: '#FFF1E9',
      tape: '#5C3A21', hub: '#F0E9D8', ink: '#3B3226' },
    case: { name: 'Amber', shell: '#9E7529', shellHi: '#EFD8A0', inner: '#2F2310',
      glow: '#E8BC5C', ink: '#FFF6E4', dim: '#C4AE8E', screen: '#241B0C', pcb: '#4E7A5E' },
  },
  {
    // Kühles Silber mit Türkis → durchscheinendes Eisblau
    type: { name: 'Type II Chrome', shell: '#3F4448', shellHi: '#5B6268', shellDark: '#26292C',
      label: '#DEE3E5', labelDeep: '#C0C8CC', rule: '#9BA6AB', stripe: '#3D8299', stripeInk: '#EAF6FA',
      tape: '#4A4A4E', hub: '#EDF1F2', ink: '#2C3336' },
    case: { name: 'Ice', shell: '#3F7A9E', shellHi: '#AFD9EF', inner: '#10222F',
      glow: '#6FBFE8', ink: '#E9F5FF', dim: '#8EA9C4', screen: '#0D1B24', pcb: '#4E7A5E' },
  },
  {
    // Schiefergrau-Blau → Atomic Purple, der kühle Verwandte
    type: { name: 'Type IV Metal', shell: '#2E3140', shellHi: '#4A4F63', shellDark: '#1C1E28',
      label: '#DCD9E6', labelDeep: '#C0BCD0', rule: '#9A96AC', stripe: '#6B4A9E', stripeInk: '#F4EDFF',
      tape: '#3A3550', hub: '#EEEBF5', ink: '#2B2839' },
    case: { name: 'Atomic Purple', shell: '#6B4A9E', shellHi: '#C9AFEF', inner: '#2B1A42',
      glow: '#A97CE8', ink: '#F2E9FF', dim: '#A48EC4', screen: '#1A1028', pcb: '#4E7A5E' },
  },
  {
    // Sand und Ocker → durchscheinendes Tabakbraun
    type: { name: 'Ferro Sand', shell: '#463E34', shellHi: '#605546', shellDark: '#2D2822',
      label: '#EFE3CC', labelDeep: '#DBC9A9', rule: '#BCA684', stripe: '#A8763C', stripeInk: '#FFF4E4',
      tape: '#6B5232', hub: '#F6EEDC', ink: '#3E3427' },
    case: { name: 'Tabak', shell: '#8A6A3A', shellHi: '#E7CFA4', inner: '#2A1F11',
      glow: '#D9AE68', ink: '#FFF3E2', dim: '#BFA98A', screen: '#20180E', pcb: '#5E6B4E' },
  },
  {
    // Oliv → Kiwi
    type: { name: 'Oliv Extra', shell: '#323A2D', shellHi: '#4A553F', shellDark: '#20261D',
      label: '#E1E4D1', labelDeep: '#C6CCB1', rule: '#A3AC8C', stripe: '#7A8C2E', stripeInk: '#F4F7E6',
      tape: '#48522F', hub: '#EEF0E1', ink: '#2E3526' },
    case: { name: 'Kiwi', shell: '#3F8F58', shellHi: '#AFEFC2', inner: '#10301C',
      glow: '#6FE096', ink: '#E9FFF0', dim: '#84B497', screen: '#0D2216', pcb: '#7A6B4E' },
  },
  {
    // Bordeaux → Berry
    type: { name: 'Bordeaux HX', shell: '#3B2428', shellHi: '#55363C', shellDark: '#26171A',
      label: '#EDD9D5', labelDeep: '#D8B9B3', rule: '#BE9A94', stripe: '#C1503F', stripeInk: '#FFF0EC',
      tape: '#5A3630', hub: '#F7E7E3', ink: '#3A2528' },
    case: { name: 'Berry', shell: '#9E4A6B', shellHi: '#EFAFC7', inner: '#33101F',
      glow: '#E87CA6', ink: '#FFE9F1', dim: '#C48EA4', screen: '#241019', pcb: '#4E7A5E' },
  },
];

export interface CassetteLook {
  type: TypeLook;
  case: CaseLook;
  /** Feste Zufallszahlen fuer Gebrauchsspuren — pro Kassette immer dieselben. */
  wear: {
    scratches: [number, number, number][];
    specks: [number, number, number][];
    /** Ein Etikett klebt nie ganz gerade. */
    tilt: number;
  };
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

/**
 * Damit im Regal keine zwei Baender gleich aussehen.
 *
 * Die Sorte kommt weiter aus der ID — bei einer Kollision rueckt das spaetere
 * Band aber auf das naechste freie Paar. Die Zuordnung haengt nur an der
 * sortierten Menge der IDs, ist also fuer alle mit demselben Regal identisch
 * und aendert sich nicht beim Neuladen.
 *
 * Preis: kommt ein Band dazu, kann sich die Sorte eines anderen verschieben.
 * Das ist der Kompromiss gegen zwei ununterscheidbare Kassetten im Fach.
 */
export function assignPairs(ids: string[]): Map<string, number> {
  const out = new Map<string, number>();
  const taken = new Set<number>();

  for (const id of [...ids].sort()) {
    let i = hash(id) % PAIRS.length;
    // Nur solange ausweichen, wie es ueberhaupt freie Paare gibt.
    for (let step = 0; step < PAIRS.length && taken.has(i); step++) {
      i = (i + 1) % PAIRS.length;
    }
    taken.add(i);
    out.set(id, i);
  }
  return out;
}

const cache = new Map<string, CassetteLook>();

export function lookFor(id: string, pairIndex?: number): CassetteLook {
  const key = pairIndex == null ? id : `${id}#${pairIndex}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const h = hash(id || 'kliqtape');
  const r = rng(h);
  const pair = PAIRS[pairIndex ?? h % PAIRS.length]!;

  const scratches: [number, number, number][] = Array.from({ length: 3 + Math.floor(r() * 3) }, () => [
    r() * 88,
    r() * 100,
    6 + r() * 26,
  ]);
  const specks: [number, number, number][] = Array.from({ length: 8 + Math.floor(r() * 10) }, () => [
    r() * 100,
    r() * 100,
    0.4 + r() * 1.1,
  ]);

  const look: CassetteLook = {
    type: pair.type,
    case: pair.case,
    wear: { scratches, specks, tilt: -0.9 + r() * 1.8 },
  };

  cache.set(key, look);
  return look;
}
