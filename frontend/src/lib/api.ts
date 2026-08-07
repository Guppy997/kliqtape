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
  /** Fest gewaehlte Bandsorte (0-5) — anders als colorSeed kein Hash-Zufall,
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

export function fetchCassettes(me: string): Promise<Cassette[]> {
  return apiFetch(`/api/cassettes?me=${encodeURIComponent(me)}`).then(unwrap<Cassette[]>);
}

export function fetchMembers(id: string): Promise<Member[]> {
  return apiFetch(`/api/cassettes/${id}/members`).then(unwrap<Member[]>);
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

export function setCassetteColorSeed(
  id: string,
  colorSeed: string | null,
  by: string,
): Promise<{ id: string; colorSeed: string | null }> {
  return apiFetch(`/api/cassettes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ colorSeed, by }),
  }).then(unwrap<{ id: string; colorSeed: string | null }>);
}

/** Feste Wahl einer der 6 Bandsorten (0-5), oder null fuer zurueck zu automatisch. */
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

export function addMember(id: string, member: string, by: string): Promise<Member> {
  return apiFetch(`/api/cassettes/${id}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ member, by }),
  }).then(unwrap<Member>);
}

export function removeMember(id: string, member: string, by: string): Promise<void> {
  return apiFetch(
    `/api/cassettes/${id}/members/${encodeURIComponent(member)}?by=${encodeURIComponent(by)}`,
    { method: 'DELETE' },
  ).then(unwrap<void>);
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

export interface FavoriteTape {
  tapeIndex: number;
  name: string | null;
  favoritedAt: number;
}

export function fetchTapes(cassetteId: string, me: string): Promise<TapeOverride[]> {
  return apiFetch(`/api/cassettes/${cassetteId}/tapes?me=${encodeURIComponent(me)}`).then(unwrap<TapeOverride[]>);
}

export function fetchFavoriteTapes(cassetteId: string, me: string): Promise<FavoriteTape[]> {
  return apiFetch(`/api/cassettes/${cassetteId}/tapes/favorites?me=${encodeURIComponent(me)}`).then(
    unwrap<FavoriteTape[]>,
  );
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
  return apiFetch(
    `/api/cassettes/${cassetteId}/tapes/${tapeIndex}/favorite?by=${encodeURIComponent(by)}`,
    { method: 'DELETE' },
  ).then(unwrap<void>);
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
  /** Live aufgenommen oder aus der Galerie — wird unterschiedlich dargestellt. */
  source: 'camera' | 'upload';
  tapeId: string | null;
  tape: { title: string; coverId: string | null; trackCount: number } | null;
  track: string;
  /** Nur auf Seite A gesetzt — welches Tape (Kalendertag) dieser Post gehoert. */
  tapeIndex: number | null;
  /** Nur bei eigenen Beitraegen gesetzt — Tonfetzen sind privat, siehe server.ts. */
  tonfetzenCount: number;
  /** Ob ich selbst schon einen Tonfetzen geschickt habe — wer genau, sieht niemand ausser der postenden Person. */
  iSentTonfetzen: boolean;
  noteStyle: NoteStyle | null;
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

/** Laedt einen Blob hoch und gibt die Medien-ID zurueck. */
export async function uploadMedia(blob: Blob, durationMs?: number): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': blob.type };
  if (durationMs != null) headers['X-Duration-Ms'] = String(Math.round(durationMs));

  const { id } = await apiFetch('/api/media', { method: 'POST', headers, body: blob }).then(
    unwrap<{ id: string }>,
  );
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

/** Nur die postende Person darf das abrufen — siehe server.ts. */
export function fetchTonfetzen(postId: string, me: string): Promise<Tonfetzen[]> {
  return apiFetch(`/api/posts/${postId}/reactions?me=${encodeURIComponent(me)}`).then(unwrap<Tonfetzen[]>);
}

export function deletePost(postId: string): Promise<void> {
  return apiFetch(`/api/posts/${postId}`, { method: 'DELETE' }).then(unwrap<void>);
}

export const mediaUrl = (id: string) => `/api/media/${id}`;

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

export function patchMixtape(
  id: string,
  patch: { title?: string; note?: string; coverId?: string | null },
): Promise<Mixtape> {
  return apiFetch(`/api/mixtapes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then(unwrap<Mixtape>);
}

export function addTrack(
  id: string,
  track: { title: string; artist: string; url: string },
): Promise<Mixtape> {
  return apiFetch(`/api/mixtapes/${id}/tracks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(track),
  }).then(unwrap<Mixtape>);
}

export function removeTrack(id: string, trackId: string): Promise<Mixtape> {
  return apiFetch(`/api/mixtapes/${id}/tracks/${trackId}`, { method: 'DELETE' }).then(unwrap<Mixtape>);
}

export function sealMixtape(id: string): Promise<Mixtape> {
  return apiFetch(`/api/mixtapes/${id}/seal`, { method: 'POST' }).then(unwrap<Mixtape>);
}

export function deleteMixtape(id: string): Promise<void> {
  return apiFetch(`/api/mixtapes/${id}`, { method: 'DELETE' }).then(unwrap<void>);
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
