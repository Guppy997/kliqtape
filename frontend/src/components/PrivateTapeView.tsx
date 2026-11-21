import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addPrivateItem,
  deletePrivateItem,
  deletePrivateTape,
  fetchPrivateItems,
  mediaUrl,
  NOTE_STYLES,
  patchPrivateTape,
  uploadMedia,
  type NoteStyle,
  type PrivateItem,
  type PrivateKind,
  type PrivateTape,
} from '@/lib/api';
import { berlinDateLabel } from '@/lib/berlinDay';
import CameraCapture from './CameraCapture';
import { MiniCassette } from './CassetteDeck';
import DateDividerLabel from './DateDividerLabel';
import KindIcon from './KindIcon';
import MixtapeRecorder from './MixtapeRecorder';
import Sheet from './Sheet';
import TapePlayer from './TapePlayer';
import Zettel, { NOTE_STYLE_LABEL } from './Zettel';

const ADD: { kind: PrivateKind; label: string }[] = [
  { kind: 'photo', label: 'Foto' },
  { kind: 'video', label: 'Clip' },
  { kind: 'text', label: 'Zettel' },
  { kind: 'voice', label: 'O-Ton' },
];

/**
 * Ein eigenes Tape von innen — wie Seite A, nur fuer einen selbst: Abzuege,
 * Zettel, O-Toene, nach Tagen geordnet. Anders als auf Seite A ist die
 * Galerie hier ausdruecklich erlaubt, es geht ums Aufheben von Erinnerungen;
 * Galeriebilder bleiben trotzdem sichtbar als solche markiert.
 */
