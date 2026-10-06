import { useQuery } from '@tanstack/react-query';
import { fetchInvites, type Cassette } from '@/lib/api';
import { useApp } from '@/store/appStore';
import { useBottomNav } from '@/store/navStore';

/**
 * Leerzustaende — frueher je eine graue Textzeile ("Kein Band eingelegt.",
 * "Leeres Band."). Gerade der allererste Moment entscheidet aber, ob jemand
 * versteht, was eine Kassette ist. Deshalb: eine leere Kassettenhuelle als
 * Bild, drei Saetze, ein klarer naechster Schritt.
 */

/** Das Kassetten-Panel liegt ueber dem Inhalt (App.tsx, --deck-h) — ein
 *  Leerzustand soll darunter anfangen, nicht dahinter verschwinden. */
const BELOW_DECK = { marginTop: 'var(--deck-h, 0px)' } as const;

/** Noch gar keine Kassette eingelegt (neues Konto oder alles verlassen). */
export function NoCassette() {
  const me = useApp((s) => s.me);
  const openDeck = useBottomNav((s) => s.openDeck);
  const setActive = useBottomNav((s) => s.setActive);
  const { data: invites = [] } = useQuery({
    queryKey: ['invites', me],
    queryFn: () => fetchInvites(me),
    enabled: Boolean(me),
  });

  return (
    <div className="rise flex flex-col items-center gap-6 px-2 py-10 text-center" style={BELOW_DECK}>
      <EmptyShell />

      <div className="flex flex-col gap-2">
        <h2 className="font-hand text-[1.7rem] leading-tight" style={{ color: 'var(--ink)' }}>
          Noch kein Band im Fach.
        </h2>
        <p className="mx-auto max-w-[19rem] text-sm leading-relaxed" style={{ color: 'var(--dim)' }}>
          Eine Kassette ist eine Runde von Leuten: die Freitagsrunde, die WG, die Familie. Jede
          bekommt ihr eigenes Band, nichts vermischt sich.
        </p>
      </div>

      {invites.length > 0 && (
        <button
          type="button"
          onClick={() => setActive('notify')}
          className="flex w-full max-w-sm items-center gap-3 rounded-xl px-3.5 py-3 text-left"
          style={{ background: 'var(--card)', border: '1px solid var(--accent)' }}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {invites.length === 1
                ? `${invites[0]!.invitedBy} lädt dich auf „${invites[0]!.cassetteName}“ ein`
                : `${invites.length} Einladungen warten auf dich`}
            </span>
            <span className="font-mono block text-[0.6rem] uppercase tracking-[0.1em]" style={{ color: 'var(--dim)' }}>
              In den Benachrichtigungen zustimmen
            </span>
          </span>
          <span aria-hidden="true" style={{ color: 'var(--accent)' }}>
            ▸
          </span>
        </button>
      )}

      <ol className="flex w-full max-w-sm flex-col gap-2 text-left">
        {[
          ['Beschriften', 'Gib dem Band einen Namen und such dir eine Bandsorte aus.'],
          ['Einladen', 'Hol die Leute dazu. Dabei ist, wer zustimmt.'],
          ['Aufnehmen', 'Seite A ist das Archiv eurer Runde, Seite B euer Gruppenchat.'],
        ].map(([title, text], i) => (
          <li
            key={title}
            className="flex items-start gap-3 rounded-xl px-3 py-2.5"
            style={{ border: '1px solid var(--line)' }}
          >
            <span
              className="font-mono mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[0.6rem]"
              style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}
            >
              {i + 1}
            </span>
            <span>
              <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {title}
              </span>
              <span className="block text-[0.8rem] leading-snug" style={{ color: 'var(--dim)' }}>
                {text}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={() => openDeck({ kind: 'create' })}
        className="font-disp w-full max-w-sm rounded-xl px-4 py-3.5 text-sm font-bold uppercase tracking-[0.1em]"
        style={{ background: 'var(--accent)', color: '#17130E' }}
      >
        Erstes Band beschriften
      </button>
    </div>
  );
}

/** Kassette eingelegt, aber auf dieser Seite noch nichts drauf. */
export function EmptyBand({ cassette }: { cassette: Cassette }) {
  const openDeck = useBottomNav((s) => s.openDeck);
  const alone = cassette.memberCount <= 1;

  return (
    <div className="rise flex flex-col items-center gap-4 px-2 py-10 text-center" style={BELOW_DECK}>
      <BlankLabel />
      <h2 className="font-hand text-[1.5rem] leading-tight" style={{ color: 'var(--ink)' }}>
        Das Band ist noch leer.
      </h2>
      <p className="max-w-[19rem] text-sm leading-relaxed" style={{ color: 'var(--dim)' }}>
        Seite A ist das Archiv von „{cassette.name}“: Fotos, Absprachen, alles, was bleiben soll.
        Mit dem Plus oben nimmst du den ersten Track auf.
      </p>
      {alone && (
        <button
          type="button"
          onClick={() => openDeck({ kind: 'invite', cassetteId: cassette.id })}
          className="mt-1 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
          style={{ background: 'var(--card)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M7 1v12M1 7h12" />
          </svg>
          Du bist noch allein, lad jemanden ein
        </button>
      )}
    </div>
  );
}

/** Eine aufgeklappte, leere Kassettenhuelle: Platz fuer ein Band, das es noch
 *  nicht gibt. Linien statt Flaechen, damit es nach "Anfang" aussieht und
 *  nicht nach einer ausgegrauten, kaputten Kassette. */
function EmptyShell() {
  return (
    <svg width="210" height="132" viewBox="0 0 210 132" fill="none" aria-hidden="true">
      {/* Huellenrueckwand, leicht nach hinten versetzt */}
      <rect x="18" y="6" width="174" height="108" rx="7" stroke="var(--line)" strokeWidth="1.5" />
      {/* Scharnierkante */}
      <path d="M18 18h174" stroke="var(--line)" strokeWidth="1" />
      {/* Ausgeschnittene Form, in die die Kassette gehoert */}
      <rect x="38" y="30" width="134" height="84" rx="6" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="5 5" opacity=".75" />
      <circle cx="78" cy="72" r="11" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 4" opacity=".6" />
      <circle cx="132" cy="72" r="11" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 4" opacity=".6" />
      {/* Plus mittig: hier kommt dein Band hin */}
      <circle cx="105" cy="72" r="14" fill="var(--accent)" />
      <path d="M105 65v14M98 72h14" stroke="#17130E" strokeWidth="2.2" strokeLinecap="round" />
      {/* Bodenkante der Huelle */}
      <path d="M10 124h190" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Ein unbeschriebenes Etikett mit Linien — das leere Band als Material. */
function BlankLabel() {
  return (
    <svg width="168" height="74" viewBox="0 0 168 74" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="166" height="72" rx="4" fill="var(--card)" stroke="var(--line)" />
      <rect x="1" y="1" width="166" height="15" rx="4" fill="var(--accent)" opacity=".85" />
      <path d="M14 38h140M14 56h140" stroke="var(--line)" strokeWidth="1" />
      <path d="M16 35c6-6 12 4 18-2s10 2 14-1" stroke="var(--dim)" strokeWidth="1.3" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}
