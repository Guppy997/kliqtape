import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addTrack,
  deleteMixtape,
  fetchMixtape,
  mediaUrl,
  patchMixtape,
  platformOf,
  removeTrack,
  sealMixtape,
  uploadMedia,
  MAX_TRACKS,
} from '@/lib/api';
import { useApp } from '@/store/appStore';
import CameraCapture from './CameraCapture';

interface Props {
  id: string;
  onClose: () => void;
}

/**
 * Editor fuer ein noch nicht versiegeltes Tape.
 *
 * Der Empfaenger sieht davon nichts, solange es ein Entwurf ist — man baut
 * ueber Tage daran und uebergibt es dann. Genau das ist der Unterschied zu
 * "teilen": es kostet Muehe, und die Muehe ist das Geschenk.
 */
export default function TapeEditor({ id, onClose }: Props) {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();

  const [shooting, setShooting] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tTitle, setTTitle] = useState('');
  const [tArtist, setTArtist] = useState('');
  const [tUrl, setTUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: tape } = useQuery({ queryKey: ['mixtape', id], queryFn: () => fetchMixtape(id, me) });

  const refresh = (next?: unknown) => {
    if (next) qc.setQueryData(['mixtape', id], next);
    void qc.invalidateQueries({ queryKey: ['mixtapes', me] });
  };
  const fail = (e: Error) => setError(e.message);

  const save = useMutation({
    mutationFn: (p: { title?: string; note?: string; coverId?: string | null }) => patchMixtape(id, p),
    onSuccess: refresh,
    onError: fail,
  });
  const add = useMutation({ mutationFn: addTrack.bind(null, id), onSuccess: refresh, onError: fail });
  const drop = useMutation({ mutationFn: removeTrack.bind(null, id), onSuccess: refresh, onError: fail });
  const seal = useMutation({
    mutationFn: () => sealMixtape(id),
    onSuccess: (t) => {
      refresh(t);
      onClose();
    },
    onError: fail,
  });
  const scrap = useMutation({
    mutationFn: () => deleteMixtape(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mixtapes', me] });
      onClose();
    },
    onError: fail,
  });

  if (!tape) return <p className="font-mono text-xs" style={{ color: 'var(--dim)' }}>Tape wird geholt …</p>;

  if (shooting) {
    return (
      <CameraCapture
        mode="photo"
        withCaption={false}
        allowUpload
        title="Cover · aufnehmen oder aus der Galerie"
        sendLabel="Als Cover"
        onCancel={() => setShooting(false)}
        onSend={async (blob) => {
          const coverId = await uploadMedia(blob);
          await save.mutateAsync({ coverId });
          setShooting(false);
        }}
      />
    );
  }

  const full = tape.tracks.length >= MAX_TRACKS;

  return (
    <div className="flex flex-col gap-5">
      <p className="font-mono text-[0.64rem] uppercase tracking-[0.12em]" style={{ color: 'var(--dim)' }}>
        Entwurf für {tape.to} · {tape.tracks.length}/{MAX_TRACKS} Titel
      </p>

      {/* --- J-Card: Cover, Titel, Widmung --- */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setShooting(true)}
          className="grid aspect-square w-24 shrink-0 place-items-center overflow-hidden rounded-md"
          style={{ background: 'var(--card)', border: '1px dashed var(--line)' }}
        >
          {tape.coverId ? (
            <img src={mediaUrl(tape.coverId)} alt="Cover" className="size-full object-cover" />
          ) : (
            <span className="font-mono px-2 text-center text-[0.58rem] uppercase leading-tight" style={{ color: 'var(--dim)' }}>
              Cover<br />wählen
            </span>
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            value={title ?? tape.title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title != null && title !== tape.title && save.mutate({ title })}
            maxLength={60}
            placeholder="Titel des Tapes"
            className="font-hand rounded-md px-2.5 py-2 text-[1.05rem] outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />
          <textarea
            value={note ?? tape.note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note != null && note !== tape.note && save.mutate({ note })}
            rows={3}
            maxLength={300}
            placeholder="Widmung …"
            className="font-hand resize-none rounded-md px-2.5 py-2 text-[0.95rem] outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />
        </div>
      </div>

      {/* --- Tracklist --- */}
      <div className="flex flex-col gap-1.5">
        {tape.tracks.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2"
            style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
          >
            <span className="font-mono w-5 shrink-0 text-[0.68rem] tabular-nums" style={{ color: 'var(--accent)' }}>
              {String(t.position).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.88rem]" style={{ color: 'var(--ink)' }}>{t.title}</p>
              <p className="font-mono truncate text-[0.6rem]" style={{ color: 'var(--dim)' }}>
                {t.artist}
                {t.artist && platformOf(t.url) ? ' · ' : ''}
                {platformOf(t.url)}
              </p>
            </div>
            <button type="button" onClick={() => drop.mutate(t.id)} aria-label="Titel entfernen" className="px-1 text-xs" style={{ color: 'var(--dim)' }}>
              ✕
            </button>
          </div>
        ))}

        {tape.tracks.length === 0 && (
          <p className="font-hand py-4 text-center text-base" style={{ color: 'var(--dim)' }}>
            Noch kein Titel drauf.
          </p>
        )}
      </div>

      {/* --- Titel hinzufügen --- */}
      {full ? (
        <p className="font-mono rounded-lg px-3 py-2 text-[0.64rem]" style={{ background: 'var(--card)', color: 'var(--accent)' }}>
          Das Band ist voll. {MAX_TRACKS} Titel — mehr passt nicht drauf.
        </p>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl p-3" style={{ background: 'rgba(0,0,0,.18)', border: '1px solid var(--line)' }}>
          <input
            value={tTitle}
            onChange={(e) => setTTitle(e.target.value)}
            maxLength={90}
            placeholder="Titel"
            className="rounded-md px-2.5 py-2 text-[0.9rem] outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />
          <input
            value={tArtist}
            onChange={(e) => setTArtist(e.target.value)}
            maxLength={90}
            placeholder="Künstler"
            className="rounded-md px-2.5 py-2 text-[0.9rem] outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />
          <input
            value={tUrl}
            onChange={(e) => setTUrl(e.target.value)}
            inputMode="url"
            maxLength={500}
            placeholder="Link (Spotify, Apple Music, YouTube …)"
            className="font-mono rounded-md px-2.5 py-2 text-[0.75rem] outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />
          <button
            type="button"
            disabled={!tTitle.trim() || add.isPending}
            onClick={() => {
              add.mutate(
                { title: tTitle.trim(), artist: tArtist.trim(), url: tUrl.trim() },
                {
                  onSuccess: () => {
                    setTTitle('');
                    setTArtist('');
                    setTUrl('');
                  },
                },
              );
            }}
            className="rounded-lg px-3 py-2.5 text-sm font-semibold disabled:opacity-40"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          >
            Aufs Band
          </button>
        </div>
      )}

      {error && <p className="text-sm" style={{ color: '#F0B5A5' }}>{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => confirm('Entwurf wegwerfen?') && scrap.mutate()}
          className="rounded-lg px-4 py-3 text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--line)', color: '#F0B5A5' }}
        >
          Wegwerfen
        </button>
        <button
          type="button"
          disabled={tape.tracks.length === 0 || !(title ?? tape.title).trim() || seal.isPending}
          onClick={() => confirm(`Tape versiegeln und ${tape.to} überreichen? Danach lässt es sich nicht mehr ändern.`) && seal.mutate()}
          className="font-disp flex-1 rounded-lg px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#17130E' }}
        >
          Versiegeln & überreichen
        </button>
      </div>
    </div>
  );
}
