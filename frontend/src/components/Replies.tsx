import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPost,
  fetchReplies,
  KIND_LABEL,
  mediaUrl,
  type FeedItem,
  type Reply,
  type ReplySummary,
} from '@/lib/api';
import { berlinTime, previewFor, type ChatMessage } from '@/lib/chat';
import { useApp, type Side } from '@/store/appStore';
import Avatar from './Avatar';
import { ChatBubbleContent } from './ChatThread';
import Sheet from './Sheet';

/* ---------------------------------------------------------------------------
 * Antworten auf einen Seite-A-Beitrag. Es gibt dafuer keinen eigenen Speicher:
 * Antworten sind die Nachrichten im Gruppenchat (Seite B), die den Beitrag
 * zitieren. So zerfaellt das Gespraech nicht in zwei Orte, und unter dem
 * Beitrag sieht man trotzdem, dass und was geantwortet wurde.
 * ------------------------------------------------------------------------- */

const REPLY_MAX = 500;

/** Unter dem Beitrag: wer geantwortet hat und die neueste Antwort. Bewusst
 *  ohne Zaehler (Kliqtape zeigt keine Zahlen), nur Gesichter und ein Satz. */
export function RepliesPreview({ replies, side, onOpen }: { replies: ReplySummary; side: Side; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Antworten ansehen, zuletzt von ${replies.latest.author}`}
      className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-transform active:scale-[0.99]"
      style={{ background: 'rgba(0,0,0,.16)' }}
    >
      <span className="flex shrink-0 -space-x-1.5">
        {replies.authors.map((a) => (
          <span key={a} className="block rounded-full" style={{ boxShadow: '0 0 0 2px var(--card)' }}>
            <Avatar name={a} side={side} size={1.3} />
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs" style={{ color: 'var(--dim)' }}>
        <span className="font-semibold" style={{ color: 'var(--ink)' }}>
          {replies.latest.author}
        </span>{' '}
        {previewFor(replies.latest.kind, replies.latest.body)}
      </span>
      {replies.count > 1 && (
        <span className="shrink-0 text-2xs" style={{ color: 'var(--accent)' }}>
          alle ansehen
        </span>
      )}
    </button>
  );
}

const toMessage = (r: Reply): ChatMessage => ({
  id: r.id,
  from: r.author,
  createdAt: r.created_at,
  kind: r.kind,
  body: r.body,
  mediaId: r.mediaId,
  durationMs: r.durationMs,
  tapeId: r.tapeId,
  tape: r.tape,
  source: r.source,
});

/** Alle Antworten zu einem Beitrag, darunter direkt antworten. Die Antwort
 *  geht als Nachricht mit Zitat in den Gruppenchat, wie bisher ueber die
 *  Sprechblase. */
export function RepliesSheet({
  item,
  open,
  onClose,
  onToChat,
}: {
  item: FeedItem;
  open: boolean;
  onClose: () => void;
  /** Fuer O-Ton, Foto oder Mixtape: zum Gruppenchat mit angeheftetem Zitat. */
  onToChat: () => void;
}) {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: replies, isLoading } = useQuery({
    queryKey: ['replies', item.id, me],
    queryFn: () => fetchReplies(item.id, me),
    enabled: open,
  });

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createPost({
        cassetteId: item.cassetteId,
        side: 'b',
        author: me,
        kind: 'text',
        body,
        quotedPostId: item.id,
      });
      setText('');
      // Antworten, Vorschau auf Seite A und Gruppenchat auf Seite B.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['replies', item.id] }),
        qc.invalidateQueries({ queryKey: ['feed', item.cassetteId] }),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  const what = item.source === 'challenge' ? 'Challenge-Beitrag' : KIND_LABEL[item.kind];

  return (
    <Sheet open={open} onClose={onClose} variant="full" title="Antworten">
      <div className="flex flex-col gap-4">
        {/* Worauf geantwortet wird — klein, damit die Antworten im Mittelpunkt stehen. */}
        <div
          className="flex items-center gap-3 rounded-xl p-2.5"
          style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
        >
          {item.mediaId && item.kind === 'photo' ? (
            <img src={mediaUrl(item.mediaId)} alt="" className="size-12 shrink-0 rounded-md object-cover" />
          ) : (
            <Avatar name={item.author} side={item.side} size={2.2} />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-2xs" style={{ color: 'var(--dim)' }}>
              {what} von {item.author}
            </span>
            <span className="block truncate text-sm" style={{ color: 'var(--ink)' }}>
              {previewFor(item.kind, item.body) || what}
            </span>
          </span>
        </div>

        {isLoading ? (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--dim)' }}>
            Antworten werden geladen …
          </p>
        ) : !replies || replies.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--dim)' }}>
            Noch keine Antworten. Schreib die erste.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {replies.map((r) => {
              const mine = r.author === me;
              return (
                <li key={r.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {!mine && <Avatar name={r.author} side="b" size={1.6} />}
                  <div className="flex max-w-[78%] flex-col gap-0.5">
                    {!mine && (
                      <span className="px-1 text-2xs" style={{ color: 'var(--dim)' }}>
                        {r.author}
                      </span>
                    )}
                    <div
                      className="rounded-xl px-3 py-2"
                      style={{
                        background: mine ? 'var(--accent)' : 'var(--card)',
                        color: mine ? 'var(--on-accent)' : 'var(--ink)',
                        border: mine ? 'none' : '1px solid var(--line)',
                      }}
                    >
                      <ChatBubbleContent msg={toMessage(r)} />
                    </div>
                    <span
                      className="num px-1 text-2xs"
                      style={{ color: 'var(--dim)', alignSelf: mine ? 'flex-end' : 'flex-start' }}
                    >
                      {berlinTime(r.created_at)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <textarea
              id={`antwort-${item.id}`}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, REPLY_MAX))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder="Antworten …"
              aria-label={`Auf den Beitrag von ${item.author} antworten`}
              className="min-h-11 flex-1 resize-none rounded-lg px-3 py-2.5 text-[0.95rem] outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!text.trim() || busy}
              className="min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              Senden
            </button>
          </div>
          {error && (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
          <p className="text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
            Antworten stehen auch im Gruppenchat auf Seite B.{' '}
            <button
              type="button"
              onClick={() => {
                onClose();
                onToChat();
              }}
              className="underline underline-offset-2"
              style={{ color: 'var(--ink)' }}
            >
              Mit O-Ton oder Foto antworten
            </button>
          </p>
        </div>
      </div>
    </Sheet>
  );
}
