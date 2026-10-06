import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPost,
  fetchFeed,
  fetchHotlineThread,
  markThreadHeard,
  sendHotlineMessage,
  uploadMedia,
  type FeedItem,
  type HotlineMessage,
  type HotlineThreadDetail,
  type Kind,
} from './api';
import type { QuotedPreview } from '@/store/quoteStore';

/**
 * Gemeinsame Nachrichtenform fuer Hot Line (1:1) und Seite B (Gruppe) — die
 * ChatThread-Komponente rendert nur noch das, unabhaengig davon, ob die
 * Daten aus posts oder hotline_messages kommen.
 */
export interface ChatMessage {
  id: string;
  from: string;
  createdAt: number;
  kind: Kind;
  body: string;
  mediaId: string | null;
  durationMs: number | null;
  tapeId: string | null;
  tape: { title: string; coverId: string | null; trackCount: number } | null;
  source: 'camera' | 'upload' | 'film' | 'imposter' | null;
  /** Nur Seite B — Bruecke zu einem Seite-A-Beitrag, auf den diese Nachricht
   *  eingeht. Bei Hot Line immer undefined, das Konzept gibt es dort nicht. */
  quotedPost?: { id: string; author: string; kind: Kind; body: string; mediaId: string | null } | null;
  /** Optimistisch angehaengt, Server hat noch nicht bestaetigt. */
  pending?: boolean;
}

/** Was ein ChatThread zum Senden braucht — Hot Line und Seite B liefern
 *  beide dieselbe Form, seit Hot Line dieselben Beitragsarten wie posts kann. */
export interface ChatController {
  messages: ChatMessage[];
  other: string;
  /** `quote` nur auf Seite B relevant — Hot Line ignoriert es einfach. */
  send: (body: string, quote?: QuotedPreview) => Promise<void>;
  sendVoice: (blob: Blob, durationMs: number, caption: string) => Promise<void>;
  sendMedia: (
    kind: 'photo' | 'video',
    blob: Blob,
    durationMs: number | undefined,
    caption: string,
    source: 'camera' | 'upload',
  ) => Promise<void>;
  shareMixtape: (tapeId: string) => Promise<void>;
  sending: boolean;
  error: string | null;
}

function fromHotline(m: HotlineMessage): ChatMessage {
  return {
    id: m.id,
    from: m.from,
    createdAt: m.createdAt,
    kind: m.kind,
    body: m.body,
    mediaId: m.mediaId,
    durationMs: m.durationMs,
    tapeId: m.tapeId,
    tape: m.tape,
    source: m.source,
    pending: m.pending,
  };
}

function fromPost(item: FeedItem): ChatMessage {
  return {
    id: item.id,
    from: item.author,
    createdAt: item.created_at,
    kind: item.kind,
    body: item.body,
    mediaId: item.mediaId,
    durationMs: item.durationMs,
    tapeId: item.tapeId,
    tape: item.tape,
    source: item.source,
    quotedPost: item.quotedPost,
    pending: item.pending,
  };
}

/** Kurze, kollisionsarme lokale ID fuer optimistische Eintraege. */
function tempId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Kurzer Vorschau-Text fuer Thread-Listen — Hot Line kann seit der
 *  Medien-Erweiterung dieselben Arten wie posts, "leerer Text" waere sonst
 *  die Vorschau bei Foto/Video/O-Ton/Mixtape. */
export function previewFor(kind: Kind, body: string | null): string {
  switch (kind) {
    case 'photo': return 'Foto';
    case 'video': return 'Video';
    case 'voice': return 'O-Ton';
    case 'tape': return 'Mixtape';
    default: return body ?? '';
  }
}

/** Kalendertag in Europe/Berlin als Vergleichsschluessel — nicht die
 *  Geraetezeitzone, sonst sieht jedes Mitglied den Tageswechsel woanders. */
export function berlinDayKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(ms));
}

export function berlinTime(ms: number): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

/** Grobes "Heute/Gestern/Datum"-Label fuer Tagestrenner im Chat — bewusst
 *  keine exakte Kalendertag-Arithmetik wie in Etappe 4, hier reicht die
 *  Naeherung fuer eine Anzeige. */
export function berlinDayLabel(ms: number): string {
  const key = berlinDayKey(ms);
  if (key === berlinDayKey(Date.now())) return 'Heute';
  if (key === berlinDayKey(Date.now() - 86_400_000)) return 'Gestern';
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(ms));
}

