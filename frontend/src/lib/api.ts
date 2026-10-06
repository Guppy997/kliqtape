import { useApp, type Side } from '@/store/appStore';

/** Haengt den Zugangscode aus dem Store an jede Anfrage — einmal hier statt
 *  an jeder der ~35 Stellen unten einzeln. `useApp.getState()` statt eines
 *  Hooks, weil api.ts keine Komponente ist. */
function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = useApp.getState().token;
  const headers = new Headers(options.headers);
  if (token) headers.set('X-Auth-Token', token);
  return fetch(url, { ...options, headers });
}

export type Kind = 'text' | 'photo' | 'video' | 'voice' | 'tape';
/** Wie ein Zettel "befestigt" ist. */
export type NoteStyle = 'tape' | 'pin' | 'staple' | 'clip' | 'fold';
export const NOTE_STYLES: NoteStyle[] = ['tape', 'pin', 'staple', 'clip', 'fold'];

/** Anzeigenamen der Beitragsarten. Bewusst aus der Analogwelt. */
export const KIND_LABEL: Record<Kind, string> = {
  tape: 'Mixtape',
  voice: 'O-Ton',
  photo: 'Schnappschuss',
  video: 'Clip',
  text: 'Zettel',
};

export interface Cassette {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
  /** Manueller Override fuer die Bandsorte — normalerweise null, dann zaehlt die ID. */
  colorSeed: string | null;
  /** Fest gewaehlte Bandsorte (0 bis PAIR_COUNT-1) — anders als colorSeed kein Hash-Zufall,
   *  sondern die IMMER angezeigte Sorte. Null = weiterhin automatisch. */
  colorIndex: number | null;
  memberCount: number;
  sideA: number;
  sideB: number;
  lastAt: number | null;
}

export interface Member {
  name: string;
  addedBy: string;
  joinedAt: number;
}

/** Eine offene Einladung auf ein Band — muss von invitee erst angenommen
 *  werden, bevor daraus eine echte Mitgliedschaft wird. */
export interface Invite {
  id: string;
  cassetteId: string;
  cassetteName: string;
  invitedBy: string;
  createdAt: number;
  colorSeed: string | null;
  colorIndex: number | null;
}

export function fetchCassettes(me: string): Promise<Cassette[]> {
  return apiFetch(`/api/cassettes?me=${encodeURIComponent(me)}`).then(unwrap<Cassette[]>);
}

export function fetchMembers(id: string, me: string): Promise<Member[]> {
  return apiFetch(`/api/cassettes/${id}/members?me=${encodeURIComponent(me)}`).then(unwrap<Member[]>);
}

/* --- Melden ----------------------------------------------------------------
 * Nur speichern und bestaetigen — im Prototyp liest das kein Moderationsteam
 * automatisch, die Meldungen liegen in der Datenbank (backend/src/routes/reports.ts). */

export type ReportReason = 'spam' | 'harassment' | 'violence' | 'illegal' | 'other';
export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'harassment', label: 'Belästigung oder Mobbing' },
  { key: 'violence', label: 'Gewalt oder Drohung' },
  { key: 'illegal', label: 'Illegale Inhalte' },
  { key: 'spam', label: 'Spam oder Werbung' },
  { key: 'other', label: 'Etwas anderes' },
];

export type ReportTarget = { cassetteId: string } | { postId: string };

export function sendReport(
  target: ReportTarget,
  reason: ReportReason,
  note: string,
  by: string,
): Promise<{ id: string }> {
  return apiFetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...target, reason, note, by }),
  }).then(unwrap<{ id: string }>);
}

export function createCassette(name: string, by: string): Promise<Cassette> {
  return apiFetch('/api/cassettes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, by }),
  }).then(unwrap<Cassette>);
}

export function renameCassette(id: string, name: string, by: string): Promise<{ id: string }> {
  return apiFetch(`/api/cassettes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, by }),
  }).then(unwrap<{ id: string }>);
}

/** Feste Wahl einer Bandsorte (0 bis PAIR_COUNT-1, siehe cassetteLook.ts), oder null fuer automatisch. */
export function setCassetteColorIndex(
  id: string,
  colorIndex: number | null,
  by: string,
): Promise<{ id: string; colorIndex: number | null }> {
  return apiFetch(`/api/cassettes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ colorIndex, by }),
  }).then(unwrap<{ id: string; colorIndex: number | null }>);
}

