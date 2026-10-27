// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Firestore palsu dengan batch / Fake Firestore with batch
const data: Record<string, Record<string, Record<string, unknown>>> = {};
let commits = 0;
let batchUpdates = 0;
let failOnCommit = 0;
const revalidateTag = vi.fn();
const getSessionActor = vi.fn();

vi.mock('next/cache', () => ({ revalidateTag: (t: string) => revalidateTag(t) }));
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: () => getSessionActor() }));
vi.mock('../../src/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    batch: () => ({
      update: (ref: { col: string; id: string }, d: Record<string, unknown>) => {
        batchUpdates++;
        data[ref.col][ref.id] = { ...data[ref.col][ref.id], ...d };
      },
      commit: async () => { commits++; if (commits === failOnCommit) throw new Error('gagal tulis'); },
    }),
    collection: (col: string) => ({
      select: () => ({ get: async () => ({ docs: Object.entries(data[col] ?? {}).map(([id, d]) => ({ id, data: () => d })) }) }),
      add: async (d: Record<string, unknown>) => { const id = 'new' + Object.keys(data[col]).length; data[col][id] = d; return { id }; },
      doc: (id: string) => ({
        col, id,
        get: async () => ({ id, exists: !!data[col]?.[id], data: () => data[col]?.[id] }),
        update: async (d: Record<string, unknown>) => { data[col][id] = { ...data[col][id], ...d }; },
      }),
    }),
  }),
}));

import { bulkUpdateWorks, createWork, listWorks, updateWork, type WorkInput } from '../../src/features/exhibition/admin-works';
import { POST as bulkPost } from '../../src/app/api/pameran/works/bulk/route';

const input: WorkInput = {
  personUid: 'u1', type: 'Landing Page', title: 'Situs', description: '', tools: [], aiAssisted: false,
  collectionId: null, cover: { thumb: '', full: '' }, media: { kind: 'site', url: 'https://x.id', slides: [] },
};

beforeEach(() => {
  commits = 0; batchUpdates = 0; failOnCommit = 0; revalidateTag.mockClear();
  data.exhibitionPeople = { u1: { nickname: 'Ani', classId: 'k1', cohort: 'web-smg', track: 'web' } };
  data.exhibitionWorks = {};
  getSessionActor.mockResolvedValue({ role: 'admin' });
});

describe('API admin karya pameran', () => {
  it('terbitkan 1.200 karya dipecah menjadi 3 batch dan semua terbarui', async () => {
    const ids = Array.from({ length: 1200 }, (_, i) => 'w' + i);
    ids.forEach((id) => { data.exhibitionWorks[id] = { status: 'draft' }; });
    const n = await bulkUpdateWorks(ids, { status: 'published' });
    expect(n).toBe(1200);
    expect(commits).toBe(3);
    expect(batchUpdates).toBe(1200);
    expect(data.exhibitionWorks.w1199.status).toBe('published');
    expect(revalidateTag).toHaveBeenCalledWith('pameran');
  });

  it('ids kosong tidak menulis dan tidak membuang cache', async () => {
    expect(await bulkUpdateWorks([], { status: 'published' })).toBe(0);
    expect(commits).toBe(0);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('karya baru berstatus draf dan mewarisi kelas pesertanya', async () => {
    const id = await createWork(input);
    expect(data.exhibitionWorks[id]).toMatchObject({ status: 'draft', classId: 'k1', cohort: 'web-smg', track: 'web', sourceKey: null });
    expect(revalidateTag).toHaveBeenCalledWith('pameran');
  });

  it('menolak peserta yang tidak ada dan jenis di luar jalurnya', async () => {
    await expect(createWork({ ...input, personUid: 'x' })).rejects.toThrow('Peserta tidak ditemukan');
    await expect(createWork({ ...input, type: 'Reels' })).rejects.toThrow('Jenis karya');
  });

  it('updateWork menolak status tak dikenal', async () => {
    data.exhibitionWorks.a = { track: 'web', status: 'draft' };
    await expect(updateWork('a', { status: 'x' as never })).rejects.toThrow('Status');
    await updateWork('a', { status: 'hidden' });
    expect(data.exhibitionWorks.a.status).toBe('hidden');
  });

  it('listWorks menggabungkan nickname', async () => {
    data.exhibitionWorks.a = { title: 'T', type: 'Landing Page', cohort: 'c', personUid: 'u1', status: 'draft', aiAssisted: false, collectionId: null, cover: { thumb: 't' } };
    expect((await listWorks())[0]).toMatchObject({ id: 'a', nickname: 'Ani', thumb: 't' });
  });

  it('rute menolak selain admin dengan 403', async () => {
    getSessionActor.mockResolvedValue({ role: 'mentor' });
    const res = await bulkPost(new Request('http://x', { method: 'POST', body: JSON.stringify({ ids: ['a'], patch: { status: 'published' } }) }));
    expect(res.status).toBe(403);
  });

  it('rute bulk menolak kunci patch yang tidak dikenal', async () => {
    const res = await bulkPost(new Request('http://x', { method: 'POST', body: JSON.stringify({ ids: ['a'], patch: { title: 'x' } }) }));
    expect(res.status).toBe(400);
  });

  it('updateWork menolak kunci di luar daftar izin (sourceKey, track, personUid)', async () => {
    data.exhibitionWorks.a = { track: 'web', status: 'draft' };
    for (const k of ['sourceKey', 'track', 'personUid']) {
      await expect(updateWork('a', { [k]: 'x' } as never)).rejects.toThrow('tidak boleh diubah');
    }
    expect(data.exhibitionWorks.a).toEqual({ track: 'web', status: 'draft' });
  });

  it('bulk menolak nilai tak valid dan patch kosong atau array dengan 400', async () => {
    const post = (patch: unknown) => bulkPost(new Request('http://x', { method: 'POST', body: JSON.stringify({ ids: ['a'], patch }) }));
    for (const patch of [{ aiAssisted: 'ya' }, { collectionId: 5 }, { status: 'x' }, {}, [{ status: 'published' }]]) {
      expect((await post(patch)).status).toBe(400);
    }
    expect(commits).toBe(0);
  });

  it('commit kedua gagal: galat diteruskan dan cache tetap dibuang', async () => {
    const ids = Array.from({ length: 600 }, (_, i) => 'w' + i);
    ids.forEach((id) => { data.exhibitionWorks[id] = { status: 'draft' }; });
    failOnCommit = 2;
    await expect(bulkUpdateWorks(ids, { status: 'published' })).rejects.toThrow('gagal tulis');
    expect(revalidateTag).toHaveBeenCalledWith('pameran');
  });
});