/** 1:1-Leitung. `threadId` undefined haelt die zugehoerige Abfrage inaktiv —
 *  so kann ChatThread beide Hooks unbedingt aufrufen, ohne die jeweils
 *  inaktive Variante Netzwerk verbrauchen zu lassen. */
export function useHotlineChat(
  threadId: string | undefined,
  startWith: string | undefined,
  me: string,
  onStarted?: (id: string) => void,
): ChatController {
  const qc = useQueryClient();
  const [id, setId] = useState<string | null>(threadId ?? null);

  useEffect(() => {
    if (threadId) setId(threadId);
  }, [threadId]);

  const threadKey = ['hotline-thread', id];

  const { data: thread } = useQuery({
    queryKey: threadKey,
    queryFn: () => fetchHotlineThread(id!, me),
    enabled: Boolean(id),
    refetchInterval: 4_000,
  });

  const heard = useMutation({
    mutationFn: () => markThreadHeard(id!, me),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hotline-threads', me] }),
  });

  // Beim Oeffnen als gelesen markieren — nur wenn tatsaechlich was Ungelesenes da ist.
  useEffect(() => {
    if (thread?.messages.some((m) => m.from !== me && !m.heard)) heard.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, thread?.messages.length]);

  const to = () => startWith ?? thread!.other;

  /** Neue Leitungen bekommen ihre ID erst mit der ersten Antwort — danach
   *  wie gewohnt aktualisieren. */
  function handleSent(res: { threadId: string }) {
    if (!id) {
      setId(res.threadId);
      onStarted?.(res.threadId);
    }
    void qc.invalidateQueries({ queryKey: ['hotline-thread', res.threadId] });
    void qc.invalidateQueries({ queryKey: ['hotline-threads', me] });
  }

  const send = useMutation({
    mutationFn: (body: string) => sendHotlineMessage({ from: me, to: to(), body, kind: 'text' }),
    // Optimistisch nur bei einer schon bestehenden Leitung moeglich — die
    // allererste Nachricht einer neuen Leitung hat noch keinen Cache-Eintrag,
    // den man erweitern koennte (die ID entsteht erst durch die Antwort).
    onMutate: async (body: string) => {
      if (!id) return undefined;
      await qc.cancelQueries({ queryKey: threadKey });
      const previous = qc.getQueryData<HotlineThreadDetail>(threadKey);
      if (previous) {
        const optimistic: HotlineMessage = {
          id: tempId(), from: me, body, kind: 'text', mediaId: null, durationMs: null,
          tapeId: null, tape: null, source: null, createdAt: Date.now(), heard: true, pending: true,
        };
        qc.setQueryData<HotlineThreadDetail>(threadKey, { ...previous, messages: [...previous.messages, optimistic] });
      }
      return { previous };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.previous) qc.setQueryData(threadKey, ctx.previous);
    },
    onSuccess: handleSent,
  });

  const sendVoice = useMutation({
    mutationFn: async ({ blob, durationMs, caption }: { blob: Blob; durationMs: number; caption: string }) => {
      const mediaId = await uploadMedia(blob, durationMs);
      return sendHotlineMessage({ from: me, to: to(), kind: 'voice', mediaId, body: caption, source: 'camera' });
    },
    onSuccess: handleSent,
  });

  const sendMedia = useMutation({
    mutationFn: async (input: {
      kind: 'photo' | 'video';
      blob: Blob;
      durationMs: number | undefined;
      caption: string;
      source: 'camera' | 'upload';
    }) => {
      const mediaId = await uploadMedia(input.blob, input.durationMs);
      return sendHotlineMessage({ from: me, to: to(), kind: input.kind, mediaId, body: input.caption, source: input.source });
    },
    onSuccess: handleSent,
  });

  const shareMixtape = useMutation({
    mutationFn: (tapeId: string) => sendHotlineMessage({ from: me, to: to(), kind: 'tape', tapeId }),
    onSuccess: handleSent,
  });

  return {
    messages: (thread?.messages ?? []).map(fromHotline),
    other: thread?.other ?? startWith ?? '',
    send: (body: string) => send.mutateAsync(body).then(() => {}),
    sendVoice: (blob: Blob, durationMs: number, caption: string) =>
      sendVoice.mutateAsync({ blob, durationMs, caption }).then(() => {}),
    sendMedia: (kind, blob, durationMs, caption, source) =>
      sendMedia.mutateAsync({ kind, blob, durationMs, caption, source }).then(() => {}),
    shareMixtape: (tapeId: string) => shareMixtape.mutateAsync(tapeId).then(() => {}),
    sending: send.isPending,
    error: send.error instanceof Error ? send.error.message : null,
  };
}

