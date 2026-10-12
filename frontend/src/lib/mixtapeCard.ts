import { mediaUrl, recipientOf, type Mixtape } from '@/lib/api';
import { berlinDateLabel } from '@/lib/berlinDay';

/**
 * Mixtape als Bild: eine J-Card (die Einlegekarte einer Kassette) mit Cover,
 * Titel, Titelliste und Widmung — zum Speichern in der Galerie. Gezeichnet
 * mit Canvas 2D, ohne Bibliothek; Schriften sind dieselben Systemschriften
 * wie in der App (index.css, --font-hand/--font-disp/--font-mono).
 */

const W = 1080;
const H = 1350;
const PAPER = '#ECE5D6';
const PAPER_DEEP = '#E0D5BE';
const INK = '#2B2620';
const DIM = '#7E7363';
const STRIPE = '#B8462C';
const GROUND = '#1C1916';

const HAND = '"Bradley Hand", "Marker Felt", "Segoe Script", cursive';
const DISP = '"Arial Narrow", "Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const SANS = '-apple-system, BlinkMacSystemFont, "Helvetica Neue", system-ui, sans-serif';

function ellipsize(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Bricht Text auf hoechstens maxLines Zeilen um, die letzte wird gekuerzt. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= max || !line) {
      line = next;
    } else {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = ellipsize(ctx, `${lines[maxLines - 1]} …`, max);
  }
  return lines;
}

function spaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: 'left' | 'right' = 'left',
) {
  // letterSpacing gibt es nicht ueberall — Zeichen fuer Zeichen setzen.
  const widths = [...text].map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let cx = align === 'right' ? x - total : x;
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, cx, y);
    cx += widths[i]!;
  });
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

