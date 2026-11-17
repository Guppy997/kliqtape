import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  Path,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  Shape,
  SRGBColorSpace,
  type Texture,
  Vector3,
} from 'three';
import {
  BAND_Y,
  BEVEL,
  D,
  PLATE,
  WALL,
  FOOT,
  FOOT_HOLE_Y,
  FOOT_HOLES,
  GAP,
  GUIDE_R,
  GUIDES,
  H,
  HUB_HOLE,
  HUB_R,
  LABEL,
  LABEL_T,
  PACK_MAX,
  PACK_MIN,
  R,
  RECESS,
  REEL_X,
  REEL_Y,
  SCREWS,
  TAB_DEPTH,
  TABS,
  TAPE_W,
  W,
  WIN,
} from './dims';
import {
  colorsOf,
  drawAnisotropy,
  drawLabelShadow,
  drawPaperBump,
  drawRibs,
  drawRings,
  drawWindowPrint,
  GLASS,
  type Pair,
  type Side,
} from './textures';

/*
 * Uebernommen von der Website (kliqtape-website, components/tape3d).
 *
 * Die Kassette als echter Koerper, gebaut wie das Vorbild: zwei verschraubte
 * Gehaeusehaelften mit Fensterloch und Naht, dazwischen die Bandwickel auf
 * Naben, Umlenkrollen und das Band; aussen Etikett, Scheibe, Fuss, Schrauben.
 *
 * Die Geometrie gibt es nur einmal. Vor jedem Bild stellt `configure()` sie
 * auf die jeweilige Kassette um (Farben, Etikett, Bandstand, Drehung).
 * Koordinaten: Mitte der Kassette, x rechts, y oben, z zur Seite A, in mm.
 */

/** Zeichnungsmass (oben links, y nach unten) -> three */
const at = (x: number, y: number): [number, number] => [x - W / 2, H / 2 - y];

function rrect(p: Path, cx: number, cy: number, w: number, h: number, r: number) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x + w, y + h - r);
  p.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  p.lineTo(x + r, y + h);
  p.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(x, y + r);
  p.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
}

/** Umriss der Schale, auf Wunsch mit den Loeschschutz-Aussparungen oben. */
function outline(tabs: boolean): Shape {
  const s = new Shape();
  const l = -W / 2;
  const r = W / 2;
  const b = -H / 2;
  const t = H / 2;
  s.moveTo(l + R, b);
  s.lineTo(r - R, b);
  s.absarc(r - R, b + R, R, -Math.PI / 2, 0, false);
  s.lineTo(r, t - R);
  s.absarc(r - R, t - R, R, 0, Math.PI / 2, false);
  if (tabs) {
    // Oberkante von rechts nach links, mit zwei Aussparungen
    for (const tab of [...TABS].reverse()) {
      const [x1] = at(tab.x + tab.w, 0);
      const [x0] = at(tab.x, 0);
      s.lineTo(x1, t);
      s.lineTo(x1, t - TAB_DEPTH);
      s.lineTo(x0, t - TAB_DEPTH);
      s.lineTo(x0, t);
    }
  }
  s.lineTo(l + R, t);
  s.absarc(l + R, t - R, R, Math.PI / 2, Math.PI, false);
  s.lineTo(l, b + R);
  s.absarc(l + R, b + R, R, Math.PI, Math.PI * 1.5, false);
  return s;
}

function windowHole(): Path {
  const p = new Path();
  const [cx, cy] = at(WIN.x + WIN.w / 2, WIN.y + WIN.h / 2);
  rrect(p, cx, cy, WIN.w, WIN.h, WIN.r);
  return p;
}

/**
 * Deckel einer Extrusion trennen: Gruppe 0 = aussen (+z), 1 = Rand,
 * 2 = innen (-z, zur Naht hin). three legt beide Deckel in eine Gruppe.
 */
