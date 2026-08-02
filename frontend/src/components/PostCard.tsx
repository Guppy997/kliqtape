import { useState } from 'react';
import { mediaUrl, KIND_LABEL, type FeedItem } from '@/lib/api';
import { useApp } from '@/store/appStore';
import Avatar from './Avatar';
import Sheet from './Sheet';
import TapePlayer from './TapePlayer';
import TapeView from './TapeView';

interface Props {
  item: FeedItem;
  onReact: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function PostCard({ item, onReact, onDelete }: Props) {
  const me = useApp((s) => s.me);
  const [openTape, setOpenTape] = useState(false);
  const side = item.side;
  const mine = item.author === me;
  const iReacted = item.reactors.includes(me);

  return (
    <article className="rise rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
      <div className="flex items-center gap-2">
        <Avatar name={item.author} side={side} />
        <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {item.author}
        </span>
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.1em]" style={{ color: 'var(--dim)' }}>
          {KIND_LABEL[item.kind]}
        </span>
        {/* Track-Nummer statt Zeitstempel: Position auf dem Band, kein Zeitdruck. */}
        <span className="font-mono ml-auto text-[0.66rem] tabular-nums" style={{ color: 'var(--dim)' }}>
          {item.track}
        </span>
        {mine && (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            aria-label="Löschen"
            className="ml-1 px-1 text-xs"
            style={{ color: 'var(--dim)' }}
          >
            ✕
          </button>
        )}
      </div>

      <div className="mt-2.5 flex flex-col gap-2.5">
        {item.kind === 'text' && (
          <p className="text-[0.92rem] leading-relaxed" style={{ color: 'var(--ink)' }}>
            {item.body}
          </p>
        )}

        {item.kind === 'photo' && item.mediaId && (
          <div className="print mx-auto w-full max-w-[17rem]">
            <img src={mediaUrl(item.mediaId)} alt={item.body || 'Schnappschuss'} loading="lazy" />
            {item.body && <p className="font-hand mt-2 text-center text-[0.95rem] text-[#3B3226]">{item.body}</p>}
          </div>
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
              <p className="font-hand mb-2 text-[1rem]" style={{ color: 'var(--ink)' }}>
                {item.body}
              </p>
            )}
            <TapePlayer src={mediaUrl(item.mediaId)} hintMs={item.durationMs} />
          </div>
        )}

        {item.kind === 'tape' && item.tape && (
          <button
            type="button"
            onClick={() => setOpenTape(true)}
            className="flex items-center gap-3 rounded-lg p-2.5 text-left"
            style={{ background: 'rgba(0,0,0,.2)', border: '1px solid var(--line)' }}
          >
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md" style={{ background: '#D8CFBB' }}>
              {item.tape.coverId ? (
                <img src={mediaUrl(item.tape.coverId)} alt="" className="size-full object-cover" />
              ) : (
                <span className="font-hand text-xl text-[#3B3226]">♪</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-hand block truncate text-[1.05rem]" style={{ color: 'var(--ink)' }}>
                {item.tape.title}
              </span>
              <span className="font-mono block text-[0.6rem] uppercase tracking-[0.1em]" style={{ color: 'var(--dim)' }}>
                {item.tape.trackCount} Titel · Tracklist ansehen
              </span>
            </span>
            <span className="font-mono shrink-0 text-[0.6rem]" style={{ color: 'var(--accent)' }}>
              ▸
            </span>
          </button>
        )}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <button
          type="button"
          onClick={() => onReact(item.id)}
          className="font-mono rounded-full px-2.5 py-1 text-[0.62rem] uppercase tracking-widest transition-colors"
          style={{
            border: '1px solid var(--line)',
            background: iReacted ? 'var(--accent)' : 'transparent',
            color: iReacted ? '#17130E' : 'var(--dim)',
          }}
        >
          {iReacted ? 'dabei' : 'da war ich'}
        </button>

        {/* Reaktionen sind Gesichter, keine Zahl. Bei dieser Gruppengroesse ist
            "wer" die interessantere Information als "wie viele". */}
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {item.reactors.map((r) => (
            <Avatar key={r} name={r} side={side} size={1.15} />
          ))}
          {item.reactors.length > 0 && (
            <span className="font-mono truncate text-[0.6rem]" style={{ color: 'var(--dim)' }}>
              {item.reactors.join(', ')}
            </span>
          )}
        </div>

      </div>

      <Sheet open={openTape} onClose={() => setOpenTape(false)} title={`Mixtape von ${item.author}`}>
        {openTape && item.tapeId && <TapeView id={item.tapeId} />}
      </Sheet>
    </article>
  );
}