/** Legt eine Einladung an — die Person ist erst Mitglied, wenn sie zustimmt
 *  (siehe fetchInvites/acceptInvite unten). */
export function inviteMember(id: string, invitee: string, by: string): Promise<{ id: string }> {
  return apiFetch(`/api/cassettes/${id}/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invitee, by }),
  }).then(unwrap<{ id: string }>);
}

export function fetchInvites(me: string): Promise<Invite[]> {
  return apiFetch(`/api/invites?me=${encodeURIComponent(me)}`).then(unwrap<Invite[]>);
}

export function acceptInvite(id: string, me: string): Promise<{ cassetteId: string; cassetteName: string }> {
  return apiFetch(`/api/invites/${id}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ me }),
  }).then(unwrap<{ cassetteId: string; cassetteName: string }>);
}

export function declineInvite(id: string, me: string): Promise<void> {
  return apiFetch(`/api/invites/${id}/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ me }),
  }).then(unwrap<void>);
}

export function removeMember(id: string, member: string, by: string): Promise<void> {
  return apiFetch(`/api/cassettes/${id}/members/${encodeURIComponent(member)}?by=${encodeURIComponent(by)}`, {
    method: 'DELETE',
  }).then(unwrap<void>);
}

/** Löscht die ganze Kassette samt aller Beiträge und Medien — endgültig. */
export function deleteCassette(id: string, by: string): Promise<{ geloescht: { posts: number; medien: number } }> {
  return apiFetch(`/api/cassettes/${id}?by=${encodeURIComponent(by)}`, { method: 'DELETE' }).then(
    unwrap<{ geloescht: { posts: number; medien: number } }>,
  );
}

/* --- Tapes — Seite A in Kalendertage gegliedert --------------------------
 * Ein Tape ist ein Kalendertag seit Gruendung der Kassette (Europe/Berlin).
 * Kassettenweit benennbar, pro Person favorisierbar. Sparse: nur Tapes mit
 * Name und/oder Favorit tauchen in fetchTapes() auf.
 * ------------------------------------------------------------------------ */

export interface TapeOverride {
  tapeIndex: number;
  name: string | null;
  favoriteCount: number;
  favoritedByMe: boolean;
}

export function fetchTapes(cassetteId: string, me: string): Promise<TapeOverride[]> {
  return apiFetch(`/api/cassettes/${cassetteId}/tapes?me=${encodeURIComponent(me)}`).then(unwrap<TapeOverride[]>);
}

/** Leerer Name loescht die Benennung wieder. */
export function setTapeName(
  cassetteId: string,
  tapeIndex: number,
  name: string,
  by: string,
): Promise<{ tapeIndex: number; name: string | null }> {
  return apiFetch(`/api/cassettes/${cassetteId}/tapes/${tapeIndex}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, by }),
  }).then(unwrap<{ tapeIndex: number; name: string | null }>);
}

