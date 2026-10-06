import PDFDocument from 'pdfkit';
import type { Writable } from 'node:stream';

/*
 * Album-Export: ein oder mehrere Tapes von Seite A als PDF.
 *
 * Dieses Modul hat BEWUSST keinen Zugang zur Datenbank — kein Import von
 * db.ts, kein better-sqlite3 (erzwungen per Lint-Regel, eslint.config.js,
 * und per Test). Alles, was hier ankommt, liefert eine AlbumSource, die
 * routes/album.ts ausschliesslich aus der View album_posts baut: freigegebene
 * Seite-A-Beitraege ohne die Leute, die "Meine Beitraege nicht in Alben"
 * eingestellt haben. Seite B und Hot Line sind von hier aus nicht erreichbar.
 */

export interface AlbumSourcePost {
  id: string;
  author: string;
  kind: 'text' | 'photo' | 'video' | 'voice' | 'tape';
  body: string;
  mediaId: string | null;
  source: string | null;
  takenAt: number | null;
  createdAt: number;
  tapeIndex: number;
  mixtape: { title: string; coverId: string | null } | null;
}

export interface AlbumSource {
  cassette(): { name: string; createdAt: number };
  /** Nur aus album_posts. */
  posts(): AlbumSourcePost[];
  tapeNames(): Map<number, string>;
  /** Datei zu einem Medium — nur fuer IDs, die posts() selbst geliefert hat. */
  mediaFile(mediaId: string): { path: string; mime: string } | null;
  dateOfTape(tapeIndex: number): string;
  timeOf(ms: number): string;
  /** Datumsaufdruck wie bei einer Einwegkamera: "'26 10 07". */
  stampOf(ms: number): string;
}

export interface AlbumPost {
  id: string;
  author: string;
  kind: AlbumSourcePost['kind'];
  body: string;
  mediaId: string | null;
  film: boolean;
  imposter: boolean;
  time: string;
  stamp: string | null;
  mixtape: AlbumSourcePost['mixtape'];
}

export interface AlbumTape {
  index: number;
  name: string | null;
  date: string;
  posts: AlbumPost[];
}

export interface Album {
  cassetteName: string;
  tapes: AlbumTape[];
}

/** Clips und O-Toene lassen sich nicht drucken — sie bleiben draussen. */
const PRINTABLE = new Set<AlbumSourcePost['kind']>(['text', 'photo', 'tape']);

export function buildAlbum(source: AlbumSource, tapeIndexes: number[] | null): Album {
  const wanted = tapeIndexes ? new Set(tapeIndexes) : null;
  const names = source.tapeNames();
  const byTape = new Map<number, AlbumPost[]>();
  for (const p of source.posts()) {
    if (!PRINTABLE.has(p.kind)) continue;
    if (wanted && !wanted.has(p.tapeIndex)) continue;
    const list = byTape.get(p.tapeIndex) ?? [];
    list.push({
      id: p.id,
      author: p.author,
      kind: p.kind,
      body: p.body,
      mediaId: p.mediaId,
      film: p.source === 'film',
      imposter: p.source === 'imposter',
      time: source.timeOf(p.takenAt ?? p.createdAt),
      stamp: p.source === 'film' ? source.stampOf(p.takenAt ?? p.createdAt) : null,
      mixtape: p.mixtape,
    });
    byTape.set(p.tapeIndex, list);
  }
  return {
    cassetteName: source.cassette().name,
    tapes: [...byTape.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([index, posts]) => ({ index, name: names.get(index) ?? null, date: source.dateOfTape(index), posts })),
  };
}

/* ---- Gestaltung -----------------------------------------------------------
 * A5 hoch, wie ein kleines Fotoalbum. Papierton statt Weiss, Abzuege mit
 * Rand, Bildunterschriften kursiv — dieselbe Materialsprache wie die App
 * (Fotoabzug, Etikett), aber ruhig genug zum Ausdrucken. */

const PAPER = '#FBF8F2';
const PRINT = '#ECE5D6';
const INK = '#2B2620';
const DIM = '#8A8070';
const STRIPE = '#B8462C';
const FILM_STAMP = '#E8842C';
const M = 42; // Seitenrand

/** pdfkit kann ein Bild vorab oeffnen (fuer die Masse), die Typen kennen
 *  das nur nicht. Das geoeffnete Bild laesst sich direkt an image() geben. */
