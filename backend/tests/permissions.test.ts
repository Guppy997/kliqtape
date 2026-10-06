import { beforeAll, describe, expect, it } from 'vitest';
import { api, cassetteWith, nameOf, upload } from './fixtures';

// Pro veraendernder Route mindestens ein Test "Fremder darf das nicht"
// (docs/CONCEPT.md §16.1). Dazu jeweils eine Gegenprobe, dass die
// berechtigte Person es darf — sonst wuerde ein Tippfehler im Pfad den
// Test genauso gruen machen wie eine echte Sperre.

const ANNA = nameOf('anna');
const BEN = nameOf('ben');
const CARA = nameOf('cara');

describe('Medien', () => {
  it('Upload ohne Zugangscode wird abgelehnt', async () => {
    expect((await upload(null)).status).toBe(401);
  });

  it('Upload mit Zugangscode klappt', async () => {
    const res = await upload('anna');
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
  });
});

describe('Profil und Konto', () => {
  it('Fremder darf kein fremdes Profilbild setzen', async () => {
    const media = await upload('cara');
    const res = await api('PUT', `/api/profiles/${ANNA}`, 'cara', { avatarId: media.body.id });
    expect(res.status).toBe(401);
  });

  it('Eigenes Profilbild setzen klappt', async () => {
    const media = await upload('anna');
    const res = await api('PUT', `/api/profiles/${ANNA}`, 'anna', { avatarId: media.body.id });
    expect(res.status).toBe(200);
  });

  it('Umbenennen ohne Zugangscode geht nicht', async () => {
    expect((await api('POST', '/api/auth/rename', null, { name: 'Neu' })).status).toBe(401);
  });

  it('Ein vergebener Name laesst sich nicht noch einmal beanspruchen', async () => {
    expect((await api('POST', '/api/auth/claim', null, { name: ANNA })).status).toBe(409);
  });

  it('Fremder darf kein fremdes Konto loeschen', async () => {
    expect((await api('DELETE', `/api/me?me=${ANNA}`, 'cara')).status).toBe(401);
  });

  it('Fremder bekommt keinen fremden Export', async () => {
    expect((await api('GET', `/api/export?me=${ANNA}`, 'cara')).status).toBe(401);
  });
});

describe('Kassetten', () => {
  let cassette: string;

  beforeAll(async () => {
    cassette = await cassetteWith('anna', ['ben']);
  });

  it('Niemand legt eine Kassette im Namen eines anderen an', async () => {
    expect((await api('POST', '/api/cassettes', 'cara', { name: 'X', by: ANNA })).status).toBe(401);
  });

  it('Fremder sieht die Kassette nicht in seiner Liste', async () => {
    const res = await api('GET', `/api/cassettes?me=${CARA}`, 'cara');
    expect(res.status).toBe(200);
    expect(res.body.map((c: { id: string }) => c.id)).not.toContain(cassette);
  });

  it('Fremder darf die Kassette nicht umbenennen', async () => {
    expect((await api('PATCH', `/api/cassettes/${cassette}`, 'cara', { by: CARA, name: 'Gekapert' })).status).toBe(403);
  });

  it('Mitglied darf die Kassette umbenennen', async () => {
    expect((await api('PATCH', `/api/cassettes/${cassette}`, 'ben', { by: BEN, name: 'Umbenannt' })).status).toBe(200);
  });

  it('Fremder darf niemanden einladen', async () => {
    expect((await api('POST', `/api/cassettes/${cassette}/invites`, 'cara', { by: CARA, invitee: CARA })).status).toBe(
      403,
    );
  });

  it('Fremder darf keine fremde Einladung annehmen oder ablehnen', async () => {
    const inv = await api('POST', `/api/cassettes/${cassette}/invites`, 'anna', { by: ANNA, invitee: nameOf('dora') });
    expect(inv.status).toBe(201);
    expect((await api('POST', `/api/invites/${inv.body.id}/accept`, 'cara', { me: CARA })).status).toBe(403);
    expect((await api('POST', `/api/invites/${inv.body.id}/decline`, 'cara', { me: CARA })).status).toBe(403);
    expect((await api('POST', `/api/invites/${inv.body.id}/decline`, 'dora', { me: nameOf('dora') })).status).toBe(204);
  });

  it('Fremder darf niemanden von der Kassette nehmen', async () => {
    expect((await api('DELETE', `/api/cassettes/${cassette}/members/${BEN}?by=${CARA}`, 'cara')).status).toBe(403);
  });

  it('Fremder darf die Kassette nicht loeschen', async () => {
    expect((await api('DELETE', `/api/cassettes/${cassette}?by=${CARA}`, 'cara')).status).toBe(403);
  });

  it('Fremder sieht die Besetzung nicht', async () => {
    expect((await api('GET', `/api/cassettes/${cassette}/members?me=${CARA}`, 'cara')).status).toBe(403);
    expect((await api('GET', `/api/cassettes/${cassette}/members?me=${BEN}`, 'ben')).status).toBe(200);
  });
});

