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
  /** Marmorierung/Konfetti/Glitzer statt einfarbigem Plastik — Akzentfarben
   *  der Sprenkel. Fehlt bei den einfarbigen Sorten. */
  fleck?: string[];
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
    case: { name: 'Amber', shell: '#856936', shellHi: '#DECA99', inner: '#2F2310',
      glow: '#D0AD61', ink: '#FFF6E4', dim: '#C4AE8E', screen: '#241B0C', pcb: '#4E7A5E' },
  },
  {
    // Kühles Silber mit Türkis → durchscheinendes Eisblau
    type: { name: 'Type II Chrome', shell: '#3F4448', shellHi: '#5B6268', shellDark: '#26292C',
      label: '#DEE3E5', labelDeep: '#C0C8CC', rule: '#9BA6AB', stripe: '#3D8299', stripeInk: '#EAF6FA',
      tape: '#4A4A4E', hub: '#EDF1F2', ink: '#2C3336' },
    case: { name: 'Ice', shell: '#487088', shellHi: '#A6CCE0', inner: '#10222F',
      glow: '#70B1D2', ink: '#E9F5FF', dim: '#8EA9C4', screen: '#0D1B24', pcb: '#4E7A5E' },
  },
  {
    // Schiefergrau-Blau → Atomic Purple, der kühle Verwandte
    type: { name: 'Type IV Metal', shell: '#2E3140', shellHi: '#4A4F63', shellDark: '#1C1E28',
      label: '#DCD9E6', labelDeep: '#C0BCD0', rule: '#9A96AC', stripe: '#6B4A9E', stripeInk: '#F4EDFF',
      tape: '#3A3550', hub: '#EEEBF5', ink: '#2B2839' },
    case: { name: 'Atomic Purple', shell: '#675189', shellHi: '#BDA6E0', inner: '#2B1A42',
      glow: '#A07BD4', ink: '#F2E9FF', dim: '#A48EC4', screen: '#1A1028', pcb: '#4E7A5E' },
  },
  {
    // Sand und Ocker → durchscheinendes Tabakbraun
    type: { name: 'Ferro Sand', shell: '#463E34', shellHi: '#605546', shellDark: '#2D2822',
      label: '#EFE3CC', labelDeep: '#DBC9A9', rule: '#BCA684', stripe: '#A8763C', stripeInk: '#FFF4E4',
      tape: '#6B5232', hub: '#F6EEDC', ink: '#3E3427' },
    case: { name: 'Tabak', shell: '#776241', shellHi: '#D7C29D', inner: '#2A1F11',
      glow: '#C4A26A', ink: '#FFF3E2', dim: '#BFA98A', screen: '#20180E', pcb: '#5E6B4E' },
  },
  {
    // Oliv → Kiwi
    type: { name: 'Oliv Extra', shell: '#323A2D', shellHi: '#4A553F', shellDark: '#20261D',
      label: '#E1E4D1', labelDeep: '#C6CCB1', rule: '#A3AC8C', stripe: '#7A8C2E', stripeInk: '#F4F7E6',
      tape: '#48522F', hub: '#EEF0E1', ink: '#2E3526' },
    case: { name: 'Kiwi', shell: '#496C54', shellHi: '#9ECEAC', inner: '#10301C',
      glow: '#71B689', ink: '#E9FFF0', dim: '#84B497', screen: '#0D2216', pcb: '#7A6B4E' },
  },
  {
    // Bordeaux → Berry
    type: { name: 'Bordeaux HX', shell: '#3B2428', shellHi: '#55363C', shellDark: '#26171A',
      label: '#EDD9D5', labelDeep: '#D8B9B3', rule: '#BE9A94', stripe: '#C1503F', stripeInk: '#FFF0EC',
      tape: '#5A3630', hub: '#F7E7E3', ink: '#3A2528' },
    case: { name: 'Berry', shell: '#895167', shellHi: '#E0A6BB', inner: '#33101F',
      glow: '#D47B9D', ink: '#FFE9F1', dim: '#C48EA4', screen: '#241019', pcb: '#4E7A5E' },
  },

  // --- Vier weitere einfarbige Sorten -------------------------------------
  {
    // Kuehles Anthrazit → helles Chrome-Grau
    type: { name: 'Graphit Type', shell: '#1B1F22', shellHi: '#31383F', shellDark: '#0F1215',
      label: '#E4DAC4', labelDeep: '#D0C1A3', rule: '#B7A484', stripe: '#2F70B1', stripeInk: '#FFF1E9',
      tape: '#23405C', hub: '#F0E9D8', ink: '#3B3226' },
    case: { name: 'Graphit', shell: '#515C67', shellHi: '#A6B3BF', inner: '#122130',
      glow: '#8294A6', ink: '#F0F2F5', dim: '#9FADBC', screen: '#0C1722', pcb: '#4E7A5E' },
  },
  {
    // Gebranntes Orange → Terrakotta
    type: { name: 'Rost Type', shell: '#221D1B', shellHi: '#3F3531', shellDark: '#15110F',
      label: '#E4DAC4', labelDeep: '#D0C1A3', rule: '#B7A484', stripe: '#B1562F', stripeInk: '#FFF1E9',
      tape: '#5C3423', hub: '#F0E9D8', ink: '#3B3226' },
    case: { name: 'Rost', shell: '#895843', shellHi: '#DBB19E', inner: '#301B12',
      glow: '#CD8B70', ink: '#F5F1F0', dim: '#BCA89F', screen: '#22130C', pcb: '#4E7A5E' },
  },
  {
    // Dunkles Blaugruen → tiefes Petrol
    type: { name: 'Petrol Type', shell: '#1B2122', shellHi: '#313D3F', shellDark: '#0F1415',
      label: '#E4DAC4', labelDeep: '#D0C1A3', rule: '#B7A484', stripe: '#2FA0B1', stripeInk: '#FFF1E9',
      tape: '#23555C', hub: '#F0E9D8', ink: '#3B3226' },
    case: { name: 'Petrol', shell: '#437F89', shellHi: '#9ED3DB', inner: '#122C30',
      glow: '#70C0CD', ink: '#F0F4F5', dim: '#9FB8BC', screen: '#0C1F22', pcb: '#4E7A5E' },
  },
  {
    // Weinrot-Violett → Pflaume
    type: { name: 'Pflaume Type', shell: '#221B22', shellHi: '#3F313F', shellDark: '#150F15',
      label: '#E4DAC4', labelDeep: '#D0C1A3', rule: '#B7A484', stripe: '#B12FB1', stripeInk: '#FFF1E9',
      tape: '#5C235C', hub: '#F0E9D8', ink: '#3B3226' },
    case: { name: 'Pflaume', shell: '#894389', shellHi: '#DB9EDB', inner: '#301230',
      glow: '#CD70CD', ink: '#F5F0F5', dim: '#BC9FBC', screen: '#220C22', pcb: '#4E7A5E' },
  },

  // --- Sechs gemusterte Sorten (echte Marmor-/Konfetti-Kassetten als Vorbild,
  //     `fleck` sind die Sprenkelfarben, gerendert von MiniCassette und
  //     CassetteHeader) --------------------------------------------------
  {
    // Vorbild: die klassischen bunt marmorierten "Jazz"-Kassetten
    type: { name: 'Jazz Marmor Type', shell: '#22201B', shellHi: '#3F3B31', shellDark: '#15130F',
      label: '#E4DAC4', labelDeep: '#D0C1A3', rule: '#B7A484', stripe: '#B1862F', stripeInk: '#FFF1E9',
      tape: '#5C4923', hub: '#F0E9D8', ink: '#3B3226' },
    case: { name: 'Jazz Marmor', shell: '#897243', shellHi: '#DBC79E', inner: '#302612',
      glow: '#CDAE70', ink: '#F5F3F0', dim: '#BCB29F', screen: '#221B0C', pcb: '#4E7A5E',
      fleck: ['#D37769', '#69A7D3', '#D3C269'] },
  },
  {
    // Vorbild: mattes Rauchglas-Plastik
    type: { name: 'Rauchglas Type', shell: '#1B1D22', shellHi: '#31363F', shellDark: '#0F1115',
      label: '#E4DAC4', labelDeep: '#D0C1A3', rule: '#B7A484', stripe: '#2F5BB1', stripeInk: '#FFF1E9',
      tape: '#23365C', hub: '#F0E9D8', ink: '#3B3226' },
    case: { name: 'Rauchglas', shell: '#4B4F59', shellHi: '#9EA5B2', inner: '#121C30',
      glow: '#7C8598', ink: '#F0F1F5', dim: '#9FA9BC', screen: '#0C1322', pcb: '#4E7A5E',
      fleck: ['#698CD3'] },
  },
  {
    // Bunte Sprenkel auf dunklem Grund
    type: { name: 'Konfetti Type', shell: '#1C1B22', shellHi: '#33313F', shellDark: '#100F15',
      label: '#E4DAC4', labelDeep: '#D0C1A3', rule: '#B7A484', stripe: '#452FB1', stripeInk: '#FFF1E9',
      tape: '#2D235C', hub: '#F0E9D8', ink: '#3B3226' },
    case: { name: 'Konfetti', shell: '#413E51', shellHi: '#928CB0', inner: '#171230',
      glow: '#6F6798', ink: '#F1F0F5', dim: '#A49FBC', screen: '#100C22', pcb: '#4E7A5E',
      fleck: ['#D37769', '#D3B969', '#69D39E', '#D3699E'] },
  },
  {
    // Olivgruen mit helleren Streifflecken
    type: { name: 'Camo Type', shell: '#20221B', shellHi: '#3B3F31', shellDark: '#13150F',
      label: '#E4DAC4', labelDeep: '#D0C1A3', rule: '#B7A484', stripe: '#86B12F', stripeInk: '#FFF1E9',
      tape: '#495C23', hub: '#F0E9D8', ink: '#3B3226' },
    case: { name: 'Camo', shell: '#5C6746', shellHi: '#B4C299', inner: '#263012',
      glow: '#99AC71', ink: '#F3F5F0', dim: '#B2BC9F', screen: '#1B220C', pcb: '#4E7A5E',
      fleck: ['#D3A769', '#95D369'] },
  },
  {
    // Schimmerndes Perlmutt
    type: { name: 'Perlmutt Type', shell: '#221B20', shellHi: '#3F313B', shellDark: '#150F13',
      label: '#E4DAC4', labelDeep: '#D0C1A3', rule: '#B7A484', stripe: '#B12F86', stripeInk: '#FFF1E9',
      tape: '#5C2349', hub: '#F0E9D8', ink: '#3B3226' },
    case: { name: 'Perlmutt', shell: '#816979', shellHi: '#D3C5CE', inner: '#301226',
      glow: '#B9A2B1', ink: '#F5F0F3', dim: '#BC9FB2', screen: '#220C1B', pcb: '#4E7A5E',
      fleck: ['#69B0D3', '#D3C269'] },
  },
  {
    // Tuerkis marmoriert
    type: { name: 'Türkis Marmor Type', shell: '#1B2221', shellHi: '#313F3E', shellDark: '#0F1514',
      label: '#E4DAC4', labelDeep: '#D0C1A3', rule: '#B7A484', stripe: '#2FB1A6', stripeInk: '#FFF1E9',
      tape: '#235C58', hub: '#F0E9D8', ink: '#3B3226' },
    case: { name: 'Türkis Marmor', shell: '#438983', shellHi: '#9EDBD6', inner: '#12302E',
      glow: '#70CDC5', ink: '#F0F5F4', dim: '#9FBCBA', screen: '#0C2220', pcb: '#4E7A5E',
      fleck: ['#D3B069', '#69D3CB'] },
  },
];

