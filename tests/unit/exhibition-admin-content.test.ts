// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Firestore palsu / Fake Firestore
const data: Record<string, Record<string, Record<string, unknown>>> = {};
const revalidateTag = vi.fn();
const getSessionActor = vi.fn();

vi.mock('next/cache', () => ({ revalidateTag: (t: string) => revalidateTag(t), unstable_cache: (fn: unknown) => fn }));
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: () => getSessionActor() }));
vi.mock('../../src/lib/firebase/admin', () => {
  const docRef = (col: string, id: string) => ({
    col, id,
    get: async () => ({ id, exists: !!data[col]?.[id], data: () => data[col]?.[id] }),
    update: async (d: Record<string, unknown>) => { data[col][id] = { ...data[col][id], ...d }; },
    set: async (d: Record<string, unknown>, opts?: { merge?: boolean }) => {
      data[col] ??= {};
      data[col][id] = opts?.merge ? { ...data[col][id], ...d } : d;
    },
  });
  return {
    getAdminDb: () => ({
      getAll: async (...refs: { col: string; id: string }[]) => refs.filter((r) => r.id).map((r) => ({ id: r.id, exists: !!data[r.col]?.[r.id], data: () => data[r.col]?.[r.id] })),
      collection: (col: string) => ({
        select: () => ({ get: async () => ({ docs: Object.entries(data[col] ?? {}).map(([id, d]) => ({ id, data: () => d })) }) }),
        add: async (d: Record<string, unknown>) => { data[col] ??= {}; const id = 'new' + Object.keys(data[col]).length; data[col][id] = d; return { id }; },
        doc: (id: string) => docRef(col, id),
      }),
    }),
  };
});

import {
  createCollection, listCollections, listPeople, updateCollection, updatePerson, updateSiteContent,
} from '../../src/features/exhibition/admin-content';
import { GET as peopleGet } from '../../src/app/api/pameran/people/route';
import { GET as personGet, PATCH as personPatch } from '../../src/app/api/pameran/people/[uid]/route';
import { GET as siteGet, PATCH as sitePatch } from '../../src/app/api/pameran/site/route';

beforeEach(() => {
  revalidateTag.mockClear();
  data.users = { s1: { name: 'Nur Aini Putri', email: 'x@y' }, s2: { name: 'Budi Santoso' } };
  data.exhibitionPeople = {
    s1: { nickname: 'Nur', cohort: 'web-smg', visible: true, photoUrl: 'p', mainWorkId: 'w1' },
    s2: { nickname: 'Budi', cohort: 'web-smg', visible: false, photoUrl: '', mainWorkId: null },
  };
  data.exhibitionWorks = { w1: { personUid: 's1', collectionId: 'c1' }, w2: { personUid: 's1', collectionId: null }, 'work-of-s2': { personUid: 's2' } };
  data.exhibitionCollections = { c1: { title: 'K', brief: '', cohort: 'web-smg', type: 'Capstone', coverUrls: [] } };
  data.exhibitionSite = { content: { photos: { a: 'x' } } };
  getSessionActor.mockResolvedValue({ role: 'admin' });
});

