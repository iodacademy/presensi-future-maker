// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Firestore palsu: koleksi dalam memori, mencatat argumen select / Fake Firestore: in-memory collections, records select arguments
type Doc = Record<string, unknown>;
const data: Record<string, Record<string, Doc>> = {};
const selects: Record<string, string[][]> = {};
const getSessionActor = vi.fn();

function query(col: string, filters: [string, unknown][] = []) {
  const rows = () => Object.entries(data[col] ?? {}).filter(([, d]) => filters.every(([f, v]) => d[f] === v));
  const snap = () => ({ docs: rows().map(([id, d]) => ({ id, ref: { col, id }, data: () => d, get: (f: string) => d[f] })), size: rows().length, empty: rows().length === 0 });
  return {
    where: (f: string, _op: string, v: unknown) => query(col, [...filters, [f, v]]),
    select: (...fields: string[]) => { (selects[col] ??= []).push(fields); return { get: async () => snap() }; },
    limit: () => ({ get: async () => snap() }),
    count: () => ({ get: async () => ({ data: () => ({ count: rows().length }) }) }),
    get: async () => snap(),
  };
}

vi.mock('../../src/features/auth/session', () => ({ getSessionActor: () => getSessionActor() }));
vi.mock('../../src/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    batch: () => {
      const ops: (() => void)[] = [];
      return {
        update: (ref: { col: string; id: string }, d: Doc) => ops.push(() => { data[ref.col][ref.id] = { ...data[ref.col][ref.id], ...d }; }),
        commit: async () => ops.forEach((o) => o()),
      };
    },
    collection: (col: string) => ({
      ...query(col),
      add: async (d: Doc) => { data[col] ??= {}; const id = col + Object.keys(data[col]).length; data[col][id] = d; return { id }; },
      doc: (id: string) => ({
        col, id,
        get: async () => ({ id, exists: !!data[col]?.[id], data: () => data[col]?.[id] }),
        update: async (d: Doc) => { data[col][id] = { ...data[col][id], ...d }; },
        delete: async () => { delete data[col][id]; },
      }),
    }),
  }),
}));

import {
  createJob, createPartner, deleteJob, listJobs, portalStats, updateJob, updatePartner,
} from '../../src/features/careers/admin-service';
import { GET as jobsGet, POST as jobsPost } from '../../src/app/api/karier/jobs/route';

const partner = {
  name: 'PT DIPSI', field: 'Software house', about: '', logo: null, website: '',
  socials: { instagram: '', linkedin: '', tiktok: '', youtube: '' },
  pics: [{ name: 'Rina Kusuma', phone: '0812', email: 'rina@dipsi.co.id' }],
};
const job = {
  partnerId: 'p1', title: 'UI/UX Designer Intern', employment: 'magang-3', category: 'desain',
  location: 'Jakarta Selatan', workMode: 'hybrid', quota: 2, description: 'Panjang', qualifications: 'Figma',
  eligibility: { mode: 'all' }, opensAt: '2026-11-03T01:00:00.000Z', closesAt: '2026-11-12T16:59:00.000Z',
  documents: { portfolio: 'required', works: 'optional', coverLetter: 'off' }, questions: [], status: 'published',
};

beforeEach(() => {
  for (const k of Object.keys(data)) delete data[k];
  for (const k of Object.keys(selects)) delete selects[k];
  data.partners = { p1: { ...partner, nameKey: 'pt dipsi', active: true } };
  data.jobs = {};
  data.jobApplications = {};
  getSessionActor.mockResolvedValue({ role: 'admin' });
});