/** Wie viele Bandsorten es gibt — der Farb-Schritt beim Anlegen iteriert
 *  darueber, statt eine Zahl an mehreren Stellen zu duplizieren. */
export const PAIR_COUNT = PAIRS.length;

export interface CassetteLook {
  type: TypeLook;
  case: CaseLook;
  /** Feste Zufallszahlen fuer Gebrauchsspuren — pro Kassette immer dieselben. */
  wear: {
    scratches: [number, number, number][];
    specks: [number, number, number][];
    /** Ein Etikett klebt nie ganz gerade. */
    tilt: number;
    /** Spuren, die mit dem Alter dazukommen (ageStageOf, berlinDay.ts) —
     *  ebenfalls fest pro Kassette, damit sie nicht bei jedem Rendern springen. */
    extraScratches: [number, number, number][];
    extraSpecks: [number, number, number][];
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
export function assignPairs(ids: string[], preTaken?: Set<number>): Map<string, number> {
  const out = new Map<string, number>();
  const taken = new Set<number>(preTaken);

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

  // Reihenfolge ist wichtig: erst die bisherigen Werte, DANN die Alters-
  // Spuren — so sieht jede Kassette auf Stufe 0 exakt aus wie vorher.
  const tilt = -0.9 + r() * 1.8;
  const extraScratches: [number, number, number][] = Array.from({ length: 12 }, () => [
    r() * 92,
    r() * 100,
    4 + r() * 18,
  ]);
  const extraSpecks: [number, number, number][] = Array.from({ length: 32 }, () => [
    r() * 100,
    r() * 100,
    0.3 + r() * 0.9,
  ]);

  const look: CassetteLook = {
    type: pair.type,
    case: pair.case,
    wear: { scratches, specks, tilt, extraScratches, extraSpecks },
  };

  cache.set(key, look);
  return look;
}