function splitCaps(geo: ExtrudeGeometry) {
  const [caps, sides] = geo.groups;
  const half = caps.count / 2;
  // Ohne Fase liegen die Deckel anders im Puffer: an der Normale erkennen.
  const nz = geo.getAttribute('normal').getZ(caps.start);
  const firstIsInner = nz < 0;
  geo.clearGroups();
  geo.addGroup(firstIsInner ? caps.start + half : caps.start, half, 0);
  geo.addGroup(sides.start, sides.count, 1);
  geo.addGroup(firstIsInner ? caps.start : caps.start + half, half, 2);
}

/** Umriss um `d` nach innen versetzt (fuer die Innenseite der Wand). */
function inset(d: number): Path {
  const p = new Path();
  rrect(p, 0, 0, W - 2 * d, H - 2 * d, Math.max(0.3, R - d));
  return p;
}

/**
 * Vorderplatte einer Haelfte mit Fensterloch, z von D/2 - PLATE bis D/2.
 * Die hintere Haelfte entsteht durch Drehen um y.
 */
function plateGeometry(tabs: boolean) {
  const shape = outline(tabs);
  shape.holes.push(windowHole());
  const geo = new ExtrudeGeometry(shape, {
    depth: PLATE - 2 * BEVEL,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    // bevelOffset = -bevelSize: die Aussenmasse bleiben exakt, die Fase geht nach innen.
    bevelSize: BEVEL,
    bevelOffset: -BEVEL,
    bevelSegments: 3,
    curveSegments: 14,
  });
  geo.translate(0, 0, D / 2 - PLATE + BEVEL);
  splitCaps(geo);
  return geo;
}

/**
 * Umlaufende Wand von der Naht bis in die Platte hinein (ohne Fase, damit
 * zwischen Wand und Platte keine zweite Fuge entsteht).
 */
function wallGeometry(tabs: boolean) {
  const shape = outline(tabs);
  shape.holes.push(inset(WALL));
  const depth = D / 2 - PLATE + BEVEL - GAP;
  const geo = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 14 });
  geo.translate(0, 0, GAP);
  splitCaps(geo);
  return geo;
}

function footGeometry() {
  const s = new Shape();
  const [x0, y0] = at(FOOT.topL, FOOT.top);
  const [x1] = at(FOOT.topR, FOOT.top);
  const [x2, y2] = at(FOOT.botR, H);
  const [x3] = at(FOOT.botL, H);
  s.moveTo(x3, y2);
  s.lineTo(x2, y2);
  s.lineTo(x1, y0);
  s.lineTo(x0, y0);
  s.lineTo(x3, y2);
  for (const hole of FOOT_HOLES) {
    const [hx, hy] = at(hole.x, FOOT_HOLE_Y);
    const p = new Path();
    if (hole.round) p.absarc(hx, hy, 1.04, 0, Math.PI * 2, true);
    else rrect(p, hx, hy, 1.12, 1.76, 0.18);
    s.holes.push(p);
  }
  const bevel = 0.22;
  const geo = new ExtrudeGeometry(s, {
    depth: FOOT.h + 0.2 - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 2,
    curveSegments: 10,
  });
  // 0,2 mm steckt in der Schale, FOOT.h steht vor
  geo.translate(0, 0, D / 2 - 0.2 + bevel);
  return geo;
}

function labelGeometry() {
  const s = new Shape();
  rrect(s, 0, 0, LABEL.w, LABEL.h, LABEL.r);
  return new ExtrudeGeometry(s, { depth: LABEL_T, bevelEnabled: false, curveSegments: 6 });
}

