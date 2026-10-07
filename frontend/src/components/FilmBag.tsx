import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { developFilmNow, fetchFilm, mediaUrl, type Cassette, type FilmShot } from '@/lib/api';
import { filmReleaseLabel, filmStampLabel, takenLabel } from '@/lib/berlinDay';
import { useApp } from '@/store/appStore';
import FilmShoot from './FilmShoot';
import PlusMark from './PlusMark';

/** Welche Freigabe pro Kassette schon geoeffnet wurde — rein lokal, wie der
 *  Gesehen-Stand der Seiten. Speicher kann fehlen (privates Fenster), dann
 *  erscheint die Tuete eben noch einmal. */
const SEEN_KEY = 'kliqtape-film-opened';
function openedAt(cassetteId: string): number {
  try {
    return (JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, number>)[cassetteId] ?? 0;
  } catch {
    return 0;
  }
}
function markOpened(cassetteId: string, at: number) {
  try {
    const all = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, number>;
    all[cassetteId] = at;
    localStorage.setItem(SEEN_KEY, JSON.stringify(all));
  } catch {
    /* ohne Speicher kein Gedaechtnis — harmlos */
  }
}

const KRAFT = '#C9A877';
const KRAFT_DEEP = '#A9895B';
const KRAFT_INK = '#3B2E1E';

/**
 * Der Film der Woche auf Seite A: solange er entwickelt wird, ein Streifen
 * mit Freigabetermin und "Belichten"; ist er entwickelt und noch nicht
 * geoeffnet, eine Fototuete. Oeffnen zeigt die Abzuege einzeln, danach liegen
 * sie als normale Beitraege im Tape des Sonntags.
 */
export default function FilmBag({ cassette, onChanged }: { cassette: Cassette; onChanged: () => void }) {
  const me = useApp((s) => s.me);
  const qc = useQueryClient();
  const [shooting, setShooting] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [, rerender] = useState(0);

  const { data: film } = useQuery({
    queryKey: ['film', cassette.id, me],
    queryFn: () => fetchFilm(cassette.id, me),
    // Damit die Tuete Sonntag um 19 Uhr auch ohne Neuladen auftaucht.
    refetchInterval: 60_000,
  });

  const developNow = useMutation({
    mutationFn: () => developFilmNow(cassette.id, me),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['film', cassette.id] });
      onChanged();
    },
  });

  if (!film) return null;
  const developed = film.developed;
  const bagWaiting = developed && developed.shots.length > 0 && openedAt(cassette.id) < developed.at;

  function closeReveal() {
    if (developed) markOpened(cassette.id, developed.at);
    setRevealing(false);
    rerender((n) => n + 1);
  }

  return (
    <>
      {bagWaiting ? (
        <button
          type="button"
          onClick={() => setRevealing(true)}
          className="rise my-3 flex items-center gap-4 rounded-xl p-3.5 text-left"
          style={{ background: 'var(--card)', border: `1px solid ${KRAFT}` }}
        >
          <MiniBag />
          <span className="min-w-0 flex-1">
            <span className="block text-base leading-tight font-semibold" style={{ color: 'var(--ink)' }}>
              Der Film ist entwickelt.
            </span>
            <span className="mt-0.5 block text-meta" style={{ color: 'var(--dim)' }}>
              Abzüge von {namesOf(developed.shots, me)}
            </span>
            <span
              className="mt-2 inline-block rounded-full px-3 py-1 text-2xs"
              style={{ background: KRAFT, color: KRAFT_INK }}
            >
              Tüte öffnen
            </span>
          </span>
        </button>
      ) : (
        <div
          className="my-3 flex items-center gap-3 rounded-xl px-3.5 py-3"
          style={{ border: '1px dashed var(--line)' }}
        >
          <Canister />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              Film der Woche
            </span>
            <span className="block text-meta leading-snug" style={{ color: 'var(--dim)' }}>
              Wird {filmReleaseLabel(film.nextRelease)} entwickelt.{' '}
              {film.iShot ? 'Dein Bild ist belichtet.' : 'Du hast noch ein Bild frei.'}
            </span>
            {film.demoTools && cassette.createdBy === me && (
              <button
                type="button"
                onClick={() => developNow.mutate()}
                disabled={developNow.isPending}
                className="mt-1 text-2xs underline disabled:opacity-50"
                style={{ color: 'var(--dim)' }}
              >
                Demo: jetzt entwickeln
              </button>
            )}
          </span>
          {!film.iShot && (
            <button
              type="button"
              onClick={() => setShooting(true)}
              className="shrink-0 rounded-full px-3 py-1.5 text-2xs"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              Belichten
            </button>
          )}
        </div>
      )}

      <FilmShoot
        open={shooting}
        cassetteId={cassette.id}
        releaseAt={film.nextRelease}
        onClose={() => setShooting(false)}
      />

      {revealing && developed && <FilmReveal shots={developed.shots} at={developed.at} onClose={closeReveal} />}
    </>
  );
}

