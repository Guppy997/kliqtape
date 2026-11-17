import type { CassetteLook, CaseLook, TypeLook } from '@/lib/cassetteLook';
import { EM, FOOT_HOLE_Y, FOOT_HOLES, GLASS_LIP, H, LABEL, MARK, SCREWS, W, WIN } from './dims';

/*
 * Uebernommen von der Website (kliqtape-website, components/tape3d) und an
 * die App angepasst: Farben und Spuren aus lookFor() (alle Sorten), Sprenkel
 * auf Seite B, Altern wie CassetteFace.
 *
 * Alle Texturen der Kassette entstehen hier per Canvas 2D, ohne Bilddateien
 * und ohne three.js. So nutzt auch die flache Ansicht (flat.ts) fuer Geraete
 * ohne WebGL genau dieselben Zeichenfunktionen: eine Quelle fuer das Etikett.
 */

export type Side = 'a' | 'b';

/** Bandsorte und Gehaeuse einer Kassette, wie lookFor() sie liefert. */
export interface Pair {
  type: TypeLook;
  case: CaseLook;
}
export type Wear = CassetteLook['wear'];

/** Schriften laut Markenskill. Die festen Schnitte stehen in index.css. */
const F = {
  mark: '"Archivo Wortmarke", Archivo, sans-serif',
  title: '"Archivo Titel", Archivo, sans-serif',
  sans: 'Archivo, system-ui, sans-serif',
  hand: 'Caveat, cursive',
};

let fontsPromise: Promise<void> | null = null;
/** Canvas zeichnet mit Ersatzschrift, solange die Datei nicht geladen ist. */
export function fontsReady(): Promise<void> {
  if (!fontsPromise) {
    const faces = ['700 20px "Archivo Wortmarke"', '700 20px "Archivo Titel"', '500 20px Archivo', '400 20px Caveat'];
    const all = Promise.all(faces.map((f) => document.fonts.load(f))).then(() => undefined);
    const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 3000));
    fontsPromise = Promise.race([all, timeout]).catch(() => undefined);
  }
  return fontsPromise;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return [c, c.getContext('2d')!];
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Kleiner Zufall mit fester Saat, damit Papierfaser und Bandlagen nicht flackern. */
function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function seedOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Text mit Laufweite. Wo der Browser `letterSpacing` am Canvas kann, bleibt
 * die Unterschneidung erhalten; sonst Zeichen fuer Zeichen.
 */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, ls: number, stroke = false) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in c) {
    c.letterSpacing = `${ls}px`;
    if (stroke) ctx.strokeText(text, x, y);
    else ctx.fillText(text, x, y);
    c.letterSpacing = '0px';
    return;
  }
  let cx = x;
  for (const ch of text) {
    if (stroke) ctx.strokeText(ch, cx, y);
    else ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + ls;
  }
}
function spacedWidth(ctx: CanvasRenderingContext2D, text: string, ls: number) {
  return ctx.measureText(text).width + ls * [...text].length;
}

/** Text auf Breite kuerzen, wie `truncate` in der App. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number, ls = 0) {
  if (spacedWidth(ctx, text, ls) <= max) return text;
  let t = text;
  while (t.length > 1 && spacedWidth(ctx, `${t}…`, ls) > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// Farben einer Seite, 1:1 wie CassetteFace in der App

export function colorsOf(pair: Pair, side: Side) {
  const { type, case: plastic } = pair;
  const isA = side === 'a';
  return {
    isA,
    shell: isA ? type.shell : plastic.shell,
    shellHi: isA ? type.shellHi : plastic.shellHi,
    shellDark: isA ? type.shellDark : plastic.inner,
    paper: isA ? type.label : `${plastic.inner}dd`,
    paperDeep: isA ? type.labelDeep : `${plastic.inner}f2`,
    ink: isA ? type.ink : plastic.ink,
    rule: isA ? type.rule : `${plastic.shellHi}55`,
    band: isA ? type.stripe : plastic.shell,
    bandInk: isA ? type.stripeInk : plastic.ink,
    sortName: isA ? type.name : plastic.name,
    letter: isA ? type.stripe : '#ffffff',
    letterBorder: isA ? type.stripe : plastic.glow,
    glow: plastic.glow,
    accent: isA ? type.stripe : plastic.glow,
    mark: isA ? '#8C8272' : `${plastic.ink}b0`,
    /** Licht fuer Kratzer und Staub, wie Wear in der App */
    wearLight: isA ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.32)',
    tape: type.tape,
    hub: type.hub,
    pcb: plastic.pcb,
    fleck: isA ? undefined : plastic.fleck,
    labelDeep: type.labelDeep,
    typeShellDark: type.shellDark,
  };
}

