import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createStory, deleteStory, fetchStories, mediaUrl, uploadMedia, type StoryKind } from '@/lib/api';
import { useApp } from '@/store/appStore';
import Avatar from './Avatar';
import CameraCapture from './CameraCapture';
import Sheet from './Sheet';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PHOTO_MS = 5000;
const VIDEO_FALLBACK_MS = 10_000;

/**
 * Storys — kassettenuebergreifend, nur Foto/Video, 24h. Ein Raster aus
 * quadratischen Kacheln, drei pro Reihe, mit der neuesten Aufnahme jeder
 * Person (eigene "+"-Kachel oben links). Antippen einer Person oeffnet einen
 * Ablauf-Betrachter mit Fortschrittsbalken, wie man es von echten Stories
 * kennt — dafuer bewusst ein eigenes, volles Overlay statt Sheet.tsx' Kopf
 * mit Titel+X: der Betrachter braucht ein eigenes Schliessen (zurueck zur
 * Reihe), waehrend Sheet.tsx' X die Story-Ansicht ganz verlaesst.
 */
export default function StoryView({ open, onClose }: Props) {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const qc = useQueryClient();

  const [addMode, setAddMode] = useState<null | StoryKind>(null);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { data: groups = [] } = useQuery({
    queryKey: ['stories', me],
    queryFn: () => fetchStories(me),
    enabled: open,
    refetchInterval: open ? 30_000 : false,
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ['stories', me] });

  const activeGroup = viewingIndex != null ? groups[viewingIndex] : null;
  const activeStory = activeGroup?.stories[segmentIndex] ?? null;

  function openViewer(i: number) {
    setViewingIndex(i);
    setSegmentIndex(0);
  }

  function closeViewer() {
    setViewingIndex(null);
    setSegmentIndex(0);
  }

  function next() {
    if (!activeGroup || viewingIndex == null) return;
    if (segmentIndex + 1 < activeGroup.stories.length) {
      setSegmentIndex(segmentIndex + 1);
    } else if (viewingIndex + 1 < groups.length) {
      setViewingIndex(viewingIndex + 1);
      setSegmentIndex(0);
    } else {
      closeViewer();
    }
  }

  function prev() {
    if (viewingIndex == null) return;
    if (segmentIndex > 0) {
      setSegmentIndex(segmentIndex - 1);
    } else if (viewingIndex > 0) {
      setViewingIndex(viewingIndex - 1);
      setSegmentIndex(0);
    }
  }

  async function sendStory(blob: Blob, durationMs: number | undefined) {
    if (!addMode) return;
    setError(null);
    try {
      const mediaId = await uploadMedia(blob, durationMs);
      await createStory({ author: me, kind: addMode, mediaId });
      setAddMode(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
    }
  }

  async function removeActive() {
    if (!activeStory) return;
    await deleteStory(activeStory.id, me);
    refresh();
    next();
  }

  return (
    <Sheet open={open} onClose={onClose} variant="full" title="Storys">
      {activeGroup && activeStory ? (
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#181615' }}>
          {/* Fortschrittsbalken, ein Segment pro Story dieser Person */}
          <div className="flex gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            {activeGroup.stories.map((s, i) => (
              <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,.3)' }}>
                <div
                  key={i === segmentIndex ? `${s.id}-active` : `${s.id}-${i < segmentIndex ? 'done' : 'todo'}`}
                  className="h-full rounded-full"
                  style={{
                    background: '#fff',
                    width: i < segmentIndex ? '100%' : i > segmentIndex ? '0%' : undefined,
                    animation:
                      i === segmentIndex
                        ? `story-progress ${activeStory.kind === 'photo' ? PHOTO_MS : activeStory.durationMs ?? VIDEO_FALLBACK_MS}ms linear forwards`
                        : undefined,
                  }}
                  onAnimationEnd={i === segmentIndex ? next : undefined}
                />
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-2 px-3">
            <Avatar name={activeGroup.author} side={side} size={2} />
            <span className="font-hand text-lg text-white">{activeGroup.author}</span>
            {activeGroup.author === me && (
              <button
                type="button"
                onClick={removeActive}
                className="font-mono ml-auto shrink-0 text-[0.6rem] uppercase tracking-[0.1em] text-white/70"
              >
                Löschen
              </button>
            )}
            <button
              type="button"
              onClick={closeViewer}
              aria-label="Zurück zur Übersicht"
              className="grid size-9 shrink-0 place-items-center rounded-full text-white"
              style={{ background: 'rgba(255,255,255,.15)' }}
            >
              ✕
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            {activeStory.kind === 'photo' ? (
              <img src={mediaUrl(activeStory.mediaId)} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <video
                key={activeStory.id}
                src={mediaUrl(activeStory.mediaId)}
                autoPlay
                playsInline
                className="max-h-full max-w-full object-contain"
                onEnded={next}
              />
            )}
            {/* Antipp-Zonen links/rechts, unsichtbar */}
            <button type="button" aria-label="Zurück" onClick={prev} className="absolute inset-y-0 left-0 w-1/3" />
            <button type="button" aria-label="Weiter" onClick={next} className="absolute inset-y-0 right-0 w-1/3" />
          </div>
        </div>
      ) : addMode ? (
        <CameraCapture
          mode={addMode}
          allowUpload={addMode === 'photo'}
          withCaption={false}
          sendLabel="Auf die Story"
          title="Story"
          onCancel={() => setAddMode(null)}
          onSend={sendStory}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Raster statt Avatar-Reihe: das Bild ist der Inhalt, nicht das
              Profilfoto. Drei pro Reihe, quadratisch; die eigene "+"-Kachel
              steht immer oben links. */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setAddMode('photo')}
              aria-label="Eigene Story aufnehmen"
              className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg"
              style={{ border: '1.5px dashed var(--accent)', background: 'color-mix(in srgb, var(--accent) 8%, transparent)' }}
            >
              <span
                className="grid size-9 place-items-center rounded-full"
                style={{ background: 'var(--accent)', color: '#17130E' }}
                aria-hidden="true"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M7 1v12M1 7h12" />
                </svg>
              </span>
              <span className="font-mono text-[0.56rem] uppercase tracking-[0.1em]" style={{ color: 'var(--accent)' }}>
                Deine Story
              </span>
            </button>

            {groups.map((g, i) => {
              const latest = g.stories[0]!;
              return (
                <button
                  key={g.author}
                  type="button"
                  onClick={() => openViewer(i)}
                  aria-label={`Story von ${g.author}`}
                  className="relative aspect-square overflow-hidden rounded-lg text-left"
                  style={{ background: 'var(--card)', boxShadow: '0 0 0 1.5px var(--accent)' }}
                >
                  {latest.kind === 'photo' ? (
                    <img src={mediaUrl(latest.mediaId)} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    // #t=0.1: zeigt das erste Bild statt einer schwarzen Flaeche.
                    <video
                      src={`${mediaUrl(latest.mediaId)}#t=0.1`}
                      muted
                      playsInline
                      preload="metadata"
                      className="size-full object-cover"
                    />
                  )}
                  <span
                    className="absolute inset-x-0 bottom-0 flex items-end gap-1.5 px-1.5 pb-1.5 pt-6"
                    style={{ background: 'linear-gradient(transparent, rgba(0,0,0,.72))' }}
                  >
                    <Avatar name={g.author} side={side} size={1.15} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.72rem] font-semibold leading-tight text-white">
                        {g.author === me ? 'Du' : g.author}
                      </span>
                      <span className="font-mono block text-[0.5rem] uppercase tracking-[0.06em] text-white/70">
                        {agoLabel(latest.createdAt)}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {groups.length === 0 && (
            <p className="font-hand py-10 text-center text-lg" style={{ color: 'var(--dim)' }}>
              Noch keine Storys — sei die erste.
            </p>
          )}

          {error && <p className="text-sm" style={{ color: '#F0B5A5' }}>{error}</p>}

          <p className="font-mono text-[0.6rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
            Sichtbar für alle, mit denen du in irgendeiner Kassette zusammen bist — nicht nur für die
            gerade eingelegte Runde. Verschwindet nach 24 Stunden von selbst.
          </p>
        </div>
      )}
    </Sheet>
  );
}

/** Grobe Zeitangabe fuer die Kachel — Storys leben ohnehin nur 24 Stunden. */
function agoLabel(createdAt: number): string {
  const min = Math.floor((Date.now() - createdAt) / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  return `vor ${Math.floor(min / 60)} Std.`;
}
