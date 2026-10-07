import { useState } from 'react';
import { useApp } from '@/store/appStore';
import { useBottomNav } from '@/store/navStore';
import Avatar from './Avatar';
import CollectedTapes from './CollectedTapes';
import MixtapeList from './MixtapeShelf';
import NavButton from './NavButton';
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
 * Regal: oben das Gesammelte (mit dem Stern hineingelegt, selbst
 * beschriftet), darunter alle Tapes aus den eigenen Kassetten. Mixtapes:
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

  return (
    <>
      <NavButton
        icon={
          <span
            className="block rounded-full"
            style={{ boxShadow: open ? '0 0 0 1.5px var(--accent)' : '0 0 0 1px var(--line)' }}
          >
            <Avatar name={me} side={side} size={1.35} />
          </span>
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
              <span className="block truncate text-xl font-semibold" style={{ color: 'var(--ink)' }}>
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
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  Gesammelt
                </h3>
                <CollectedTapes me={me} active={open && tab === 'regal'} onJump={() => setActiveNav(null)} />
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
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
    </>
  );
}

function GearIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7" />
    </svg>
  );
}