export async function renderMixtapeCard(tape: Mixtape): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const cover = tape.coverId ? await loadImage(mediaUrl(tape.coverId)) : null;

  // Grund: dunkel, mit weichem Licht von oben — wie die Karte auf einem Tisch.
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 260, 80, W / 2, 520, 900);
  glow.addColorStop(0, 'rgba(255,240,215,.10)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Die J-Card, ein Hauch schief, mit Schatten
  const cx = 90;
  const cy = 86;
  const cw = W - 180;
  const ch = H - 200;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((-0.6 * Math.PI) / 180);
  ctx.translate(-W / 2, -H / 2);
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = PAPER;
  ctx.fillRect(cx, cy, cw, ch);
  ctx.shadowColor = 'transparent';

  // Farbband oben, wie der bedruckte Kopf einer echten J-Card
  ctx.fillStyle = STRIPE;
  ctx.fillRect(cx, cy, cw, 74);
  ctx.fillStyle = '#FFF4EC';
  ctx.font = `700 30px ${DISP}`;
  ctx.textBaseline = 'middle';
  spaced(ctx, 'KLIQTAPE', cx + 40, cy + 38, 5);
  ctx.font = `500 22px ${MONO}`;
  spaced(ctx, 'MIXTAPE · C60', cx + cw - 40, cy + 38, 3, 'right');

  // Cover links, Titel rechts
  const coverSize = 300;
  const coverX = cx + 40;
  const coverY = cy + 112;
  if (cover) {
    const s = Math.max(coverSize / cover.width, coverSize / cover.height);
    const sw = coverSize / s;
    const sh = coverSize / s;
    ctx.drawImage(cover, (cover.width - sw) / 2, (cover.height - sh) / 2, sw, sh, coverX, coverY, coverSize, coverSize);
  } else {
    // Ohne Cover: eine Kassette als Strichzeichnung, wie auf dem Albumtitel.
    ctx.fillStyle = PAPER_DEEP;
    ctx.fillRect(coverX, coverY, coverSize, coverSize);
    const kx = coverX + 40;
    const ky = coverY + 80;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(kx, ky, 220, 140, 12);
    ctx.stroke();
    ctx.fillStyle = STRIPE;
    ctx.fillRect(kx + 16, ky + 14, 188, 14);
    ctx.strokeRect(kx + 16, ky + 14, 188, 44);
    ctx.beginPath();
    ctx.roundRect(kx + 50, ky + 74, 120, 34, 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(kx + 78, ky + 91, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(kx + 142, ky + 91, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(kx + 40, ky + 140);
    ctx.lineTo(kx + 56, ky + 120);
    ctx.lineTo(kx + 164, ky + 120);
    ctx.lineTo(kx + 180, ky + 140);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(coverX, coverY, coverSize, coverSize);

  const tx = coverX + coverSize + 40;
  const tw = cx + cw - 40 - tx;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = `64px ${HAND}`;
  const titleLines = wrap(ctx, tape.title || 'Ohne Titel', tw, 3);
  titleLines.forEach((l, i) => ctx.fillText(l, tx, coverY + 64 + i * 70));
  let ty = coverY + 64 + titleLines.length * 70 + 6;
  ctx.fillStyle = DIM;
  ctx.font = `500 22px ${MONO}`;
  spaced(ctx, `VON ${tape.from.toUpperCase()}`, tx, ty, 2);
  ty += 34;
  spaced(ctx, `FÜR ${recipientOf(tape).toUpperCase()}`, tx, ty, 2);
  if (tape.sealedAt) {
    ty += 34;
    spaced(ctx, `VERSIEGELT ${berlinDateLabel(tape.sealedAt)}`, tx, ty, 2);
  }

  // Titelliste
  let y = coverY + coverSize + 70;
  ctx.fillStyle = DIM;
  ctx.font = `700 22px ${DISP}`;
  spaced(ctx, 'SEITE A', cx + 40, y, 4);
  ctx.fillStyle = STRIPE;
  ctx.fillRect(cx + 40, y + 12, 56, 3);
  y += 52;
  // Platz fuer die Widmung unten vorab ausmessen, dann die Titelliste in den
  // Rest einpassen — zwoelf Titel plus drei Zeilen Widmung muessen auf die Karte.
  ctx.font = `38px ${HAND}`;
  const noteLines = tape.note ? wrap(ctx, tape.note, cw - 160, 3) : [];
  const noteH = noteLines.length ? 40 + noteLines.length * 46 : 0;
  const tracks = tape.tracks.slice(0, 12);
  const bottom = cy + ch - 40 - (noteH ? noteH + 40 : 0);
  const lineH = Math.min(46, (bottom - y) / Math.max(1, tracks.length));
  const titlePx = Math.round(Math.min(28, lineH * 0.68));
  const listW = cw - 80;
  for (const t of tracks) {
    ctx.fillStyle = STRIPE;
    ctx.font = `600 ${titlePx - 4}px ${MONO}`;
    ctx.fillText(String(t.position).padStart(2, '0'), cx + 40, y);
    ctx.fillStyle = INK;
    ctx.font = `500 ${titlePx}px ${SANS}`;
    const title = ellipsize(ctx, t.title, listW - 90 - (t.artist ? 220 : 0));
    ctx.fillText(title, cx + 100, y);
    if (t.artist) {
      const titleW = ctx.measureText(title).width;
      ctx.fillStyle = DIM;
      ctx.font = `400 ${titlePx - 4}px ${SANS}`;
      ctx.fillText(ellipsize(ctx, `— ${t.artist}`, listW - 100 - titleW), cx + 100 + titleW + 12, y);
    }
    // feine Linie wie auf einer echten Tracklist
    ctx.fillStyle = 'rgba(43,38,32,.12)';
    ctx.fillRect(cx + 40, y + Math.round(lineH * 0.3), listW, 1.5);
    y += lineH;
  }

  // Widmung: ein aufgeklebter Zettel unten auf der Karte, mit Klebestreifen
  if (noteLines.length) {
    const lines = noteLines;
    const nh = noteH;
    const ny = cy + ch - nh - 44;
    ctx.save();
    ctx.translate(cx + cw / 2, ny + nh / 2);
    ctx.rotate((0.8 * Math.PI) / 180);
    ctx.fillStyle = PAPER_DEEP;
    ctx.shadowColor = 'rgba(0,0,0,.18)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillRect(-(cw - 100) / 2, -nh / 2, cw - 100, nh);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(255,250,235,.55)';
    ctx.fillRect(-60, -nh / 2 - 14, 120, 28);
    ctx.fillStyle = INK;
    ctx.font = `38px ${HAND}`;
    lines.forEach((l, i) => ctx.fillText(l, -(cw - 160) / 2, -nh / 2 + 54 + i * 46));
    ctx.restore();
  }
  ctx.restore();

  // Absender unten auf dem Grund
  ctx.fillStyle = 'rgba(236,229,214,.55)';
  ctx.font = `500 22px ${MONO}`;
  ctx.textBaseline = 'middle';
  const footer = 'gemacht mit kliqtape';
  const fw = [...footer].reduce((a, c2) => a + ctx.measureText(c2).width + 3, 0);
  spaced(ctx, footer, (W - fw) / 2, H - 52, 3);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild ließ sich nicht erzeugen'))), 'image/png'),
  );
}