describe('API admin peserta, koleksi, konten situs', () => {
  it('nama panggilan kosong ditolak', async () => {
    await expect(updatePerson('s1', { nickname: ' ' })).rejects.toThrow(/nama panggilan/i);
  });
  it('nama panggilan dengan spasi diterima dan dipangkas', async () => {
    await updatePerson('s1', { nickname: ' Nur Aini ' });
    expect(data.exhibitionPeople.s1.nickname).toBe('Nur Aini');
    expect(revalidateTag).toHaveBeenCalledWith('pameran');
  });
  it('tautan peserta non-http(s) ditolak / non-http(s) person links are rejected', async () => {
    for (const k of ['photoUrl', 'linkedinUrl', 'portfolioUrl']) {
      await expect(updatePerson('s1', { [k]: 'javascript:alert(1)' } as never)).rejects.toThrow(/http/i);
    }
    await updatePerson('s1', { linkedinUrl: 'https://linkedin.com/in/x', portfolioUrl: '' });
    expect(data.exhibitionPeople.s1.linkedinUrl).toBe('https://linkedin.com/in/x');
  });
  it('karya utama harus milik peserta itu', async () => {
    await expect(updatePerson('s1', { mainWorkId: 'work-of-s2' })).rejects.toThrow();
    await updatePerson('s1', { mainWorkId: 'w2' });
    expect(data.exhibitionPeople.s1.mainWorkId).toBe('w2');
  });
  it('peserta menolak kunci di luar daftar izin, array, dan patch kosong', async () => {
    for (const p of [{ cohort: 'x' }, { classId: 'x' }, {}, [{ visible: true }]]) {
      await expect(updatePerson('s1', p as never)).rejects.toThrow();
    }
    expect(data.exhibitionPeople.s1.cohort).toBe('web-smg');
  });
  it('daftar peserta admin memuat nama lengkap dan jumlah karya', async () => {
    const rows = await listPeople();
    expect(rows.find((r) => r.uid === 's1')).toMatchObject({ fullName: 'Nur Aini Putri', nickname: 'Nur', workCount: 2 });
  });
  it('daftar peserta hanya untuk admin', async () => {
    getSessionActor.mockResolvedValue({ role: 'student' });
    expect((await peopleGet()).status).toBe(403);
    expect((await personPatch(new Request('http://x', { method: 'PATCH', body: '{}' }), { params: Promise.resolve({ uid: 's1' }) })).status).toBe(403);
  });
  it('koleksi: hitung karya, validasi kohor dan jenis', async () => {
    expect((await listCollections())[0]).toMatchObject({ id: 'c1', count: 1 });
    const base = { title: 'B', brief: '', classId: 'k', cohort: 'web-smg', type: 'Capstone', coverUrls: [] };
    const id = await createCollection(base);
    expect(data.exhibitionCollections[id].title).toBe('B');
    await expect(createCollection({ ...base, cohort: 'zzz' })).rejects.toThrow();
    await expect(createCollection({ ...base, type: 'Reels' })).rejects.toThrow();
  });
  it('updateCollection hanya title, brief, coverUrls', async () => {
    await updateCollection('c1', { title: 'Baru' });
    expect(data.exhibitionCollections.c1.title).toBe('Baru');
    await expect(updateCollection('c1', { cohort: 'x' } as never)).rejects.toThrow('tidak boleh diubah');
  });
  it('konten situs disimpan dengan merge dan divalidasi', async () => {
    await updateSiteContent({ testiPeserta: [{ uid: 'u1', headline: ' Bisa ', quote: 'Bagus' }] });
    expect(data.exhibitionSite.content).toEqual({ photos: { a: 'x' }, testiPeserta: [{ uid: 'u1', headline: 'Bisa', quote: 'Bagus', video: '' }] });
    expect(revalidateTag).toHaveBeenCalledWith('pameran');
    await expect(updateSiteContent({ foo: 1 } as never)).rejects.toThrow('tidak boleh diubah');
    await expect(updateSiteContent({ photos: null } as never)).rejects.toThrow();
    await updateSiteContent({ captions: { 'doc-1': 'Hari pertama' } });
    expect(data.exhibitionSite.content.captions).toEqual({ 'doc-1': 'Hari pertama' });
    await expect(updateSiteContent({ captions: null } as never)).rejects.toThrow();
    await expect(updateSiteContent({ testiTrainer: {} } as never)).rejects.toThrow();
    const res = await sitePatch(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ photos: [] }) }));
    expect(res.status).toBe(400);
  });
  it('testimoni peserta ditolak bila bentuknya salah atau videonya bukan http(s)', async () => {
    await expect(updateSiteContent({ testiPeserta: { s1: 'bagus' } } as never)).rejects.toThrow();
    await expect(updateSiteContent({ testiPeserta: [{ uid: '', headline: 'a', quote: 'b' }] })).rejects.toThrow('butuh peserta');
    await expect(updateSiteContent({ testiPeserta: [{ uid: 'u1', headline: 'a', quote: 'b', video: 'javascript:alert(1)' }] })).rejects.toThrow('http');
    await expect(updateSiteContent({ testiAuthors: {} } as never)).rejects.toThrow('tidak boleh diubah');
  });
  it('GET situs: bawaan bila belum ada dokumen, isi tersimpan bila ada', async () => {
    delete data.exhibitionSite.content;
    const def = await (await siteGet()).json();
    expect(def.content.testiPlan.role).toBe('Yayasan Plan International Indonesia');
    data.exhibitionSite.content = { testiPlan: { name: 'N', role: 'Peran', quote: 'q' } };
    const got = await (await siteGet()).json();
    expect(got.content.testiPlan.role).toBe('Peran');
    expect(got.content.photos).toBeDefined();
  });

  it('GET peserta mengembalikan bio tersimpan untuk admin, 403 untuk non-admin, 404 bila tidak ada', async () => {
    data.exhibitionPeople.s1.bio = 'Bio Nur';
    const ctx = (uid: string) => ({ params: Promise.resolve({ uid }) });
    const ok = await personGet(new Request('http://x'), ctx('s1'));
    expect((await ok.json()).person).toMatchObject({ uid: 's1', bio: 'Bio Nur' });
    expect((await personGet(new Request('http://x'), ctx('nope'))).status).toBe(404);
    getSessionActor.mockResolvedValue({ role: 'student' });
    expect((await personGet(new Request('http://x'), ctx('s1'))).status).toBe(403);
  });
});
