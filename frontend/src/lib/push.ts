import { apiFetch, unwrap } from '@/lib/api';

/*
 * Wochen-Erinnerung per Web-Push (backend/src/routes/push.ts): hoechstens eine
 * pro Woche, wenn die Challenge aufgeloest ist. Auf dem iPhone geht das nur in
 * der installierten App (Home-Bildschirm), nicht im Safari-Tab.
 */

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Fragt die Erlaubnis ab (muss aus einem Antippen heraus passieren) und
 *  meldet dieses Geraet an. true, wenn es geklappt hat. */
export async function enableReminder(me: string): Promise<boolean> {
  if (!pushSupported()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  const { publicKey } = await apiFetch('/api/push/key').then(unwrap<{ publicKey: string }>);
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  await apiFetch('/api/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ me, subscription: sub.toJSON() }),
  }).then(unwrap<{ subscribed: boolean }>);
  return true;
}

export async function disableReminder(me: string): Promise<void> {
  if (pushSupported()) {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    await sub?.unsubscribe();
  }
  await apiFetch(`/api/push/subscriptions?me=${encodeURIComponent(me)}`, { method: 'DELETE' }).then(unwrap<void>);
}

export function fetchReminder(me: string): Promise<{ subscribed: boolean }> {
  return apiFetch(`/api/push/subscriptions?me=${encodeURIComponent(me)}`).then(unwrap<{ subscribed: boolean }>);
}
