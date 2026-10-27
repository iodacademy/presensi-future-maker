/**
 * Layanan admin untuk peserta, koleksi, dan isi situs pameran.
 * Nama lengkap hanya lewat sini; jalur publik (read.ts) tidak pernah memuatnya.
 *
 * Admin service for exhibition people, collections, and site content.
 * Full names only pass through here; the public path (read.ts) never loads them.
 */
import { revalidateTag } from 'next/cache';
import { getAdminDb } from '../../lib/firebase/admin';
import { checkKeys } from './admin-works';
import { COH, TRACKS } from './content';
import { readSiteContent } from './read';
import type { ExhibitionCollection, ExhibitionPerson, SiteContent } from './model';

export interface AdminPersonRow {
  uid: string; fullName: string; nickname: string; cohort: string; visible: boolean;
  photoUrl: string; mainWorkId: string | null; workCount: number;
}
export type PersonPatch = Partial<Pick<ExhibitionPerson, 'nickname' | 'photoUrl' | 'bio' | 'skills' | 'linkedinUrl' | 'portfolioUrl' | 'visible' | 'mainWorkId'>>;

const db = () => getAdminDb();
const now = () => new Date().toISOString();

export async function listPeople(): Promise<AdminPersonRow[]> {
  const [pSnap, wSnap] = await Promise.all([
    db().collection('exhibitionPeople').select('nickname', 'cohort', 'visible', 'photoUrl', 'mainWorkId').get(),
    db().collection('exhibitionWorks').select('personUid').get(),
  ]);
  const counts = new Map<string, number>();
  wSnap.docs.forEach((w) => { const u = w.data().personUid as string; counts.set(u, (counts.get(u) ?? 0) + 1); });
  // Hanya nama peserta pameran, bukan seluruh users / Names only for exhibition people, not all users
  const names = new Map<string, string>();
  if (pSnap.docs.length) {
    const users = await db().getAll(...pSnap.docs.map((p) => db().collection('users').doc(p.id)), { fieldMask: ['name'] });
    users.forEach((u) => names.set(u.id, (u.data()?.name as string) ?? ''));
  }
  return pSnap.docs.map((p) => {
    const d = p.data();
    return {
      uid: p.id, fullName: names.get(p.id) ?? '', nickname: d.nickname ?? '', cohort: d.cohort ?? '',
      visible: !!d.visible, photoUrl: d.photoUrl ?? '', mainWorkId: d.mainWorkId ?? null, workCount: counts.get(p.id) ?? 0,
    };
  });
}

const PERSON_KEYS = ['nickname', 'photoUrl', 'bio', 'skills', 'linkedinUrl', 'portfolioUrl', 'visible', 'mainWorkId'];
const STRING_KEYS = ['photoUrl', 'bio', 'linkedinUrl', 'portfolioUrl'];

export async function updatePerson(uid: string, patch: PersonPatch): Promise<void> {
  const p = checkKeys(patch, PERSON_KEYS);
  const out: Record<string, unknown> = { ...p };
  if (p.nickname !== undefined) {
    if (typeof p.nickname !== 'string' || !p.nickname.trim()) throw new Error('Nama panggilan tidak boleh kosong');
    out.nickname = p.nickname.trim();
  }
  for (const k of STRING_KEYS) if (p[k] !== undefined && typeof p[k] !== 'string') throw new Error(`${k} harus teks`);
  if (p.visible !== undefined && typeof p.visible !== 'boolean') throw new Error('visible harus true atau false');
  if (p.skills !== undefined && (!Array.isArray(p.skills) || p.skills.some((s) => typeof s !== 'string'))) {
    throw new Error('skills harus daftar teks');
  }
  const ref = db().collection('exhibitionPeople').doc(uid);
  if (!(await ref.get()).exists) throw new Error('Peserta tidak ditemukan');
  if (p.mainWorkId !== undefined && p.mainWorkId !== null) {
    const w = typeof p.mainWorkId === 'string' ? await db().collection('exhibitionWorks').doc(p.mainWorkId).get() : null;
    if (!w?.exists || w.data()?.personUid !== uid) throw new Error('Karya utama harus milik peserta ini');
  }
  await ref.update({ ...out, updatedAt: now() });
  revalidateTag('pameran');
}

export async function listCollections(): Promise<(ExhibitionCollection & { count: number })[]> {
  const [cSnap, wSnap] = await Promise.all([
    db().collection('exhibitionCollections').select('title', 'brief', 'classId', 'cohort', 'type', 'coverUrls').get(),
    db().collection('exhibitionWorks').select('collectionId').get(),
  ]);
  const counts = new Map<string, number>();
  wSnap.docs.forEach((w) => { const c = w.data().collectionId as string | null; if (c) counts.set(c, (counts.get(c) ?? 0) + 1); });
  return cSnap.docs.map((c) => ({ ...(c.data() as Omit<ExhibitionCollection, 'id'>), id: c.id, count: counts.get(c.id) ?? 0 }));
}

export async function createCollection(input: Omit<ExhibitionCollection, 'id'>): Promise<string> {
  const cohort = COH[input.cohort];
  if (!cohort) throw new Error('Kohor tidak dikenal');
  if (!TRACKS[cohort.track].types.includes(input.type)) throw new Error(`Jenis "${input.type}" tidak ada di jalur kohor ini`);
  if (typeof input.title !== 'string' || !input.title.trim()) throw new Error('Judul koleksi tidak boleh kosong');
  // Daftar kolom eksplisit, bukan isi body mentah / Explicit field list, not the raw body
  const ref = await db().collection('exhibitionCollections').add({
    title: input.title.trim(), brief: input.brief ?? '', classId: input.classId ?? '',
    cohort: input.cohort, type: input.type, coverUrls: input.coverUrls ?? [],
  });
  revalidateTag('pameran');
  return ref.id;
}

export async function updateCollection(id: string, patch: Partial<Pick<ExhibitionCollection, 'title' | 'brief' | 'coverUrls'>>): Promise<void> {
  const p = checkKeys(patch, ['title', 'brief', 'coverUrls']);
  if (p.title !== undefined && (typeof p.title !== 'string' || !p.title.trim())) throw new Error('Judul koleksi tidak boleh kosong');
  if (p.brief !== undefined && typeof p.brief !== 'string') throw new Error('brief harus teks');
  if (p.coverUrls !== undefined && (!Array.isArray(p.coverUrls) || p.coverUrls.some((u) => typeof u !== 'string'))) {
    throw new Error('coverUrls harus daftar teks');
  }
  const ref = db().collection('exhibitionCollections').doc(id);
  if (!(await ref.get()).exists) throw new Error('Koleksi tidak ditemukan');
  await ref.update(p);
  revalidateTag('pameran');
}

const SITE_ARRAYS = ['testiTrainer'];
const SITE_OBJECTS = ['photos', 'videos', 'testiPeserta', 'testiPlan'];

// Isi situs untuk admin: sama dengan jalur publik tapi tanpa cache / Site content for admin: same as the public path but uncached
export const getSiteContentAdmin = readSiteContent;

export async function updateSiteContent(patch: Partial<SiteContent>): Promise<void> {
  const p = checkKeys(patch, [...SITE_ARRAYS, ...SITE_OBJECTS]);
  for (const [k, v] of Object.entries(p)) {
    const isObj = !!v && typeof v === 'object' && !Array.isArray(v);
    if (SITE_ARRAYS.includes(k) ? !Array.isArray(v) : !isObj) throw new Error(`Isi "${k}" bentuknya tidak sesuai`);
  }
  await db().collection('exhibitionSite').doc('content').set(p, { merge: true });
  revalidateTag('pameran');
}
