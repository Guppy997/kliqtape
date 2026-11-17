import { NeutralToneMapping, PerspectiveCamera, PMREMGenerator, type Texture, Vector2, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { lookFor } from '@/lib/cassetteLook';
import { CAMERA_Z, EM, H, MARGIN_EM, W } from './dims';
import { CassetteModel } from './model';
import { drawLabel, drawShell, fontsReady, type Side } from './textures';

/*
 * Uebernommen von der Website (kliqtape-website, components/tape3d), dazu:
 * Aussehen aus lookFor() und Texturen werden freigegeben, sobald eine
 * Kassette stillsteht (die Farbauswahl zeigt sechs auf einmal).
 *
 * EIN WebGL-Renderer fuer alle Kassetten der Seite. Jede Kassette hat ein
 * normales 2D-Canvas im DOM; der Renderer zeichnet sie in einen Ausschnitt
 * seines eigenen (unsichtbaren) Canvas und kopiert das Bild per drawImage
 * hinueber. Warum so:
 *  - nur ein WebGL-Kontext (iOS begrenzt die Anzahl, Shader werden nur
 *    einmal uebersetzt),
 *  - Hover, Einblenden, Reihenfolge und overflow bleiben ganz normales DOM.
 * Gezeichnet wird nur, was im Bild ist und sich geaendert hat.
 */

export interface Params {
  cassetteId: string;
  /** Gewaehlte Bandsorte, sonst aus der ID */
  pairIndex?: number;
  /** Altersstufe 0..9 (ageStageOf) */
  age: number;
  front: Side;
  withBack: boolean;
  label: string;
  sub?: string;
  corner: string;
  /** Schraeglage des Etiketts in Grad, sonst fest pro Kassette (wear.tilt) */
  tilt?: number;
  rx: number;
  ry: number;
  rz: number;
  /** Bandstand 0..1 */
  reel: number;
  spinning: boolean;
}

export interface Handle {
  invalidate(): void;
  dispose(): void;
}

interface Instance {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  get: () => Params;
  onFrame: () => void;
  onLost: () => void;
  visible: boolean;
  dirty: boolean;
  shown: boolean;
  w: number;
  h: number;
  angle: number;
  last: number;
  texKey: string;
  release: number;
  tex: { shellFront: Texture; shellBack: Texture; labelFront: Texture; labelBack: Texture | null } | null;
}

/** Spulen drehen 3 s pro Umdrehung, wie in der App. */
const SPIN = (Math.PI * 2) / 3000;

let renderer: WebGLRenderer | null = null;
let model: CassetteModel | null = null;
let camera: PerspectiveCamera | null = null;
let failed = false;
let lost = false;
let raf = 0;
let fontsOk = false;
const instances = new Set<Instance>();
let io: IntersectionObserver | null = null;
let ro: ResizeObserver | null = null;
const byElement = new Map<Element, Instance>();

const small = () => window.matchMedia('(max-width: 640px)').matches;

function init(): boolean {
  if (renderer) return true;
  if (failed) return false;
  // three braucht WebGL 2. Vorher selbst nachsehen, sonst schreibt three
  // Fehler in die Konsole, obwohl die flache Kassette einspringt.
  try {
    if (!document.createElement('canvas').getContext('webgl2')) throw new Error('kein WebGL 2');
    renderer = new WebGLRenderer({
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });
  } catch {
    failed = true;
    return false;
  }
  renderer.setPixelRatio(1);
  // Die Fehlerpruefung wartet synchron auf den Shader-Compiler: nur beim Entwickeln.
  renderer.debug.checkShaderErrors = import.meta.env.DEV;
  renderer.autoClear = false;
  // Neutral statt ACES: die Markenfarben sollen bleiben, wie sie sind.
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);

  model = new CassetteModel(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  // Studio-Licht ohne Bilddatei: RoomEnvironment ist eine prozedurale Szene.
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  model.scene.environment = env;
  // Wenig Umgebung, mehr Hauptlicht: sonst wird dunkles Plastik grau und
  // die Markenfarben verblassen. Die Scheibe spiegelt eigens staerker.
  model.scene.environmentIntensity = 0.42;
  model.setEnvironment(env);
  pmrem.dispose();

  // Das Canvas zeigt die Mitte der Kassette 1:1 wie das bisherige CSS-3D:
  // gleicher Abstand (perspective 110em), Bildhoehe = Hoehe des Canvas in mm.
  const canvasH = (H / EM + 2 * MARGIN_EM) * EM;
  const canvasW = (W / EM + 2 * MARGIN_EM) * EM;
  camera = new PerspectiveCamera((2 * Math.atan(canvasH / 2 / CAMERA_Z) * 180) / Math.PI, canvasW / canvasH, 200, 700);
  camera.position.set(0, 0, CAMERA_Z);

  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    for (const inst of instances) inst.onLost();
  });

  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const inst = byElement.get(e.target);
        if (!inst) continue;
        inst.visible = e.isIntersecting;
        if (inst.visible) invalidate(inst);
      }
    },
    { rootMargin: '160px' },
  );
  ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const inst = byElement.get(e.target);
      if (!inst) continue;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const box = e.contentBoxSize?.[0];
      const cssW = box ? box.inlineSize : e.contentRect.width;
      const cssH = box ? box.blockSize : e.contentRect.height;
      inst.w = Math.round(cssW * dpr);
      inst.h = Math.round(cssH * dpr);
      if (inst.canvas.width !== inst.w || inst.canvas.height !== inst.h) {
        inst.canvas.width = inst.w;
        inst.canvas.height = inst.h;
      }
      invalidate(inst);
    }
  });

  void fontsReady().then(() => {
    fontsOk = true;
    for (const inst of instances) invalidate(inst);
  });
  return true;
}

