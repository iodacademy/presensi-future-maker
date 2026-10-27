/**
 * Layanan admin untuk karya pameran: daftar, buat, ubah, dan ubah massal.
 * Setiap penulisan membuang cache publik lewat tag 'pameran'.
 *
 * Admin service for exhibition works: list, create, update, and bulk update.
 * Every write drops the public cache through the 'pameran' tag.
 */
import { revalidateTag } from 'next/cache';
import { getAdminDb } from '../../lib/firebase/admin';
import { TRACKS, type TrackKey } from './content';
import type { ExhibitionWork, WorkStatus } from './model';

export interface AdminWorkRow {
  id: string; title: string; type: string; cohort: string; personUid: string; nickname: string;
  status: WorkStatus; aiAssisted: boolean; collectionId: string | null; thumb: string;
}
export type WorkInput = Pick<ExhibitionWork, 'personUid' | 'type' | 'title' | 'description' | 'tools' | 'aiAssisted' | 'collectionId' | 'cover' | 'media'>;
export type BulkPatch = Partial<Pick<ExhibitionWork, 'status' | 'aiAssisted' | 'collectionId'>>;

const STATUSES: WorkStatus[] = ['draft', 'published', 'hidden'];
const works = () => getAdminDb().collection('exhibitionWorks');
const now = () => new Date().toISOString();

function checkStatus(s: unknown) {
  if (!STATUSES.includes(s as WorkStatus)) throw new Error('Status karya tidak dikenal');
}
function checkType(track: TrackKey, type: string) {
  if (!TRACKS[track]?.types.includes(type)) throw new Error(`Jenis karya "${type}" tidak ada di jalur ini`);
}

export async function listWorks(): Promise<AdminWorkRow[]> {
  const db = getAdminDb();
  const [wSnap, pSnap] = await Promise.all([
    works().select('title', 'type', 'cohort', 'personUid', 'status', 'aiAssisted', 'collectionId', 'cover.thumb').get(),
    db.collection('exhibitionPeople').select('nickname').get(),
  ]);
  const nicks = new Map(pSnap.docs.map((p) => [p.id, p.data().nickname as string]));
  return wSnap.docs.map((w) => {
    const d = w.data();
    return {
      id: w.id, title: d.title ?? '', type: d.type ?? '', cohort: d.cohort ?? '', personUid: d.personUid,
      nickname: nicks.get(d.personUid) ?? '', status: d.status, aiAssisted: !!d.aiAssisted,
      collectionId: d.collectionId ?? null, thumb: d.cover?.thumb ?? '',
    };
  });
}

export async function getWork(id: string): Promise<ExhibitionWork | null> {
  const s = await works().doc(id).get();
  return s.exists ? ({ ...s.data(), id } as ExhibitionWork) : null;
}

export async function createWork(input: WorkInput): Promise<string> {
  const p = await getAdminDb().collection('exhibitionPeople').doc(input.personUid).get();
  if (!p.exists) throw new Error('Peserta tidak ditemukan');
  const person = p.data() as { classId: string; cohort: string; track: TrackKey };
  checkType(person.track, input.type);
  const t = now();
  const ref = await works().add({
    ...input, classId: person.classId, cohort: person.cohort, track: person.track,
    status: 'draft', sourceKey: null, createdAt: t, updatedAt: t,
  });
  revalidateTag('pameran');
  return ref.id;
}

// Kunci yang boleh diubah admin; personUid sengaja tidak ada / Keys an admin may edit; personUid is deliberately absent
const EDITABLE = ['type', 'title', 'description', 'tools', 'aiAssisted', 'collectionId', 'cover', 'media', 'status'];
const BULK_KEYS = ['status', 'aiAssisted', 'collectionId'];

export function checkKeys(patch: unknown, allowed: string[]): Record<string, unknown> {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Perubahan harus berupa objek');
  const keys = Object.keys(patch);
  if (keys.length === 0) throw new Error('Perubahan tidak boleh kosong');
  const bad = keys.find((k) => !allowed.includes(k));
  if (bad) throw new Error(`Kolom "${bad}" tidak boleh diubah`);
  return patch as Record<string, unknown>;
}

export async function updateWork(id: string, patch: Partial<WorkInput & { status: WorkStatus }>): Promise<void> {
  checkKeys(patch, EDITABLE);
  const ref = works().doc(id);
  const s = await ref.get();
  if (!s.exists) throw new Error('Karya tidak ditemukan');
  if (patch.status !== undefined) checkStatus(patch.status);
  if (patch.type !== undefined) checkType((s.data() as { track: TrackKey }).track, patch.type);
  await ref.update({ ...patch, updatedAt: now() });
  revalidateTag('pameran');
}

export async function bulkUpdateWorks(ids: string[], patch: BulkPatch): Promise<number> {
  if (ids.length === 0) return 0;
  const p = checkKeys(patch, BULK_KEYS);
  if (p.status !== undefined) checkStatus(p.status);
  if (p.aiAssisted !== undefined && typeof p.aiAssisted !== 'boolean') throw new Error('aiAssisted harus true atau false');
  if (p.collectionId !== undefined && p.collectionId !== null && typeof p.collectionId !== 'string') {
    throw new Error('collectionId harus teks atau null');
  }
  const db = getAdminDb();
  const updatedAt = now();
  try {
    // Firestore membatasi 500 tulis per batch / Firestore caps a batch at 500 writes
    for (let i = 0; i < ids.length; i += 500) {
      const batch = db.batch();
      ids.slice(i, i + 500).forEach((id) => batch.update(works().doc(id), { ...patch, updatedAt }));
      await batch.commit();
    }
  } finally {
    // Chunk awal mungkin sudah tertulis, jadi cache tetap dibuang / Earlier chunks may be written, so the cache is dropped regardless
    revalidateTag('pameran');
  }
  return ids.length;
}
