import { inject } from 'vitest';

// Feste Testpersonen. anna legt in den Tests die Kassetten an, ben ist
// Mitglied, cara ist die Fremde — eingeloggt, aber in keiner Runde.
export const ADMIN = 'Kanal';
export const PEOPLE = {
  anna: 'Anna',
  ben: 'Ben',
  cara: 'Cara',
  dora: 'Dora',
  emil: 'Emil',
  kanal: ADMIN,
} as const;
export type Person = keyof typeof PEOPLE;

export const token = (who: Person) => inject('tokens')[who];
export const nameOf = (who: Person) => PEOPLE[who];

export interface ApiResult<T = any> {
  status: number;
  body: T;
}

/** Kleiner fetch-Wrapper gegen den Test-Server. `as` setzt den Token. */
export async function api<T = any>(
  method: string,
  path: string,
  as?: Person | null,
  body?: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(inject('baseUrl') + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(as ? { 'X-Auth-Token': token(as) } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    /* kein JSON, etwa bei Medien */
  }
  return { status: res.status, body: json };
}

/** Laedt ein winziges Bild hoch — Inhalt egal, der Server prueft nur den Typ. */
export async function upload(as: Person | null, mime = 'image/jpeg'): Promise<ApiResult<{ id: string }>> {
  const res = await fetch(inject('baseUrl') + '/api/media', {
    method: 'POST',
    headers: { 'Content-Type': mime, ...(as ? { 'X-Auth-Token': token(as) } : {}) },
    body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

/** Rohabruf einer Mediendatei, nur der Status interessiert. */
export async function fetchMedia(id: string): Promise<number> {
  const res = await fetch(inject('baseUrl') + `/api/media/${id}`);
  await res.arrayBuffer();
  return res.status;
}

/** Legt eine Kassette an, in der `members` (ausser dem Gruender) per
 *  Einladung + Zustimmen Mitglied sind. */
export async function cassetteWith(owner: Person, members: Person[] = [], name = 'Testrunde'): Promise<string> {
  const created = await api('POST', '/api/cassettes', owner, { name, by: nameOf(owner) });
  if (created.status !== 201) throw new Error(`Kassette: ${created.status}`);
  const id = created.body.id as string;
  for (const m of members) {
    const inv = await api('POST', `/api/cassettes/${id}/invites`, owner, { by: nameOf(owner), invitee: nameOf(m) });
    if (inv.status !== 201) throw new Error(`Einladung: ${inv.status}`);
    const acc = await api('POST', `/api/invites/${inv.body.id}/accept`, m, { me: nameOf(m) });
    if (acc.status !== 200) throw new Error(`Zustimmen: ${acc.status}`);
  }
  return id;
}
