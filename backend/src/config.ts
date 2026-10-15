import { mkdirSync } from 'node:fs';

/* Konfiguration aus der Umgebung — an einer Stelle, statt verstreut ueber
 * die Routen. Werte und Bedeutung: siehe .env.example. */

export const PORT = Number(process.env.PORT ?? 3000);
export const MEDIA_DIR = process.env.MEDIA_DIR ?? './media';
export const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 25);
/** Ueberschreibbar nur fuer die Testsuite, die in Sekunden mehr Anfragen
 *  stellt als ein Mensch in einer Minute. */
export const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN ?? 300);
// Wer den Kliqtape-Kanal bespielen darf (routes/news.ts) — ein beanspruchter
// Name wie jeder andere, nur dieser eine darf dort posten. Leer per Default:
// ohne gesetzten Namen kann niemand posten, der Kanal ist dann leer.
export const ADMIN_NAME = process.env.ADMIN_NAME ?? '';
/** Nur fuer Vorfuehrungen (DEMO_TOOLS=1): jeder Challenge-Typ laesst sich
 *  sofort starten und aufloesen, statt bis Sonntagabend zu warten. */
export const DEMO_TOOLS = process.env.DEMO_TOOLS === '1';
/** Wo die Datenbank liegt (und, ohne eigene Schluessel, die VAPID-Schluessel). */
export const DATA_DIR = process.env.DATA_DIR ?? './data';
/** Wochen-Erinnerung per Web-Push. Leer: Schluessel werden einmal erzeugt und
 *  in DATA_DIR/vapid.json abgelegt. SUBJECT ist die Kontaktadresse fuer die
 *  Push-Dienste (mailto: oder https:). */
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:kontakt@kliqtape.invalid';
/** Oeffentliche Adresse fuer den QR-Code. Ohne Angabe die, von der aus der
 *  Brief angefordert wurde (Origin-Header). */
export const PUBLIC_URL = (process.env.PUBLIC_URL ?? '').replace(/\/$/, '');

mkdirSync(MEDIA_DIR, { recursive: true });
mkdirSync(DATA_DIR, { recursive: true });