// ---------------------------------------------------------------------------
// Etikett

export interface LabelSpec {
  pair: Pair;
  side: Side;
  label: string;
  sub?: string;
  corner: string;
  /** Altersstufe 0..9 (ageStageOf): Etikett vergilbt, Filzstift verblasst, Eselsohr. */
  age?: number;
}

/**
 * Das Etikett wie CassetteFace in der App: Farbband mit Wortmarke, Bandsorte
 * und Position, darunter zwei linierte Zeilen mit Filzstift. Masse in em der
 * Website (1em = 4 mm), damit es aussieht wie bisher.
 */
export function drawLabel(spec: LabelSpec, widthPx: number): HTMLCanvasElement {
  const c = colorsOf(spec.pair, spec.side);
  const s = widthPx / LABEL.w; // px pro mm
  const em = EM * s;
  const [cv, ctx] = makeCanvas(widthPx, LABEL.h * s);
  const w = cv.width;
  const h = cv.height;

  roundRectPath(ctx, 0, 0, w, h, LABEL.r * s);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, c.paper);
  g.addColorStop(1, c.paperDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Papier: feine Faser, nur auf Seite A (das Etikett von Seite B ist Plastik).
  if (c.isA) {
    const rnd = seeded(seedOf(spec.label));
    const n = Math.round((w * h) / 260);
    for (let i = 0; i < n; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const len = (0.3 + rnd() * 1.4) * s;
      const a = rnd() * Math.PI;
      ctx.strokeStyle = rnd() > 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(90,70,40,.06)';
      ctx.lineWidth = Math.max(0.6, 0.06 * s);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
  }

  // Farbband oben, wie der bedruckte Kopf einer echten J-Card
  const bandH = 1.32 * em;
  ctx.fillStyle = c.band;
  ctx.fillRect(0, 0, w, bandH);
  ctx.textBaseline = 'alphabetic';
  const padX = 0.625 * em;
  const markSize = 0.92 * em;
  // Grundlinie so, dass die Versalien mittig im Band stehen (Versalhoehe ~0,7)
  const base = bandH / 2 + markSize * 0.35;

  // Wortmarke: KLIQ gefuellt, TAPE als Kontur 0.032em, Laufweite +0.01em
  ctx.font = `700 ${markSize}px ${F.mark}`;
  const ls = 0.01 * markSize;
  ctx.fillStyle = c.bandInk;
  ctx.strokeStyle = c.bandInk;
  ctx.lineWidth = Math.max(1, 0.032 * markSize);
  ctx.lineJoin = 'round';
  spaced(ctx, 'KLIQ', padX, base, ls);
  const kliqW = spacedWidth(ctx, 'KLIQ', ls);
  spaced(ctx, 'TAPE', padX + kliqW, base, ls, true);
  const markW = kliqW + spacedWidth(ctx, 'TAPE', ls);

  // Ecke rechts: kurze Nummernform
  ctx.font = `500 ${0.5 * em}px ${F.sans}`;
  const cornerLs = 0.16 * 0.5 * em;
  const corner = spec.corner.toUpperCase();
  const cornerW = spacedWidth(ctx, corner, cornerLs);
  ctx.globalAlpha = 0.8;
  spaced(ctx, corner, w - padX - cornerW, base, cornerLs);

  // Bandsorte neben der Wortmarke, gekuerzt wie `truncate`
  ctx.font = `700 ${0.55 * em}px ${F.title}`;
  const sortLs = 0.18 * 0.55 * em;
  const sortX = padX + markW + 0.5 * em;
  const sortMax = w - padX - cornerW - 0.5 * em - sortX;
  ctx.globalAlpha = 0.9;
  if (sortMax > em) spaced(ctx, fit(ctx, c.sortName.toUpperCase(), sortMax, sortLs), sortX, base, sortLs);
  ctx.globalAlpha = 1;

  // Zwei Zeilen mit Filzstift. Caveat ist kleiner als Bradley Hand, daher groesser gesetzt.
  const lx = 0.75 * em;
  const lineMax = w - 2 * lx;
  const rule = Math.max(1, 0.25 * s);
  const y1 = bandH + 0.5 * em + 1.5625 * em;
  const y2 = y1 + 0.375 * em + 1.1875 * em;
  ctx.fillStyle = c.rule;
  ctx.fillRect(lx, y1, lineMax, rule);
  ctx.fillRect(lx, y2, lineMax, rule);

  const age = spec.age ?? 0;
  const fade = 1 - age * 0.012;
  ctx.fillStyle = c.ink;
  ctx.font = `500 ${1.62 * em}px ${F.hand}`;
  ctx.globalAlpha = fade;
  ctx.fillText(fit(ctx, spec.label, lineMax), lx, y1 - 0.3 * em);
  ctx.globalAlpha = 0.7 * fade;
  ctx.font = `400 ${1.24 * em}px ${F.hand}`;
  ctx.fillText(
    fit(ctx, spec.sub ?? (c.isA ? 'Seite A · Bleibt' : 'Seite B · Gruppenchat'), lineMax),
    lx,
    y2 - 0.24 * em,
  );
  ctx.globalAlpha = 1;

  // Altern wie CassetteFace: Papier vergilbt von der Ecke her, die Kanten
  // dunkeln nach, ab Stufe 4 ein Eselsohr unten rechts. Nur Seite A, das
  // Etikett von Seite B ist Plastik und vergilbt nicht.
  if (c.isA && age > 0) {
    ctx.globalCompositeOperation = 'multiply';
    const corner = ctx.createRadialGradient(0.92 * w, 0.08 * h, 0, 0.92 * w, 0.08 * h, 1.3 * w);
    corner.addColorStop(0, `rgba(150,108,38,${0.022 * age})`);
    corner.addColorStop(0.62, 'rgba(150,108,38,0)');
    ctx.fillStyle = corner;
    ctx.fillRect(0, 0, w, h);
    const lin = ctx.createLinearGradient(0, 0, 0, h);
    lin.addColorStop(0, `rgba(150,108,38,${0.008 * age})`);
    lin.addColorStop(1, `rgba(110,74,28,${0.02 * age})`);
    ctx.fillStyle = lin;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(90,60,20,${0.035 * age})`;
    ctx.lineWidth = (2 + age) * (w / 320);
    ctx.strokeRect(0, 0, w, h);
  }
  if (c.isA && age >= 4) {
    const d = (4 + age * 1.6) * (w / 320);
    ctx.fillStyle = c.typeShellDark;
    ctx.beginPath();
    ctx.moveTo(w, h - d);
    ctx.lineTo(w, h);
    ctx.lineTo(w - d, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = c.labelDeep;
    ctx.shadowColor = 'rgba(0,0,0,.25)';
    ctx.shadowBlur = d * 0.15;
    ctx.beginPath();
    ctx.moveTo(w, h - d);
    ctx.lineTo(w - d, h - d);
    ctx.lineTo(w - d, h);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
  }
  return cv;
}

/** Weicher Kontaktschatten unter dem Etikett (Alpha). Rand um das Etikett: `pad` mm. */
export function drawLabelShadow(pad: number, widthPx: number): HTMLCanvasElement {
  const s = widthPx / (LABEL.w + 2 * pad);
  const [cv, ctx] = makeCanvas(widthPx, (LABEL.h + 2 * pad) * s);
  // Form ausserhalb zeichnen, nur ihren Schatten ins Bild schieben: shadowBlur
  // kann jeder Browser, ctx.filter nicht.
  const off = cv.width * 2;
  ctx.shadowColor = 'rgba(0,0,0,1)';
  ctx.shadowBlur = pad * s * 0.7;
  ctx.shadowOffsetX = off;
  ctx.fillStyle = '#000';
  roundRectPath(ctx, pad * s - off, pad * s, LABEL.w * s, LABEL.h * s, LABEL.r * s);
  ctx.fill();
  return cv;
}

// ---------------------------------------------------------------------------
// Gehaeuseplatte: Farbe, Gebrauchsspuren, Senkungen, Andockloecher, ↻

export interface ShellSpec {
  pair: Pair;
  side: Side;
  wear: Wear;
  /** Altersstufe: pro Stufe ein Kratzer und drei Staubkoerner mehr, Ecken abgegriffen. */
  age?: number;
}

/*
 * Die Rueckseite braucht kein Spiegelbild: Sie entsteht in model.ts durch
 * Drehen der Vorderseite, die UVs laufen dadurch von hinten gesehen richtig.
 */

export function drawShell(spec: ShellSpec, widthPx: number): HTMLCanvasElement {
  const c = colorsOf(spec.pair, spec.side);
  const s = widthPx / W;
  const [cv, ctx] = makeCanvas(widthPx, H * s);
  const w = cv.width;
  const h = cv.height;
  ctx.fillStyle = c.shell;
  ctx.fillRect(0, 0, w, h);

  // Marmor/Konfetti der gemusterten Sorten, nur Seite B: weiche Farbkleckse
  // an den festen Positionen der Spuren, wie CassetteFace.
  if (c.fleck) {
    c.fleck.forEach((color, i) => {
      const [x, y] = spec.wear.specks[i] ?? [30 + i * 25, 45];
      ctx.save();
      ctx.translate((x / 100) * w, (y / 100) * h);
      ctx.scale(0.4 * w, 0.36 * h);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, `${color}66`);
      g.addColorStop(0.7, `${color}00`);
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    });
  }

  const age = spec.age ?? 0;
  const scratches = [...spec.wear.scratches, ...spec.wear.extraScratches.slice(0, age)];
  const specks = [...spec.wear.specks, ...spec.wear.extraSpecks.slice(0, age * 3)];

  // Gebrauchsspuren wie Wear in der App: dort in einem 100x100-Raster, das
  // auf die Flaeche gestreckt ist.
  ctx.fillStyle = c.wearLight;
  ctx.strokeStyle = c.wearLight;
  ctx.globalAlpha = 0.35;
  for (const [x, y, r] of specks) {
    ctx.beginPath();
    ctx.ellipse(
      (x / 100) * w,
      (y / 100) * h,
      Math.max(0.6, ((r * 0.35) / 100) * w),
      Math.max(0.6, ((r * 0.35) / 100) * h),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(0.7, (0.35 / 100) * h);
  ctx.lineCap = 'round';
  for (const [x, y, len] of scratches) {
    ctx.beginPath();
    ctx.moveTo((x / 100) * w, (y / 100) * h);
    ctx.lineTo(((x + len) / 100) * w, ((y - len * 0.12) / 100) * h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Abgegriffene Ecken: wo man eine Kassette anfasst, wird das Plastik heller.
  if (age > 0) {
    for (const [cx, cy] of [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ]) {
      const r = ((10 + age * 1.6) / 100) * w;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, c.wearLight.replace(/[\d.]+\)$/, `${0.55 * Math.min(1, age * 0.11)})`));
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    }
  }

  // Senkungen der Schrauben und die dunklen Loecher unter dem Fuss
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  for (const [x, y] of SCREWS) {
    ctx.beginPath();
    ctx.arc(x * s, y * s, 1.3 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,.8)';
  for (const hole of FOOT_HOLES) {
    ctx.beginPath();
    if (hole.round) ctx.arc(hole.x * s, FOOT_HOLE_Y * s, 1.04 * s, 0, Math.PI * 2);
    else roundRectPath(ctx, (hole.x - 0.56) * s, (FOOT_HOLE_Y - 0.88) * s, 1.12 * s, 1.76 * s, 0.16 * s);
    ctx.fill();
  }

  ctx.fillStyle = c.mark;
  ctx.font = `400 ${3.6 * s}px ${F.sans}`;
  ctx.textAlign = 'right';
  ctx.fillText('↻', MARK.x * s, MARK.y * s);
  return cv;
}

/** Feine Rippen der Schale als Hoehenbild: eine Rippe pro Kachel. */
export function drawRibs(): HTMLCanvasElement {
  const [cv, ctx] = makeCanvas(4, 32);
  ctx.fillStyle = '#7f7f7f';
  ctx.fillRect(0, 0, 4, 32);
  const g = ctx.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, '#7f7f7f');
  g.addColorStop(0.06, '#c8c8c8');
  g.addColorStop(0.14, '#7f7f7f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 32);
  return cv;
}

/** Papierfaser als Hoehenbild, gekachelt. */
export function drawPaperBump(px = 256): HTMLCanvasElement {
  const [cv, ctx] = makeCanvas(px, px);
  const img = ctx.createImageData(px, px);
  const rnd = seeded(7);
  for (let i = 0; i < px * px; i++) {
    const v = 118 + rnd() * 20;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < px * 3; i++) {
    const x = rnd() * px;
    const y = rnd() * px;
    const a = rnd() * Math.PI;
    const len = 2 + rnd() * 9;
    ctx.strokeStyle = rnd() > 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.14)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  return cv;
}

// ---------------------------------------------------------------------------
// Bandwickel: Lagen und die Richtung fuer den Glanz

/**
 * Stirnseite eines Wickels: viele feine Lagen mit leicht wechselnder
 * Helligkeit, wie unterschiedlich straff gewickeltes Band. Die Mitte deckt
 * spaeter die Nabe ab. Fuellt die ganze Kreisscheibe der Zylinder-UVs.
 */
export function drawRings(tape: string, px = 512): HTMLCanvasElement {
  const [cv, ctx] = makeCanvas(px, px);
  const img = ctx.createImageData(px, px);
  const r0 = parseInt(tape.slice(1, 3), 16);
  const g0 = parseInt(tape.slice(3, 5), 16);
  const b0 = parseInt(tape.slice(5, 7), 16);
  // Helligkeit je Radius vorab: Baender aus unterschiedlich straff gewickelten
  // Lagen (einige Zehntel mm breit), darin feine Einzellagen, aussen eine Kante.
  const steps = px;
  const lum = new Float32Array(steps);
  const rnd = seeded(seedOf(tape));
  let band = 1;
  let left = 0;
  for (let i = 0; i < steps; i++) {
    if (left-- <= 0) {
      band = 0.72 + rnd() * 0.5;
      left = 2 + Math.floor(rnd() * 9);
    }
    const fine = 1 + (rnd() - 0.5) * 0.22;
    lum[i] = band * fine;
  }
  const half = px / 2;
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const dx = x + 0.5 - half;
      const dy = y + 0.5 - half;
      const rho = Math.hypot(dx, dy) / half; // 0..1
      const k = lum[Math.min(steps - 1, Math.floor(rho * steps))] * (rho > 0.985 ? 0.7 : 1);
      const o = (y * px + x) * 4;
      img.data[o] = Math.min(255, r0 * k);
      img.data[o + 1] = Math.min(255, g0 * k);
      img.data[o + 2] = Math.min(255, b0 * k);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/**
 * Richtung des Glanzes auf dem Wickel fuer `anisotropyMap`: R/G = Richtung in
 * UV-Koordinaten (-1..1 -> 0..255), B = Staerke. `radial` waehlt, ob die
 * Richtung nach aussen oder im Kreis laeuft (Feinabstimmung im Bild).
 */
export function drawAnisotropy(px = 256, radial = true): HTMLCanvasElement {
  const [cv, ctx] = makeCanvas(px, px);
  const img = ctx.createImageData(px, px);
  const half = px / 2;
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const dx = x + 0.5 - half;
      // Canvas-y laeuft nach unten, UV-v nach oben
      const dy = half - (y + 0.5);
      const len = Math.hypot(dx, dy) || 1;
      let ux = dx / len;
      let uy = dy / len;
      if (!radial) [ux, uy] = [-uy, ux];
      const o = (y * px + x) * 4;
      img.data[o] = (ux * 0.5 + 0.5) * 255;
      img.data[o + 1] = (uy * 0.5 + 0.5) * 255;
      img.data[o + 2] = 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// ---------------------------------------------------------------------------
// Fenster: aufgedruckter Rahmen und das A/B-Kaestchen

/** Flaeche der Scheibe: das Loch plus der Rand, der unter der Schale steckt. */
export const GLASS = { x: WIN.x - GLASS_LIP, y: WIN.y - GLASS_LIP, w: WIN.w + 2 * GLASS_LIP, h: WIN.h + 2 * GLASS_LIP };

export function drawWindowPrint(
  pair: Pair,
  side: Side,
  widthPx: number,
): { map: HTMLCanvasElement; glow: HTMLCanvasElement | null } {
  const c = colorsOf(pair, side);
  const s = widthPx / GLASS.w;
  const [cv, ctx] = makeCanvas(widthPx, GLASS.h * s);
  const lip = GLASS_LIP * s;
  // Leichte Toenung des Klarsichtplastiks
  ctx.fillStyle = c.isA ? 'rgba(14,12,10,.22)' : `${c.shellDark}44`;
  ctx.fillRect(0, 0, cv.width, cv.height);
  // Aufgedruckter Rahmen knapp innerhalb der Lochkante
  ctx.strokeStyle = c.isA ? 'rgba(255,255,255,.2)' : `${c.shellHi}88`;
  ctx.lineWidth = Math.max(1, 0.25 * s);
  roundRectPath(ctx, lip + 0.5 * s, lip + 0.5 * s, (WIN.w - 1) * s, (WIN.h - 1) * s, WIN.r * s);
  ctx.stroke();

  // A/B-Kaestchen in der Mitte, wie in der App
  const box = 2.3 * EM * s;
  const bx = cv.width / 2 - box / 2;
  const by = cv.height / 2 - box / 2;
  ctx.fillStyle = c.isA ? 'rgba(10,9,8,.35)' : 'rgba(26,16,40,.25)';
  roundRectPath(ctx, bx, by, box, box, 0.14 * EM * s);
  ctx.fill();
  ctx.strokeStyle = c.letterBorder;
  ctx.lineWidth = Math.max(1, 0.25 * s);
  ctx.stroke();
  const letter = side.toUpperCase();
  const size = 1.15 * EM * s;
  ctx.font = `700 ${size}px ${F.title}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = c.letter;
  ctx.fillText(letter, cv.width / 2, cv.height / 2 + size * 0.04);

  if (c.isA) return { map: cv, glow: null };
  // Seite B: der Buchstabe leuchtet in der Glow-Farbe (emissiveMap)
  const [gv, gctx] = makeCanvas(cv.width, cv.height);
  gctx.font = ctx.font;
  gctx.textAlign = 'center';
  gctx.textBaseline = 'middle';
  gctx.shadowColor = '#fff';
  gctx.shadowBlur = 0.6 * EM * s;
  gctx.fillStyle = '#fff';
  gctx.fillText(letter, gv.width / 2, gv.height / 2 + size * 0.04);
  return { map: cv, glow: gv };
}
