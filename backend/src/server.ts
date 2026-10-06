import express from 'express';
import rateLimit from 'express-rate-limit';
import { type ErrorRequestHandler } from 'express';
import { MAX_UPLOAD_MB, MEDIA_DIR, PORT, RATE_LIMIT_PER_MIN } from './config.js';
import { HttpError } from './http.js';
import { mediaRouter } from './media.js';
import { accountRouter } from './routes/account.js';
import { cassettesRouter } from './routes/cassettes.js';
import { lettersRouter } from './routes/letters.js';
import { reportsRouter } from './routes/reports.js';
import { filmRouter } from './routes/film.js';
import { imposterRouter } from './routes/imposter.js';
import { albumRouter } from './routes/album.js';
import { postsRouter } from './routes/posts.js';
import { tapesRouter } from './routes/tapes.js';
import { storiesRouter } from './routes/stories.js';
import { newsRouter } from './routes/news.js';
import { hotlineRouter } from './routes/hotline.js';
import { mixtapesRouter } from './routes/mixtapes.js';

/*
 * Einstieg des Backends: App, Middleware, Routen, Fehlerbehandlung. Die
 * Routen liegen nach Bereichen in routes/, gemeinsame Bausteine daneben
 * (access.ts: Zugangscode und Mitgliedschaft, media.ts, time.ts, db.ts).
 */

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Caddy sitzt davor — sonst zaehlt das Limit unten alle IPs als eine.
app.use(express.json({ limit: '256kb' }));
// Grosszuegig, nur als Netz gegen Missbrauch/Bugs, sobald die API nicht mehr
// nur uebers Tailnet erreichbar ist — nicht als Schutz vor gezielten Angriffen gedacht.
app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    limit: RATE_LIMIT_PER_MIN,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

app.use(mediaRouter);
app.use(accountRouter);
app.use(cassettesRouter);
app.use(lettersRouter);
app.use(reportsRouter);
app.use(filmRouter);
app.use(imposterRouter);
app.use(albumRouter);
app.use(postsRouter);
app.use(tapesRouter);
app.use(storiesRouter);
app.use(newsRouter);
app.use(hotlineRouter);
app.use(mixtapesRouter);

/* -------------------------------------------------------------------------
 * Zentrale Fehlerbehandlung — gibt immer JSON zurueck, nie HTML.
 * Der vierte Parameter ist Pflicht, sonst erkennt Express die Middleware nicht.
 * ---------------------------------------------------------------------- */
const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : err?.type === 'entity.too.large' ? 413 : 500;
  const message =
    status === 413
      ? `Zu groß — maximal ${MAX_UPLOAD_MB} MB`
      : err instanceof HttpError
        ? err.message
        : 'Unerwarteter Serverfehler';

  if (status >= 500) console.error('[kliqtape]', err);
  res.status(status).json({ error: message });
};
app.use(onError);

app.listen(PORT, () => {
  console.log(`[kliqtape] Backend läuft auf :${PORT} — Medien in ${MEDIA_DIR}`);
});
