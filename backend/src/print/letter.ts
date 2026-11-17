import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type { Writable } from 'node:stream';
import { F, registerFonts, wordmark } from './fonts.js';

/*
 * Einladung als Brief: ein druckbares A5-Blatt mit QR-Code. Bekommt alles
 * uebergeben und hat — wie album.ts — keinen Zugang zur Datenbank.
 */

export interface Letter {
  cassetteName: string;
  from: string;
  /** Vollstaendige Adresse mit Token, steht im QR-Code und darunter als Text. */
  url: string;
  /** Lesbares Ablaufdatum, z. B. "20.10.2026". */
  validUntil: string;
}

const PAPER = '#FBF8F2';
const PRINT = '#ECE5D6';
const INK = '#2B2620';
const DIM = '#8A8070';
const STRIPE = '#B8462C';

export function renderLetterPdf(letter: Letter, out: Writable): void {
  const doc = new PDFDocument({
    size: 'A5',
    margin: 0,
    info: { Title: `Einladung zu ${letter.cassetteName}`, Creator: 'Kliqtape' },
  });
  doc.pipe(out);
  registerFonts(doc);
  const W = doc.page.width;
  const H = doc.page.height;
  const M = 44;
  const inner = W - 2 * M;

  doc.rect(0, 0, W, H).fill(PAPER);
  doc.rect(0, 0, W, 6).fill(STRIPE);

  // Kopf: Wortmarke wie auf dem Etikett
  wordmark(doc, M, M, 11, INK);
  doc
    .fillColor(DIM)
    .font(F.text)
    .fontSize(8)
    .text('Eine Kassette ist eine Runde von Leuten.', M, M + 14);

  doc
    .fillColor(INK)
    .font(F.hand)
    .fontSize(36)
    .text('Du bist eingeladen.', M, M + 52, { width: inner });
  doc
    .font(F.text)
    .fontSize(11)
    .fillColor(INK)
    .text(
      `${letter.from} möchte dich auf die Kassette »${letter.cassetteName}« holen. Seite A ist euer Archiv, ` +
        'Seite B euer Gruppenchat. Ohne Werbung, ohne Algorithmus, ohne Zahlen.',
      M,
      doc.y + 10,
      { width: inner, lineGap: 3 },
    );

  // QR-Code auf einem Abzug — Module direkt als Rechtecke, kein Bild noetig.
  const qr = QRCode.create(letter.url, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const box = 150;
  const cell = box / (size + 8);
  const frameX = (W - box - 24) / 2;
  const frameY = doc.y + 24;
  doc
    .save()
    .fillColor('#000000', 0.06)
    .rect(frameX + 3, frameY + 4, box + 24, box + 52)
    .fill()
    .restore();
  doc.rect(frameX, frameY, box + 24, box + 52).fill(PRINT);
  doc.rect(frameX + 12, frameY + 12, box, box).fill('#FFFFFF');
  // Alle Module in EINEN Pfad und einmal fuellen — einzeln gefuellt
  // entstehen an den Kanten Haarlinien, die Scanner aus dem Tritt bringen.
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.modules.get(r, c)) doc.rect(frameX + 12 + (c + 4) * cell, frameY + 12 + (r + 4) * cell, cell, cell);
    }
  }
  doc.fill(INK);
  doc
    .fillColor(INK)
    .font(F.hand)
    .fontSize(13)
    .text('Scannen, Namen wählen, zustimmen.', frameX, frameY + box + 22, {
      width: box + 24,
      align: 'center',
    });

  // Fuss: was der Brief kann und was nicht — ehrlich und knapp.
  const footY = H - M - 58;
  doc
    .moveTo(M, footY)
    .lineTo(W - M, footY)
    .lineWidth(0.6)
    .strokeColor(DIM)
    .stroke();
  doc
    .fillColor(DIM)
    .font(F.text)
    .fontSize(7.5)
    .text(
      `Gilt einmal und bis ${letter.validUntil}. Führt nur auf »${letter.cassetteName}«. ` +
        'Dabei bist du erst, wenn du der Einladung zustimmst.',
      M,
      footY + 8,
      { width: inner },
    );
  doc
    .fillColor(DIM)
    .font(F.text)
    .fontSize(6.5)
    .text(letter.url, M, doc.y + 6, { width: inner });

  doc.end();
}
