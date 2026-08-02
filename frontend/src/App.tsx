import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deletePost, fetchFeed, toggleReaction } from '@/lib/api';
import { useApp, SIDE_LABEL, SIDE_HINT } from '@/store/appStore';
import CassetteHeader from '@/components/CassetteHeader';
import PostCard from '@/components/PostCard';
import BottomBar from '@/components/BottomBar';
import Lockup from '@/components/Lockup';
import Settings from '@/components/Settings';
import Shelf from '@/components/Shelf';
import UpdateNotification from '@/components/UpdateNotification';

export default function App() {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);

  // Beim Start immer auf der eingestellten Seite landen, nicht dort, wo man
  // beim letzten Mal aufgehoert hat.
  useEffect(() => {
    const { startSide, setSide } = useApp.getState();
    setSide(startSide);
  }, []);

  // Der Rahmen ist immer derselbe — nur die Seitentokens wechseln. Sonst
  // springt das Layout zwischen Anmeldung und App.
  return (
    <div className={side === 'a' ? 'side-a' : 'side-b'} style={{ background: 'var(--screen)', minHeight: '100%' }}>
      <UpdateNotification />
      {me ? <Deck /> : <NameGate />}
    </div>
  );
}

function Deck() {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const qc = useQueryClient();

  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['feed', side],
    queryFn: () => fetchFeed(side),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['feed', side] });

  const react = useMutation({ mutationFn: (id: string) => toggleReaction(id, me), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => deletePost(id), onSuccess: invalidate });

  return (
    <>
      <CassetteHeader count={data.length} />

      <main className="mx-auto flex max-w-xl flex-col gap-2.5 px-3 pb-32 pt-2">
        {/* Laufzeile wie auf einem J-Card-Einleger: was laeuft gerade, wie viel. */}
        <div
          className="font-mono flex items-center justify-between gap-3 pb-1 text-[0.64rem] uppercase tracking-[0.11em]"
          style={{ color: 'var(--dim)' }}
        >
          <span className="truncate">
            Seite {side.toUpperCase()} · {SIDE_HINT[side]} · {data.length}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <Shelf />
            <Settings />
          </span>
        </div>

        {isLoading && (
          <p className="py-10 text-center font-mono text-xs" style={{ color: 'var(--dim)' }}>
            Band wird eingelegt …
          </p>
        )}

        {isError && (
          <p className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(184,70,44,.18)', color: '#F0B5A5' }}>
            {/* Bandsalat: wenn das Backend nicht antwortet, ist das Band verheddert. */}
            Bandsalat — {(error as Error).message}
          </p>
        )}

        {!isLoading && !isError && data.length === 0 && (
          <div className="py-16 text-center">
            <p className="font-hand text-lg" style={{ color: 'var(--dim)' }}>
              Leeres Band.
            </p>
            <p className="mt-1 font-mono text-[0.66rem] uppercase tracking-widest" style={{ color: 'var(--dim)' }}>
              {SIDE_LABEL[side]}
            </p>
          </div>
        )}

        {data.map((item) => (
          <PostCard
            key={item.id}
            item={item}
            onReact={(id) => react.mutate(id)}
            onDelete={(id) => remove.mutate(id)}
          />
        ))}

        {data.length > 0 && (
          <div className="flex flex-col items-center gap-1.5 pt-8">
            {/* Bandende: der durchsichtige Vorspann. Hier hoert der Feed auf. */}
            <div
              className="h-1 w-24 rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--accent), transparent)' }}
            />
            <p className="font-hand text-base" style={{ color: 'var(--dim)' }}>
              Bandende.
            </p>
            <p className="font-mono text-[0.6rem] uppercase tracking-widest" style={{ color: 'var(--dim)' }}>
              kein Nachschub
            </p>
          </div>
        )}
      </main>

      <BottomBar items={data} onPosted={invalidate} />
    </>
  );
}

function NameGate() {
  const setMe = useApp((s) => s.setMe);
  const [value, setValue] = useState('');

  return (
    <div className="grid min-h-full place-items-center px-6 py-16">
      <form
        className="flex w-full max-w-sm flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) setMe(value);
        }}
      >
        <h1>
          <Lockup size="clamp(3rem, 17vw, 4.6rem)" />
        </h1>
        <p className="text-sm" style={{ color: 'var(--dim)' }}>
          Prototyp ohne Login. Tipp einen Namen ein — er bleibt nur auf diesem Gerät.
        </p>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={40}
          autoFocus
          placeholder="Dein Name"
          className="rounded-lg px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#FFF3EC' }}
        >
          Band einlegen
        </button>
        <p className="font-mono text-[0.62rem] leading-relaxed" style={{ color: 'var(--dim)' }}>
          Achtung: Seite B ist in diesem Prototyp noch NICHT verschlüsselt. Keine echten
          privaten Inhalte einstellen.
        </p>
      </form>
    </div>
  );
}
