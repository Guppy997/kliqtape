import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPrivateTape, fetchPrivateTapes, mediaUrl, type PrivateTape } from '@/lib/api';
import { berlinDateLabel } from '@/lib/berlinDay';
import { lookFor, PAIR_COUNT } from '@/lib/cassetteLook';
import { MiniCassette } from './CassetteDeck';
import PrivateTapeView from './PrivateTapeView';
import Sheet from './Sheet';

/**
 * "Meine Tapes" im Profil-Regal: eigene Baender ohne Runde, wie ein
 * Tagebuch — fuer Erinnerungen, die man fuer sich behalten will. Niemand
 * sonst sieht sie; der Server antwortet Fremden mit 404.
 */
export default function PrivateTapes({ me, active }: { me: string; active: boolean }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [look, setLook] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: tapes = [], isLoading } = useQuery({
    queryKey: ['privateTapes', me],
    queryFn: () => fetchPrivateTapes(me),
    enabled: active && Boolean(me),
  });
  const opened = tapes.find((t) => t.id === openId) ?? null;

  const create = useMutation({
    mutationFn: () => createPrivateTape(me, title.trim(), look),
    onSuccess: (tape) => {
      void qc.invalidateQueries({ queryKey: ['privateTapes', me] });
      setCreating(false);
      setTitle('');
      setLook(null);
      setOpenId(tape.id);
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen'),
  });

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {isLoading && (
          <p className="py-3 text-center text-xs" style={{ color: 'var(--dim)' }}>
            Lädt …
          </p>
        )}
        {tapes.map((t) => (
          <TapeRow key={t.id} tape={t} onOpen={() => setOpenId(t.id)} />
        ))}
        <button
          type="button"
          onClick={() => {
            setError(null);
            setCreating(true);
          }}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm"
          style={{ border: '1px dashed var(--line)', color: 'var(--accent)' }}
        >
          <span aria-hidden="true">+</span> Neues Tape
        </button>
        {tapes.length === 0 && !isLoading && (
          <p className="px-1 text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
            Ein Band nur für dich — für Fotos, Zettel und O-Töne, die du behalten willst.
          </p>
        )}
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} variant="full" title="Neues Tape">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              Wie soll das Tape heißen?
            </p>
            <p className="mt-1 text-2xs leading-relaxed" style={{ color: 'var(--dim)' }}>
              Nur du siehst es. Der Name steht auf dem Etikett und ist jederzeit änderbar.
            </p>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={40}
            autoFocus
            placeholder="z. B. Sommer 2026"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim() && !create.isPending) create.mutate();
            }}
            className="w-full rounded-lg px-3 py-3 text-base outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />

          <div className="flex flex-col gap-2">
            <p className="text-2xs" style={{ color: 'var(--dim)' }}>
              Bandsorte {look == null && '· ohne Auswahl automatisch'}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: PAIR_COUNT }, (_, idx) => {
                const chosen = look === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLook(chosen ? null : idx)}
                    aria-pressed={chosen}
                    aria-label={lookFor('neu', idx).type.name}
                    className="flex flex-col items-center gap-1.5 rounded-xl p-2"
                    style={{
                      background: 'var(--card)',
                      border: `1px solid ${chosen ? 'var(--accent)' : 'var(--line)'}`,
                    }}
                  >
                    <MiniCassette id="neu" pairIndex={idx} active={false} side="a" label={title.trim() || undefined} />
                    <span className="text-center text-2xs" style={{ color: 'var(--dim)' }}>
                      {lookFor('neu', idx).type.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={!title.trim() || create.isPending}
            onClick={() => create.mutate()}
            className="w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            Ins Regal stellen
          </button>
        </div>
      </Sheet>

      {opened && (
        <PrivateTapeView
          tape={opened}
          me={me}
          pairIndex={opened.colorIndex ?? undefined}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}

function TapeRow({ tape, onOpen }: { tape: PrivateTape; onOpen: () => void }) {
  const count = tape.itemCount === 1 ? '1 Eintrag' : `${tape.itemCount} Einträge`;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-2.5 rounded-xl p-2.5 text-left"
      style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      <MiniCassette id={tape.id} pairIndex={tape.colorIndex ?? undefined} active side="a" label={tape.title} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium" style={{ color: 'var(--ink)' }}>
          {tape.title}
        </span>
        <span className="block truncate text-2xs" style={{ color: 'var(--dim)' }}>
          {count}
          {tape.lastAt != null && (
            <>
              {' · zuletzt '}
              <span className="tabular-nums">{berlinDateLabel(tape.lastAt)}</span>
            </>
          )}
        </span>
      </span>
      {tape.coverMediaId && (
        <img
          src={mediaUrl(tape.coverMediaId)}
          alt=""
          loading="lazy"
          className="size-10 shrink-0 rounded-md object-cover"
          style={{ border: '1px solid var(--line)' }}
        />
      )}
    </button>
  );
}