/** Gibt es WebGL? Legt den Renderer dabei an. */
export function supported(): boolean {
  return init();
}

function invalidate(inst: Instance) {
  inst.dirty = true;
  if (!raf) raf = requestAnimationFrame(tick);
}

function disposeTex(inst: Instance) {
  if (!inst.tex) return;
  const { shellFront, shellBack, labelFront, labelBack } = inst.tex;
  for (const t of new Set([shellFront, shellBack, labelFront, labelBack])) t?.dispose();
  inst.tex = null;
}

/**
 * Etikett- und Gehaeusetexturen dieser Kassette, neu nur wenn sich etwas
 * geaendert hat. Hoechstens eine Kassette pro Bild bekommt neue Texturen,
 * sonst ruckelt es, wenn das Regal mit sechs Kassetten ins Bild kommt.
 */
function texturesFor(inst: Instance, p: Params, budget: { left: number }) {
  const back: Side = p.withBack ? (p.front === 'a' ? 'b' : 'a') : p.front;
  const look = lookFor(p.cassetteId, p.pairIndex);
  const key = JSON.stringify([
    look.type.name,
    p.cassetteId,
    p.front,
    back,
    p.withBack,
    p.label,
    p.sub,
    p.corner,
    p.age,
  ]);
  if (inst.tex && inst.texKey === key) return inst.tex;
  if (budget.left <= 0) return null;
  budget.left--;
  disposeTex(inst);
  const m = model!;
  const shellPx = small() ? 768 : 1024;
  const labelPx = small() ? 1024 : 1536;
  const shellFront = m.makeShellTexture(drawShell({ pair: look, side: p.front, wear: look.wear, age: p.age }, shellPx));
  const shellBack =
    back === p.front && !p.withBack
      ? shellFront
      : m.makeShellTexture(drawShell({ pair: look, side: back, wear: look.wear, age: p.age }, shellPx));
  const labelFront = m.makeLabelTexture(
    drawLabel({ pair: look, side: p.front, label: p.label, sub: p.sub, corner: p.corner, age: p.age }, labelPx),
  );
  const labelBack = p.withBack
    ? m.makeLabelTexture(drawLabel({ pair: look, side: back, label: p.label, corner: p.corner, age: p.age }, labelPx))
    : null;
  inst.tex = { shellFront, shellBack, labelFront, labelBack };
  inst.texKey = key;
  return inst.tex;
}

