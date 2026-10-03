import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { berlinDayKey, berlinDayLabel, berlinTime, previewFor, useCassetteChat, useHotlineChat, type ChatMessage } from '@/lib/chat';
import { fetchMixtapes, mediaUrl, HOTLINE_MAX } from '@/lib/api';
import { baseMime, pickAudioMime } from '@/lib/tapeAudio';
import { useApp } from '@/store/appStore';
import { useQuote } from '@/store/quoteStore';
import Avatar from './Avatar';
import CameraCapture from './CameraCapture';
import DateDividerLabel from './DateDividerLabel';
import EmojiPicker from './EmojiPicker';
import EmojiText from './EmojiText';
import Sheet from './Sheet';
import TapePlayer from './TapePlayer';

/** Sony-Sports-Walkman-Gelb, minimal Richtung Orange gezogen. Warm, leuchtend,
 *  klar vom roten REC unterscheidbar. */
export const HOTLINE_AMBER = '#F6AB1F';

const CASSETTE_MAX = 500;

interface Props {
  variant: 'hotline' | 'cassette';
  /** hotline */
  threadId?: string;
  startWith?: string;
  onStarted?: (threadId: string) => void;
  /** cassette */
  cassetteId?: string;
}

/**
 * Ein Chat-Verlauf — geteilt zwischen Hot Line (1:1, privat) und Seite B
 * (Gruppe, alle Mitglieder der Kassette). Beide Hooks werden unbedingt
 * aufgerufen (React-Regel), aber nur die zur variant passende Abfrage ist
 * ueberhaupt aktiv (siehe lib/chat.ts) — kein doppelter Netzwerk-Traffic.
 *
 * Hot Line bleibt privat und bekommt in dieser Ansicht keinen eigenen
 * Kopf-Bereich mit Absender-Namen — "nicht ich" heisst dort immer dieselbe
 * eine Person. Auf Seite B kann "nicht ich" jede und jeder sein, deshalb
 * dort ein Namensschild ueber der Bubble, sobald der Absender wechselt.
 */