export default function PrivateTapeView({
  tape,
  me,
  pairIndex,
  onClose,
}: {
  tape: PrivateTape;
  me: string;
  pairIndex: number | undefined;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState<PrivateKind | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(tape.title);
  const [text, setText] = useState('');
  const [noteStyle, setNoteStyle] = useState<NoteStyle>('tape');
  const [error, setError] = useState<string | null>(null);

  const itemsKey = ['privateItems', tape.id, me];
  const { data: items = [], isLoading } = useQuery({
    queryKey: itemsKey,
    queryFn: () => fetchPrivateItems(tape.id, me),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: itemsKey });
    void qc.invalidateQueries({ queryKey: ['privateTapes', me] });
  };

  const rename = useMutation({
    mutationFn: () => patchPrivateTape(tape.id, me, { title: title.trim() }),
    onSuccess: () => {
      setRenaming(false);
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: () => deletePrivateTape(tape.id, me),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['privateTapes', me] });
      onClose();
    },
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => deletePrivateItem(tape.id, itemId, me),
    onSuccess: refresh,
  });

  async function add(item: Parameters<typeof addPrivateItem>[2]) {
    setError(null);
    try {
      await addPrivateItem(tape.id, me, item);
      setAdding(null);
      setText('');
      setNoteStyle('tape');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Einkleben fehlgeschlagen');
    }
  }

  async function addMedia(
    kind: PrivateKind,
    blob: Blob,
    ms: number | undefined,
    caption: string,
    source: 'camera' | 'upload',
  ) {
    const mediaId = await uploadMedia(blob, ms);
    await add({ kind, body: caption, mediaId, source });
  }

  // Nach Berliner Kalendertag gruppiert, wie die Tapes auf Seite A.
  const days = useMemo(() => {
    const out: { label: string; items: PrivateItem[] }[] = [];
    for (const item of items) {
      const label = berlinDateLabel(item.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
  }, [items]);

  return (
    <>
      <Sheet open onClose={onClose} variant="full" title="Eigenes Tape">
        <div className="flex flex-col gap-5 pb-24">
          <div className="flex items-center gap-3">
            <span className="shrink-0 [zoom:1.5]">
              <MiniCassette id={tape.id} pairIndex={pairIndex} active={false} side="a" label={tape.title} />
            </span>
            <div className="min-w-0 flex-1">
              {renaming ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (title.trim()) rename.mutate();
                  }}
                >
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => (title.trim() && title.trim() !== tape.title ? rename.mutate() : setRenaming(false))}
                    maxLength={40}
                    aria-label="Titel"
                    className="w-full rounded-lg px-2 py-1 text-lg heading outline-none"
                    style={{ background: 'var(--card)', border: '1px solid var(--accent)', color: 'var(--ink)' }}
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  className="block w-full truncate text-left text-lg heading"
                  style={{ color: 'var(--ink)' }}
                  aria-label={`Titel „${tape.title}“ ändern`}
                >
                  {tape.title}
                </button>
              )}
              <span className="block text-2xs" style={{ color: 'var(--dim)' }}>
                Nur für dich · {items.length === 1 ? '1 Eintrag' : `${items.length} Einträge`}
              </span>
            </div>
          </div>

          {isLoading ? (
            <p className="py-6 text-center text-xs" style={{ color: 'var(--dim)' }}>
              Lädt …
            </p>
          ) : items.length === 0 ? (
            <p
              className="rounded-xl px-3 py-6 text-center text-sm leading-relaxed"
              style={{ color: 'var(--dim)', border: '1px dashed var(--line)' }}
            >
              Noch leer. Kleb unten ein Foto, einen Zettel oder einen O-Ton ein — es sieht niemand außer dir.
            </p>
          ) : (
            days.map((day) => (
              <section key={day.label} className="flex flex-col gap-4">
                <DateDividerLabel label={day.label} />
                {day.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onRemove={() => {
                      if (confirm('Diesen Eintrag aus dem Tape nehmen?')) removeItem.mutate(item.id);
                    }}
                  />
                ))}
              </section>
            ))
          )}

          <button
            type="button"
            onClick={() => {
              if (confirm(`„${tape.title}“ mit allem darauf wegwerfen? Das lässt sich nicht rückgängig machen.`))
                remove.mutate();
            }}
            disabled={remove.isPending}
            className="mt-4 self-center text-2xs disabled:opacity-50"
            style={{ color: 'var(--danger)' }}
          >
            Tape wegwerfen
          </button>
        </div>

        {/* Einkleben: klebt unten wie die Leiste, damit es auch bei einem
            vollen Tape in Reichweite bleibt. */}
        <div
          className="glass fixed inset-x-0 bottom-0 z-10 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          <div className="mx-auto grid max-w-xl grid-cols-4 gap-2">
            {ADD.map((a) => (
              <button
                key={a.kind}
                type="button"
                onClick={() => {
                  setError(null);
                  setAdding(a.kind);
                }}
                className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl py-1.5"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--accent)' }}
              >
                <KindIcon kind={a.kind} />
                <span className="text-2xs" style={{ color: 'var(--ink)' }}>
                  {a.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Sheet>

      <Sheet
        open={adding === 'photo' || adding === 'video'}
        onClose={() => setAdding(null)}
        variant="full"
        title={adding === 'video' ? 'Clip einkleben' : 'Foto einkleben'}
      >
        {(adding === 'photo' || adding === 'video') && (
          <CameraCapture
            mode={adding}
            allowUpload
            onCancel={() => setAdding(null)}
            onSend={(blob, ms, caption, source) => addMedia(adding, blob, ms, caption, source)}
          />
        )}
        {error && (
          <p className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
      </Sheet>

      <Sheet open={adding === 'voice'} onClose={() => setAdding(null)} variant="full" title="O-Ton einkleben">
        {adding === 'voice' && (
          <MixtapeRecorder
            onCancel={() => setAdding(null)}
            onSend={(blob, ms, caption) => addMedia('voice', blob, ms, caption, 'camera')}
          />
        )}
        {error && (
          <p className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
      </Sheet>

      <Sheet open={adding === 'text'} onClose={() => setAdding(null)} variant="full" title="Zettel einkleben">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg py-3" style={{ background: 'rgba(0,0,0,.18)' }}>
            <Zettel id="privat-vorschau" style={noteStyle} text={text.trim() || 'Was willst du behalten?'} />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={500}
            autoFocus
            placeholder="Was willst du behalten?"
            className="resize-none rounded-lg p-3 text-[0.95rem] outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />
          {/* Sechs Arten: zwei Reihen zu je drei, wie beim Zettel in der Runde. */}
          <div className="grid grid-cols-3 gap-1.5">
            {NOTE_STYLES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setNoteStyle(s)}
                aria-pressed={noteStyle === s}
                className="flex-1 rounded-lg py-2 text-2xs"
                style={{
                  background: noteStyle === s ? 'rgba(0,0,0,.18)' : 'transparent',
                  border: `1px solid ${noteStyle === s ? 'var(--accent)' : 'var(--line)'}`,
                  color: noteStyle === s ? 'var(--accent)' : 'var(--dim)',
                }}
              >
                {NOTE_STYLE_LABEL[s]}
              </button>
            ))}
          </div>
          {error && (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => add({ kind: 'text', body: text.trim(), noteStyle })}
            disabled={!text.trim()}
            className="rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            Einkleben
          </button>
        </div>
      </Sheet>
    </>
  );
}

function ItemCard({ item, onRemove }: { item: PrivateItem; onRemove: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      {item.kind === 'text' && <Zettel id={item.id} style={item.noteStyle} text={item.body} />}

      {item.kind === 'photo' && item.mediaId && item.source !== 'upload' && (
        <div className="print mx-auto w-full max-w-[17rem]">
          <img src={mediaUrl(item.mediaId)} alt={item.body || 'Foto'} loading="lazy" />
          {item.body && <p className="font-hand mt-2 text-center text-[0.95rem] text-[#3B3226]">{item.body}</p>}
        </div>
      )}

      {/* Aus der Galerie: kein Abzug, sondern ein schlichtes Bild mit Hinweis —
          derselbe sichtbare Unterschied wie bei Beitraegen (PostCard.tsx). */}
      {item.kind === 'photo' && item.mediaId && item.source === 'upload' && (
        <figure className="mx-auto w-full max-w-[17rem]">
          <img
            src={mediaUrl(item.mediaId)}
            alt={item.body || 'Bild'}
            loading="lazy"
            className="w-full rounded-lg"
            style={{ border: '1px solid var(--line)' }}
          />
          <figcaption className="mt-1.5 flex items-baseline gap-2">
            <span className="shrink-0 text-2xs" style={{ color: 'var(--dim)' }}>
              Galerie
            </span>
            {item.body && (
              <span className="min-w-0 flex-1 text-meta" style={{ color: 'var(--dim)' }}>
                {item.body}
              </span>
            )}
          </figcaption>
        </figure>
      )}

      {item.kind === 'video' && item.mediaId && (
        <div className="print mx-auto w-full max-w-[17rem]">
          <video src={mediaUrl(item.mediaId)} controls playsInline preload="metadata" />
          {item.body && <p className="font-hand mt-2 text-center text-[0.95rem] text-[#3B3226]">{item.body}</p>}
        </div>
      )}

      {item.kind === 'voice' && item.mediaId && (
        <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,.2)', border: '1px solid var(--line)' }}>
          {item.body && (
            <p className="mb-2 text-sm" style={{ color: 'var(--ink)' }}>
              {item.body}
            </p>
          )}
          <TapePlayer src={mediaUrl(item.mediaId)} hintMs={item.durationMs} />
        </div>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="hit self-center text-2xs"
        style={{ color: 'var(--dim)' }}
        aria-label="Eintrag aus dem Tape nehmen"
      >
        Entfernen
      </button>
    </div>
  );
}