/** Zeichnet eine Kassette. false: diesmal kein Budget fuer neue Texturen. */
function draw(inst: Instance, now: number, budget: { left: number }): boolean {
  const r = renderer!;
  const p = inst.get();
  const tex = texturesFor(inst, p, budget);
  if (!tex) return false;
  const dt = inst.last ? Math.min(100, now - inst.last) : 0;
  inst.last = now;
  if (p.spinning) inst.angle -= dt * SPIN;

  // Zeichenflaeche nur vergroessern, nie pro Bild neu anlegen
  const size = r.getSize(tmp);
  if (size.x < inst.w || size.y < inst.h) r.setSize(Math.max(size.x, inst.w), Math.max(size.y, inst.h), false);
  const bufH = r.getSize(tmp).y;

  const look = lookFor(p.cassetteId, p.pairIndex);
  const tilt = p.tilt ?? look.wear.tilt;
  model!.configure({
    pair: look,
    front: p.front,
    withBack: p.withBack,
    tilt,
    tiltBack: -tilt * 0.6,
    rx: p.rx,
    ry: p.ry,
    rz: p.rz,
    reel: p.reel,
    hubAngle: inst.angle,
    ...tex,
  });
  r.setViewport(0, 0, inst.w, inst.h);
  r.setScissor(0, 0, inst.w, inst.h);
  r.setScissorTest(true);
  r.clear();
  r.render(model!.scene, camera!);

  inst.ctx.clearRect(0, 0, inst.w, inst.h);
  // WebGL zaehlt y von unten: der Ausschnitt liegt unten links im Puffer.
  inst.ctx.drawImage(r.domElement, 0, bufH - inst.h, inst.w, inst.h, 0, 0, inst.w, inst.h);
  if (!inst.shown) {
    inst.shown = true;
    inst.onFrame();
  }
  // Steht die Kassette still, bleibt ihr Bild im 2D-Canvas; die Texturen
  // (Etikett, Gehaeuse) braucht dann niemand mehr. Bei der naechsten
  // Aenderung entstehen sie neu, hoechstens eine Kassette pro Bild.
  window.clearTimeout(inst.release);
  if (!p.spinning) {
    inst.release = window.setTimeout(() => {
      if (!inst.dirty) disposeTex(inst);
    }, 2000);
  }
  return true;
}
const tmp = new Vector2();

function tick(now: number) {
  raf = 0;
  if (lost || !renderer || !fontsOk) return;
  let again = false;
  const budget = { left: 1 };
  for (const inst of instances) {
    if (!inst.visible || inst.w === 0 || inst.h === 0) continue;
    const spinning = inst.get().spinning;
    if (spinning) {
      inst.dirty = true;
      again = true;
    } else {
      inst.last = 0;
    }
    if (!inst.dirty) continue;
    if (draw(inst, now, budget)) inst.dirty = false;
    else again = true;
  }
  if (again && !raf) raf = requestAnimationFrame(tick);
}

export function register(
  canvas: HTMLCanvasElement,
  get: () => Params,
  events: { onFrame: () => void; onLost: () => void },
): Handle | null {
  if (!init() || lost) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const inst: Instance = {
    canvas,
    ctx,
    get,
    onFrame: events.onFrame,
    onLost: events.onLost,
    visible: false,
    dirty: true,
    shown: false,
    w: 0,
    h: 0,
    angle: 0,
    last: 0,
    texKey: '',
    release: 0,
    tex: null,
  };
  instances.add(inst);
  byElement.set(canvas, inst);
  io!.observe(canvas);
  ro!.observe(canvas);
  return {
    invalidate: () => invalidate(inst),
    dispose: () => {
      io?.unobserve(canvas);
      ro?.unobserve(canvas);
      byElement.delete(canvas);
      instances.delete(inst);
      window.clearTimeout(inst.release);
      disposeTex(inst);
    },
  };
}
