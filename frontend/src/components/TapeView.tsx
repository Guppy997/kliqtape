import { useQuery } from '@tanstack/react-query';
import { fetchMixtape, mediaUrl, platformOf } from '@/lib/api';
import { useApp } from '@/store/appStore';

interface Props {
  id: string;
}

/** Ein versiegeltes Tape, so wie es der Beschenkte sieht: J-Card mit Tracklist. */
export default function TapeView({ id }: Props) {
  const me = useApp((s) => s.me);
  const { data: tape, isError, error } = useQuery({
    queryKey: ['mixtape', id],
    queryFn: () => fetchMixtape(id, me),
  });

  if (isError) {
    return <p className="text-sm" style={{ color: '#F0B5A5' }}>{(error as Error).message}</p>;
  }
  if (!tape) {
    return <p className="font-mono text-xs" style={{ color: 'var(--dim)' }}>Tape wird geholt …</p>;
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
        <p className="font-hand mt-2 px-1 text-center text-[1.15rem] leading-tight text-[#3B3226]">
          {tape.title}
        </p>
        <p className="font-mono mt-1 text-center text-[0.58rem] uppercase tracking-[0.1em] text-[#3B3226]/60">
          {mine ? `für ${tape.to}` : `von ${tape.from}`}
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
              <span className="font-mono w-5 shrink-0 text-[0.68rem] tabular-nums" style={{ color: 'var(--accent)' }}>
                {String(t.position).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9rem]" style={{ color: 'var(--ink)' }}>{t.title}</span>
                <span className="font-mono block truncate text-[0.6rem]" style={{ color: 'var(--dim)' }}>
                  {t.artist}
                  {t.artist && plat ? ' · ' : ''}
                  {plat}
                </span>
              </span>
              {t.url && (
                <span className="font-mono shrink-0 text-[0.6rem] uppercase" style={{ color: 'var(--accent)' }}>
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

      <p className="font-mono text-[0.6rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
        Die Titel öffnen sich in dem Dienst, aus dem der Link stammt. Kliqtape speichert keine
        Musik und ist an keine Plattform gebunden.
      </p>
    </div>
  );
}