export function favoriteTape(cassetteId: string, tapeIndex: number, by: string): Promise<void> {
  return apiFetch(`/api/cassettes/${cassetteId}/tapes/${tapeIndex}/favorite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ by }),
  }).then(unwrap<void>);
}

export function unfavoriteTape(cassetteId: string, tapeIndex: number, by: string): Promise<void> {
  return apiFetch(`/api/cassettes/${cassetteId}/tapes/${tapeIndex}/favorite?by=${encodeURIComponent(by)}`, {
    method: 'DELETE',
  }).then(unwrap<void>);
}

export interface FeedItem {
  id: string;
  cassetteId: string;
  side: Side;
  author: string;
  kind: Kind;
  body: string;
  created_at: number;
  mediaId: string | null;
  durationMs: number | null;
  /** Live aufgenommen, aus der Galerie, entwickelter Film oder Beitrag
   *  einer Imposter-Woche — wird jeweils anders dargestellt. */
  source: 'camera' | 'upload' | 'film' | 'imposter';
  /** Nur beim Film: wann belichtet wurde. created_at ist die Freigabe. */
  takenAt: number | null;
  /** Beitrag aus einer Imposter-Woche: 'entry' vor der Aufloesung, danach
   *  'imposter' oder 'crew'. */
  imposterMark: 'entry' | 'imposter' | 'crew' | null;
  tapeId: string | null;
  tape: { title: string; coverId: string | null; trackCount: number } | null;
  track: string;
  /** Nur auf Seite A gesetzt — welches Tape (Kalendertag) dieser Post gehoert. */
  tapeIndex: number | null;
  /** Nur bei eigenen Beitraegen gesetzt — Tonfetzen sind privat, siehe backend/src/routes/posts.ts. */
  tonfetzenCount: number;
  /** Ob ich selbst schon einen Tonfetzen geschickt habe — wer genau, sieht niemand ausser der postenden Person. */
  iSentTonfetzen: boolean;
  noteStyle: NoteStyle | null;
  /** Nur auf Seite B gesetzt — Bruecke zu einem Seite-A-Beitrag, auf den
   *  diese Nachricht eingeht ("dazu schreiben"). */
  quotedPostId: string | null;
  quotedPost: { id: string; author: string; kind: Kind; body: string; mediaId: string | null } | null;
  /** Nur lokal, nie vom Server — optimistisch angehaengt, waehrend der Post
   *  noch unterwegs ist (siehe lib/chat.ts). */
  pending?: boolean;
}

export interface Tonfetzen {
  author: string;
  mediaId: string;
  createdAt: number;
}

/** Wie Error, nur mit dem HTTP-Status dabei — z.B. um 409 ("Name schon
 *  vergeben") von anderen Fehlern zu unterscheiden, ohne den deutschen
 *  Fehlertext zu parsen. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const msg = await res
      .json()
      .then((j) => j.error as string)
      .catch(() => `Serverfehler ${res.status}`);
    throw new ApiError(res.status, msg);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/* --- Identitaet ------------------------------------------------------------
 * Minimaler Ersatz fuer ein Login: ein Token pro Name, einmal beim ersten
 * Beanspruchen ausgegeben. Bewusst ohne apiFetch() — beim Claimen gibt es
 * noch keinen gespeicherten Token, und whoami() prueft explizit einen
 * *eingetippten* Token, nicht zwingend den im Store liegenden.
 * ------------------------------------------------------------------------ */

export function claimName(name: string): Promise<{ name: string; token: string }> {
  return fetch('/api/auth/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }).then(unwrap<{ name: string; token: string }>);
}

export function whoami(token: string): Promise<{ name: string }> {
  return fetch('/api/auth/whoami', { headers: { 'X-Auth-Token': token } }).then(unwrap<{ name: string }>);
}

/** Echter, serverseitiger Umzug auf einen neuen Namen — der Token bleibt
 *  derselbe. Nutzt apiFetch(), der aktuelle Token aus dem Store identifiziert
 *  serverseitig, wer da umbenennt. */
export function renameIdentity(name: string): Promise<{ name: string }> {
  return apiFetch('/api/auth/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }).then(unwrap<{ name: string }>);
}

export function fetchFeed(cassetteId: string, side: Side, me: string): Promise<FeedItem[]> {
  return apiFetch(`/api/posts?cassette=${cassetteId}&side=${side}&me=${encodeURIComponent(me)}`).then(
    unwrap<FeedItem[]>,
  );
}

/* --- Entwickelter Film ------------------------------------------------------
 * Ein Bild pro Person, Kassette und Woche. Bis Sonntagabend liefert der
 * Server es an niemanden aus (backend/src/media.ts, isUnreleasedMedia). */

export interface FilmShot {
  id: string;
  author: string;
  mediaId: string;
  caption: string;
  takenAt: number;
}

export interface FilmStatus {
  /** Wann der laufende Film entwickelt wird (Sonntag 19:00 Berlin). */
  nextRelease: number;
  /** Ob ich diese Woche schon belichtet habe — mehr verraet der Server nicht. */
  iShot: boolean;
  /** Der zuletzt entwickelte Film dieser Kassette, falls es einen gibt. */
  developed: { at: number; shots: FilmShot[] } | null;
  demoTools: boolean;
}

export function fetchFilm(cassetteId: string, me: string): Promise<FilmStatus> {
  return apiFetch(`/api/cassettes/${cassetteId}/film?me=${encodeURIComponent(me)}`).then(unwrap<FilmStatus>);
}

export function shootFilm(
  cassetteId: string,
  author: string,
  mediaId: string,
  caption: string,
): Promise<{ id: string; developAt: number }> {
  return apiFetch(`/api/cassettes/${cassetteId}/film`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author, mediaId, caption }),
  }).then(unwrap<{ id: string; developAt: number }>);
}

/** Nur mit DEMO_TOOLS=1 auf dem Server, nur fuer die Gruenderin. */
export function developFilmNow(cassetteId: string, by: string): Promise<{ developed: number }> {
  return apiFetch(`/api/cassettes/${cassetteId}/film/develop-now`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ by }),
  }).then(unwrap<{ developed: number }>);
}

/* --- Imposter-Woche ---------------------------------------------------------
 * Ein Special ab vier Leuten. Der Server verraet vor der Aufloesung nur der
 * Imposter-Person selbst, dass sie es ist, und liefert nie Stimmenzahlen. */

export interface ImposterEntry {
  postId: string;
  author: string;
  kind: Kind;
  body: string;
  mediaId: string | null;
}

export interface ImposterWeek {
  id: string;
  phase: 'playing' | 'voting' | 'revealed';
  startedBy: string;
  startedAt: number;
  revealAt: number;
  votingEndsAt: number;
  entryKind: 'photo' | 'text';
  card: { imposter: boolean; text: string };
  iSubmitted: boolean;
  entries: ImposterEntry[];
  myVote: string | null;
  voted: string[];
  result: { imposter: string; task: string; hint: string; caught: boolean; revealedAt: number } | null;
}

export interface ImposterStatus {
  week: ImposterWeek | null;
  canStart: boolean;
  minMembers: number;
  nextStartAt: number | null;
  demoTools: boolean;
}

export function fetchImposter(cassetteId: string, me: string): Promise<ImposterStatus> {
  return apiFetch(`/api/cassettes/${cassetteId}/imposter?me=${encodeURIComponent(me)}`).then(unwrap<ImposterStatus>);
}

function imposterPost<T>(cassetteId: string, path: string, body: unknown): Promise<T> {
  return apiFetch(`/api/cassettes/${cassetteId}/imposter${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(unwrap<T>);
}

export const startImposter = (cassetteId: string, by: string) => imposterPost<{ id: string }>(cassetteId, '', { by });
export const submitImposterEntry = (cassetteId: string, author: string, entry: { mediaId?: string; body?: string }) =>
  imposterPost<{ postId: string }>(cassetteId, '/entry', { author, ...entry });
export const voteImposter = (cassetteId: string, by: string, suspect: string) =>
  imposterPost<{ ok: true }>(cassetteId, '/vote', { by, suspect });
export const revealImposter = (cassetteId: string, by: string) =>
  imposterPost<{ ok: true }>(cassetteId, '/reveal', { by });
/** Nur mit DEMO_TOOLS=1 auf dem Server, nur fuer die Gruenderin. */
export const imposterNow = (cassetteId: string, by: string) => imposterPost<{ ok: true }>(cassetteId, '/now', { by });

/** Laedt einen Blob hoch und gibt die Medien-ID zurueck. */
export async function uploadMedia(blob: Blob, durationMs?: number): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': blob.type };
  if (durationMs != null) headers['X-Duration-Ms'] = String(Math.round(durationMs));

  const { id } = await apiFetch('/api/media', { method: 'POST', headers, body: blob }).then(unwrap<{ id: string }>);
  return id;
}

export function createPost(input: {
  cassetteId: string;
  side: Side;
  author: string;
  kind: Kind;
  body?: string;
  mediaId?: string | null;
  tapeId?: string | null;
  source?: 'camera' | 'upload';
  noteStyle?: NoteStyle | null;
  /** Nur auf Seite B: bezieht sich diese Nachricht auf einen Seite-A-Beitrag. */
  quotedPostId?: string | null;
}): Promise<{ id: string }> {
  return apiFetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then(unwrap<{ id: string }>);
}

export function sendTonfetzen(postId: string, author: string, mediaId: string): Promise<{ mediaId: string }> {
  return apiFetch(`/api/posts/${postId}/react`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author, mediaId }),
  }).then(unwrap<{ mediaId: string }>);
}

