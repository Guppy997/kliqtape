import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Faengt Abstuerze beim Zeichnen ab, statt die ganze App leer zu lassen.
 *
 * Anlass: Eine installierte App laeuft so lange mit ihrer zwischengespeicherten
 * Version, bis man "Band wechseln" tippt. Passt diese alte Version nicht mehr
 * zu den Daten des Servers, stuerzte sie ab — und mit ihr verschwand auch der
 * Update-Hinweis, die App kam aus eigener Kraft nicht mehr auf die neue
 * Version. Deshalb sitzt diese Grenze UNTER dem Update-Banner (App.tsx): Der
 * Hinweis bleibt sichtbar, und "Neu laden" holt im Zweifel die neue Version.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[kliqtape] Absturz beim Zeichnen', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
          Da hat sich das Band verheddert.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--dim)' }}>
          Meist hilft es, die App neu zu laden — liegt eine neue Version bereit, kommt sie dabei gleich mit.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg px-4 py-2.5 text-sm font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          Neu laden
        </button>
      </div>
    );
  }
}
