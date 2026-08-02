import type { Side } from '@/store/appStore';

export type Kind = 'text' | 'photo' | 'video' | 'voice' | 'tape';

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
  return fetch(`/api/cassettes?me=${encodeURIComponent(me)}`).then(unwrap<Cassette[]>);
}

export function fetchMembers(id: string): Promise<Member[]> {
  return fetch(`/api/cassettes/${id}/members`).then(unwrap<Member[]>);
}

export function createCassette(name: string, by: string): Promise<Cassette> {
  return fetch('/api/cassettes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, by }),
  }).then(unwrap<Cassette>);
}

export function renameCassette(id: string, name: string, by: string): Promise<{ id: string }> {
  return fetch(`/api/cassettes/${id}`, {
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
  return fetch(`/api/cassettes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ colorSeed, by }),
  }).then(unwrap<{ id: string; colorSeed: string | null }>);
}

export function addMember(id: string, member: string, by: string): Promise<Member> {
  return fetch(`/api/cassettes/${id}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ member, by }),
  }).then(unwrap<Member>);
}

export function removeMember(id: string, member: string, by: string): Promise<void> {
  return fetch(
    `/api/cassettes/${id}/members/${encodeURIComponent(member)}?by=${encodeURIComponent(by)}`,
    { method: 'DELETE' },
  ).then(unwrap<void>);
}

export interface FeedItem {
  id: string;
  cassetteId: string;
  /** Nur auf Seite B gesetzt: Zeitpunkt, an dem der Beitrag überspielt wird. */
  expiresAt: number | null;
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
  reactors: string[];
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const msg = await res
      .json()
      .then((j) => j.error as string)
      .catch(() => `Serverfehler ${res.status}`);
    throw new Error(msg);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export function fetchFeed(cassetteId: string, side: Side): Promise<FeedItem[]> {
  return fetch(`/api/posts?cassette=${cassetteId}&side=${side}`).then(unwrap<FeedItem[]>);
}

/** Laedt einen Blob hoch und gibt die Medien-ID zurueck. */
export async function uploadMedia(blob: Blob, durationMs?: number): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': blob.type };
  if (durationMs != null) headers['X-Duration-Ms'] = String(Math.round(durationMs));

  const { id } = await fetch('/api/media', { method: 'POST', headers, body: blob }).then(
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
}): Promise<{ id: string }> {
  return fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then(unwrap<{ id: string }>);
}

export function toggleReaction(postId: string, author: string): Promise<{ reacted: boolean }> {
  return fetch(`/api/posts/${postId}/react`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author }),
  }).then(unwrap<{ reacted: boolean }>);
}

export function deletePost(postId: string): Promise<void> {
  return fetch(`/api/posts/${postId}`, { method: 'DELETE' }).then(unwrap<void>);
}

export const mediaUrl = (id: string) => `/api/media/${id}`;

/* --- Hot Line ------------------------------------------------------------ */

export const HOTLINE_MAX = 240;

export interface Hotline {
  id: string;
  from: string;
  body: string;
  createdAt: number;
  expiresAt: number;
  heard: boolean;
  /** Optionaler Bezug auf einen Beitrag — Hotlines gehen auch direkt an eine Person. */
  post: { id: string; side: Side; kind: Kind; body: string } | null;
}

export function fetchHotlines(me: string): Promise<Hotline[]> {
  return fetch(`/api/hotlines?me=${encodeURIComponent(me)}`).then(unwrap<Hotline[]>);
}

export function sendHotline(input: {
  postId?: string | null;
  from: string;
  to: string;
  body: string;
}): Promise<{ id: string; expiresAt: number }> {
  return fetch('/api/hotlines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then(unwrap<{ id: string; expiresAt: number }>);
}

export function markHeard(id: string): Promise<{ heard: boolean }> {
  return fetch(`/api/hotlines/${id}/heard`, { method: 'POST' }).then(unwrap<{ heard: boolean }>);
}

export function deleteHotline(id: string): Promise<void> {
  return fetch(`/api/hotlines/${id}`, { method: 'DELETE' }).then(unwrap<void>);
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
  return fetch(`/api/mixtapes?me=${encodeURIComponent(me)}`).then(unwrap<Mixtape[]>);
}

export function fetchMixtape(id: string, me: string): Promise<Mixtape> {
  return fetch(`/api/mixtapes/${id}?me=${encodeURIComponent(me)}`).then(unwrap<Mixtape>);
}

export function createMixtape(from: string, to: string, title: string): Promise<Mixtape> {
  return fetch('/api/mixtapes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, title }),
  }).then(unwrap<Mixtape>);
}

export function patchMixtape(
  id: string,
  patch: { title?: string; note?: string; coverId?: string | null },
): Promise<Mixtape> {
  return fetch(`/api/mixtapes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then(unwrap<Mixtape>);
}

export function addTrack(
  id: string,
  track: { title: string; artist: string; url: string },
): Promise<Mixtape> {
  return fetch(`/api/mixtapes/${id}/tracks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(track),
  }).then(unwrap<Mixtape>);
}

export function removeTrack(id: string, trackId: string): Promise<Mixtape> {
  return fetch(`/api/mixtapes/${id}/tracks/${trackId}`, { method: 'DELETE' }).then(unwrap<Mixtape>);
}

export function sealMixtape(id: string): Promise<Mixtape> {
  return fetch(`/api/mixtapes/${id}/seal`, { method: 'POST' }).then(unwrap<Mixtape>);
}

export function deleteMixtape(id: string): Promise<void> {
  return fetch(`/api/mixtapes/${id}`, { method: 'DELETE' }).then(unwrap<void>);
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
  const res = await fetch(`/api/export?me=${encodeURIComponent(me)}`);
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
  return fetch(`/api/me?me=${encodeURIComponent(me)}`, { method: 'DELETE' }).then(
    unwrap<{ geloescht: Record<string, number> }>,
  );
}

/* --- Profile ------------------------------------------------------------- */

export interface Profile {
  name: string;
  avatarId: string | null;
}

export function fetchProfiles(): Promise<Profile[]> {
  return fetch('/api/profiles').then(unwrap<Profile[]>);
}

export function saveProfile(name: string, avatarId: string | null): Promise<Profile> {
  return fetch(`/api/profiles/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarId }),
  }).then(unwrap<Profile>);
}
