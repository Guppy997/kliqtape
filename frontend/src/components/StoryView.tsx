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
 * Storys — kassettenuebergreifend, nur Foto/Video, 24h. Eine Reihe aus
 * Avataren (eigene "+"-Kachel zuerst), Antippen einer Person oeffnet einen
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
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#000' }}>
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
          <div className="flex gap-3 overflow-x-auto pb-1">
            {/* Eigene Story hinzufuegen */}
            <button
              type="button"
              onClick={() => setAddMode('photo')}
              className="flex shrink-0 flex-col items-center gap-1.5"
            >
              <span className="relative block">
                <Avatar name={me} side={side} size={3.4} />
                <span
                  className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full text-xs font-bold"
                  style={{ background: 'var(--accent)', color: '#17130E' }}
                >
                  +
                </span>
              </span>
              <span className="font-mono text-[0.58rem] uppercase tracking-[0.08em]" style={{ color: 'var(--dim)' }}>
                Du
              </span>
            </button>

            {groups.map((g, i) => (
              <button
                key={g.author}
                type="button"
                onClick={() => openViewer(i)}
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <span className="block rounded-full" style={{ boxShadow: '0 0 0 2px var(--accent)' }}>
                  <Avatar name={g.author} side={side} size={3.4} />
                </span>
                <span
                  className="font-mono max-w-[3.4rem] truncate text-[0.58rem] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--dim)' }}
                >
                  {g.author}
                </span>
              </button>
            ))}
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
