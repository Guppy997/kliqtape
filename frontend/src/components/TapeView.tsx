import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMixtape, mediaUrl, platformOf, recipientOf, saveBlob, type Mixtape } from '@/lib/api';
import { renderMixtapeCard } from '@/lib/mixtapeCard';
import { useApp } from '@/store/appStore';

interface Props {
  id: string;
}

/** Ein versiegeltes Tape, so wie es der Beschenkte sieht: J-Card mit Tracklist. */
export default function TapeView({ id }: Props) {
  const me = useApp((s) => s.me);
  const {
    data: tape,
    isError,
    error,
  } = useQuery({
    queryKey: ['mixtape', id],
    queryFn: () => fetchMixtape(id, me),
  });

  if (isError) {
    return (
      <p className="text-sm" style={{ color: 'var(--danger)' }}>
        {(error as Error).message}
      </p>
    );
  }
  if (!tape) {
    return (
      <p className="text-xs" style={{ color: 'var(--dim)' }}>
        Tape wird geholt …
      </p>
    );
  }

  const mine = tape.from === me;

  return (
    <div className="flex flex-col gap-5">
      {/* J-Card */}
      <div className="print mx-auto w-full max-w-[19rem]">
        {tape.coverId ? (
          <img src={mediaUrl(tape.coverId)} alt="" />
        ) : (
          <div className="grid aspect-square place-items-center" style={{ background: '#D8CFBB' }}>
            <span className="font-hand text-2xl text-[#3B3226]">{tape.title}</span>
          </div>
        )}
        <p className="font-hand mt-2 px-1 text-center text-[1.15rem] leading-tight text-[#3B3226]">{tape.title}</p>
        <p className="mt-1 text-center text-2xs text-[#3B3226]/60">
          {mine ? `für ${recipientOf(tape)}` : `von ${tape.from}`}
        </p>
      </div>

      {tape.note && (
        <p
          className="font-hand rounded-lg px-4 py-3 text-[1rem] leading-relaxed"
          style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        >
          {tape.note}
        </p>
      )}

      {/* Tracklist */}
      <ol className="flex flex-col gap-1.5">
        {tape.tracks.map((t) => {
          const plat = platformOf(t.url);
          const row = (
            <>
              <span className="font-mono w-5 shrink-0 text-2xs tabular-nums" style={{ color: 'var(--accent)' }}>
                {String(t.position).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm" style={{ color: 'var(--ink)' }}>
                  {t.title}
                </span>
                <span className="block truncate text-2xs" style={{ color: 'var(--dim)' }}>
                  {t.artist}
                  {t.artist && plat ? ' · ' : ''}
                  {plat}
                </span>
              </span>
              {t.url && (
                <span className="shrink-0 text-2xs" style={{ color: 'var(--accent)' }}>
                  öffnen ↗
                </span>
              )}
            </>
          );

          return (
            <li key={t.id}>
              {t.url ? (
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
                >
                  {row}
                </a>
              ) : (
                <div
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
                >
                  {row}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {tape.sealed && <SaveCard tape={tape} />}

      <p className="text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
        Die Titel öffnen sich in dem Dienst, aus dem der Link stammt. Kliqtape speichert keine Musik und ist an keine
        Plattform gebunden.
      </p>
    </div>
  );
}

/** Mixtape als Bild fuer die Galerie. Auf dem Handy ueber das Teilen-Menue
 *  (dort heisst es "Bild sichern"), sonst als PNG-Download. */
function SaveCard({ tape }: { tape: Mixtape }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function save() {
    setState('busy');
    try {
      const blob = await renderMixtapeCard(tape);
      const name = `mixtape-${(tape.title || 'ohne-titel').replace(/[^\p{L}\p{N}]+/gu, '-')}.png`;
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: tape.title });
        } catch (e) {
          // Abbrechen im Teilen-Menue ist kein Fehler.
          if ((e as Error).name !== 'AbortError') throw e;
        }
      } else {
        saveBlob(blob, name);
      }
      setState('done');
    } catch {
      setState('error');
    }
  }

  return (
    <button
      type="button"
      onClick={() => void save()}
      disabled={state === 'busy'}
      className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm disabled:opacity-60"
      style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="12" height="12" rx="1.5" />
        <circle cx="6" cy="6" r="1.3" />
        <path d="M2.5 12l3.5-3.5 2.5 2.5 2-2 3 3" />
      </svg>
      {state === 'busy'
        ? 'Karte wird gezeichnet …'
        : state === 'done'
          ? 'Gespeichert'
          : state === 'error'
            ? 'Ging nicht — nochmal?'
            : 'Als Bild speichern'}
    </button>
  );
}