function openImage(doc: PDFKit.PDFDocument, path: string): { width: number; height: number } {
  return (doc as unknown as { openImage(src: string): { width: number; height: number } }).openImage(path);
}

function tapeLabel(t: AlbumTape): string {
  return `Tape ${String(t.index).padStart(2, '0')}`;
}

export function renderAlbumPdf(album: Album, source: Pick<AlbumSource, 'mediaFile'>, out: Writable): void {
  const doc = new PDFDocument({
    size: 'A5',
    margin: M,
    bufferPages: true,
    info: { Title: `${album.cassetteName} — Kliqtape-Album`, Creator: 'Kliqtape' },
  });
  doc.pipe(out);
  const W = doc.page.width;
  const H = doc.page.height;
  const inner = W - 2 * M;

  const paper = () => doc.save().rect(0, 0, W, H).fill(PAPER).restore();
  doc.on('pageAdded', paper);
  paper();

  // ---- Titelseite: Kassette als Strichzeichnung, Name, Zeitraum ----------
  const cw = 230;
  const ch = 146;
  const cx = (W - cw) / 2;
  const cy = 120;
  doc.save().lineWidth(1.4).strokeColor(INK);
  doc.roundedRect(cx, cy, cw, ch, 10).stroke();
  doc.rect(cx + 16, cy + 14, cw - 32, 54).fillAndStroke(PRINT, INK);
  doc.rect(cx + 16, cy + 14, cw - 32, 13).fill(STRIPE);
  doc.fillColor(PAPER).font('Helvetica-Bold').fontSize(7).text('KLIQTAPE', cx + 24, cy + 17.5, { characterSpacing: 1.5 });
  doc.fillColor(INK).font('Times-Italic').fontSize(15).text(album.cassetteName, cx + 24, cy + 35, { width: cw - 48, lineBreak: false, ellipsis: true });
  doc.roundedRect(cx + 40, cy + 80, cw - 80, 34, 4).stroke();
  doc.circle(cx + 70, cy + 97, 10).stroke();
  doc.circle(cx + cw - 70, cy + 97, 10).stroke();
  doc.moveTo(cx + 40, cy + ch).lineTo(cx + 56, cy + ch - 18).lineTo(cx + cw - 56, cy + ch - 18).lineTo(cx + cw - 40, cy + ch).stroke();
  doc.restore();

  const first = album.tapes[0];
  const last = album.tapes.at(-1);
  doc.fillColor(DIM).font('Helvetica-Bold').fontSize(8).text('ALBUM', M, cy + ch + 46, { width: inner, align: 'center', characterSpacing: 3 });
  doc.fillColor(INK).font('Times-Bold').fontSize(26).text(album.cassetteName, M, cy + ch + 62, { width: inner, align: 'center' });
  if (first && last) {
    const range = first === last ? first.date : `${first.date} – ${last.date}`;
    doc.fillColor(DIM).font('Helvetica').fontSize(9).text(
      `${range} · ${album.tapes.length} ${album.tapes.length === 1 ? 'Tape' : 'Tapes'}`,
      M, doc.y + 6, { width: inner, align: 'center' },
    );
  }
  doc.fillColor(DIM).font('Helvetica').fontSize(7).text(
    'Nur Seite A. Clips und O-Töne lassen sich nicht drucken. Wer seine Beiträge nicht in Alben haben möchte, fehlt hier bewusst.',
    M + 30, H - M - 30, { width: inner - 60, align: 'center' },
  );

  // ---- Tapes ----------------------------------------------------------------
  const ensure = (needed: number) => {
    if (doc.y + needed > H - M - 18) doc.addPage();
  };

  for (const tape of album.tapes) {
    doc.addPage();
    doc.fillColor(STRIPE).rect(M, M, 28, 3).fill();
    doc.fillColor(DIM).font('Helvetica-Bold').fontSize(8).text(tapeLabel(tape).toUpperCase(), M, M + 10, { characterSpacing: 2 });
    doc.fillColor(INK).font('Times-Italic').fontSize(20).text(tape.name ?? tape.date, M, doc.y + 2, { width: inner });
    if (tape.name) doc.fillColor(DIM).font('Helvetica').fontSize(9).text(tape.date, M, doc.y + 1);
    doc.moveDown(1.2);

    for (const post of tape.posts) {
      const meta = `${post.author} · ${post.time}${post.film ? ' · Film' : ''}${post.imposter ? ' · Imposter-Woche' : ''}`;

      if (post.kind === 'photo' && post.mediaId) {
        const file = source.mediaFile(post.mediaId);
        if (!file || !/jpeg|png/.test(file.mime)) continue;
        const img = openImage(doc, file.path);
        // Zwei Abzuege pro Seite: so wirkt es wie ein Album, nicht wie ein Stapel Einzelbilder.
        const maxW = inner - 80;
        const scale = Math.min(maxW / img.width, 170 / img.height);
        const iw = img.width * scale;
        const ih = img.height * scale;
        const captionH = post.body ? doc.font('Times-Italic').fontSize(11).heightOfString(post.body, { width: iw }) + 6 : 0;
        const frameH = ih + 16 + captionH + 18;
        ensure(frameH + 14);
        const x = (W - iw) / 2 - 8;
        const y = doc.y;
        // pdfkit kennt keine Hex-Farben mit Alpha — Deckkraft separat.
        doc.save().fillColor('#000000', 0.07).rect(x + 2.5, y + 3, iw + 16, frameH).fill().restore();
        doc.fillColor(PRINT).rect(x, y, iw + 16, frameH).fill();
        doc.image(img as unknown as string, x + 8, y + 8, { width: iw, height: ih });
        if (post.stamp) {
          doc.fillColor(FILM_STAMP).font('Courier-Bold').fontSize(9).text(post.stamp, x + 8, y + 8 + ih - 14, { width: iw - 6, align: 'right' });
        }
        let ty = y + 8 + ih + 6;
        if (post.body) {
          doc.fillColor(INK).font('Times-Italic').fontSize(11).text(post.body, x + 8, ty, { width: iw, align: 'center' });
          ty = doc.y + 2;
        }
        doc.fillColor(DIM).font('Helvetica').fontSize(7).text(meta, x + 8, ty, { width: iw, align: 'center' });
        doc.y = y + frameH + 16;
        doc.x = M;
      } else if (post.kind === 'text') {
        const textH = doc.font('Times-Roman').fontSize(12).heightOfString(post.body, { width: inner - 30 });
        ensure(textH + 34);
        const y = doc.y;
        doc.fillColor(PRINT).rect(M + 6, y, inner - 12, textH + 26).fill();
        doc.fillColor(STRIPE).rect(M + 6, y, 3, textH + 26).fill();
        doc.fillColor(INK).font('Times-Roman').fontSize(12).text(post.body, M + 18, y + 8, { width: inner - 30 });
        doc.fillColor(DIM).font('Helvetica').fontSize(7).text(meta, M + 18, doc.y + 3);
        doc.y = y + textH + 26 + 14;
        doc.x = M;
      } else if (post.kind === 'tape' && post.mixtape) {
        ensure(78);
        const y = doc.y;
        doc.fillColor(PRINT).rect(M + 6, y, inner - 12, 64).fill();
        const cover = post.mixtape.coverId ? source.mediaFile(post.mixtape.coverId) : null;
        if (cover && /jpeg|png/.test(cover.mime)) doc.image(cover.path, M + 14, y + 8, { fit: [48, 48] });
        else doc.fillColor('#D8CFBB').rect(M + 14, y + 8, 48, 48).fill();
        doc.fillColor(DIM).font('Helvetica-Bold').fontSize(7).text('MIXTAPE', M + 74, y + 12, { characterSpacing: 1.5 });
        doc.fillColor(INK).font('Times-Italic').fontSize(14).text(post.mixtape.title || 'Ohne Titel', M + 74, y + 23, { width: inner - 92 });
        doc.fillColor(DIM).font('Helvetica').fontSize(7).text(meta, M + 74, y + 44);
        doc.y = y + 64 + 14;
        doc.x = M;
      }
    }
  }

  // ---- Fusszeile auf allen Innenseiten -------------------------------------
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    // Unterhalb des Rands schreiben, ohne dass pdfkit eine neue Seite anlegt.
    doc.page.margins.bottom = 0;
    doc.fillColor(DIM).font('Helvetica').fontSize(7).text(
      `${album.cassetteName} · ${i + 1}`,
      M, H - M + 14, { width: inner, align: 'center', lineBreak: false },
    );
  }

  doc.end();
}