describe('layanan admin Job Portal', () => {
  it('menolak nama mitra yang sudah terdaftar walau beda huruf dan spasi', async () => {
    await expect(createPartner({ ...partner, name: ' pt  dipsi ' })).rejects.toThrow('Nama perusahaan sudah terdaftar');
  });

  it('mitra boleh disimpan ulang dengan namanya sendiri', async () => {
    await updatePartner('p1', { ...partner, about: 'Baru' });
    expect(data.partners.p1.about).toBe('Baru');
  });

  it('mitra baru tersimpan aktif dengan nameKey', async () => {
    const id = await createPartner({ ...partner, name: 'PT Mitra B' });
    expect(data.partners[id]).toMatchObject({ name: 'PT Mitra B', nameKey: 'pt mitra b', active: true });
  });

  it('lowongan baru menyalin nama mitra dan mulai dengan 0 pelamar', async () => {
    const id = await createJob(job);
    expect(data.jobs[id]).toMatchObject({ partnerName: 'PT DIPSI', applicantCount: 0, qualifications: ['Figma'] });
  });

  it('lowongan untuk mitra tak dikenal ditolak', async () => {
    await expect(createJob({ ...job, partnerId: 'x' })).rejects.toThrow('Mitra tidak ditemukan');
  });

  it('ganti nama mitra ikut memperbarui nama di lowongannya', async () => {
    data.jobs.j1 = { ...job, partnerName: 'PT DIPSI', applicantCount: 0 };
    data.jobs.j2 = { ...job, partnerId: 'p2', partnerName: 'Lain', applicantCount: 0 };
    await updatePartner('p1', { ...partner, name: 'PT DIPSI Indonesia' });
    expect(data.jobs.j1.partnerName).toBe('PT DIPSI Indonesia');
    expect(data.jobs.j2.partnerName).toBe('Lain');
  });

  it('lowongan yang sudah punya pelamar tidak bisa dihapus', async () => {
    data.jobs.j1 = { ...job, partnerName: 'PT DIPSI', applicantCount: 3 };
    await expect(deleteJob('j1')).rejects.toThrow('Lowongan yang sudah punya pelamar tidak bisa dihapus');
    data.jobs.j2 = { ...job, partnerName: 'PT DIPSI', applicantCount: 0 };
    await deleteJob('j2');
    expect(data.jobs.j2).toBeUndefined();
  });

  it('mitra lowongan yang sudah punya pelamar tidak bisa diganti', async () => {
    data.partners.p2 = { ...partner, name: 'PT B', nameKey: 'pt b', active: true };
    data.jobs.j1 = { ...job, partnerName: 'PT DIPSI', applicantCount: 1 };
    await expect(updateJob('j1', { ...job, partnerId: 'p2' })).rejects.toThrow('Mitra lowongan yang sudah punya pelamar tidak bisa diganti');
  });

  it('ubah lowongan mempertahankan id pertanyaan lama', async () => {
    data.jobs.j1 = { ...job, partnerName: 'PT DIPSI', applicantCount: 0 };
    await updateJob('j1', { ...job, questions: [{ id: 'q1', label: 'Kenapa?', kind: 'long', options: [], required: true }] });
    expect((data.jobs.j1.questions as { id: string }[])[0].id).toBe('q1');
  });

  it('daftar lowongan tidak mengambil teks panjang', async () => {
    data.jobs.j1 = { ...job, partnerName: 'PT DIPSI', applicantCount: 0 };
    const rows = await listJobs();
    expect(rows[0]).toMatchObject({ id: 'j1', title: 'UI/UX Designer Intern', picName: 'Rina Kusuma' });
    const fields = selects.jobs.flat();
    expect(fields).not.toContain('description');
    expect(fields).not.toContain('qualifications');
    expect(fields).not.toContain('questions');
  });

  it('ringkasan menghitung lowongan aktif, pelamar, mitra, dan interview', async () => {
    data.jobs.j1 = { ...job, partnerName: 'PT DIPSI', applicantCount: 14 };
    data.jobs.j2 = { ...job, status: 'draft', partnerName: 'PT DIPSI', applicantCount: 0 };
    data.jobs.j3 = { ...job, closesAt: '2026-11-04T00:00:00.000Z', partnerName: 'PT DIPSI', applicantCount: 6 };
    data.jobApplications = { a1: { status: 'interview' }, a2: { status: 'baru' } };
    const s = await portalStats(new Date('2026-11-05T00:00:00Z'));
    expect(s).toEqual({ activeJobs: 1, applicants: 20, partners: 1, interviews: 1 });
  });

  it('selain admin ditolak 403', async () => {
    getSessionActor.mockResolvedValue({ role: 'student' });
    expect((await jobsGet()).status).toBe(403);
    expect((await jobsPost(new Request('http://x', { method: 'POST', body: JSON.stringify(job) }))).status).toBe(403);
  });
});
