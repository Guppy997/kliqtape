import { useQueryClient } from '@tanstack/react-query';
import { shootFilm, uploadMedia } from '@/lib/api';
import { filmReleaseLabel } from '@/lib/berlinDay';
import { useApp } from '@/store/appStore';
import CameraCapture from './CameraCapture';
import Sheet from './Sheet';

interface Props {
  open: boolean;
  cassetteId: string;
  /** Freigabe des laufenden Films, falls schon bekannt — nur fuer den Hinweis. */
  releaseAt?: number;
  onClose: () => void;
  onShot?: () => void;
}

/**
 * Ein Bild auf den Film der Woche belichten. Nur Kamera, keine Galerie — wie
 * eine Einwegkamera. Danach sieht man es selbst auch nicht mehr, bis Sonntag
 * entwickelt wird.
 */
export default function FilmShoot({ open, cassetteId, releaseAt, onClose, onShot }: Props) {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();

  async function send(blob: Blob, _ms: number | undefined, caption: string) {
    const mediaId = await uploadMedia(blob);
    await shootFilm(cassetteId, me, mediaId, caption);
    void qc.invalidateQueries({ queryKey: ['film', cassetteId] });
    onShot?.();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} variant="full" title="Film belichten">
      {open && (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[0.62rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
            Ein Bild pro Woche. Es wird entwickelt
            {releaseAt ? ` und ${filmReleaseLabel(releaseAt)} für alle gleichzeitig sichtbar` : ' und Sonntagabend für alle gleichzeitig sichtbar'}
            . Bis dahin siehst auch du es nicht.
          </p>
          <CameraCapture mode="photo" allowUpload={false} sendLabel="Belichten" title="Film" onCancel={onClose} onSend={send} />
        </div>
      )}
    </Sheet>
  );
}