describe('Kassette loeschen und verlassen', () => {
  it('Nur wer die Kassette angelegt hat, darf sie loeschen', async () => {
    const id = await cassetteWith('anna', ['ben']);
    expect((await api('DELETE', `/api/cassettes/${id}?by=${BEN}`, 'ben')).status).toBe(403);
    expect((await api('DELETE', `/api/cassettes/${id}?by=${ANNA}`, 'anna')).status).toBe(200);
  });

  it('Die Gruenderin laesst sich nicht von anderen rauswerfen', async () => {
    const id = await cassetteWith('anna', ['ben']);
    expect((await api('DELETE', `/api/cassettes/${id}/members/${ANNA}?by=${BEN}`, 'ben')).status).toBe(403);
  });

  it('Geht die Gruenderin, uebernimmt das dienstaelteste Mitglied', async () => {
    const id = await cassetteWith('anna', ['ben', 'dora']);
    expect((await api('DELETE', `/api/cassettes/${id}/members/${ANNA}?by=${ANNA}`, 'anna')).status).toBe(204);
    const list = await api('GET', `/api/cassettes?me=${BEN}`, 'ben');
    expect(list.body.find((c: { id: string }) => c.id === id).createdBy).toBe(BEN);
    expect((await api('DELETE', `/api/cassettes/${id}?by=${nameOf('dora')}`, 'dora')).status).toBe(403);
    expect((await api('DELETE', `/api/cassettes/${id}?by=${BEN}`, 'ben')).status).toBe(200);
  });
});

describe('Melden', () => {
  let cassette: string;
  let annasPost: string;

  beforeAll(async () => {
    cassette = await cassetteWith('anna', ['ben']);
    const res = await api('POST', '/api/posts', 'anna', {
      cassetteId: cassette,
      side: 'a',
      author: ANNA,
      kind: 'text',
      body: 'Melde mich',
    });
    annasPost = res.body.id;
  });

  it('Fremder darf weder Kassette noch Beitrag melden', async () => {
    expect((await api('POST', '/api/reports', 'cara', { by: CARA, cassetteId: cassette, reason: 'spam' })).status).toBe(
      403,
    );
    expect((await api('POST', '/api/reports', 'cara', { by: CARA, postId: annasPost, reason: 'spam' })).status).toBe(
      403,
    );
  });

  it('Niemand meldet im Namen eines anderen', async () => {
    expect((await api('POST', '/api/reports', 'cara', { by: BEN, cassetteId: cassette, reason: 'spam' })).status).toBe(
      401,
    );
  });

  it('Mitglied darf Kassette und fremden Beitrag melden, aber nicht den eigenen', async () => {
    expect(
      (await api('POST', '/api/reports', 'ben', { by: BEN, cassetteId: cassette, reason: 'other', note: 'Test' }))
        .status,
    ).toBe(201);
    expect(
      (await api('POST', '/api/reports', 'ben', { by: BEN, postId: annasPost, reason: 'harassment' })).status,
    ).toBe(201);
    expect((await api('POST', '/api/reports', 'anna', { by: ANNA, postId: annasPost, reason: 'spam' })).status).toBe(
      400,
    );
  });

  it('Genau ein Ziel und ein bekannter Grund', async () => {
    expect((await api('POST', '/api/reports', 'ben', { by: BEN, reason: 'spam' })).status).toBe(400);
    expect(
      (await api('POST', '/api/reports', 'ben', { by: BEN, cassetteId: cassette, postId: annasPost, reason: 'spam' }))
        .status,
    ).toBe(400);
    expect(
      (await api('POST', '/api/reports', 'ben', { by: BEN, cassetteId: cassette, reason: 'langweilig' })).status,
    ).toBe(400);
  });
});

