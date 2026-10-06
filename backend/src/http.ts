/** Fehler mit HTTP-Status, damit die zentrale Middleware (server.ts) sauber
 *  antworten kann. Wird in Routen einfach geworfen — Express 4 faengt
 *  synchrone Fehler selbst. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