/** Nur die postende Person darf das abrufen — siehe backend/src/routes/posts.ts. */
export function fetchTonfetzen(postId: string, me: string): Promise<Tonfetzen[]> {
  return apiFetch(`/api/posts/${postId}/reactions?me=${encodeURIComponent(me)}`).then(unwrap<Tonfetzen[]>);
}

export function deletePost(postId: string, me: string): Promise<void> {
  return apiFetch(`/api/posts/${postId}?me=${encodeURIComponent(me)}`, { method: 'DELETE' }).then(unwrap<void>);
}

export const mediaUrl = (id: string) => `/api/media/${id}`;

/* --- Storys ------------------------------------------------------------
 * Kassettenuebergreifend, nur Foto/Video, verschwinden nach 24h — siehe
 * backend/src/routes/stories.ts fuer die Sichtbarkeits-Regel (jeder, mit dem man in
 * irgendeiner Kassette zusammen ist).
 * ------------------------------------------------------------------------ */

export type StoryKind = 'photo' | 'video';

export interface Story {
  id: string;
  kind: StoryKind;
  mediaId: string;
  durationMs: number | null;
  createdAt: number;
  expiresAt: number;
}

export interface StoryGroup {
  author: string;
  stories: Story[];
}

export function fetchStories(me: string): Promise<StoryGroup[]> {
  return apiFetch(`/api/stories?me=${encodeURIComponent(me)}`).then(unwrap<StoryGroup[]>);
}