describe('Tapes auf Seite A', () => {
  let cassette: string;

  beforeAll(async () => {
    cassette = await cassetteWith('anna', ['ben']);
  });

  it('Fremder darf kein Tape benennen', async () => {
    expect((await api('PUT', `/api/cassettes/${cassette}/tapes/1`, 'cara', { by: CARA, name: 'X' })).status).toBe(403);
  });

  it('Mitglied darf ein Tape benennen', async () => {
    expect(
      (await api('PUT', `/api/cassettes/${cassette}/tapes/1`, 'ben', { by: BEN, name: 'Erster Tag' })).status,
    ).toBe(200);
  });

  it('Fremder darf nicht favorisieren oder entfavorisieren', async () => {
    expect((await api('POST', `/api/cassettes/${cassette}/tapes/1/favorite`, 'cara', { by: CARA })).status).toBe(403);
    expect((await api('DELETE', `/api/cassettes/${cassette}/tapes/1/favorite?by=${CARA}`, 'cara')).status).toBe(403);
  });

  it('Fremder sieht die Tapes nicht', async () => {
    expect((await api('GET', `/api/cassettes/${cassette}/tapes?me=${CARA}`, 'cara')).status).toBe(403);
  });
});

describe('Beitraege', () => {
  let cassette: string;
  let postId: string;

  beforeAll(async () => {
    cassette = await cassetteWith('anna', ['ben']);
    const res = await api('POST', '/api/posts', 'anna', {
      cassetteId: cassette,
      side: 'a',
      author: ANNA,
      kind: 'text',
      body: 'Hallo Runde',
    });
    postId = res.body.id;
  });

  it('Fremder darf nicht posten', async () => {
    const res = await api('POST', '/api/posts', 'cara', {
      cassetteId: cassette,
      side: 'b',
      author: CARA,
      kind: 'text',
      body: 'Hi',
    });
    expect(res.status).toBe(403);
  });

  it('Niemand postet im Namen eines Mitglieds', async () => {
    const res = await api('POST', '/api/posts', 'cara', {
      cassetteId: cassette,
      side: 'b',
      author: BEN,
      kind: 'text',
      body: 'Hi',
    });
    expect(res.status).toBe(401);
  });

  it('Fremder sieht keine der beiden Seiten', async () => {
    expect((await api('GET', `/api/posts?side=a&cassette=${cassette}&me=${CARA}`, 'cara')).status).toBe(403);
    expect((await api('GET', `/api/posts?side=b&cassette=${cassette}&me=${CARA}`, 'cara')).status).toBe(403);
  });

  it('Mitglied darf fremden Beitrag nicht loeschen', async () => {
    expect((await api('DELETE', `/api/posts/${postId}?me=${BEN}`, 'ben')).status).toBe(403);
  });

  it('Fremder darf keinen Tonfetzen schicken', async () => {
    const media = await upload('cara', 'audio/webm');
    const res = await api('POST', `/api/posts/${postId}/react`, 'cara', { author: CARA, mediaId: media.body.id });
    expect(res.status).toBe(403);
  });

  it('Nur die postende Person hoert die Tonfetzen', async () => {
    expect((await api('GET', `/api/posts/${postId}/reactions?me=${BEN}`, 'ben')).status).toBe(403);
  });

  it('Autorin darf eigenen Beitrag loeschen', async () => {
    const res = await api('POST', '/api/posts', 'anna', {
      cassetteId: cassette,
      side: 'a',
      author: ANNA,
      kind: 'text',
      body: 'weg damit',
    });
    expect((await api('DELETE', `/api/posts/${res.body.id}?me=${ANNA}`, 'anna')).status).toBe(204);
  });
});

