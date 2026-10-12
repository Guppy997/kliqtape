import { useRef, useState } from 'react';
import { filmStampLabel } from '@/lib/berlinDay';
import { exifDate } from '@/lib/exifDate';
import { processUpload } from '@/lib/photo';

const YEAR_MS = 365 * 86_400_000;

/** 'YYYY-MM' fuer <input type="month">, in UTC wie exifDate. */
function monthOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * "Damals" — ein Foto aus der Galerie, mindestens ein Jahr alt. Das Datum
 * kommt aus den Bilddaten des Originals (lib/exifDate.ts), bevor das
 * Neu-Kodieren alle Metadaten entfernt; verraten sie keins, gibt man Monat
 * und Jahr selbst an. An den Server geht nur dieses Datum — pruefen kann er
 * es nicht, das sagt auch "Was der Server sieht".
 */
export default function DamalsPicker({
  onSend,
}: {
  onSend: (blob: Blob, caption: string, takenAt: number) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [exifAt, setExifAt] = useState<number | null>(null);
  const [month, setMonth] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = monthOf(Date.now() - YEAR_MS);
  // Unveraenderter Monat aus den Bilddaten: das genaue Datum nehmen, sonst
  // die Monatsmitte.
  const takenAt = !month
    ? null
    : exifAt != null && monthOf(exifAt) === month
      ? exifAt
      : Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 15, 12);
  const oldEnough = takenAt != null && takenAt <= Date.now() - YEAR_MS;

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const at = await exifDate(file);
      const { blob, previewUrl } = await processUpload(file);
      setShot({ blob, url: previewUrl });
      setExifAt(at);
      setMonth(at != null ? monthOf(at) : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bild lässt sich nicht lesen');
    }
  }

  async function send() {
    if (!shot || takenAt == null) return;
    setBusy(true);
    setError(null);
    try {
      await onSend(shot.blob, caption.trim(), takenAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />

      {shot ? (
        <div className="print mx-auto w-full max-w-[17rem]">
          <div className="relative">
            <img src={shot.url} alt="Dein Foto von damals" />
            {takenAt != null && (
              <span
                className="font-mono absolute bottom-1.5 right-2 text-[0.7rem] font-bold tracking-[0.12em]"
                style={{ color: '#FF9A3C', textShadow: '0 0 4px rgba(255,120,30,.7)' }}
              >
                {filmStampLabel(takenAt)}
              </span>
            )}
          </div>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={44}
            placeholder="Mit Filzstift beschriften …"
            className="font-hand mt-2 w-full bg-transparent px-1 text-center text-[0.95rem] text-[#3B3226] outline-none placeholder:text-[#3B3226]/40"
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => input.current?.click()}
        className="rounded-lg px-4 py-3 text-sm"
        style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
      >
        {shot ? 'Anderes Foto wählen' : 'Foto aus der Galerie wählen'}
      </button>

      {shot && (
        <label className="flex flex-col gap-1.5">
          <span className="text-2xs" style={{ color: 'var(--dim)' }}>
            {exifAt != null
              ? 'Aufgenommen — aus den Bilddaten gelesen'
              : 'Die Bilddaten verraten kein Datum. Wann war das ungefähr?'}
          </span>
          <input
            type="month"
            value={month}
            max={latest}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg px-3 py-2 text-base outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />
          {takenAt != null && !oldEnough && (
            <span className="text-2xs" style={{ color: 'var(--danger)' }}>
              Das Foto muss mindestens ein Jahr alt sein.
            </span>
          )}
        </label>
      )}

      {error && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {shot && (
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || !oldEnough}
          className="rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-40"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          Weiter
        </button>
      )}
    </div>
  );
}
