import { useEffect, useRef, useState } from 'react';
import type { Cassette } from '@/lib/api';
import { ageStageOf } from '@/lib/berlinDay';
import { lookFor } from '@/lib/cassetteLook';
import Cassette3D, { useReducedMotion } from './Cassette3D';

/**
 * Das Fach als Kassettenstapel, wie Karten in Apple Wallet: die eingelegte
 * Kassette steht oben ganz sichtbar, alle anderen darunter, leicht nach hinten
 * gekippt wie in einer Schublade. Sie ueberlappen so, dass Farbband, Name und
 * die Zeile darunter sichtbar bleiben. So bleibt der Regal-Look der Website,
 * und es skaliert auch mit 15 Runden am Handy.
 *
 * Tippen legt die Kassette direkt ein (wie vorher die Zeile), der Stift
 * daneben oeffnet die Kassetten-Ansicht.
 */
export default function CassetteStack({
  cassettes,
  insertedId,
  side,
  looks,
  onInsert,
  onEdit,
}: {
  /** Schon sortiert: die eingelegte zuerst. */
  cassettes: Cassette[];
  insertedId: string | null;
  /** Seite der eingelegten Kassette */
  side: 'a' | 'b';
  looks: Map<string, number>;
  onInsert: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [lifting, setLifting] = useState<string | null>(null);

  // Breite der Kassetten haengt am Platz im Fach: Kassette + Spalte fuer den Stift.
  useEffect(() => {
    if (!box.current) return;
    const el = box.current;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const cassetteW = Math.max(0, Math.min(width - 52, 360));
  const cassetteH = cassetteW * (16 / 25);
  // Sichtbarer Streifen jeder Kassette im Stapel: Farbband, Name, zweite Zeile.
  const step = Math.round(cassetteH * 0.44);

  function insert(id: string) {
    if (reduce) return onInsert(id);
    // Kurz anheben, dann einlegen: man sieht, welche Kassette genommen wurde.
    setLifting(id);
    window.setTimeout(() => {
      setLifting(null);
      onInsert(id);
    }, 220);
  }

  const inserted = cassettes.find((c) => c.id === insertedId);
  const rest = cassettes.filter((c) => c.id !== insertedId);

  const meta = (c: Cassette) =>
    `${c.memberCount} ${c.memberCount === 1 ? 'Person' : 'Leute'} · A ${c.sideA} · B ${c.sideB}`;
  const corner = (c: Cassette) => `Position ${(c.sideA + c.sideB).toString().padStart(3, '0')}`;

  return (
    <div ref={box} className="flex flex-col">
      {cassetteW > 0 && inserted && (
        <Card
          c={inserted}
          inserted
          side={side}
          height={cassetteH + 22}
          width={cassetteW}
          pairIndex={looks.get(inserted.id)}
          meta={meta(inserted)}
          corner={corner(inserted)}
          lifted={lifting === inserted.id}
          reduce={reduce}
          onInsert={() => insert(inserted.id)}
          onEdit={() => onEdit(inserted.id)}
        />
      )}

      {cassetteW > 0 && rest.length > 0 && (
        <ul aria-label="Weitere Gruppen" className="mt-4 flex flex-col" style={{ paddingBottom: cassetteH - step }}>
          {rest.map((c) => (
            <li key={c.id} className="relative" style={{ height: step }}>
              <Card
                c={c}
                side="a"
                height={step}
                width={cassetteW}
                pairIndex={looks.get(c.id)}
                meta={meta(c)}
                corner={corner(c)}
                lifted={lifting === c.id}
                reduce={reduce}
                onInsert={() => insert(c.id)}
                onEdit={() => onEdit(c.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Card({
  c,
  inserted = false,
  side,
  height,
  width,
  pairIndex,
  meta,
  corner,
  lifted,
  reduce,
  onInsert,
  onEdit,
}: {
  c: Cassette;
  inserted?: boolean;
  side: 'a' | 'b';
  /** Sichtbare Hoehe (Streifen im Stapel, ganze Kassette oben) */
  height: number;
  width: number;
  pairIndex?: number;
  meta: string;
  corner: string;
  lifted: boolean;
  reduce: boolean;
  onInsert: () => void;
  onEdit: () => void;
}) {
  const [hover, setHover] = useState(false);
  const { type, case: plastic } = lookFor(c.id, pairIndex);
  const accent = side === 'b' ? plastic.glow : type.stripe;
  const lift = reduce ? 0 : lifted ? -16 : hover ? -6 : 0;

  return (
    <div className="relative flex items-start gap-2" style={{ height }}>
      {/* Nur die eingelegte Kassette leuchtet: das einzige "ausgewaehlt"-Signal. */}
      {inserted && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            left: '4%',
            top: '10%',
            width: width * 0.92,
            height: width * 0.6,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${accent}55, ${accent}00)`,
            filter: 'blur(18px)',
          }}
        />
      )}
      <button
        type="button"
        onClick={onInsert}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        aria-label={inserted ? `${c.name}, eingelegt, ${meta}` : `${c.name} einlegen, ${meta}`}
        aria-current={inserted ? 'true' : undefined}
        className="relative block shrink-0 rounded-xl text-left"
        style={{
          width,
          height,
          transform: `translateY(${lift}px)`,
          transition: reduce ? undefined : 'transform 0.22s cubic-bezier(.2,.7,.2,1)',
        }}
      >
        <Cassette3D
          cassetteId={c.id}
          pairIndex={pairIndex}
          side={side}
          label={c.name}
          sub={meta}
          corner={corner}
          age={ageStageOf(c.createdAt)}
          width={width}
          // Oben aufrecht und mit laufenden Spulen, im Stapel nach hinten
          // gekippt wie in einer Schublade: oben das Etikett, unten verdeckt.
          rotateX={inserted ? -10 : -18}
          rotateY={inserted ? -6 : 0}
          rotateZ={inserted ? -1.5 : 0}
          spinning={inserted}
          ground={inserted}
        />
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`${c.name} bearbeiten`}
        title="Bearbeiten"
        className="hit relative mt-1 grid size-11 shrink-0 place-items-center rounded-full"
        style={{ color: 'var(--dim)' }}
      >
        <span
          className="grid size-7 place-items-center rounded-full"
          style={{ border: '1px solid var(--line)', background: 'var(--card)' }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11 2l3 3-8 8-3.5.5.5-3.5z" />
            <path d="M9.5 3.5l3 3" />
          </svg>
        </span>
      </button>
    </div>
  );
}
