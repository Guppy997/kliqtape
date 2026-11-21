import { useState } from 'react';
import { useApp } from '@/store/appStore';
import { useBottomNav } from '@/store/navStore';
import Avatar from './Avatar';
import CollectedTapes from './CollectedTapes';
import MixtapeList from './MixtapeShelf';
import NavButton from './NavButton';
import Onboarding from './Onboarding';
import PrivateTapes from './PrivateTapes';
import SettingsSheet from './Settings';
import Sheet from './Sheet';
import ShelfList from './Shelf';

type Tab = 'regal' | 'mixtapes';

/**
 * Das Profil ist die eigene Sammlung — nur fuer einen selbst sichtbar,
 * bewusst KEIN oeffentliches Profil: andere sollen nie sehen, was jemand
 * ueber alle Runden hinweg teilt, sonst vermischen sich die Kreise
 * (CONCEPT.md, "Bewusst nicht geplant").
 *
 * Regal: zuerst die eigenen, privaten Tapes (Tagebuch-Baender), dann das
 * Gesammelte (mit dem Stern hineingelegt, selbst beschriftet), darunter alle
 * Tapes aus den eigenen Kassetten. Mixtapes:
 * bauen, verschenken, erhaltene. Einstellungen hinter dem Zahnrad.
 */
export default function ProfileView() {
  const me = useApp((s) => s.me);
  const side = useApp((s) => s.side);
  const navActive = useBottomNav((s) => s.active);
  const setActiveNav = useBottomNav((s) => s.setActive);
  const open = navActive === 'profile';
  const [tab, setTab] = useState<Tab>('regal');
  const [settings, setSettings] = useState(false);
  const [intro, setIntro] = useState(false);

  return (
    <>
      {/* Strich-Symbol mit Beschriftung wie Eject, Band und Hot Line. Frueher
          das eigene Profilbild: ein Foto zwischen Strich-Symbolen wirkte wie
          ein Fremdkoerper. Kein Zahnrad, weil der Reiter die Sammlung
          oeffnet; die Einstellungen liegen dort hinter dem Zahnrad. */}
      <NavButton
        icon={
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="7.5" cy="4.6" r="3" />
            <path d="M1.75 14c0-3.1 2.6-5.4 5.75-5.4s5.75 2.3 5.75 5.4" />
          </svg>
        }
        label="Profil"
        active={open}
        onClick={() => setActiveNav('profile')}
      />

      {/* Hauptseite der unteren Leiste — gewechselt wird dort, deshalb ohne X. */}
      <Sheet open={open} onClose={() => setActiveNav(null)} variant="full" reserveBottomNav hideClose title="Profil">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Avatar name={me} side={side} size={3.5} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xl heading" style={{ color: 'var(--ink)' }}>
                {me}
              </span>
              <span className="block text-xs" style={{ color: 'var(--dim)' }}>
                Deine Sammlung — nur du siehst sie.
              </span>
            </span>
            <button
              type="button"
              onClick={() => setSettings(true)}
              aria-label="Einstellungen"
              title="Einstellungen"
              className="hit grid size-10 shrink-0 place-items-center rounded-full"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            >
              <GearIcon />
            </button>
          </div>

          {/* Das Onboarding als Vorschau, zum Zeigen: alle Screens, nichts
              wird gespeichert (Onboarding.tsx). */}
          <button
            type="button"
            onClick={() => setIntro(true)}
            className="flex items-center gap-2 self-start rounded-full px-3.5 py-2 text-xs font-medium"
            style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          >
            <RewindIcon />
            Einführung ansehen
          </button>

          <div
            role="tablist"
            aria-label="Sammlung"
            className="grid grid-cols-2 gap-1 rounded-full p-1"
            style={{ background: 'color-mix(in srgb, var(--ink) 7%, transparent)' }}
          >
            {(
              [
                ['regal', 'Regal'],
                ['mixtapes', 'Mixtapes'],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className="h-9 rounded-full text-sm font-medium"
                style={{
                  background: tab === key ? 'var(--accent)' : 'transparent',
                  color: tab === key ? 'var(--on-accent)' : 'var(--dim)',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'regal' ? (
            <>
              <section className="flex flex-col gap-2">
                <h3 className="text-sm heading" style={{ color: 'var(--ink)' }}>
                  Meine Tapes
                </h3>
                <PrivateTapes me={me} active={open && tab === 'regal'} />
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="text-sm heading" style={{ color: 'var(--ink)' }}>
                  Gesammelt
                </h3>
                <CollectedTapes me={me} active={open && tab === 'regal'} onJump={() => setActiveNav(null)} />
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="text-sm heading" style={{ color: 'var(--ink)' }}>
                  Aus deinen Kassetten
                </h3>
                <ShelfList me={me} active={open && tab === 'regal'} onJump={() => setActiveNav(null)} />
              </section>
            </>
          ) : (
            <MixtapeList />
          )}
        </div>
      </Sheet>

      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
      {intro && <Onboarding preview onDone={() => setIntro(false)} />}
    </>
  );
}

/** Zurueckspulen wie am Kassettendeck — die Einfuehrung nochmal von vorn. */
function RewindIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="var(--accent)" aria-hidden="true">
      <path d="M7 3v8L1.5 7zM12.5 3v8L7 7z" />
    </svg>
  );
}

/** Zahnrad mit acht Zaehnen — die fruehere Variante (Kreis mit Strahlen)
 *  las sich wie eine Sonne. */
function GearIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16.02 8.16 L18.15 8.42 L18.15 11.58 L16.02 11.84 L15.56 12.96 L16.88 14.64 L14.64 16.88 L12.96 15.56 L11.84 16.02 L11.58 18.15 L8.42 18.15 L8.16 16.02 L7.04 15.56 L5.36 16.88 L3.12 14.64 L4.44 12.96 L3.98 11.84 L1.85 11.58 L1.85 8.42 L3.98 8.16 L4.44 7.04 L3.12 5.36 L5.36 3.12 L7.04 4.44 L8.16 3.98 L8.42 1.85 L11.58 1.85 L11.84 3.98 L12.96 4.44 L14.64 3.12 L16.88 5.36 L15.56 7.04 Z" />
      <circle cx="10" cy="10" r="2.6" />
    </svg>
  );
}
