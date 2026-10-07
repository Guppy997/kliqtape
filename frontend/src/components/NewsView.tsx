import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createNewsPost,
  deleteNewsPost,
  fetchNews,
  mediaUrl,
  updateProjectFunding,
  uploadMedia,
  type NewsKind,
} from '@/lib/api';
import { berlinDateLabel, berlinTimeLabel } from '@/lib/berlinDay';
import { useApp } from '@/store/appStore';
import CameraCapture from './CameraCapture';
import Lockup from './Lockup';
import Sheet from './Sheet';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = null | 'choose' | NewsKind;

/**
 * Kliqtape-Kanal — News/Insights von den Betreiber:innen, dauerhaft und fuer
 * alle sichtbar. `canPost` kommt vom Server (ADMIN_NAME, siehe backend/src/routes/news.ts) —
 * fast alle sehen hier nur die Liste, kein Erstellen-Knopf.
 */
export default function NewsView({ open, onClose }: Props) {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingFunding, setEditingFunding] = useState(false);
  const [fundingBalance, setFundingBalance] = useState('');
  const [fundingNote, setFundingNote] = useState('');
  const [fundingBusy, setFundingBusy] = useState(false);
  const [fundingError, setFundingError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['news', me],
    queryFn: () => fetchNews(me),
    enabled: open,
  });
  const posts = data?.posts ?? [];
  const canPost = data?.canPost ?? false;
  const funding = data?.funding ?? { balance: '', note: '', updatedAt: 0 };

  const refresh = () => void qc.invalidateQueries({ queryKey: ['news', me] });

  function openFundingEditor() {
    setFundingBalance(funding.balance);
    setFundingNote(funding.note);
    setFundingError(null);
    setEditingFunding(true);
  }

  async function saveFunding() {
    setFundingBusy(true);
    setFundingError(null);
    try {
      await updateProjectFunding({ me, balance: fundingBalance.trim(), note: fundingNote.trim() });
      setEditingFunding(false);
      refresh();
    } catch (err) {
      setFundingError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setFundingBusy(false);
    }
  }

  async function sendText() {
    setBusy(true);
    setError(null);
    try {
      await createNewsPost({ author: me, kind: 'text', body: text.trim() });
      setText('');
      setStep(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  async function sendMedia(blob: Blob, durationMs: number | undefined) {
    if (step !== 'photo' && step !== 'video') return;
    const mediaId = await uploadMedia(blob, durationMs);
    await createNewsPost({ author: me, kind: step, mediaId });
    setStep(null);
    refresh();
  }

  async function remove(id: string) {
    await deleteNewsPost(id, me);
    refresh();
  }

  return (
    <Sheet open={open} onClose={onClose} variant="full" title="Kliqtape">
      <div className="flex flex-col gap-4">
        <div
          className="flex items-center gap-3 rounded-xl p-3"
          style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
        >
          <Lockup size="1.6rem" />
          <span className="flex-1 text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
            News, Insights und was sonst noch am Projekt passiert.
          </span>
          {canPost && (
            <button
              type="button"
              onClick={() => setStep('choose')}
              aria-label="Beitrag erstellen"
              className="hit grid size-9 shrink-0 place-items-center rounded-full transition-transform active:scale-95"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M7 1v12M1 7h12" />
              </svg>
            </button>
          )}
        </div>

        {/* Foerderstand: Freitext-Betrag + Notiz, von ADMIN_NAME gepflegt
            (siehe PUT /api/news/funding). Noch ohne klickbaren Spenden-Link —
            kommt, sobald eine Plattform steht. Solange nichts eingetragen
            ist, zeigt die Karte den alten, allgemeinen Hinweistext. */}
        <div
          className="rounded-xl p-3"
          style={{
            background: 'color-mix(in srgb, var(--accent) 12%, var(--card))',
            border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--line))',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="block text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              Unterstütze unser Projekt
            </span>
            {canPost && (
              <button
                type="button"
                onClick={openFundingEditor}
                className="shrink-0 text-2xs"
                style={{ color: 'var(--accent)' }}
              >
                Bearbeiten
              </button>
            )}
          </div>

          {funding.balance || funding.note ? (
            <>
              {funding.balance && (
                <span className="mt-1.5 block text-xl font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                  {funding.balance}
                </span>
              )}
              {funding.note && (
                <span className="mt-1 block text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
                  {funding.note}
                </span>
              )}
              {funding.updatedAt > 0 && (
                <span className="mt-1.5 block text-2xs" style={{ color: 'var(--dim)' }}>
                  Stand: {berlinDateLabel(funding.updatedAt)}
                </span>
              )}
            </>
          ) : (
            <span className="mt-1 block text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
              Kliqtape kommt ohne Werbung und ohne Tracking aus — der Spenden-Link folgt hier in Kürze.
            </span>
          )}
        </div>

        {isLoading && (
          <p className="py-6 text-center text-xs" style={{ color: 'var(--dim)' }}>
            Lädt …
          </p>
        )}

        {!isLoading && posts.length === 0 && (
          <p className="py-10 text-center text-sm" style={{ color: 'var(--dim)' }}>
            Noch nichts gepostet.
          </p>
        )}

        {posts.map((p) => (
          <article
            key={p.id}
            className="rounded-xl p-3"
            style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
          >
            <div className="flex items-center gap-2">
              <Lockup size="0.85rem" />
              <span className="font-mono ml-auto shrink-0 text-2xs tabular-nums" style={{ color: 'var(--dim)' }}>
                {berlinDateLabel(p.createdAt)} · {berlinTimeLabel(p.createdAt)}
              </span>
              {canPost && (
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  aria-label="Löschen"
                  className="shrink-0 px-1 text-xs"
                  style={{ color: 'var(--dim)' }}
                >
                  ✕
                </button>
              )}
            </div>

            {p.body && (
              <p className="mt-2 text-sm" style={{ color: 'var(--ink)' }}>
                {p.body}
              </p>
            )}
            {p.kind === 'photo' && p.mediaId && (
              <img src={mediaUrl(p.mediaId)} alt="" className="mt-2 w-full rounded-lg" />
            )}
            {p.kind === 'video' && p.mediaId && (
              <video
                src={mediaUrl(p.mediaId)}
                controls
                playsInline
                preload="metadata"
                className="mt-2 w-full rounded-lg"
              />
            )}
          </article>
        ))}
      </div>

      <Sheet open={step === 'choose'} onClose={() => setStep(null)} variant="full" title="Beitrag erstellen">
        <div className="flex flex-col gap-2">
          {[
            { kind: 'text' as const, label: 'Text' },
            { kind: 'photo' as const, label: 'Foto' },
            { kind: 'video' as const, label: 'Video' },
          ].map((c) => (
            <button
              key={c.kind}
              type="button"
              onClick={() => setStep(c.kind)}
              className="rounded-xl p-3 text-left"
              style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
            >
              <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {c.label}
              </span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={step === 'text'} onClose={() => setStep(null)} variant="full" title="Text">
        <div className="flex flex-col gap-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={1000}
            autoFocus
            placeholder="Was gibt's Neues?"
            className="resize-none rounded-lg p-3 text-[0.95rem] outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />
          {error && (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={sendText}
            disabled={busy || !text.trim()}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            Posten
          </button>
        </div>
      </Sheet>

      <Sheet
        open={step === 'photo' || step === 'video'}
        onClose={() => setStep(null)}
        variant="full"
        title={step === 'photo' ? 'Foto' : 'Video'}
      >
        {(step === 'photo' || step === 'video') && (
          <CameraCapture
            mode={step}
            allowUpload={step === 'photo'}
            withCaption={false}
            sendLabel="Posten"
            onCancel={() => setStep('choose')}
            onSend={sendMedia}
          />
        )}
      </Sheet>

      <Sheet open={editingFunding} onClose={() => setEditingFunding(false)} variant="full" title="Förderstand">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-2xs" style={{ color: 'var(--dim)' }}>
              Aktueller Kontostand
            </span>
            <input
              value={fundingBalance}
              onChange={(e) => setFundingBalance(e.target.value)}
              maxLength={40}
              autoFocus
              placeholder="z. B. 128,40 €"
              className="rounded-lg px-3 py-2.5 text-[0.95rem] outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-2xs" style={{ color: 'var(--dim)' }}>
              Wofür / Ziel (optional)
            </span>
            <textarea
              value={fundingNote}
              onChange={(e) => setFundingNote(e.target.value)}
              rows={4}
              maxLength={300}
              placeholder="z. B. Ziel: mehr Speicherplatz für Fotos & Videos (250 €)"
              className="resize-none rounded-lg p-3 text-sm outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            />
          </label>
          {fundingError && (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {fundingError}
            </p>
          )}
          <button
            type="button"
            onClick={saveFunding}
            disabled={fundingBusy}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            Speichern
          </button>
        </div>
      </Sheet>
    </Sheet>
  );
}
