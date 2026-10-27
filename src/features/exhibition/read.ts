/**
 * Pembacaan data pameran untuk halaman publik, ber-cache. Hanya nickname yang
 * keluar dari modul ini; koleksi `users` tidak pernah dibaca.
 *
 * Cached reads of exhibition data for public pages. Only the nickname leaves
 * this module; the `users` collection is never read.
 */
import { unstable_cache } from 'next/cache';
import { getAdminDb } from '../../lib/firebase/admin';
import { wibDate } from '../../lib/time';
import { VIDEOS, TESTI_P, TESTI_T, TESTI_PLAN, type TrackKey } from './content';
import type { CollectionCard, ExhibitionCollection, GalleryCard, SiteContent, WorkMedia } from './model';

export interface PublicPerson {
  uid: string; nickname: string; cohort: string; track: TrackKey; photoUrl: string; mainWorkId: string | null; workCount: number;
}
export interface Catalog { people: PublicPerson[]; cards: GalleryCard[]; collections: CollectionCard[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

const CARD_FIELDS = ['personUid', 'cohort', 'track', 'type', 'title', 'aiAssisted', 'collectionId', 'cover.thumb'];
const nick = (v: unknown) => (typeof v === 'string' && v.trim() ? v : 'Peserta');
const cache = <A extends unknown[], R>(name: string, fn: (...a: A) => Promise<R>) =>
  unstable_cache(fn, ['pameran-' + name], { tags: ['pameran'], revalidate: 300 });

function toCard(id: string, d: Doc, nickname: string): GalleryCard {
  return {
    id, title: d.title ?? '', type: d.type ?? '', cohort: d.cohort ?? '', track: d.track, personUid: d.personUid,
    nickname, thumb: d.cover?.thumb ?? '', aiAssisted: !!d.aiAssisted, collectionId: d.collectionId ?? null,
  };
}

// Hanya peserta yang tampil, tanpa membaca `users` / Visible participants only, no `users` read
async function visiblePerson(uid: string): Promise<Doc | null> {
  const s = await getAdminDb().collection('exhibitionPeople').doc(uid).get();
  const d = s.exists ? (s.data() as Doc) : null;
  return d && d.visible === true ? d : null;
}

async function readCatalog(): Promise<Catalog> {
  const db = getAdminDb();
  const [pSnap, wSnap, cSnap] = await Promise.all([
    db.collection('exhibitionPeople').where('visible', '==', true).select('nickname', 'cohort', 'track', 'photoUrl', 'mainWorkId').get(),
    db.collection('exhibitionWorks').where('status', '==', 'published').select(...CARD_FIELDS).get(),
    db.collection('exhibitionCollections').select('title', 'cohort', 'type', 'coverUrls').get(),
  ]);
  const nicknames = new Map<string, string>();
  pSnap.docs.forEach((p) => nicknames.set(p.id, nick(p.data().nickname)));
  const cards = wSnap.docs
    .filter((w) => nicknames.has(w.data().personUid))
    .map((w) => toCard(w.id, w.data(), nicknames.get(w.data().personUid)!));
  const counts = new Map<string, number>();
  cards.forEach((c) => counts.set(c.personUid, (counts.get(c.personUid) ?? 0) + 1));
  const people: PublicPerson[] = pSnap.docs.map((p) => {
    const d = p.data();
    return {
      uid: p.id, nickname: nicknames.get(p.id)!, cohort: d.cohort, track: d.track, photoUrl: d.photoUrl ?? '',
      mainWorkId: d.mainWorkId ?? null, workCount: counts.get(p.id) ?? 0,
    };
  });
  const collections = cSnap.docs.flatMap((c): CollectionCard[] => {
    const members = cards.filter((x) => x.collectionId === c.id);
    const d = c.data();
    if (members.length === 0) return [];
    // Tanpa sampul tersimpan, pakai tiga thumb anggota pertama / Without stored covers, use the first three member thumbs
    const stored: string[] = d.coverUrls ?? [];
    const coverUrls = stored.length ? stored : members.map((m) => m.thumb).filter(Boolean).slice(0, 3);
    return [{
      id: c.id, title: d.title ?? '', cohort: d.cohort ?? '', type: d.type ?? '', coverUrls,
      count: members.length, nicknames: [...new Set(members.map((m) => m.nickname))],
    }];
  });
  return { people, cards, collections };
}

async function readWorkDetail(id: string) {
  const db = getAdminDb();
  const s = await db.collection('exhibitionWorks').doc(id).get();
  const d = s.exists ? (s.data() as Doc) : null;
  if (!d || d.status !== 'published') return null;
  const owner = await visiblePerson(d.personUid);
  if (!owner) return null;
  let collection: { id: string; title: string } | null = null;
  if (d.collectionId) {
    const c = await db.collection('exhibitionCollections').doc(d.collectionId).get();
    if (c.exists) collection = { id: d.collectionId, title: (c.data() as Doc).title ?? '' };
  }
  return {
    ...toCard(id, d, nick(owner.nickname)),
    description: d.description ?? '',
    tools: (d.tools ?? []) as string[],
    media: { kind: d.media?.kind, url: d.media?.url ?? '', slides: d.media?.slides ?? [] } as WorkMedia,
    coverFull: d.cover?.full ?? '',
    collection,
  };
}

async function readPersonDetail(uid: string) {
  const p = await visiblePerson(uid);
  if (!p) return null;
  const snap = await getAdminDb().collection('exhibitionWorks')
    .where('personUid', '==', uid).where('status', '==', 'published').select(...CARD_FIELDS).get();
  const nickname = nick(p.nickname);
  const works = snap.docs.map((w) => toCard(w.id, w.data(), nickname));
  return {
    uid, nickname, cohort: p.cohort as string, track: p.track as TrackKey, photoUrl: (p.photoUrl ?? '') as string,
    mainWorkId: (p.mainWorkId ?? null) as string | null, workCount: works.length,
    bio: (p.bio ?? '') as string, skills: (p.skills ?? []) as string[],
    linkedinUrl: (p.linkedinUrl ?? '') as string, portfolioUrl: (p.portfolioUrl ?? '') as string, works,
  };
}

async function readCollectionDetail(id: string) {
  const db = getAdminDb();
  const s = await db.collection('exhibitionCollections').doc(id).get();
  if (!s.exists) return null;
  const c = s.data() as Doc;
  const snap = await db.collection('exhibitionWorks')
    .where('collectionId', '==', id).where('status', '==', 'published').select(...CARD_FIELDS, 'media.url').get();
  const owners = new Map<string, string | null>();
  const versions: (GalleryCard & { siteUrl: string })[] = [];
  for (const w of snap.docs) {
    const d = w.data();
    if (!owners.has(d.personUid)) {
      const o = await visiblePerson(d.personUid);
      owners.set(d.personUid, o ? nick(o.nickname) : null);
    }
    const nickname = owners.get(d.personUid);
    if (nickname) versions.push({ ...toCard(w.id, d, nickname), siteUrl: d.media?.url ?? '' });
  }
  if (versions.length === 0) return null;
  const collection: ExhibitionCollection = {
    id, title: c.title ?? '', brief: c.brief ?? '', classId: c.classId ?? '', cohort: c.cohort ?? '',
    type: c.type ?? '', coverUrls: c.coverUrls ?? [],
  };
  return { collection, versions };
}

export async function readSiteContent(): Promise<SiteContent> {
  const s = await getAdminDb().collection('exhibitionSite').doc('content').get();
  const stored = (s.exists ? s.data() : {}) as Partial<SiteContent>;
  // ponytail: gabungan dangkal per kunci teratas, dalamkan bila admin menyunting sebagian objek / shallow merge per top-level key, deepen if admins edit partial objects
  return { photos: {}, captions: {}, videos: VIDEOS, testiPeserta: TESTI_P, testiAuthors: {}, testiTrainer: TESTI_T, testiPlan: TESTI_PLAN, ...stored };
}

export type WorkDetail = NonNullable<Awaited<ReturnType<typeof readWorkDetail>>>;
export type PersonDetail = NonNullable<Awaited<ReturnType<typeof readPersonDetail>>>;

export const getCatalog = cache('catalog', readCatalog);
export const getWorkDetail = cache('work', readWorkDetail);
export const getPersonDetail = cache('person', readPersonDetail);
export const getCollectionDetail = cache('collection', readCollectionDetail);
export const getSiteContent = cache('site', readSiteContent);

export function todayWib(): string {
  return wibDate();
}
