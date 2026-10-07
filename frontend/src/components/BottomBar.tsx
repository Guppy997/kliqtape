import { useEffect, useRef } from 'react';
import { useApp } from '@/store/appStore';
import { useBottomNav } from '@/store/navStore';
import CassetteDeck from './CassetteDeck';
import HotlineComposer from './HotlineComposer';
import NavButton from './NavButton';
import ProfileView from './ProfileView';

interface Props {
  /** Zurueck zur Startansicht der eingelegten Kassette — Seite A, ohne Filter. */
  onHome: () => void;
}

/**
 * Untere Leiste — vier gleichwertige Bereiche, schlank wie bei Instagram:
 * Fach (Kassette wechseln), Band (zurueck zur Startansicht), Hot Line
 * (direkt schreiben), Profil (die eigene Sammlung). Erstellen sitzt oben
 * links, die Glocke ("Neues") oben rechts (siehe App.tsx).
 *
 * z-45, bewusst hoeher als frueher (war z-20): Eject/Hot-Line/Neuigkeiten
 * geben ihrem jeweiligen Sheet jetzt reserveBottomNav mit (siehe Sheet.tsx) —
 * die Leiste soll dabei sichtbar durchscheinen, statt wie sonst unter dem
 * Sheet zu verschwinden. Andere, "normale" Sheets (Settings, Regal, die
 * Erstellen-Flows) bleiben bei z-50 und decken die Leiste weiterhin ganz ab.
 */
export default function BottomBar({ onHome }: Props) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const side = useApp((s) => s.side);
  const navActive = useBottomNav((s) => s.active);
  // "Zu Hause" heisst: kein anderer Bereich offen und man ist tatsaechlich
  // auf Seite A — nicht einfach immer an, sonst waere es kein Tab-Zustand.
  const isHome = navActive === null && side === 'a';

  // Sheet.tsx braucht die tatsaechliche Hoehe, um seinen Inhalt nicht hinter
  // der jetzt sichtbaren Leiste verschwinden zu lassen (siehe reserveBottomNav).
  useEffect(() => {
    if (!barRef.current) return;
    const el = barRef.current;
    const set = () => document.documentElement.style.setProperty('--bottombar-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--bottombar-h');
    };
  }, []);

  return (
    <div
      ref={barRef}
      className="glass fixed inset-x-0 bottom-0 z-[45] px-3 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1"
    >
      <div className="mx-auto grid max-w-xl grid-cols-4 place-items-center gap-1">
        <CassetteDeck />
        <NavButton
          icon={
            // Kassette statt Haussymbol — passt zum Rest der App, ein Haus
            // wirkte hier wie ein Fremdkoerper.
            <svg
              width="16"
              height="12"
              viewBox="0 0 16 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <rect x="0.65" y="0.65" width="14.7" height="10.7" rx="1.5" />
              <circle cx="4.5" cy="6" r="1.6" />
              <circle cx="11.5" cy="6" r="1.6" />
              <path d="M6.3 6h3.4" />
            </svg>
          }
          label="Band"
          active={isHome}
          onClick={onHome}
        />
        <HotlineComposer />
        <ProfileView />
      </div>
    </div>
  );
}