/** Nabe: weisser Ring, innen sechs Zaehne, an denen der Rekorder dreht. */
function hubGeometry() {
  const s = new Shape();
  s.absarc(0, 0, HUB_R, 0, Math.PI * 2, false);
  const hole = new Path();
  const teeth = 6;
  const toothHalf = (9 * Math.PI) / 180;
  const inner = 0.82;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const p0 = a + toothHalf;
    const p1 = a + (Math.PI * 2) / teeth - toothHalf;
    const pt = (r: number, ang: number) => [r * Math.cos(ang), r * Math.sin(ang)] as const;
    if (i === 0) hole.moveTo(...pt(HUB_HOLE, a - toothHalf));
    hole.lineTo(...pt(inner, a - toothHalf * 0.8));
    hole.lineTo(...pt(inner, a + toothHalf * 0.8));
    hole.lineTo(...pt(HUB_HOLE, p0));
    hole.absarc(0, 0, HUB_HOLE, p0, p1, false);
  }
  s.holes.push(hole);
  const depth = TAPE_W + 0.5;
  const geo = new ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 18 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function tex(canvas: HTMLCanvasElement, color = true): CanvasTexture {
  const t = new CanvasTexture(canvas);
  t.colorSpace = color ? SRGBColorSpace : NoColorSpace;
  return t;
}
/** Texturen fuer Flaechen mit UVs in mm (Extrusionen): auf die Flaeche abbilden. */
function fitMm(t: Texture, w: number, h: number, ox = 0.5, oy = 0.5) {
  t.repeat.set(1 / w, 1 / h);
  t.offset.set(ox, oy);
  return t;
}

// ---------------------------------------------------------------------------
// Materialien, einmal pro Bandsorte und Seite

interface SideMats {
  outer: MeshPhysicalMaterial;
  rim: MeshPhysicalMaterial;
  inner: Material;
  label: MeshPhysicalMaterial;
  labelEdge: MeshStandardMaterial;
  print: MeshStandardMaterial;
  backdrop: MeshStandardMaterial;
}
interface PairMats {
  packCap: MeshPhysicalMaterial;
  packSide: MeshStandardMaterial;
  hub: MeshPhysicalMaterial;
  tape: MeshPhysicalMaterial;
}