export function createStory(input: {
  author: string;
  kind: StoryKind;
  mediaId: string;
}): Promise<{ id: string; expiresAt: number }> {
  return apiFetch('/api/stories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then(unwrap<{ id: string; expiresAt: number }>);
}

export function deleteStory(id: string, me: string): Promise<void> {
  return apiFetch(`/api/stories/${id}?me=${encodeURIComponent(me)}`, { method: 'DELETE' }).then(unwrap<void>);
}

/* --- Kliqtape-Kanal ------------------------------------------------------
 * News/Insights von den Betreiber:innen — dauerhaft, fuer alle sichtbar,
 * schreiben darf serverseitig nur ADMIN_NAME. `canPost` sagt dem Frontend,
 * ob die aktuell angemeldete Person das ist, ohne den Servernamen selbst zu
 * kennen.
 * ------------------------------------------------------------------------ */

export type NewsKind = 'text' | 'photo' | 'video';

export interface NewsPost {
  id: string;
  author: string;
  kind: NewsKind;
  body: string;
  mediaId: string | null;
  durationMs: number | null;
  createdAt: number;
}

export interface ProjectFunding {
  balance: string;
  note: string;
  updatedAt: number;
}

export interface NewsFeed {
  canPost: boolean;
  funding: ProjectFunding;
  posts: NewsPost[];
}

export function fetchNews(me: string): Promise<NewsFeed> {
  return apiFetch(`/api/news?me=${encodeURIComponent(me)}`).then(unwrap<NewsFeed>);
}

export function updateProjectFunding(input: { me: string; balance: string; note: string }): Promise<void> {
  return apiFetch('/api/news/funding', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then(unwrap<void>);
}

export function createNewsPost(input: {
  author: string;
  kind: NewsKind;
  body?: string;
  mediaId?: string | null;
}): Promise<{ id: string }> {
  return apiFetch('/api/news', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then(unwrap<{ id: string }>);
}

export function deleteNewsPost(id: string, me: string): Promise<void> {
  return apiFetch(`/api/news/${id}?me=${encodeURIComponent(me)}`, { method: 'DELETE' }).then(unwrap<void>);
}

/* --- Hot Line --------------------------------------------------------------
 * Eine offene Leitung zwischen zwei Personen, dauerhaft — die erste
 * Nachricht eroeffnet sie, danach ein echter Verlauf ohne Verfall.
 * ------------------------------------------------------------------------ */

export const HOTLINE_MAX = 240;

export interface HotlineThread {
  id: string;
  /** Die jeweils andere Person in der Leitung. */
  other: string;
  createdAt: number;
  lastBody: string | null;
  /** Art der letzten Nachricht — fuers Vorschau-Label bei Foto/Video/O-Ton/Mixtape. */
  lastKind: Kind | null;
  lastFrom: string | null;
  lastAt: number | null;
  unread: number;
}

export interface HotlineMessage {
  id: string;
  from: string;
  body: string;
  /** Wie bei posts — Hot Line kann seit Etappe "modernerer Chat" dieselben Arten. */
  kind: Kind;
  mediaId: string | null;
  durationMs: number | null;
  tapeId: string | null;
  tape: { title: string; coverId: string | null; trackCount: number } | null;
  source: 'camera' | 'upload' | null;
  createdAt: number;
  heard: boolean;
  /** Nur lokal, nie vom Server — optimistisch angehaengt (siehe lib/chat.ts). */
  pending?: boolean;
}

export interface HotlineThreadDetail {
  id: string;
  other: string;
  createdAt: number;
  messages: HotlineMessage[];
}

export function fetchHotlineThreads(me: string): Promise<HotlineThread[]> {
  return apiFetch(`/api/hotlines/threads?me=${encodeURIComponent(me)}`).then(unwrap<HotlineThread[]>);
}

export function fetchHotlineThread(id: string, me: string): Promise<HotlineThreadDetail> {
  return apiFetch(`/api/hotlines/threads/${id}/messages?me=${encodeURIComponent(me)}`).then(
    unwrap<HotlineThreadDetail>,
  );
}

/** Schickt eine Nachricht — findet die Leitung zu `to` oder eröffnet eine neue. */
export function sendHotlineMessage(input: {
  from: string;
  to: string;
  body?: string;
  kind?: Kind;
  mediaId?: string | null;
  tapeId?: string | null;
  source?: 'camera' | 'upload';
}): Promise<{ threadId: string; messageId: string }> {
  return apiFetch('/api/hotlines/threads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then(unwrap<{ threadId: string; messageId: string }>);
}

export function markThreadHeard(id: string, me: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/hotlines/threads/${id}/heard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ me }),
  }).then(unwrap<{ ok: boolean }>);
}

