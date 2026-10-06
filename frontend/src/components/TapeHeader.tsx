import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { favoriteTape, setTapeName, unfavoriteTape, type TapeOverride } from '@/lib/api';
import { berlinDateLabel, dateOfTapeIndex } from '@/lib/berlinDay';
import DateDividerLabel from './DateDividerLabel';

interface Props {
  cassetteId: string;
  cassetteCreatedAt: number;
  tapeIndex: number;
  override: TapeOverride | undefined;
  me: string;
  onChanged: () => void;
}

export function defaultTapeName(tapeIndex: number): string {
  return `Tape ${String(tapeIndex).padStart(2, '0')}`;
}

/** Voller Anzeigename: eigener Name plus die Standard-Nummer daneben — die
 *  soll nach dem Umbenennen nicht verschwinden, sonst verliert man die
 *  Zählung aus dem Blick. */
export function tapeDisplayName(tapeIndex: number, customName: string | null | undefined): string {
  const base = defaultTapeName(tapeIndex);
  return customName ? `${customName} · ${base}` : base;
}

/** Gruppen-Überschrift für ein Tape (Kalendertag) auf Seite A — Datum, Name
 *  (umbenennbar), Favoriten-Stern. Umschließt DateDividerLabel für die
 *  Trenner-Optik, hält den eigentlichen Zustand aber selbst — anders als
 *  der Chat-Tagestrenner ist ein Tape eine adressierbare, benannte Sache. */
export default function TapeHeader({ cassetteId, cassetteCreatedAt, tapeIndex, override, me, onChanged }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const cancelled = useRef(false);

  const name = tapeDisplayName(tapeIndex, override?.name);
  const dateLabel = berlinDateLabel(dateOfTapeIndex(cassetteCreatedAt, tapeIndex).getTime());

  const rename = useMutation({
    mutationFn: (value: string) => setTapeName(cassetteId, tapeIndex, value, me),
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
  });

  const favorite = useMutation({
    mutationFn: () =>
      override?.favoritedByMe ? unfavoriteTape(cassetteId, tapeIndex, me) : favoriteTape(cassetteId, tapeIndex, me),
    onSuccess: onChanged,
  });

  return (
    <div id={`tape-${tapeIndex}`} className="pt-4 first:pt-0">
      <DateDividerLabel label={dateLabel} />
      <div className="mt-1 flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => favorite.mutate()}
          disabled={favorite.isPending}
          aria-label={override?.favoritedByMe ? 'Favorit entfernen' : 'Als Favorit markieren'}
          className="shrink-0 text-[0.8rem] leading-none disabled:opacity-50"
          style={{ color: override?.favoritedByMe ? 'var(--accent)' : 'var(--dim)' }}
        >
          {override?.favoritedByMe ? '★' : '☆'}
        </button>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              // Escape bricht ab — ohne diese Sperre speicherte das danach
              // feuernde blur den Entwurf trotzdem.
              if (cancelled.current) return;
              rename.mutate(draft.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') {
                cancelled.current = true;
                setEditing(false);
              }
            }}
            maxLength={60}
            placeholder={defaultTapeName(tapeIndex)}
            aria-label="Name des Tapes"
            className="font-hand rounded px-1.5 py-0.5 text-[0.95rem] outline-none"
            style={{ background: 'var(--card)', border: '1px solid var(--accent)', color: 'var(--ink)' }}
          />
        ) : (
          <>
            {/* Der Name ist reiner Text — Antippen beim Scrollen loeste vorher
                versehentlich das Umbenennen aus. Bearbeiten nur ueber den Stift. */}
            <span className="font-hand text-[0.95rem]" style={{ color: 'var(--ink)' }}>
              {name}
            </span>
            <button
              type="button"
              onClick={() => {
                cancelled.current = false;
                setDraft(override?.name ?? '');
                setEditing(true);
              }}
              aria-label={`${name} umbenennen`}
              title="Umbenennen"
              className="grid size-6 shrink-0 place-items-center rounded-full"
              style={{ color: 'var(--dim)' }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                   strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 2l3 3-8 8-3.5.5.5-3.5z" />
                <path d="M9.5 3.5l3 3" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
