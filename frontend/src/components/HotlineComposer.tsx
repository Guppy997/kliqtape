import { useState } from 'react';
import { sendHotline, HOTLINE_MAX, type FeedItem } from '@/lib/api';
import { useApp } from '@/store/appStore';
import Avatar from './Avatar';
import Sheet from './Sheet';

interface Props {
  item: FeedItem | null;
  onClose: () => void;
}

const KIND_LABEL: Record<string, string> = {
  text: 'Notiz',
  photo: 'Foto',
  video: 'Video',
  mixtape: 'Mixtape',
};

/**
 * Hot Line — eine direkte Antwort an genau eine Person, zu genau einem Beitrag.
 *
 * Bewusst kein Chat: kein Verlauf, keine Threads, nach 24 Stunden weg. Der
 * Bezug zum Beitrag ist Pflicht, damit daraus nicht versehentlich ein
 * Messenger wird — man ruft immer WEGEN etwas an.
 */
export default function HotlineComposer({ item, onClose }: Props) {
  const me = useApp((s) => s.me);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function call() {
    if (!item || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendHotline({ postId: item.id, from: me, to: item.author, body: text.trim() });
      setDone(true);
      setText('');
      window.setTimeout(() => {
        setDone(false);
        onClose();
      }, 1100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  const left = HOTLINE_MAX - text.length;

  return (
    <Sheet open={item != null} onClose={onClose} title="Hot Line">
      {item && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Avatar name={item.author} side={item.side} size={2.6} />
            <div className="min-w-0">
              <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
                {item.author}
              </p>
              <p className="font-mono truncate text-[0.62rem] uppercase tracking-[0.1em]" style={{ color: 'var(--dim)' }}>
                wegen {item.track} · {KIND_LABEL[item.kind] ?? item.kind}
                {item.body ? ` · ${item.body}` : ''}
              </p>
            </div>
          </div>

          {done ? (
            <p
              className="font-hand rounded-lg px-3 py-6 text-center text-lg"
              style={{ background: 'var(--card)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
            >
              Durchgestellt.
            </p>
          ) : (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, HOTLINE_MAX))}
                rows={3}
                autoFocus
                placeholder={`Kurz an ${item.author} …`}
                className="resize-none rounded-lg p-3 text-[0.95rem] outline-none"
                style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
              />

              <div className="font-mono flex items-center justify-between text-[0.62rem]" style={{ color: 'var(--dim)' }}>
                <span>verfällt nach 24 Stunden · kein Verlauf</span>
                <span className="tabular-nums" style={{ color: left < 30 ? 'var(--accent)' : 'var(--dim)' }}>
                  {left}
                </span>
              </div>

              {error && <p className="text-sm" style={{ color: '#F0B5A5' }}>{error}</p>}

              <button
                type="button"
                onClick={call}
                disabled={busy || !text.trim()}
                className="font-disp rounded-lg px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#17130E' }}
              >
                {busy ? 'Verbinde …' : 'Durchstellen'}
              </button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