/* --- Mixtapes ------------------------------------------------------------ */

export const MAX_TRACKS = 12;

export interface Track {
  id: string;
  position: number;
  title: string;
  artist: string;
  url: string;
}

export interface Mixtape {
  id: string;
  from: string;
  to: string;
  title: string;
  note: string;
  coverId: string | null;
  sealed: boolean;
  sealedAt: number | null;
  createdAt: number;
  tracks: Track[];
  trackCount: number;
}

export function fetchMixtapes(me: string): Promise<Mixtape[]> {
  return apiFetch(`/api/mixtapes?me=${encodeURIComponent(me)}`).then(unwrap<Mixtape[]>);
}

export function fetchMixtape(id: string, me: string): Promise<Mixtape> {
  return apiFetch(`/api/mixtapes/${id}?me=${encodeURIComponent(me)}`).then(unwrap<Mixtape>);
}

export function createMixtape(from: string, to: string, title: string): Promise<Mixtape> {
  return apiFetch('/api/mixtapes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, title }),
  }).then(unwrap<Mixtape>);
}

/* Alle veraendernden Tape-Aufrufe schicken `me` mit — der Server prueft
   damit, dass wirklich der Absender am Werk ist (requireTapeOwner). */

export function patchMixtape(
  id: string,
  me: string,
  patch: { title?: string; note?: string; coverId?: string | null },
): Promise<Mixtape> {
  return apiFetch(`/api/mixtapes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...patch, me }),
  }).then(unwrap<Mixtape>);
}

export function addTrack(
  id: string,
  me: string,
  track: { title: string; artist: string; url: string },
): Promise<Mixtape> {
  return apiFetch(`/api/mixtapes/${id}/tracks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...track, me }),
  }).then(unwrap<Mixtape>);
}

export function removeTrack(id: string, trackId: string, me: string): Promise<Mixtape> {
  return apiFetch(`/api/mixtapes/${id}/tracks/${trackId}?me=${encodeURIComponent(me)}`, {
    method: 'DELETE',
  }).then(unwrap<Mixtape>);
}