export class CassetteModel {
  readonly scene = new Scene();
  private root = new Group();
  private frontHalf: Mesh;
  private backHalf: Mesh;
  private frontWall: Mesh;
  private backWall: Mesh;
  private frontFoot: Mesh;
  private backFoot: Mesh;
  private frontLabel: Mesh;
  private backLabel: Mesh;
  private frontShadow: Mesh;
  private backShadow: Mesh;
  private frontPrint: Mesh;
  private backPrint: Mesh;
  private frontBackdrop: Mesh;
  private backBackdrop: Mesh;
  private packs: { group: Group; mesh: Mesh; hub: Mesh }[] = [];
  private segments: Mesh[] = [];
  private rollers: Mesh[] = [];
  private pcb = new Group();
  private rim: DirectionalLight;
  private sideMats = new Map<string, SideMats>();
  private pairMats = new Map<string, PairMats>();
  private ribs: CanvasTexture;
  private paper: CanvasTexture;
  private aniso: CanvasTexture;
  private dark = new MeshStandardMaterial({ color: '#0b0a09', roughness: 0.9 });
  private glassReflect = new MeshPhysicalMaterial({
    // Nur Spiegelung: schwarz und additiv, damit die Scheibe nicht abdunkelt.
    color: 0x000000,
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  private n = new Vector3();

  constructor(private maxAnisotropy = 8) {
    this.ribs = tex(drawRibs(), false);
    this.ribs.wrapS = this.ribs.wrapT = RepeatWrapping;
    this.ribs.repeat.set(0.01, 1 / 1.24);
    this.paper = tex(drawPaperBump(), false);
    this.paper.wrapS = this.paper.wrapT = RepeatWrapping;
    this.paper.repeat.set(1 / 8, 1 / 8);
    this.aniso = tex(drawAnisotropy(256, true), false);

    this.frontHalf = new Mesh(plateGeometry(false));
    this.backHalf = new Mesh(plateGeometry(true).rotateY(Math.PI));
    this.frontWall = new Mesh(wallGeometry(false));
    this.backWall = new Mesh(wallGeometry(true).rotateY(Math.PI));
    this.root.add(this.frontWall, this.backWall);
    const foot = footGeometry();
    const footBack = foot.clone().rotateY(Math.PI);
    this.frontFoot = new Mesh(foot);
    this.backFoot = new Mesh(footBack);
    this.root.add(this.frontHalf, this.backHalf, this.frontFoot, this.backFoot);

    // Etikett mit Kontaktschatten, vorne und hinten
    const lg = labelGeometry();
    // Kontaktschatten: schwarz, die Form steckt im Alpha der Textur
    const shadowMat = new MeshBasicMaterial({
      color: 0xffffff,
      map: tex(drawLabelShadow(1, 512), false),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const [lx, ly] = at(LABEL.x + LABEL.w / 2, LABEL.y + LABEL.h / 2);
    const mkLabel = (back: boolean) => {
      const g = new Group();
      const label = new Mesh(lg);
      label.position.z = D / 2;
      const shadow = new Mesh(new PlaneGeometry(LABEL.w + 2, LABEL.h + 2), shadowMat);
      shadow.position.set(0.18, -0.3, D / 2 + 0.008);
      g.add(shadow, label);
      g.position.set(lx, ly, 0);
      const wrap = new Group();
      wrap.add(g);
      if (back) wrap.rotation.y = Math.PI;
      this.root.add(wrap);
      return { label, shadow, g };
    };
    const fl = mkLabel(false);
    const bl = mkLabel(true);
    this.frontLabel = fl.label;
    this.backLabel = bl.label;
    this.frontShadow = fl.shadow;
    this.backShadow = bl.shadow;

    // Scheiben: Druck (Toenung, Rahmen, A/B) und Spiegelung, leicht vertieft
    const [gx, gy] = at(GLASS.x + GLASS.w / 2, GLASS.y + GLASS.h / 2);
    const glassGeo = new PlaneGeometry(GLASS.w, GLASS.h);
    const mkGlass = (back: boolean) => {
      const wrap = new Group();
      const print = new Mesh(glassGeo);
      print.position.set(gx, gy, D / 2 - RECESS);
      const reflect = new Mesh(glassGeo, this.glassReflect);
      reflect.position.set(gx, gy, D / 2 - RECESS + 0.02);
      wrap.add(print, reflect);
      if (back) wrap.rotation.y = Math.PI;
      this.root.add(wrap);
      return print;
    };
    this.frontPrint = mkGlass(false);
    this.backPrint = mkGlass(true);

    // Innenraum hinter den Wickeln: dunkel wie das Fenster in der App.
    // Einseitig, je eine pro Blickrichtung.
    const [wx, wy] = at(WIN.x + WIN.w / 2, WIN.y + WIN.h / 2);
    const bdGeo = new PlaneGeometry(WIN.w + 4, WIN.h + 4);
    this.frontBackdrop = new Mesh(bdGeo);
    this.frontBackdrop.position.set(wx, wy, -(TAPE_W / 2 + 0.6));
    const bdWrap = new Group();
    this.backBackdrop = new Mesh(bdGeo);
    this.backBackdrop.position.set(-wx, wy, -(TAPE_W / 2 + 0.6));
    bdWrap.add(this.backBackdrop);
    bdWrap.rotation.y = Math.PI;
    this.root.add(this.frontBackdrop, bdWrap);

    // Wickel und Naben
    const packGeo = new CylinderGeometry(1, 1, TAPE_W, 96, 1, false);
    packGeo.rotateX(Math.PI / 2);
    const hubGeo = hubGeometry();
    for (const x of REEL_X) {
      const [px, py] = at(x, REEL_Y);
      const group = new Group();
      group.position.set(px, py, 0);
      const mesh = new Mesh(packGeo);
      const hub = new Mesh(hubGeo);
      group.add(mesh, hub);
      this.root.add(group);
      this.packs.push({ group, mesh, hub });
    }

    // Bandlauf: Umlenkrollen, Filz, und das Band in fuenf Stuecken
    const rollerGeo = new CylinderGeometry(GUIDE_R, GUIDE_R, TAPE_W + 1.2, 24);
    rollerGeo.rotateX(Math.PI / 2);
    const rollerMat = new MeshPhysicalMaterial({ color: '#E9E3D6', roughness: 0.4, clearcoat: 0.3 });
    for (const [x, y] of GUIDES) {
      const m = new Mesh(rollerGeo, rollerMat);
      m.position.set(...at(x, y), 0);
      this.rollers.push(m);
      this.root.add(m);
    }
    const felt = new Mesh(
      new BoxGeometry(6.4, 1.1, TAPE_W),
      new MeshStandardMaterial({ color: '#D8CDB6', roughness: 1 }),
    );
    felt.position.set(...at(W / 2, BAND_Y - 0.62), 0);
    const spring = new Mesh(
      new BoxGeometry(4.2, 0.5, 1.4),
      new MeshStandardMaterial({ color: '#9A9488', metalness: 1, roughness: 0.35 }),
    );
    spring.position.set(...at(W / 2, BAND_Y - 1.5), 0);
    this.root.add(felt, spring);
    const segGeo = new BoxGeometry(1, 0.05, TAPE_W);
    for (let i = 0; i < 5; i++) {
      const m = new Mesh(segGeo);
      this.segments.push(m);
      this.root.add(m);
    }

    // Platine, nur durch das durchscheinende Plastik von Seite B zu sehen
    // (der Platinen-Schimmer der App, unten rechts aus Sicht von Seite B).
    const pcbMat = new MeshStandardMaterial({ color: '#4E7A5E', roughness: 0.6 });
    const board = new Mesh(new BoxGeometry(17, 6.5, 0.5), pcbMat);
    const chip = new Mesh(
      new BoxGeometry(4.6, 2.8, 0.7),
      new MeshStandardMaterial({ color: '#141414', roughness: 0.5 }),
    );
    chip.position.set(-2.5, 0.4, -0.5);
    this.pcb.add(board, chip);
    const gold = new MeshStandardMaterial({ color: '#C9A24A', metalness: 1, roughness: 0.3 });
    for (let i = 0; i < 6; i++) {
      const pad = new Mesh(new BoxGeometry(0.7, 1.1, 0.12), gold);
      pad.position.set(2.2 + i * 1.1, -2, -0.3);
      this.pcb.add(pad);
    }
    this.pcb.position.set(...at(16, H - 7.5), -1.4);
    this.root.add(this.pcb);

    // Schrauben: Metall mit Kreuzschlitz, vorne und hinten
    const headGeo = new CylinderGeometry(0.95, 1.02, 0.36, 24);
    headGeo.rotateX(Math.PI / 2);
    const slotGeo = new BoxGeometry(1.3, 0.2, 0.14);
    const metal = new MeshStandardMaterial({ color: '#BDB7AC', metalness: 1, roughness: 0.32 });
    for (const back of [false, true]) {
      const wrap = new Group();
      SCREWS.forEach(([x, y], i) => {
        const screw = new Group();
        const head = new Mesh(headGeo, metal);
        const s1 = new Mesh(slotGeo, this.dark);
        const s2 = new Mesh(slotGeo, this.dark);
        s1.position.z = s2.position.z = 0.15;
        s2.rotation.z = Math.PI / 2;
        screw.add(head, s1, s2);
        screw.rotation.z = 0.3 + i * 0.7;
        screw.position.set(...at(x, y), D / 2 + 0.06);
        wrap.add(screw);
      });
      if (back) wrap.rotation.y = Math.PI;
      this.root.add(wrap);
    }

    // Licht: Hauptlicht oben links wie der Glanz in der App, dazu ein
    // Kantenlicht von hinten in der Akzentfarbe (statt des Rand-Glows der App).
    const key = new DirectionalLight('#ffffff', 2.3);
    key.position.set(-0.55, 0.9, 1.1);
    this.rim = new DirectionalLight('#B8462C', 1.4);
    this.rim.position.set(0.5, 0.8, -1.2);
    this.scene.add(key, this.rim, this.root);
  }

  private sideMat(pair: Pair, side: Side): SideMats {
    const key = `${pair.type.name}:${side}`;
    const hit = this.sideMats.get(key);
    if (hit) return hit;
    const c = colorsOf(pair, side);
    const isA = c.isA;
    // Seite A deckend, Seite B durchscheinend: man sieht die Mechanik.
    const plastic = {
      roughness: isA ? 0.4 : 0.26,
      clearcoat: isA ? 0.08 : 0.4,
      clearcoatRoughness: 0.3,
      transparent: !isA,
      opacity: isA ? 1 : 0.74,
    };
    const { map, glow } = drawWindowPrint(pair, side, 1024);
    const mats: SideMats = {
      outer: new MeshPhysicalMaterial({
        ...plastic,
        color: '#ffffff',
        bumpMap: this.ribs,
        bumpScale: 0.22,
      }),
      rim: new MeshPhysicalMaterial({ ...plastic, color: c.shell }),
      inner: isA
        ? new MeshStandardMaterial({ color: c.shellDark, roughness: 0.9 })
        : new MeshPhysicalMaterial({ ...plastic, color: c.shell }),
      label: new MeshPhysicalMaterial({
        color: '#ffffff',
        roughness: isA ? 0.92 : 0.35,
        bumpMap: isA ? this.paper : null,
        bumpScale: 0.35,
        transparent: !isA,
      }),
      labelEdge: new MeshStandardMaterial({ color: isA ? '#F3ECDD' : c.shellDark, roughness: 0.95 }),
      print: new MeshStandardMaterial({
        map: tex(map),
        transparent: true,
        depthWrite: false,
        roughness: 0.3,
        ...(glow ? { emissiveMap: tex(glow), emissive: new Color(c.glow), emissiveIntensity: 1.6 } : {}),
      }),
      backdrop: new MeshStandardMaterial({ color: c.shellDark, roughness: 0.85 }),
    };
    mats.print.map!.anisotropy = this.maxAnisotropy;
    this.sideMats.set(key, mats);
    return mats;
  }

  private pairMat(pair: Pair): PairMats {
    const hit = this.pairMats.get(pair.type.name);
    if (hit) return hit;
    const c = colorsOf(pair, 'a');
    const rings = tex(drawRings(c.tape, 512));
    const tapeColor = new Color(c.tape);
    const mats: PairMats = {
      // Stirnseite des Wickels: glatt, mit gerichtetem Glanz quer zu den Lagen
      packCap: new MeshPhysicalMaterial({
        map: rings,
        // Oxidband glaenzt leicht metallisch, der Glanz nimmt die Bandfarbe an.
        roughness: 0.32,
        metalness: 0.2,
        anisotropy: 0.75,
        anisotropyMap: this.aniso,
      }),
      packSide: new MeshStandardMaterial({ color: tapeColor.clone().multiplyScalar(0.55), roughness: 0.75 }),
      hub: new MeshPhysicalMaterial({ color: c.hub, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
      tape: new MeshPhysicalMaterial({ color: c.tape, roughness: 0.3, clearcoat: 0.4 }),
    };
    this.pairMats.set(pair.type.name, mats);
    return mats;
  }

  /** Texturen pro Kassette: Gehaeuse mit Gebrauchsspuren, Etiketten. */
  makeShellTexture(canvas: HTMLCanvasElement) {
    const t = fitMm(tex(canvas), W, H);
    t.anisotropy = this.maxAnisotropy;
    return t;
  }
  makeLabelTexture(canvas: HTMLCanvasElement) {
    const t = fitMm(tex(canvas), LABEL.w, LABEL.h);
    t.anisotropy = this.maxAnisotropy;
    return t;
  }

  /** Die Scheibe spiegelt staerker als der Rest: eigene Umgebung mit eigener Staerke. */
  setEnvironment(env: Texture) {
    this.glassReflect.envMap = env;
    this.glassReflect.envMapIntensity = 1.4;
    this.glassReflect.needsUpdate = true;
  }

  configure(p: ConfigureParams) {
    const front = p.front;
    const back: Side = p.withBack ? (front === 'a' ? 'b' : 'a') : front;
    const mf = this.sideMat(p.pair, front);
    const mb = this.sideMat(p.pair, back);
    const pm = this.pairMat(p.pair);

    mf.outer.map = p.shellFront;
    mb.outer.map = p.shellBack;
    this.frontHalf.material = [mf.outer, mf.rim, mf.inner];
    this.backHalf.material = [mb.outer, mb.rim, mb.inner];
    this.frontWall.material = [mf.inner, mf.rim, mf.inner];
    this.backWall.material = [mb.inner, mb.rim, mb.inner];
    this.frontFoot.material = [mf.outer, mf.rim];
    this.backFoot.material = [mb.outer, mb.rim];

    mf.label.map = p.labelFront;
    this.frontLabel.material = [mf.label, mf.labelEdge];
    this.frontLabel.parent!.rotation.z = (-p.tilt * Math.PI) / 180;
    this.frontShadow.visible = mf.label.transparent === false;
    const showBack = p.withBack && p.labelBack !== null;
    this.backLabel.parent!.visible = showBack;
    if (showBack) {
      mb.label.map = p.labelBack;
      this.backLabel.material = [mb.label, mb.labelEdge];
      this.backLabel.parent!.rotation.z = (-p.tiltBack * Math.PI) / 180;
      this.backShadow.visible = mb.label.transparent === false;
    }

    this.frontPrint.material = mf.print;
    this.backPrint.material = mb.print;
    this.frontBackdrop.material = mf.backdrop;
    this.backBackdrop.material = mb.backdrop;
    this.pcb.visible = back === 'b' || front === 'b';

    // Bandstand: links voll -> rechts voll
    const radii = [PACK_MAX + (PACK_MIN - PACK_MAX) * p.reel, PACK_MIN + (PACK_MAX - PACK_MIN) * p.reel];
    this.packs.forEach((k, i) => {
      k.mesh.material = [pm.packSide, pm.packCap, pm.packCap];
      // Zylinder liegt nach rotateX entlang z: Radius steckt in x und y
      k.mesh.scale.set(radii[i], radii[i], 1);
      k.hub.material = pm.hub;
      k.group.rotation.z = p.hubAngle;
    });
    this.layTape(radii, pm.tape);

    this.root.rotation.set((-p.rx * Math.PI) / 180, (p.ry * Math.PI) / 180, (-p.rz * Math.PI) / 180, 'XYZ');

    // Kantenlicht in der Akzentfarbe der Seite, die gerade zur Kamera zeigt
    this.n.set(0, 0, 1).applyEuler(this.root.rotation);
    this.rim.color.set(colorsOf(p.pair, this.n.z >= 0 ? front : back).accent);
  }

  /** Das Band vom Wickel ueber die Rollen, unten quer und wieder hoch. */
  private layTape(radii: number[], mat: Material) {
    const [lx, ly] = at(REEL_X[0], REEL_Y);
    const [rx, ry] = at(REEL_X[1], REEL_Y);
    const [g0x, g0y] = at(...GUIDES[0]);
    const [g1x, g1y] = at(...GUIDES[1]);
    const [, by] = at(0, BAND_Y);
    // Ablaufpunkt unten aussen am Wickel (etwa 224 Grad)
    const a = (224 * Math.PI) / 180;
    const pts: [number, number][] = [
      [lx + Math.cos(a) * radii[0], ly + Math.sin(a) * radii[0]],
      [g0x - GUIDE_R, g0y],
      [g0x + GUIDE_R * 0.4, by],
      [g1x - GUIDE_R * 0.4, by],
      [g1x + GUIDE_R, g1y],
      [rx - Math.cos(a) * radii[1], ry + Math.sin(a) * radii[1]],
    ];
    this.segments.forEach((m, i) => {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      m.material = mat;
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
      m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
      m.scale.x = len;
    });
  }
}

export interface ConfigureParams {
  pair: Pair;
  front: Side;
  withBack: boolean;
  tilt: number;
  tiltBack: number;
  rx: number;
  ry: number;
  rz: number;
  reel: number;
  hubAngle: number;
  shellFront: Texture;
  shellBack: Texture;
  labelFront: Texture;
  labelBack: Texture | null;
}
