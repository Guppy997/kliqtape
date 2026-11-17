import { lookFor } from '@/lib/cassetteLook';
import {
  EM,
  FOOT,
  FOOT_HOLE_Y,
  FOOT_HOLES,
  H,
  HUB_R,
  LABEL,
  MARGIN_EM,
  PACK_MAX,
  PACK_MIN,
  R,
  REEL_X,
  REEL_Y,
  SCREWS,
  W,
  WIN,
} from './dims';
import { colorsOf, drawLabel, drawShell, drawWindowPrint, GLASS, type Side } from './textures';

/**
 * Uebernommen von der Website (kliqtape-website, components/tape3d).
 *
 * Die Kassette flach, wie in der App, fuer Geraete ohne WebGL. Nutzt dieselben
 * Zeichenfunktionen wie die 3D-Kassette, also dasselbe Etikett.
 */
export function drawFlat(
  canvas: HTMLCanvasElement,
  p: {
    cassetteId: string;
    pairIndex?: number;
    side: Side;
    label: string;
    sub?: string;
    corner: string;
    tilt?: number;
    reel: number;
    age: number;
  },
) {
  const look = lookFor(p.cassetteId, p.pairIndex);
  const tilt = p.tilt ?? look.wear.tilt;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const s = canvas.width / ((W / EM + 2 * MARGIN_EM) * EM);
  const o = MARGIN_EM * EM * s;
  const c = colorsOf(look, p.side);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(o, o);

  const shape = new Path2D();
  shape.roundRect(0, 0, W * s, H * s, R * s);
  ctx.save();
  ctx.clip(shape);
  ctx.drawImage(
    drawShell({ pair: look, side: p.side, wear: look.wear, age: p.age }, Math.round(W * s)),
    0,
    0,
    W * s,
    H * s,
  );
  // Glanz oben links wie in der App
  const glare = ctx.createRadialGradient(0.2 * W * s, -0.08 * H * s, 0, 0.2 * W * s, -0.08 * H * s, 0.9 * W * s);
  glare.addColorStop(0, 'rgba(255,255,255,.16)');
  glare.addColorStop(0.45, 'rgba(255,255,255,0)');
  ctx.fillStyle = glare;
  ctx.fillRect(0, 0, W * s, H * s);
  ctx.restore();

  // Fenster mit den Wickeln
  const win = new Path2D();
  win.roundRect(WIN.x * s, WIN.y * s, WIN.w * s, WIN.h * s, WIN.r * s);
  ctx.save();
  ctx.clip(win);
  ctx.fillStyle = c.shellDark;
  ctx.fillRect(WIN.x * s, WIN.y * s, WIN.w * s, WIN.h * s);
  const radii = [PACK_MAX + (PACK_MIN - PACK_MAX) * p.reel, PACK_MIN + (PACK_MAX - PACK_MIN) * p.reel];
  REEL_X.forEach((x, i) => {
    ctx.fillStyle = c.tape;
    ctx.beginPath();
    ctx.arc(x * s, REEL_Y * s, radii[i] * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.hub;
    ctx.beginPath();
    ctx.arc(x * s, REEL_Y * s, HUB_R * s, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.drawImage(
    drawWindowPrint(look, p.side, Math.round(GLASS.w * s)).map,
    GLASS.x * s,
    GLASS.y * s,
    GLASS.w * s,
    GLASS.h * s,
  );
  ctx.restore();

  // Fuss mit Andockloechern
  ctx.beginPath();
  ctx.moveTo(FOOT.topL * s, FOOT.top * s);
  ctx.lineTo(FOOT.topR * s, FOOT.top * s);
  ctx.lineTo(FOOT.botR * s, H * s);
  ctx.lineTo(FOOT.botL * s, H * s);
  ctx.closePath();
  const fg = ctx.createLinearGradient(0, FOOT.top * s, 0, H * s);
  fg.addColorStop(0, c.shellHi);
  fg.addColorStop(0.42, c.shell);
  fg.addColorStop(1, c.shellDark);
  ctx.fillStyle = fg;
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.72)';
  for (const hole of FOOT_HOLES) {
    ctx.beginPath();
    if (hole.round) ctx.arc(hole.x * s, FOOT_HOLE_Y * s, 1.04 * s, 0, Math.PI * 2);
    else ctx.roundRect((hole.x - 0.56) * s, (FOOT_HOLE_Y - 0.88) * s, 1.12 * s, 1.76 * s, 0.16 * s);
    ctx.fill();
  }

  ctx.fillStyle = '#9d978c';
  for (const [x, y] of SCREWS) {
    ctx.beginPath();
    ctx.arc(x * s, y * s, 0.95 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Etikett, leicht schief aufgeklebt
  const lw = LABEL.w * s;
  const lh = LABEL.h * s;
  ctx.translate((LABEL.x + LABEL.w / 2) * s, (LABEL.y + LABEL.h / 2) * s);
  ctx.rotate((tilt * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,.5)';
  ctx.shadowBlur = 0.4 * s;
  ctx.shadowOffsetY = 0.2 * s;
  ctx.drawImage(
    drawLabel({ pair: look, side: p.side, label: p.label, sub: p.sub, corner: p.corner, age: p.age }, Math.round(lw)),
    -lw / 2,
    -lh / 2,
    lw,
    lh,
  );
  ctx.restore();
}
