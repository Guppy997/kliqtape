import { useState } from 'react';
import { CORE_PAIR_COUNT, lookFor } from '@/lib/cassetteLook';
import Cassette3D, { useTween } from './Cassette3D';

/**
 * Farbauswahl fuer ein neues Band: die sechs Kernfarben (cassetteLook.ts),
 * gemeinsam fuer "Neue Gruppe" (CassetteDeck.tsx), die erste Kassette im
 * Onboarding und die eigenen Tapes (PrivateTapes.tsx).
 *
 * Erster Tipp waehlt die Farbe und zeigt Seite A. Nochmal auf dieselbe Farbe
 * dreht die kleine Kassette auf Seite B, wo dieselbe Sorte als
 * durchscheinendes Gehaeuse anders aussieht, und wieder zurueck. Gespeichert
 * wird nur die Sorte, die Seite ist reine Vorschau: jede Kassette hat beide.
 *
 * Die Kassetten sind echte Gegenstaende wie im Fach (Cassette3D); das
 * Umdrehen dreht sie in 3D, immer vorwaerts wie eine Spule.
 *
 * `flip={false}` fuer die eigenen Tapes, die nur eine Seite haben: dort hebt
 * nochmal tippen die Auswahl wieder auf (ohne Auswahl = automatisch).
 */
export default function BandPicker({
  value,
  onChange,
  label,
  flip = true,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  /** Name des Bands, steht als Vorschau auf dem Etikett. */
  label?: string;
  flip?: boolean;
}) {
  const [side, setSide] = useState<'a' | 'b'>('a');
  // Zaehlt die Drehungen der gewaehlten Kassette. Steckt im key, damit die
  // Animation bei jedem Umdrehen neu startet; 0 = frisch gewaehlt, keine Drehung.
  const [turns, setTurns] = useState(0);

  function pick(idx: number) {
    if (value !== idx) {
      onChange(idx);
      setSide('a');
      setTurns(0);
    } else if (flip) {
      setSide(side === 'a' ? 'b' : 'a');
      setTurns(turns + 1);
    } else {
      onChange(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: CORE_PAIR_COUNT }, (_, idx) => {
          const look = lookFor('neu', idx);
          const chosen = value === idx;
          const shown = chosen ? side : 'a';
          // Mit Umdrehen heisst die Farbe nach dem Gehaeuse (Amber, Ice, ...),
          // so wie man sie kennt. Ohne nur Seite A, also nach der Bandsorte.
          const name = flip ? look.case.name : look.type.name;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => pick(idx)}
              aria-pressed={chosen}
              aria-label={chosen && flip ? `${name}, Seite ${shown.toUpperCase()}` : name}
              className="flex flex-col items-center gap-2 rounded-xl px-2 pb-2 pt-3"
              style={{
                background: 'var(--card)',
                border: `1px solid ${chosen ? 'var(--accent)' : 'var(--line)'}`,
              }}
            >
              <PickerCassette idx={idx} turns={chosen ? turns : 0} withBack={flip} label={label} />
              <span className="text-center text-2xs leading-tight">
                <span style={{ color: chosen ? 'var(--ink)' : 'var(--dim)' }}>{name}</span>
                {/* Zeile immer da (nur unsichtbar), damit die Kachel beim
                    Waehlen nicht hoeher wird und das Raster springt. */}
                {flip && (
                  <span className="block" style={{ color: 'var(--dim)', visibility: chosen ? 'visible' : 'hidden' }}>
                    Seite {shown.toUpperCase()}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {flip && value != null && (
        <p className="text-2xs" style={{ color: 'var(--dim)' }}>
          Nochmal tippen dreht die Kassette um.
        </p>
      )}
    </div>
  );
}

/** Eine Kassette im Raster. Dreht sich bei jedem Umdrehen um 180 Grad weiter. */
function PickerCassette({
  idx,
  turns,
  withBack,
  label,
}: {
  idx: number;
  turns: number;
  withBack: boolean;
  label?: string;
}) {
  const rotateY = useTween(turns * 180);
  return (
    <Cassette3D
      cassetteId="neu"
      pairIndex={idx}
      withBack={withBack}
      label={label ?? ''}
      width={92}
      rotateX={-8}
      rotateY={rotateY}
      className="my-1"
    />
  );
}
