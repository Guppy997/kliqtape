import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * Schriften der PDFs laut Markenskill: Archivo fuer alles, Caveat fuer
 * Handschrift. pdfkit kann keine Variable Fonts, deshalb feste Schnitte,
 * erzeugt von scripts/fonts.sh (Lizenzen liegen daneben, SIL OFL).
 *
 * Pfad relativ zu dieser Datei: src/print beim Entwickeln und in den Tests,
 * dist/print im Container. In beiden Faellen liegt assets/ zwei Ebenen hoeher.
 */
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');

export const F = {
  /** Fliesstext, Metadaten */
  text: 'Archivo',
  /** Bedienung, Stempel */
  medium: 'Archivo-Medium',
  /** Ueberschriften und gedruckte Etiketten: 700, Breite 87.5 */
  title: 'Archivo-Titel',
  /** Wortmarke: 700, Breite 75 */
  mark: 'Archivo-Wortmarke',
  /** Handschrift auf Material: Namen, Widmungen, Zettel */
  hand: 'Caveat',
} as const;

/** Caveat ist kleiner als eine Buchschrift gleicher Groesse. */
export const HAND_SCALE = 1.2;

export function registerFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont(F.text, path.join(DIR, 'Archivo-Regular.ttf'));
  doc.registerFont(F.medium, path.join(DIR, 'Archivo-Medium.ttf'));
  doc.registerFont(F.title, path.join(DIR, 'Archivo-Titel.ttf'));
  doc.registerFont(F.mark, path.join(DIR, 'Archivo-Wortmarke.ttf'));
  doc.registerFont(F.hand, path.join(DIR, 'Caveat-Regular.ttf'));
}

/**
 * Wortmarke wie ueberall: KLIQ gefuellt, TAPE nur Kontur (0.032em), Laufweite
 * +0.01em. Beide Teile in derselben Farbe.
 */
export function wordmark(doc: PDFKit.PDFDocument, x: number, y: number, size: number, color: string) {
  const spacing = 0.01 * size;
  doc.save();
  doc
    .font(F.mark)
    .fontSize(size)
    .fillColor(color)
    .strokeColor(color)
    .lineWidth(Math.max(0.3, 0.032 * size));
  doc.text('KLIQ', x, y, { characterSpacing: spacing, lineBreak: false });
  const w = doc.widthOfString('KLIQ', { characterSpacing: spacing });
  doc.text('TAPE', x + w, y, { characterSpacing: spacing, lineBreak: false, fill: false, stroke: true });
  doc.restore();
}
