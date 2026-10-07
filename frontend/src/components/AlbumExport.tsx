import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { downloadAlbum, fetchAlbumPreview, mediaUrl, type Cassette } from '@/lib/api';
import { useApp } from '@/store/appStore';
import Sheet from './Sheet';

/**
 * Album-Export: Tapes von Seite A auswaehlen und als PDF speichern. Die
 * Auswahl zeigt pro Tape ein paar Bilder statt einer Anzahl — wie man im
 * Schuhkarton blaettert, nicht wie in einer Statistik.
 */
export default function AlbumExport({
  open,
  cassette,
  onClose,
}: {
  open: boolean;
  cassette: Cassette;
  onClose: () => void;
}) {
  const me = useApp((s) => s.me);
  const { data, isLoading } = useQuery({
    queryKey: ['album-preview', cassette.id, me],
    queryFn: () => fetchAlbumPreview(cassette.id, me),
    enabled: open,
  });
  const [chosen, setChosen] = useState<Set<number>>(new Set());

  // Beim Oeffnen sind alle Tapes gewaehlt — der haeufigste Fall ist "alles".
  useEffect(() => {
    if (data) setChosen(new Set(data.tapes.map((t) => t.index)));
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      downloadAlbum(
        cassette.id,
        me,
        [...chosen].sort((a, b) => a - b),
        cassette.name,
      ),
  });

  const toggle = (i: number) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <Sheet open={open} onClose={onClose} variant="full" title="Album als PDF">
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--dim)' }}>
          Wähle die Tapes von Seite A, die ins Album sollen. Seite B und Hot Line kommen nie hinein, Clips und O-Töne
          lassen sich nicht drucken. Wer seine Beiträge aus Alben ausgenommen hat, fehlt bewusst.
        </p>

        {isLoading && (
          <p className="text-2xs" style={{ color: 'var(--dim)' }}>
            Spule durch …
          </p>
        )}
        {data && data.tapes.length === 0 && (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--dim)' }}>
            Auf Seite A ist noch nichts, das sich drucken lässt.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          {data?.tapes.map((t) => {
            const on = chosen.has(t.index);
            const photos = t.posts.filter((p) => p.mediaId).slice(0, 4);
            return (
              <button
                key={t.index}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(t.index)}
                className="flex items-center gap-3 rounded-xl p-2.5 text-left"
                style={{ background: 'var(--card)', border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}` }}
              >
                <span
                  aria-hidden="true"
                  className="grid size-5 shrink-0 place-items-center rounded"
                  style={{
                    border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
                    background: on ? 'var(--accent)' : 'transparent',
                    color: 'var(--on-accent)',
                  }}
                >
                  {on && '✓'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-2xs" style={{ color: 'var(--dim)' }}>
                    Tape {String(t.index).padStart(2, '0')} · {t.date}
                  </span>
                  <span className="block truncate text-base font-medium" style={{ color: 'var(--ink)' }}>
                    {t.name ?? (photos.length ? 'Bilder und Zettel' : 'Zettel')}
                  </span>
                </span>
                <span className="flex shrink-0 -space-x-3">
                  {photos.map((p, i) => (
                    <img
                      key={p.id}
                      src={mediaUrl(p.mediaId!)}
                      alt=""
                      className="size-9 rounded-sm object-cover"
                      style={{ border: '2px solid #ECE5D6', transform: `rotate(${(i % 2 ? 4 : -3) + i}deg)` }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {save.error && (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>
            {(save.error as Error).message}
          </p>
        )}

        {data && data.tapes.length > 0 && (
          <button
            type="button"
            disabled={chosen.size === 0 || save.isPending}
            onClick={() => save.mutate()}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            {save.isPending ? 'Album wird gebunden …' : 'PDF speichern'}
          </button>
        )}
      </div>
    </Sheet>
  );
}
