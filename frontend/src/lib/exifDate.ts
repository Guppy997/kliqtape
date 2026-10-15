/**
 * Aufnahmedatum aus den EXIF-Daten eines JPEG lesen — fuer die Challenge
 * "Damals". Ohne Bibliothek: nur die paar Bytes, die es dafuer braucht
 * (APP1-Segment, TIFF-Kopf, IFD0 → Exif-IFD → DateTimeOriginal).
 *
 * Muss VOR processUpload (lib/photo.ts) laufen: das Neu-Kodieren entfernt
 * alle Metadaten, und das ist auch gut so — an den Server geht nur dieses
 * eine Datum, nie die EXIF-Daten selbst (kein GPS, kein Geraet).
 *
 * Gibt den Zeitpunkt als Millisekunden zurueck, oder null, wenn das Bild
 * keins verraet. Die Uhrzeit ohne Zeitzone wird als UTC gelesen — fuer
 * "mindestens ein Jahr alt" reicht das voellig.
 */
export async function exifDate(file: File): Promise<number | null> {
  try {
    const view = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
    let off = 2;
    while (off + 10 < view.byteLength) {
      const marker = view.getUint16(off);
      if ((marker & 0xff00) !== 0xff00) return null;
      const len = view.getUint16(off + 2);
      // APP1 mit "Exif\0\0"
      if (marker === 0xffe1 && view.getUint32(off + 4) === 0x45786966) return fromTiff(view, off + 10);
      off += 2 + len;
    }
    return null;
  } catch {
    return null;
  }
}

const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;

function fromTiff(view: DataView, start: number): number | null {
  const little = view.getUint16(start) === 0x4949;
  const u16 = (o: number) => view.getUint16(start + o, little);
  const u32 = (o: number) => view.getUint32(start + o, little);

  const ascii = (entry: number): string => {
    const count = u32(entry + 4);
    const at = count > 4 ? u32(entry + 8) : entry + 8;
    let out = '';
    for (let i = 0; i < count - 1 && start + at + i < view.byteLength; i++) {
      out += String.fromCharCode(view.getUint8(start + at + i));
    }
    return out;
  };

  /** Alle Eintraege eines IFD als tag → Offset des Eintrags. */
  const entries = (ifd: number): Map<number, number> => {
    const map = new Map<number, number>();
    if (start + ifd + 2 > view.byteLength) return map;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const entry = ifd + 2 + i * 12;
      if (start + entry + 12 > view.byteLength) break;
      map.set(u16(entry), entry);
    }
    return map;
  };

  const ifd0 = entries(u32(4));
  const exifAt = ifd0.get(TAG_EXIF_IFD);
  const exif = exifAt != null ? entries(u32(exifAt + 8)) : new Map<number, number>();
  const at = exif.get(TAG_DATETIME_ORIGINAL) ?? ifd0.get(TAG_DATETIME);
  return at != null ? parseExifDate(ascii(at)) : null;
}

/** "2019:07:14 18:22:05" → Millisekunden. */
function parseExifDate(text: string): number | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(text.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  if (!y || y < 1900 || !mo || !d) return null;
  return Date.UTC(y, mo - 1, d, h ?? 0, mi ?? 0, s ?? 0);
}