describe('Storys', () => {
  it('Niemand postet eine Story im Namen eines anderen', async () => {
    const media = await upload('cara');
    expect(
      (await api('POST', '/api/stories', 'cara', { author: ANNA, kind: 'photo', mediaId: media.body.id })).status,
    ).toBe(401);
  });

  it('Fremde Story loeschen geht nicht', async () => {
    const media = await upload('anna');
    const story = await api('POST', '/api/stories', 'anna', { author: ANNA, kind: 'photo', mediaId: media.body.id });
    expect(story.status).toBe(201);
    expect((await api('DELETE', `/api/stories/${story.body.id}?me=${BEN}`, 'ben')).status).toBe(403);
    expect((await api('DELETE', `/api/stories/${story.body.id}?me=${ANNA}`, 'anna')).status).toBe(204);
  });
});

describe('Kliqtape-Kanal', () => {
  it('Nur der Kanal-Account darf posten, Foerderstand setzen und loeschen', async () => {
    expect((await api('POST', '/api/news', 'anna', { author: ANNA, kind: 'text', body: 'X' })).status).toBe(403);
    expect((await api('PUT', '/api/news/funding', 'anna', { me: ANNA, balance: '1 €' })).status).toBe(403);

    const post = await api('POST', '/api/news', 'kanal', { author: nameOf('kanal'), kind: 'text', body: 'Hallo' });
    expect(post.status).toBe(201);
    expect((await api('DELETE', `/api/news/${post.body.id}?me=${ANNA}`, 'anna')).status).toBe(403);
    expect((await api('DELETE', `/api/news/${post.body.id}?me=${nameOf('kanal')}`, 'kanal')).status).toBe(204);
  });
});

describe('Hot Line', () => {
  let threadId: string;

  beforeAll(async () => {
    const res = await api('POST', '/api/hotlines/threads', 'anna', { from: ANNA, to: BEN, body: 'Hey' });
    threadId = res.body.threadId;
  });

  it('Niemand schreibt im Namen eines anderen', async () => {
    expect((await api('POST', '/api/hotlines/threads', 'cara', { from: ANNA, to: BEN, body: 'Fake' })).status).toBe(
      401,
    );
  });

  it('Fremder liest keine fremde Leitung und markiert nichts als gehoert', async () => {
    expect((await api('GET', `/api/hotlines/threads/${threadId}/messages?me=${CARA}`, 'cara')).status).toBe(403);
    expect((await api('POST', `/api/hotlines/threads/${threadId}/heard`, 'cara', { me: CARA })).status).toBe(403);
    expect((await api('POST', `/api/hotlines/threads/${threadId}/heard`, 'ben', { me: BEN })).status).toBe(200);
  });
});

describe('Mixtapes', () => {
  let tapeId: string;

  beforeAll(async () => {
    const res = await api('POST', '/api/mixtapes', 'anna', { from: ANNA, to: BEN, title: 'Sommer' });
    tapeId = res.body.id;
  });

  it('Niemand legt ein Tape im Namen eines anderen an', async () => {
    expect((await api('POST', '/api/mixtapes', 'cara', { from: ANNA, to: BEN })).status).toBe(401);
  });

  it('Empfaenger sieht den Entwurf nicht', async () => {
    expect((await api('GET', `/api/mixtapes/${tapeId}?me=${BEN}`, 'ben')).status).toBe(403);
  });

  it('Fremder darf ein Tape nicht aendern, bespielen, versiegeln oder loeschen', async () => {
    expect((await api('PATCH', `/api/mixtapes/${tapeId}`, 'cara', { me: CARA, title: 'X' })).status).toBe(403);
    expect((await api('POST', `/api/mixtapes/${tapeId}/tracks`, 'cara', { me: CARA, title: 'X' })).status).toBe(403);
    expect((await api('POST', `/api/mixtapes/${tapeId}/seal`, 'cara', { me: CARA })).status).toBe(403);
    expect((await api('DELETE', `/api/mixtapes/${tapeId}?me=${CARA}`, 'cara')).status).toBe(403);
  });

  it('Fremder darf keinen Titel entfernen', async () => {
    const added = await api('POST', `/api/mixtapes/${tapeId}/tracks`, 'anna', { me: ANNA, title: 'Song' });
    expect(added.status).toBe(201);
    const trackId = added.body.tracks[0].id as string;
    expect((await api('DELETE', `/api/mixtapes/${tapeId}/tracks/${trackId}?me=${CARA}`, 'cara')).status).toBe(403);
  });
});
