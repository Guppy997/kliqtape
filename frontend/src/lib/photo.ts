/**
 * Fotoverarbeitung.
 *
 * Wichtig fuer die Gestaltungsregel: der klassische Charakter soll aus Rahmen
 * und Beschraenkung kommen, NICHT aus einem Filter, der das Bild zerstoert.
 * Also nur eine leichte Kontrastkurve, minimale Entsaettigung, feines Korn und
 * eine sanfte Vignette. Kein Sepia, keine Kratzer, keine Lichtlecks.
 */

const MAX_EDGE = 1280;

export interface CapturedPhoto {
  blob: Blob;
  previewUrl: string;
}

export async function capturePhoto(video: HTMLVideoElement): Promise<CapturedPhoto> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error('Kamera liefert noch kein Bild');

  const scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas nicht verfügbar');

  ctx.drawImage(video, 0, 0, w, h);
  applyClassicLook(ctx, w, h);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.86),
  );
  if (!blob) throw new Error('Bild konnte nicht erzeugt werden');

  return { blob, previewUrl: URL.createObjectURL(blob) };
}

function applyClassicLook(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  const cx = w / 2;
  const cy = h / 2;
  const maxDist = Math.hypot(cx, cy);

  for (let i = 0; i < d.length; i += 4) {
    const px = (i / 4) % w;
    const py = Math.floor(i / 4 / w);

    let r = d[i]!;
    let g = d[i + 1]!;
    let b = d[i + 2]!;

    // Leichte Entsaettigung — 12 % Richtung Grau reicht, damit es "Abzug"
    // statt "Handykamera" wirkt, ohne die Farben zu verlieren.
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    r += (lum - r) * 0.12;
    g += (lum - g) * 0.12;
    b += (lum - b) * 0.12;

    // Sanfte S-Kurve: Tiefen etwas zu, Lichter etwas runter.
    r = curve(r);
    g = curve(g);
    b = curve(b);

    // Vignette, bewusst schwach (max. 18 % Abdunklung in den Ecken).
    const dist = Math.hypot(px - cx, py - cy) / maxDist;
    const vig = 1 - 0.18 * Math.pow(dist, 2.2);
    r *= vig;
    g *= vig;
    b *= vig;

    // Feines Korn. Monochrom, damit keine Farbflecken entstehen.
    const grain = (Math.random() - 0.5) * 9;
    d[i] = clamp(r + grain);
    d[i + 1] = clamp(g + grain);
    d[i + 2] = clamp(b + grain);
  }

  ctx.putImageData(img, 0, 0);
}

function curve(v: number): number {
  const x = v / 255;
  // Milder Kontrast: unter 0.5 leicht runter, darueber leicht rauf.
  const y = x < 0.5 ? 0.5 * Math.pow(2 * x, 1.12) : 1 - 0.5 * Math.pow(2 * (1 - x), 1.12);
  return y * 255;
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Kamera-Stream anfordern. Wirft mit lesbarem Text, wenn es nicht geht. */
export async function openCamera(facing: 'user' | 'environment', withAudio: boolean) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      'Kamera nicht verfügbar. Browser geben sie nur über https oder localhost frei — ' +
        'ruf die App über den Tailscale-Hostnamen auf.',
    );
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: withAudio,
    });
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === 'NotAllowedError') throw new Error('Zugriff abgelehnt. Erlaube Kamera und Mikrofon.');
    if (name === 'NotFoundError') throw new Error('Keine Kamera gefunden.');
    throw new Error('Kamera lässt sich nicht öffnen.');
  }
}
