/**
 * Einladung als Brief: der Token aus dem QR-Code (?brief=...) muss die
 * Namenswahl ueberleben, falls jemand die App zum ersten Mal oeffnet.
 * sessionStorage statt localStorage: er gehoert zu genau diesem Besuch.
 */
const KEY = 'kliqtape-brief';

/** Einmal beim Start: Token aus der Adresse holen und die Adresse saeubern,
 *  damit er nicht in Verlauf, Lesezeichen oder Screenshots stehen bleibt. */
export function captureLetterToken(): void {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('brief');
    if (!token) return;
    sessionStorage.setItem(KEY, token);
    url.searchParams.delete('brief');
    window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
  } catch {
    /* ohne Speicher geht der Brief eben verloren — der Server weiss nichts davon */
  }
}

export function pendingLetterToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearLetterToken(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* egal */
  }
}
