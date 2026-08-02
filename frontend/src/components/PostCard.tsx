import { mediaUrl, type FeedItem } from '@/lib/api';
import { useApp } from '@/store/appStore';
import Avatar from './Avatar';
import TapePlayer from './TapePlayer';

interface Props {
  item: FeedItem;
  onReact: (id: string) => void;
  onDelete: (id: string) => void;
  onHotline: (item: FeedItem) => void;
}

export default function PostCard({ item, onReact, onDelete, onHotline }: Props) {
  const me = useApp((s) => s.me);
  const side = item.side;
  const mine = item.author === me;
  const iReacted = item.reactors.includes(me);

  return (
    <article
      className="rise rounded-xl p-3"
      style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      <div className="flex items-center gap-2">
        <Avatar name={item.author} side={side} />
        <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {item.author}
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
            <img src={mediaUrl(item.mediaId)} alt={item.body || 'Foto'} loading="lazy" />
            {item.body && (
              <p className="font-hand mt-2 text-center text-[0.95rem] text-[#3B3226]">{item.body}</p>
            )}
          </div>
        )}

        {item.kind === 'video' && item.mediaId && (
          <div className="print mx-auto w-full max-w-[17rem]">
            <video src={mediaUrl(item.mediaId)} controls playsInline preload="metadata" />
            {item.body && (
              <p className="font-hand mt-2 text-center text-[0.95rem] text-[#3B3226]">{item.body}</p>
            )}
          </div>
        )}

        {item.kind === 'mixtape' && item.mediaId && (
          <div
            className="rounded-lg p-3"
            style={{ background: 'rgba(0,0,0,.2)', border: '1px solid var(--line)' }}
          >
            {item.body && (
              <p className="font-hand mb-2 text-[1rem]" style={{ color: 'var(--ink)' }}>
                {item.body}
              </p>
            )}
            <TapePlayer src={mediaUrl(item.mediaId)} hintMs={item.durationMs} />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1.5">
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

        {/* Hot Line: direkt und privat an den Autor. Bei eigenen Beitraegen
            sinnlos, deshalb ausgeblendet. */}
        {!mine && (
          <button
            type="button"
            onClick={() => onHotline(item)}
            className="font-mono flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.62rem] uppercase tracking-widest"
            style={{ border: '1px solid var(--line)', color: 'var(--dim)' }}
          >
            <span className="size-1.5 rounded-full" style={{ background: '#E0402A' }} />
            Hot Line
          </button>
        )}

        {/* Reaktionen sind Gesichter, keine Zahl. Bei dieser Gruppengroesse ist
            "wer" die interessantere Information als "wie viele". */}
        <div className="flex items-center gap-1">
          {item.reactors.map((r) => (
            <Avatar key={r} name={r} side={side} size={1.15} />
          ))}
        </div>
        {item.reactors.length > 0 && (
          <span className="font-mono truncate text-[0.6rem]" style={{ color: 'var(--dim)' }}>
            {item.reactors.join(', ')}
          </span>
        )}
      </div>
    </article>
  );
}