function namesOf(shots: FilmShot[], me: string): string {
  const names = [...new Set(shots.map((s) => (s.author === me ? 'dir' : s.author)))];
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} und ${names.at(-1)}`;
}

type Phase = 'bag' | 'opening' | 'viewer';

/**
 * Das Oeffnen der Fototuete: Lasche klappt hoch, die Abzuege rutschen heraus,
 * dann einzeln durchblaettern. Antippen ueberspringt die Animation; mit
 * reduzierter Bewegung geht es direkt zu den Abzuegen.
 */
function FilmReveal({ shots, at, onClose }: { shots: FilmShot[]; at: number; onClose: () => void }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<Phase>(reduced ? 'viewer' : 'bag');
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (phase === 'viewer') return;
    const t1 = window.setTimeout(() => setPhase('opening'), 450);
    const t2 = window.setTimeout(() => setPhase('viewer'), 2300);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // Nur einmal beim Oeffnen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (phase !== 'viewer') return;
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(shots.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, shots.length, onClose]);

  const shot = shots[index]!;
  const opening = phase === 'opening';
  const date = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(at));

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Entwickelter Film"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-5"
      style={{ background: 'rgba(14,12,10,.985)' }}
      onClick={() => phase !== 'viewer' && setPhase('viewer')}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Schließen"
        // Dasselbe X wie ueberall oben links (Sheet.tsx), an der Stelle des Plus —
        // mt-0.5, weil die Titelzeile dort 36 px hoch ist und das Plus mittig sitzt.
        className="hit absolute left-3 top-[max(0.5rem,env(safe-area-inset-top))] mt-0.5 grid size-8 place-items-center rounded-full text-white"
      >
        <PlusMark turned />
      </button>

      {phase !== 'viewer' ? (
        <div className="relative" style={{ width: 230, height: 280, perspective: '900px', marginTop: 120 }}>
          {/* Rueckwand — das Innere der Tuete */}
          <div className="absolute inset-x-0 bottom-0 rounded-lg" style={{ top: 70, background: KRAFT_DEEP }} />
          {/* Abzuege: stecken in der Tuete, rutschen beim Oeffnen nach oben raus */}
          {shots.slice(0, 4).map((s, i) => (
            <div
              key={s.id}
              className="absolute bg-[#ECE5D6] p-1.5 pb-5"
              style={{
                left: 26,
                right: 26,
                top: 84,
                zIndex: 1,
                boxShadow: '0 0.3rem 0.8rem rgba(0,0,0,.4)',
                transform: opening
                  ? `translateY(${-190 + i * 14}px) rotate(${(i - 1.5) * 5}deg)`
                  : `translateY(0) rotate(${(i - 1.5) * 1.5}deg)`,
                transition: `transform 900ms cubic-bezier(.2,.8,.25,1) ${650 + i * 110}ms`,
              }}
            >
              <img src={mediaUrl(s.mediaId)} alt="" className="block aspect-square w-full object-cover" />
            </div>
          ))}
          {/* Vorderseite mit aufgedrucktem Etikett */}
          <div
            className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end rounded-b-md px-4 pb-5 text-center"
            style={{
              top: 70,
              zIndex: 2,
              background: `linear-gradient(180deg, ${KRAFT} 0%, #BE9C69 100%)`,
              boxShadow: '0 1rem 2rem rgba(0,0,0,.5)',
              color: KRAFT_INK,
            }}
          >
            <span className="font-disp text-[0.7rem] font-bold uppercase tracking-[0.3em]">Kliqtape · Foto</span>
            <span className="mt-1 h-px w-24" style={{ background: KRAFT_INK, opacity: 0.4 }} />
            <span className="font-hand mt-2 text-[1.15rem] leading-tight">Entwickelt {date}</span>
            <span className="font-mono mt-1 text-[0.5rem] uppercase tracking-[0.2em] opacity-70">
              Bitte nicht knicken
            </span>
          </div>
          {/* Lasche: klappt um die Oberkante der Vorderseite nach oben. Wechselt
              mitten in der Drehung (hochkant, unsichtbar) hinter die Abzuege. */}
          <div
            className="absolute inset-x-0"
            style={{
              top: 70,
              height: 66,
              zIndex: opening ? 0 : 3,
              transformOrigin: 'top center',
              transform: opening ? 'rotateX(180deg)' : 'rotateX(0deg)',
              transition: 'transform 620ms cubic-bezier(.5,0,.3,1), z-index 0s 300ms',
              background: `linear-gradient(0deg, #B89766, ${KRAFT})`,
              clipPath: 'polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%)',
            }}
          />
        </div>
      ) : (
        <div
          className="flex w-full max-w-sm flex-col items-center gap-5"
          onTouchStart={(e) => (touchX.current = e.touches[0]!.clientX)}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0]!.clientX - touchX.current;
            touchX.current = null;
            if (dx < -40) setIndex((i) => Math.min(shots.length - 1, i + 1));
            if (dx > 40) setIndex((i) => Math.max(0, i - 1));
          }}
        >
          <figure
            key={shot.id}
            className="print rise w-full"
            style={{ transform: `rotate(${index % 2 === 0 ? -1 : 0.8}deg)` }}
          >
            <div className="relative">
              <img
                src={mediaUrl(shot.mediaId)}
                alt={shot.caption || `Filmbild von ${shot.author}`}
                className="aspect-square object-cover"
              />
              <span
                className="font-mono absolute bottom-2 right-2.5 text-[0.8rem] font-bold tracking-[0.12em]"
                style={{ color: '#FF9A3C', textShadow: '0 0 4px rgba(255,120,30,.7)' }}
              >
                {filmStampLabel(shot.takenAt)}
              </span>
            </div>
            <figcaption className="mt-2 flex items-baseline justify-between gap-2 px-0.5 text-[#3B3226]">
              <span className="font-hand text-[1.05rem]">{shot.caption || shot.author}</span>
              <span className="shrink-0 text-2xs opacity-70">
                {shot.caption ? `${shot.author} · ` : ''}
                {takenLabel(shot.takenAt)}
              </span>
            </figcaption>
          </figure>

          <div className="flex w-full items-center justify-between">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              aria-label="Vorheriger Abzug"
              className="grid size-10 place-items-center rounded-full text-white disabled:opacity-25"
              style={{ background: 'rgba(255,255,255,.12)' }}
            >
              ‹
            </button>
            <span className="flex gap-1.5" aria-hidden="true">
              {shots.map((s, i) => (
                <span
                  key={s.id}
                  className="block size-1.5 rounded-full"
                  style={{ background: i === index ? KRAFT : 'rgba(255,255,255,.25)' }}
                />
              ))}
            </span>
            {index < shots.length - 1 ? (
              <button
                type="button"
                onClick={() => setIndex((i) => i + 1)}
                aria-label="Nächster Abzug"
                className="grid size-10 place-items-center rounded-full text-white"
                style={{ background: 'rgba(255,255,255,.12)' }}
              >
                ›
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-4 py-2.5 text-2xs"
                style={{ background: KRAFT, color: KRAFT_INK }}
              >
                Ins Band legen
              </button>
            )}
          </div>
          <p className="text-center text-2xs leading-relaxed text-white/50">
            Die Abzüge liegen danach im Tape vom Sonntag auf Seite A.
          </p>
        </div>
      )}
    </div>,
    document.body,
  );
}

function MiniBag() {
  return (
    <svg width="54" height="62" viewBox="0 0 54 62" aria-hidden="true">
      <rect x="3" y="14" width="48" height="46" rx="3" fill={KRAFT} />
      <path d="M3 14h48v12l-24 9-24-9z" fill="#B89766" />
      <rect x="9" y="3" width="36" height="20" fill="#ECE5D6" transform="rotate(-6 27 13)" />
      <rect x="12" y="6" width="30" height="13" fill="#7C8C9A" transform="rotate(-6 27 13)" />
      <path d="M14 44h26M18 50h18" stroke={KRAFT_INK} strokeWidth="1.2" opacity=".5" />
    </svg>
  );
}

function Canister() {
  return (
    <svg width="30" height="36" viewBox="0 0 30 36" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="18" height="26" rx="2.5" stroke="var(--accent)" strokeWidth="1.4" />
      <rect x="8" y="2" width="10" height="4" rx="1" stroke="var(--accent)" strokeWidth="1.4" />
      <path d="M22 12h5v14h-5" stroke="var(--accent)" strokeWidth="1.4" />
      <path d="M24.5 14v2M24.5 19v2M24.5 24v0.5" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8 15h10M8 20h7" stroke="var(--dim)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