/** Seite-B-Gruppenchat einer Kassette. `cassetteId` undefined haelt die
 *  Abfrage inaktiv, aus demselben Grund wie bei useHotlineChat. */
export function useCassetteChat(cassetteId: string | undefined, me: string): ChatController {
  const qc = useQueryClient();
  const queryKey = ['feed', cassetteId, 'b', me];

  const { data = [] } = useQuery({
    queryKey,
    queryFn: () => fetchFeed(cassetteId!, 'b', me),
    enabled: Boolean(cassetteId),
    refetchInterval: 4_000,
  });

  const send = useMutation({
    mutationFn: ({ body, quote }: { body: string; quote?: QuotedPreview }) =>
      createPost({ cassetteId: cassetteId!, side: 'b', author: me, kind: 'text', body, quotedPostId: quote?.postId }),
    onMutate: async ({ body, quote }: { body: string; quote?: QuotedPreview }) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<FeedItem[]>(queryKey);
      const optimistic: FeedItem = {
        id: tempId(),
        cassetteId: cassetteId!,
        side: 'b',
        author: me,
        kind: 'text',
        body,
        created_at: Date.now(),
        takenAt: null,
        imposterMark: null,
        mediaId: null,
        durationMs: null,
        source: 'camera',
        tapeId: null,
        tape: null,
        track: '',
        tapeIndex: null,
        tonfetzenCount: 0,
        iSentTonfetzen: false,
        noteStyle: null,
        // Direkt aus der bereits vorhandenen Vorschau gebaut, statt auf die
        // Server-Antwort zu warten — sonst wuerde die Zitat-Karte kurz fehlen.
        quotedPostId: quote?.postId ?? null,
        quotedPost: quote
          ? { id: quote.postId, author: quote.author, kind: quote.kind, body: quote.body, mediaId: quote.mediaId }
          : null,
        pending: true,
      };
      qc.setQueryData<FeedItem[]>(queryKey, (old = []) => [...old, optimistic]);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });

  // O-Ton, Foto, Video, Mixtape direkt aus dem Chat heraus, ohne den Umweg
  // ueber REC — Seite B ist ein laufendes Gespraech, das alles gehoert dort
  // genauso hin wie Text.
  const sendVoice = useMutation({
    mutationFn: async ({ blob, durationMs, caption }: { blob: Blob; durationMs: number; caption: string }) => {
      const mediaId = await uploadMedia(blob, durationMs);
      return createPost({ cassetteId: cassetteId!, side: 'b', author: me, kind: 'voice', mediaId, body: caption, source: 'camera' });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });

  const sendMedia = useMutation({
    mutationFn: async (input: {
      kind: 'photo' | 'video';
      blob: Blob;
      durationMs: number | undefined;
      caption: string;
      source: 'camera' | 'upload';
    }) => {
      const mediaId = await uploadMedia(input.blob, input.durationMs);
      return createPost({
        cassetteId: cassetteId!, side: 'b', author: me, kind: input.kind,
        mediaId, body: input.caption, source: input.source,
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });

  const shareMixtape = useMutation({
    mutationFn: (tapeId: string) =>
      createPost({ cassetteId: cassetteId!, side: 'b', author: me, kind: 'tape', tapeId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });

  return {
    messages: data.map(fromPost),
    other: '',
    send: (body: string, quote?: QuotedPreview) => send.mutateAsync({ body, quote }).then(() => {}),
    sendVoice: (blob: Blob, durationMs: number, caption: string) =>
      sendVoice.mutateAsync({ blob, durationMs, caption }).then(() => {}),
    sendMedia: (kind, blob, durationMs, caption, source) =>
      sendMedia.mutateAsync({ kind, blob, durationMs, caption, source }).then(() => {}),
    shareMixtape: (tapeId: string) => shareMixtape.mutateAsync(tapeId).then(() => {}),
    sending: send.isPending,
    error: send.error instanceof Error ? send.error.message : null,
  };
}