export function sealMixtape(id: string, me: string): Promise<Mixtape> {
  return apiFetch(`/api/mixtapes/${id}/seal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ me }),
  }).then(unwrap<Mixtape>);
}

export function deleteMixtape(id: string, me: string): Promise<void> {
  return apiFetch(`/api/mixtapes/${id}?me=${encodeURIComponent(me)}`, { method: 'DELETE' }).then(unwrap<void>);
}

/** Plattform am Hostnamen erkennen — rein lokal, kein Aufruf nach draußen. */
export function platformOf(url: string): string {
  if (!url) return '';
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    if (h.includes('spotify')) return 'Spotify';
    if (h.includes('music.apple')) return 'Apple Music';
    if (h.includes('youtube') || h.includes('youtu.be')) return 'YouTube';
    if (h.includes('deezer')) return 'Deezer';
    if (h.includes('bandcamp')) return 'Bandcamp';
    if (h.includes('soundcloud')) return 'SoundCloud';
    if (h.includes('tidal')) return 'Tidal';
    return h;
  } catch {
    return '';
  }
}

/* --- Eigene Daten -------------------------------------------------------- */

/** Laedt den kompletten Datenexport als Datei herunter (DSGVO Art. 20). */
export async function downloadExport(me: string): Promise<void> {
  const res = await apiFetch(`/api/export?me=${encodeURIComponent(me)}`);
  if (!res.ok) throw new Error('Export fehlgeschlagen');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kliqtape-${me}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Speichert einen Blob als Datei — derselbe Weg fuer JSON-Export, Album,
 *  Einladungsbrief und Mixtape-Karte. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Manche Browser lesen die URL erst nach dem Klick — kurz stehen lassen.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* --- Einladung als Brief ----------------------------------------------------- */

/** Erzeugt einen neuen Brief (einmal gueltig, 14 Tage) und speichert das PDF.
 *  Gibt die Adresse aus dem QR-Code zurueck, fuer "Link kopieren". */
export async function requestLetter(cassetteId: string, by: string): Promise<string | null> {
  const res = await apiFetch(`/api/cassettes/${cassetteId}/letter.pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ by }),
  });
  if (!res.ok) await unwrap(res);
  saveBlob(await res.blob(), 'kliqtape-einladung.pdf');
  return res.headers.get('X-Letter-Url');
}

export function redeemLetter(
  me: string,
  token: string,
): Promise<{ inviteId: string; cassetteName: string; invitedBy: string }> {
  return apiFetch('/api/letters/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ me, token }),
  }).then(unwrap<{ inviteId: string; cassetteName: string; invitedBy: string }>);
}

/* --- Album-Export -----------------------------------------------------------
 * Nur Seite A. Was im Album landet, entscheidet der Server (View album_posts):
 * nichts Unentwickeltes, nichts von Leuten mit "Meine Beitraege nicht in Alben". */

export interface AlbumPreviewPost {
  id: string;
  author: string;
  kind: Kind;
  body: string;
  mediaId: string | null;
}

export interface AlbumPreview {
  cassetteName: string;
  tapes: { index: number; name: string | null; date: string; posts: AlbumPreviewPost[] }[];
}

export function fetchAlbumPreview(cassetteId: string, me: string): Promise<AlbumPreview> {
  return apiFetch(`/api/cassettes/${cassetteId}/album?me=${encodeURIComponent(me)}`).then(unwrap<AlbumPreview>);
}

export async function downloadAlbum(cassetteId: string, me: string, tapes: number[], name: string): Promise<void> {
  const res = await apiFetch(
    `/api/cassettes/${cassetteId}/album.pdf?me=${encodeURIComponent(me)}&tapes=${tapes.join(',')}`,
  );
  if (!res.ok) await unwrap(res);
  saveBlob(await res.blob(), `kliqtape-album-${name.replace(/[^\p{L}\p{N}]+/gu, '-')}.pdf`);
}

export function fetchAlbumOptOut(me: string): Promise<{ optOut: boolean }> {
  return apiFetch(`/api/me/album?me=${encodeURIComponent(me)}`).then(unwrap<{ optOut: boolean }>);
}

export function setAlbumOptOut(me: string, optOut: boolean): Promise<{ optOut: boolean }> {
  return apiFetch('/api/me/album', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ me, optOut }),
  }).then(unwrap<{ optOut: boolean }>);
}

export function deleteEverything(me: string): Promise<{ geloescht: Record<string, number> }> {
  return apiFetch(`/api/me?me=${encodeURIComponent(me)}`, { method: 'DELETE' }).then(
    unwrap<{ geloescht: Record<string, number> }>,
  );
}

/* --- Profile ------------------------------------------------------------- */

export interface Profile {
  name: string;
  avatarId: string | null;
}

export function fetchProfiles(): Promise<Profile[]> {
  return apiFetch('/api/profiles').then(unwrap<Profile[]>);
}

export function saveProfile(name: string, avatarId: string | null): Promise<Profile> {
  return apiFetch(`/api/profiles/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarId }),
  }).then(unwrap<Profile>);
}