export default function ChatThread({ variant, threadId, startWith, onStarted, cassetteId }: Props) {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  // Nur auf Seite B relevant (siehe PostCard.tsx, "Reagieren") — Hot Line
  // liest den Store zwar mit, zeigt/nutzt ihn aber nie.
  const pendingQuote = useQuote((s) => s.pending);
  const setPendingQuote = useQuote((s) => s.setPending);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // "+"-Menue: Foto/Video/Mixtape senden, ohne den REC-Umweg — dieselben
  // Anhangsarten wie am grossen Aufnahme-Knopf, nur direkt im Gespraech.
  const [attachStep, setAttachStep] = useState<null | 'choose' | 'photo' | 'video' | 'tape'>(null);
  const [attachBusy, setAttachBusy] = useState(false);

  // O-Ton inline im Composer statt eines eigenen Vollbild-Umwegs (frueher
  // Sheet + MixtapeRecorder) — der ist fuer den bedaechtigen "Mixtape bauen"-
  // Fall gedacht, im laufenden Chat soll eine Sprachnachricht sich so schnell
  // anfuehlen wie Text: antippen, sprechen, antippen zum Senden.
  const [recState, setRecState] = useState<'idle' | 'recording'>('idle');
  const [recElapsed, setRecElapsed] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);

  // Auf Seite B soll das Eingabefeld immer sichtbar am unteren Rand kleben —
  // `position: sticky` reichte dafuer nicht (haengt vom scrollenden Vorfahren
  // ab, hier scrollt aber die ganze Seite). Stattdessen `fixed` direkt am
  // unteren Rand — Seite B zeigt in diesem Modus keine BottomBar mehr
  // (siehe App.tsx), das Eingabefeld hier ist der einzige fixe Balken.
  // Eigene Hoehe per ResizeObserver als CSS-Variable, damit `App.tsx` den
  // Inhalt darunter freihalten kann.
  useEffect(() => {
    if (variant !== 'cassette') return;
    if (!composerRef.current) return;
    const el = composerRef.current;
    const set = () => document.documentElement.style.setProperty('--chatcomposer-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--chatcomposer-h');
    };
  }, [variant]);

  const hotline = useHotlineChat(variant === 'hotline' ? threadId : undefined, startWith, me, onStarted);
  const cassette = useCassetteChat(variant === 'cassette' ? cassetteId : undefined, me);
  const chat = variant === 'hotline' ? hotline : cassette;

  const maxLen = variant === 'hotline' ? HOTLINE_MAX : CASSETTE_MAX;
  const accent = variant === 'hotline' ? HOTLINE_AMBER : 'var(--accent)';
  const canSend = variant === 'hotline' ? Boolean(chat.other) : true;

  // Nur eigene, versiegelte Tapes lassen sich teilen — ein Entwurf ist privat.
  const { data: tapes = [] } = useQuery({
    queryKey: ['mixtapes', me],
    queryFn: () => fetchMixtapes(me),
    enabled: attachStep === 'tape',
  });
  const shareableTapes = tapes.filter((t) => t.from === me && t.sealed);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.messages.length]);

  function insertEmoji(e: string) {
    setText((t) => (t + e).slice(0, maxLen));
  }

  async function sendAttachment(kind: 'photo' | 'video', blob: Blob, ms: number | undefined, caption: string, source: 'camera' | 'upload') {
    setAttachBusy(true);
    setError(null);
    try {
      await chat.sendMedia(kind, blob, ms, caption, source);
      setAttachStep(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
    } finally {
      setAttachBusy(false);
    }
  }

  async function sendMixtape(tapeId: string) {
    setAttachBusy(true);
    setError(null);
    try {
      await chat.shareMixtape(tapeId);
      setAttachStep(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
    } finally {
      setAttachBusy(false);
    }
  }

  async function submit() {
    const body = text.trim();
    if (!body) return;
    setError(null);
    try {
      await chat.send(body, variant === 'cassette' ? (pendingQuote ?? undefined) : undefined);
      setText('');
      setPendingQuote(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
    }
  }

  // Laufanzeige waehrend der Aufnahme, harte Kappung bei 90 Sekunden (gleiches
  // Limit wie beim Mixtape-Rekorder).
  useEffect(() => {
    if (recState !== 'recording') return;
    const id = window.setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setRecElapsed(ms);
      if (ms >= 90_000) stopRecording();
    }, 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recState]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function startRecording() {
    if (!chat.sendVoice) return;
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Mikrofon nicht verfügbar. Browser geben es nur über https oder localhost frei.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const mime = pickAudioMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const type = baseMime(rec.mimeType || mime || 'audio/webm');
        const blob = new Blob(chunksRef.current, { type });
        const ms = Date.now() - startedAtRef.current;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setRecState('idle');
        if (ms < 400) return; // versehentlicher Tipp, zu kurz zum Senden
        void chat.sendVoice?.(blob, ms, '').catch((err) => {
          setError(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
        });
      };

      rec.start(250);
      recRef.current = rec;
      startedAtRef.current = Date.now();
      setRecElapsed(0);
      setRecState('recording');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aufnahme nicht möglich');
    }
  }

  /** Aufnahme beenden und senden. */
  function stopRecording() {
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    recRef.current = null;
  }

  /** Aufnahme beenden und verwerfen — onstop soll dann nichts mehr senden. */
  function cancelRecording() {
    const rec = recRef.current;
    if (rec) {
      rec.onstop = null;
      if (rec.state !== 'inactive') rec.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    setRecState('idle');
  }

  const messageList = (
    <div className={variant === 'hotline' ? 'flex flex-1 flex-col gap-1 overflow-y-auto py-3' : 'flex flex-col gap-1 py-3'}>
      {chat.messages.length === 0 ? (
        <p className="font-hand py-10 text-center text-lg" style={{ color: 'var(--dim)' }}>
          {variant === 'hotline' ? (chat.other ? `Noch nichts mit ${chat.other}.` : 'Wähl jemanden.') : 'Noch nichts geschrieben.'}
        </p>
      ) : (
        chat.messages.map((m, i) => {
          const mine = m.from === me;
          const prev = chat.messages[i - 1];
          const showDivider = !prev || berlinDayKey(prev.createdAt) !== berlinDayKey(m.createdAt);
          const showSender = variant === 'cassette' && !mine && (showDivider || prev?.from !== m.from);
          return (
            <div key={m.id}>
              {showDivider && <DateDividerLabel label={berlinDayLabel(m.createdAt)} />}
              <div className={`mt-1 flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                {variant === 'cassette' && !mine && <Avatar name={m.from} side={side} size={1.5} />}
                <div className="flex max-w-[76%] flex-col gap-0.5">
                  {showSender && (
                    <span className="font-mono px-1 text-[0.56rem] uppercase tracking-[0.06em]" style={{ color: 'var(--dim)' }}>
                      {m.from}
                    </span>
                  )}
                  <div
                    className="rounded-xl px-3 py-2"
                    style={{
                      background: mine ? accent : 'var(--card)',
                      color: mine ? '#20180A' : 'var(--ink)',
                      border: mine ? 'none' : '1px solid var(--line)',
                      opacity: m.pending ? 0.6 : 1,
                    }}
                  >
                    {m.quotedPost && (
                      <div
                        className="mb-1.5 rounded-md px-2 py-1"
                        style={{ background: 'rgba(0,0,0,.18)', borderLeft: '2px solid currentColor' }}
                      >
                        <span className="block truncate text-[0.68rem] opacity-80">
                          {m.quotedPost.author}: {previewFor(m.quotedPost.kind, m.quotedPost.body)}
                        </span>
                      </div>
                    )}
                    <ChatBubbleContent msg={m} />
                  </div>
                  <span
                    className="font-mono px-1 text-[0.5rem] tabular-nums"
                    style={{ color: 'var(--dim)', alignSelf: mine ? 'flex-end' : 'flex-start' }}
                  >
                    {m.pending ? 'wird gesendet …' : berlinTime(m.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );

  const composerInner = (
    <div className="flex flex-col gap-1.5 pt-2" style={variant === 'hotline' ? { borderTop: '1px solid var(--line)' } : undefined}>
      {error && <p className="text-xs" style={{ color: '#F0B5A5' }}>{error}</p>}

      {/* Angehefteter Bezug auf einen Seite-A-Beitrag (siehe PostCard.tsx,
          "Reagieren") — bis zum Absenden jederzeit ueber das Kreuz wieder
          entfernbar, genau wie eine Antwort-Vorschau in jeder anderen
          Chat-App. */}
      {variant === 'cassette' && pendingQuote && (
        <div
          className="flex items-center gap-2 rounded-lg py-1.5 pl-2.5 pr-1.5"
          style={{ background: 'var(--card)', borderLeft: '3px solid var(--accent)' }}
        >
          <span className="min-w-0 flex-1 truncate text-[0.76rem]" style={{ color: 'var(--dim)' }}>
            An <span style={{ color: 'var(--ink)' }}>{pendingQuote.author}</span>: {previewFor(pendingQuote.kind, pendingQuote.body)}
          </span>
          <button
            type="button"
            onClick={() => setPendingQuote(null)}
            aria-label="Bezug entfernen"
            className="shrink-0 px-1.5 text-xs"
            style={{ color: 'var(--dim)' }}
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        {recState === 'recording' ? (
          <>
            {/* Aufnahme laeuft — ersetzt Schreibfeld+Senden, genau wie bei
                jeder anderen Chat-App, statt ein eigenes Sheet aufzumachen. */}
            <div
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2.5"
              style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
            >
              <span className="blink size-2.5 shrink-0 rounded-full" style={{ background: '#C7452A' }} />
              <span className="font-mono tabular-nums text-sm" style={{ color: 'var(--ink)' }}>
                {String(Math.floor(recElapsed / 60000)).padStart(2, '0')}:
                {String(Math.floor((recElapsed % 60000) / 1000)).padStart(2, '0')}
              </span>
              <span className="font-mono truncate text-[0.6rem] uppercase tracking-wide" style={{ color: 'var(--dim)' }}>
                nimmt auf …
              </span>
            </div>
            <button
              type="button"
              aria-label="Aufnahme verwerfen"
              title="Verwerfen"
              onClick={cancelRecording}
              className="grid size-11 shrink-0 place-items-center rounded-lg text-base"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--dim)' }}
            >
              ✕
            </button>
            <button
              type="button"
              aria-label="Aufnahme senden"
              title="Senden"
              onClick={stopRecording}
              className="grid size-11 shrink-0 place-items-center rounded-lg"
              style={{ background: accent, color: variant === 'hotline' ? '#20180A' : '#17130E' }}
            >
              <svg width="14" height="11" viewBox="0 0 14 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 6l3.5 3.5L13 1" />
              </svg>
            </button>
          </>
        ) : (
          <>
            {/* Emoji links, Textfeld, dann "+" fuer Anhaenge und zuletzt
                Mikro/Senden — an Signal/WhatsApp angelehnte Anordnung statt
                der bisherigen Text-Schaltflaeche. */}
            <button
              type="button"
              aria-label="Emoji"
              title="Emoji"
              onClick={() => setEmojiOpen(true)}
              className="grid size-9 shrink-0 place-items-center self-end rounded-full text-lg transition-transform active:scale-90"
              style={{ color: 'var(--dim)' }}
            >
              <svg width="19" height="19" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="9" r="7" />
                <path d="M6 10.5c.8 1 1.9 1.5 3 1.5s2.2-.5 3-1.5" />
                <circle cx="6.6" cy="7" r="0.7" fill="currentColor" stroke="none" />
                <circle cx="11.4" cy="7" r="0.7" fill="currentColor" stroke="none" />
              </svg>
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, maxLen))}
              rows={1}
              placeholder={variant === 'hotline' ? (chat.other ? `An ${chat.other} …` : 'Erst jemanden wählen …') : 'Schreib was …'}
              disabled={!canSend}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              className="min-w-0 flex-1 resize-none rounded-lg p-2.5 text-[0.9rem] outline-none disabled:opacity-50"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            />
            <button
              type="button"
              aria-label="Anhang: Foto, Video oder Mixtape"
              title="Anhang"
              disabled={!canSend}
              onClick={() => setAttachStep('choose')}
              className="grid size-11 shrink-0 place-items-center rounded-lg transition-transform active:scale-95 disabled:opacity-40"
              style={{
                background: 'color-mix(in srgb, var(--deck, var(--card)) 80%, black 20%)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                <path d="M8 1.5v13M1.5 8h13" />
              </svg>
            </button>
            {/* Mikro/Senden morpht wie bei jeder anderen Chat-App: leer =
                aufnehmen, getippt = senden — statt beide dauerhaft
                nebeneinander zu zeigen. Eigene Optik statt des REC-Knopfs:
                der ist warmes Kassetten-Braun+Rot, hier soll es das
                durchscheinende Plastik-Leuchten der Kassette sein (--accent
                = shell.glow auf Seite B), sonst wirkt der Knopf wie aus
                einer anderen App importiert. */}
            {text.trim() ? (
              <button
                type="button"
                aria-label="Senden"
                title="Senden"
                disabled={!canSend || chat.sending}
                onClick={() => void submit()}
                className="grid size-11 shrink-0 place-items-center rounded-lg transition-transform active:scale-95 disabled:opacity-40"
                style={{ background: accent, color: variant === 'hotline' ? '#20180A' : '#17130E' }}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7.5 12.5V2.5M3.5 6.5l4-4 4 4" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                aria-label="O-Ton aufnehmen"
                title="O-Ton aufnehmen"
                disabled={!canSend}
                onClick={() => void startRecording()}
                className="grid size-11 shrink-0 place-items-center rounded-lg transition-transform active:scale-95 disabled:opacity-40"
                style={{
                  background: 'color-mix(in srgb, var(--deck, var(--card)) 80%, black 20%)',
                  border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)',
                }}
              >
                <svg width="13" height="15" viewBox="0 0 14 16" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4.5" y="1" width="5" height="8" rx="2.5" />
                  <path d="M1.5 7.5a5.5 5.5 0 0 0 11 0" />
                  <path d="M7 13v2" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
      {recState !== 'recording' && (
        <p className="font-mono text-right text-[0.58rem]" style={{ color: maxLen - text.length < 30 ? accent : 'var(--dim)' }}>
          {maxLen - text.length}
        </p>
      )}
    </div>
  );

  // Seite B zeigt keine BottomBar mehr (siehe App.tsx) — dieses Feld ist dort
  // der einzige fixe Balken, direkt am unteren Rand, voller Fokus aufs
  // Schreiben statt geteilt mit Laufwerk-Tasten. Aeussere Leiste volle Breite
  // fuers Blatt-Hintergrund, innerer Block dieselbe max-w-xl-Spalte wie der
  // restliche Inhalt (wie vorher bei BottomBar).
  //
  // Hintergrund bewusst dunkler als --screen (die restliche Seite) und auf
  // --deck (= shell.inner, das satte Innenplastik der aktuellen Kassette) —
  // sonst verschwimmt die Leiste mit dem Bildschirm dahinter, statt als
  // eigenes Bauteil des Geraets zu wirken.
  const composer =
    variant === 'cassette' ? (
      <div
        ref={composerRef}
        className="fixed inset-x-0 bottom-0 z-[15] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        style={{
          background: 'color-mix(in srgb, var(--deck, var(--screen)) 92%, black 8%)',
          borderTop: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
          boxShadow: '0 -0.6rem 1.2rem rgba(0,0,0,.35)',
        }}
      >
        <div className="mx-auto max-w-xl">{composerInner}</div>
      </div>
    ) : (
      composerInner
    );

  // Emoji-Picker und Anhang-Menue gehoeren zu beiden Varianten gleichermassen
  // — Hot Line kann seit der Erweiterung auf Foto/Video/O-Ton/Mixtape genau
  // dasselbe wie Seite B.
  const sheets = (
    <>
      <EmojiPicker open={emojiOpen} onClose={() => setEmojiOpen(false)} onPick={insertEmoji} />

      <Sheet open={attachStep === 'choose'} onClose={() => setAttachStep(null)} title="Anhang">
        <div className="flex flex-col gap-2">
          {(
            [
              { step: 'photo', label: 'Foto', hint: 'nur jetzt, kein Upload' },
              { step: 'video', label: 'Video', hint: 'max. 10 Sekunden' },
              { step: 'tape', label: 'Mixtape', hint: 'eines deiner versiegelten teilen' },
            ] as const
          ).map((c) => (
            <button
              key={c.step}
              type="button"
              onClick={() => setAttachStep(c.step)}
              className="flex items-center justify-between rounded-xl px-3.5 py-3 text-left"
              style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
            >
              <span className="font-disp text-sm font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--ink)' }}>
                {c.label}
              </span>
              <span className="font-mono text-[0.6rem]" style={{ color: 'var(--dim)' }}>
                {c.hint}
              </span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={attachStep === 'photo' || attachStep === 'video'}
        onClose={() => setAttachStep(null)}
        variant="full"
        title={attachStep === 'photo' ? 'Foto' : 'Video'}
      >
        {(attachStep === 'photo' || attachStep === 'video') && (
          <CameraCapture
            mode={attachStep}
            allowUpload={attachStep === 'photo'}
            onCancel={() => setAttachStep('choose')}
            onSend={(blob, ms, caption, source) => sendAttachment(attachStep, blob, ms, caption, source)}
          />
        )}
      </Sheet>

      <Sheet open={attachStep === 'tape'} onClose={() => setAttachStep(null)} variant="full" title="Mixtape teilen">
        <div className="flex flex-col gap-3">
          {shareableTapes.length === 0 ? (
            <p className="font-hand py-8 text-center text-lg" style={{ color: 'var(--dim)' }}>
              Noch kein versiegeltes Mixtape.
            </p>
          ) : (
            shareableTapes.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={attachBusy}
                onClick={() => void sendMixtape(t.id)}
                className="flex items-center gap-3 rounded-xl p-2.5 text-left disabled:opacity-50"
                style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
              >
                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md" style={{ background: '#D8CFBB' }}>
                  {t.coverId ? (
                    <img src={mediaUrl(t.coverId)} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="font-hand text-lg text-[#3B3226]">♪</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-hand block truncate text-[1.02rem]" style={{ color: 'var(--ink)' }}>
                    {t.title}
                  </span>
                  <span className="font-mono block text-[0.6rem] uppercase tracking-[0.1em]" style={{ color: 'var(--dim)' }}>
                    ursprünglich für {t.to} · {t.trackCount}/12
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </Sheet>
    </>
  );

  if (variant === 'hotline') {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid var(--line)' }}>
          <Avatar name={chat.other} side={side} size={2.2} />
          <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
            {chat.other || 'Neue Leitung'}
          </p>
        </div>
        {messageList}
        {composer}
        {sheets}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {messageList}
      {composer}
      {sheets}
    </div>
  );
}

function ChatBubbleContent({ msg }: { msg: ChatMessage }) {
  switch (msg.kind) {
    case 'text':
      return <p className="text-[0.9rem] leading-relaxed"><EmojiText text={msg.body} /></p>;

    case 'photo':
      return msg.mediaId ? (
        <div className="flex flex-col gap-1.5">
          <img src={mediaUrl(msg.mediaId)} alt={msg.body || 'Foto'} loading="lazy" className="max-w-full rounded-md" />
          {msg.body && <p className="text-[0.85rem]"><EmojiText text={msg.body} /></p>}
        </div>
      ) : null;

    case 'video':
      return msg.mediaId ? (
        <div className="flex flex-col gap-1.5">
          <video src={mediaUrl(msg.mediaId)} controls playsInline preload="metadata" className="max-w-full rounded-md" />
          {msg.body && <p className="text-[0.85rem]"><EmojiText text={msg.body} /></p>}
        </div>
      ) : null;

    case 'voice':
      return msg.mediaId ? (
        <div className="flex flex-col gap-1.5">
          {msg.body && <p className="font-hand text-[0.95rem]"><EmojiText text={msg.body} /></p>}
          <TapePlayer src={mediaUrl(msg.mediaId)} hintMs={msg.durationMs} />
        </div>
      ) : null;

    case 'tape':
      return msg.tape ? (
        <div className="flex items-center gap-2">
          <span
            className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md"
            style={{ background: '#D8CFBB' }}
          >
            {msg.tape.coverId ? (
              <img src={mediaUrl(msg.tape.coverId)} alt="" className="size-full object-cover" />
            ) : (
              <span className="font-hand text-[#3B3226]">♪</span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-hand block truncate text-[0.95rem]">{msg.tape.title}</span>
            <span className="font-mono block text-[0.55rem] uppercase tracking-[0.08em] opacity-70">
              {msg.tape.trackCount} Titel
            </span>
          </span>
        </div>
      ) : null;

    default:
      return null;
  }
}
