import { create } from 'zustand';

/**
 * Berechtigungen erst fragen, wenn sie gebraucht werden — und davor in einem
 * Satz erklaeren, wofuer (PermissionHost.tsx zeigt die Erklaerung). Nach
 * "Erlauben" kommt die Abfrage des Systems; die Erklaerung erscheint pro Art
 * nur einmal (lokal gemerkt), und gar nicht, wenn die Berechtigung schon da ist.
 */
export type PermissionKind = 'camera' | 'video' | 'microphone';

interface Ask {
  kind: PermissionKind;
  answer: (ok: boolean) => void;
}

interface PermissionState {
  ask: Ask | null;
  open: (ask: Ask) => void;
  close: () => void;
}

export const usePermission = create<PermissionState>((set) => ({
  ask: null,
  open: (ask) => set({ ask }),
  close: () => set({ ask: null }),
}));

const KEY = 'kliqtape-permission-explained';

function explained(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

function markExplained(kind: PermissionKind) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...explained(), [kind]: true }));
  } catch {
    /* ohne Speicher kommt die Erklaerung eben noch einmal */
  }
}

/** Ist die Berechtigung laut Browser schon erteilt? (Nicht ueberall abfragbar.) */
async function alreadyGranted(kind: PermissionKind): Promise<boolean> {
  const names: string[] = kind === 'video' ? ['camera', 'microphone'] : [kind];
  try {
    const states = await Promise.all(
      names.map((name) => navigator.permissions.query({ name: name as PermissionName }).then((r) => r.state)),
    );
    return states.every((s) => s === 'granted');
  } catch {
    return false;
  }
}

/** Vor getUserMedia aufrufen. true: weitermachen (die Systemabfrage darf
 *  kommen), false: die Person hat "Nicht jetzt" gewaehlt. */
export async function ensurePermission(kind: PermissionKind): Promise<boolean> {
  if (explained()[kind] || (await alreadyGranted(kind))) return true;
  const ok = await new Promise<boolean>((answer) => usePermission.getState().open({ kind, answer }));
  if (ok) markExplained(kind);
  return ok;
}
