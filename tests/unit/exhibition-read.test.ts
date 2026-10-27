// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }));

const media = { kind: 'site', url: 'https://demo.example/a', slides: [] };
const work = (o: Record<string, unknown>) => ({
  personUid: 'p1', cohort: 'web-smg', track: 'web', type: 'Landing Page', title: 'Karya', description: 'deskripsi panjang',
  tools: ['React'], status: 'published', aiAssisted: false, collectionId: null, cover: { thumb: 't.webp', full: 'f.webp' }, media, ...o,
});
const person = (o: Record<string, unknown>) => ({
  nickname: 'Adinda', cohort: 'web-smg', track: 'web', photoUrl: 'p.webp', mainWorkId: null, bio: 'bio panjang',
  skills: ['CSS'], linkedinUrl: '', portfolioUrl: '', visible: true, ...o,
});

// select() hanya menyisakan kolom yang diminta, supaya kebocoran kolom terlihat.
// select() keeps only the listed fields, so any extra-field leak shows up.
const data: Record<string, Record<string, Record<string, unknown>>> = {
  users: { p1: { name: 'Adinda Puan Maharani' } },
  exhibitionPeople: {
    p1: person({ mainWorkId: 'w1' }), p2: person({ nickname: '' }), p3: person({ nickname: 'Tanpa' }),
    'hidden-uid': person({ nickname: 'Rahasia', visible: false }),
  },
  exhibitionWorks: {
    w1: work({}), w2: work({ status: 'draft' }), w3: work({ status: 'hidden' }),
    'work-of-hidden': work({ personUid: 'hidden-uid' }), w5: work({ personUid: 'p2' }),
    w6: work({ collectionId: 'c1', type: 'Dashboard' }),
  },
  exhibitionCollections: {
    c1: { title: 'Koleksi', brief: 'brief', classId: 'k', cohort: 'web-smg', type: 'Dashboard', coverUrls: ['c.webp'] },
    c2: { title: 'Kosong', brief: '', classId: 'k', cohort: 'web-smg', type: 'Dashboard', coverUrls: [] },
  },
  exhibitionSite: {},
};

function pick(d: Record<string, unknown>, fields: string[]) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const [a, b] = f.split('.');
    if (!(a in d)) continue;
    if (b) out[a] = { ...(out[a] as object), [b]: (d[a] as Record<string, unknown>)[b] };
    else out[a] = d[a];
  }
  return out;
}
function query(name: string, filters: [string, unknown][] = [], fields: string[] | null = null) {
  return {
    where: (f: string, _op: string, v: unknown) => query(name, [...filters, [f, v]], fields),
    select: (...f: string[]) => query(name, filters, f),
    get: async () => {
      const docs = Object.entries(data[name] ?? {})
        .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
        .map(([id, d]) => ({ id, data: () => (fields ? pick(d, fields) : d) }));
      return { docs, empty: docs.length === 0 };
    },
  };
}
vi.mock('../../src/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    collection: (name: string) => ({
      ...query(name),
      doc: (id: string) => ({ get: async () => ({ id, exists: !!data[name]?.[id], data: () => data[name]?.[id] }) }),
    }),
  }),
}));

import { getCatalog, getCollectionDetail, getPersonDetail, getSiteContent, getWorkDetail, todayWib } from '../../src/features/exhibition/read';

describe('modul baca pameran', () => {
  it('katalog hanya memuat karya terbit milik peserta yang tampil', async () => {
    const c = await getCatalog();
    expect(c.cards.map((x) => x.id).sort()).toEqual(['w1', 'w5', 'w6']);
    expect(c.cards.find((x) => x.id === 'w1')).toMatchObject({ nickname: 'Adinda', thumb: 't.webp', personUid: 'p1' });
  });
  it('tidak ada nama lengkap atau kolom panjang di katalog', async () => {
    const json = JSON.stringify(await getCatalog());
    expect(json).not.toContain('Maharani');
    expect(json).not.toContain('description');
    expect(json).not.toContain('"bio"');
  });
  it('peserta disembunyikan: profil dan karyanya tidak dapat dibuka', async () => {
    expect(await getPersonDetail('hidden-uid')).toBeNull();
    expect(await getWorkDetail('work-of-hidden')).toBeNull();
    expect(await getWorkDetail('w2')).toBeNull();
  });
  it('nickname kosong ditampilkan sebagai Peserta', async () => {
    const c = await getCatalog();
    expect(c.people.find((p) => p.uid === 'p2')?.nickname).toBe('Peserta');
    expect(c.cards.find((x) => x.id === 'w5')?.nickname).toBe('Peserta');
  });
  it('peserta tanpa karya tetap ada di katalog dengan workCount 0', async () => {
    const c = await getCatalog();
    expect(c.people.find((p) => p.uid === 'p3')).toMatchObject({ workCount: 0 });
    expect(c.people.find((p) => p.uid === 'p1')?.workCount).toBe(2);
  });
  it('koleksi tanpa anggota tampil dibuang, yang berisi dihitung', async () => {
    const c = await getCatalog();
    expect(c.collections).toEqual([{ id: 'c1', title: 'Koleksi', cohort: 'web-smg', type: 'Dashboard', coverUrls: ['c.webp'], count: 1, nicknames: ['Adinda'] }]);
  });
  it('detail karya, peserta, dan koleksi', async () => {
    const w = await getWorkDetail('w6');
    expect(w).toMatchObject({ description: 'deskripsi panjang', coverFull: 'f.webp', collection: { id: 'c1', title: 'Koleksi' } });
    const p = await getPersonDetail('p1');
    expect(p?.works.map((x) => x.id).sort()).toEqual(['w1', 'w6']);
    expect(JSON.stringify(p)).not.toContain('Maharani');
    const col = await getCollectionDetail('c1');
    expect(col?.versions[0]).toMatchObject({ id: 'w6', siteUrl: 'https://demo.example/a' });
  });
  it('konten situs memakai default bila dokumen belum ada', async () => {
    expect((await getSiteContent()).testiPlan.role).toBe('Yayasan Plan International Indonesia');
  });
  it('todayWib berbentuk YYYY-MM-DD', () => {
    expect(todayWib()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
